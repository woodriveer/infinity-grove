import { BigDouble } from './bignum/BigDouble';
import { PlayerStateSnapshot } from './PlayerStateSnapshot';
import type { RosterEntrySnapshot } from './RosterEntrySnapshot';

/**
 * Pure mirror of the backend's event replay: PlayerEventIngestionService.IngestAsync
 * plus the PlayerProgress rules it applies (Backend Application/Domain). The client
 * uses it as a *prediction* (S2): to project its unsynced events onto the last
 * reconciled state, so local play stays visible across restarts while offline.
 * The backend stays the authority; shared/test-vectors/event-validation.json
 * proves this mirror accepts, rejects and words reasons exactly as it does.
 *
 * Payloads arrive as parsed JSON and are read with System.Text.Json semantics
 * (case-insensitive names, missing members default, wrong JSON kinds are
 * "Malformed <Type> payload.").
 */

export const ACTIVE_SQUAD_CAPACITY = 5;

export interface IngestEvent {
  readonly clientEventId: string;
  readonly sequenceNumber: number;
  readonly type: string;
  readonly payload: unknown;
}

export interface IngestResult {
  readonly clientEventId: string;
  readonly status: 'Accepted' | 'Rejected';
  readonly rejectionReason: string | null;
}

/** Backend-side account state: the canonical snapshot plus every event verdict on record. */
export interface ProgressLedger {
  readonly state: PlayerStateSnapshot;
  readonly verdicts: Readonly<Record<string, { status: 'Accepted' | 'Rejected'; rejectionReason: string | null }>>;
}

export class EventValidationError extends Error {
  override readonly name = 'EventValidationException';
}

export const PlayerProgressReplay = {
  newLedger(state: PlayerStateSnapshot = PlayerStateSnapshot.empty()): ProgressLedger {
    return { state, verdicts: {} };
  },

  /** IngestAsync: events in sequence order; resends report the prior verdict; stale sequences are accepted no-ops. */
  ingestBatch(ledger: ProgressLedger, events: readonly IngestEvent[]): { ledger: ProgressLedger; results: IngestResult[] } {
    let state = ledger.state;
    const verdicts = { ...ledger.verdicts };
    const results: IngestResult[] = [];
    const ordered = [...events].sort((a, b) => a.sequenceNumber - b.sequenceNumber);
    for (const incoming of ordered) {
      const id = incoming.clientEventId.toLowerCase();
      const existing = verdicts[id];
      if (existing) {
        results.push({ clientEventId: id, status: existing.status, rejectionReason: existing.rejectionReason });
        continue;
      }
      if (incoming.sequenceNumber <= state.lastAppliedSequence) {
        results.push({ clientEventId: id, status: 'Accepted', rejectionReason: null });
        continue;
      }
      try {
        state = PlayerProgressReplay.applyEvent(state, incoming.type, incoming.payload);
        state = advanceSequence(state, incoming.sequenceNumber);
        verdicts[id] = { status: 'Accepted', rejectionReason: null };
        results.push({ clientEventId: id, status: 'Accepted', rejectionReason: null });
      } catch (e) {
        if (!(e instanceof EventValidationError)) throw e;
        state = advanceSequence(state, incoming.sequenceNumber);
        verdicts[id] = { status: 'Rejected', rejectionReason: e.message };
        results.push({ clientEventId: id, status: 'Rejected', rejectionReason: e.message });
      }
    }
    return { ledger: { state, verdicts }, results };
  },

  /** Applies one event's rules; throws EventValidationError when the backend would reject it. */
  applyEvent(state: PlayerStateSnapshot, type: string, payload: unknown): PlayerStateSnapshot {
    switch (type) {
      case 'GoldEarned': {
        const p = readObject(payload, 'GoldEarned');
        const amount = new BigDouble(readDouble(p, 'goldMantissa', 'GoldEarned'), readInt(p, 'goldExponent', 'GoldEarned'));
        if (amount.sign() < 0) throw new EventValidationError('Gold earned amount must not be negative.');
        return setGold(state, PlayerStateSnapshot.gold(state).add(amount));
      }
      case 'GoldSpent': {
        const p = readObject(payload, 'GoldSpent');
        const amount = new BigDouble(readDouble(p, 'goldMantissa', 'GoldSpent'), readInt(p, 'goldExponent', 'GoldSpent'));
        if (amount.sign() < 0) throw new EventValidationError('Gold spent amount must not be negative.');
        const gold = PlayerStateSnapshot.gold(state);
        if (gold.lt(amount)) {
          throw new EventValidationError(`Insufficient gold: have ${gold.toString()}, need ${amount.toString()}.`);
        }
        return setGold(state, gold.sub(amount));
      }
      case 'StageCleared': {
        const p = readObject(payload, 'StageCleared');
        const stageNumber = readInt(p, 'stageNumber', 'StageCleared');
        if (stageNumber < 1) throw new EventValidationError('Stage number must be positive.');
        if (stageNumber > state.furthestStageCleared + 1) {
          throw new EventValidationError(`Cannot clear stage ${stageNumber} before stage ${state.furthestStageCleared + 1}.`);
        }
        return stageNumber > state.furthestStageCleared ? { ...state, furthestStageCleared: stageNumber } : state;
      }
      case 'HeroAcquired': {
        const p = readObject(payload, 'HeroAcquired');
        const heroId = readGuid(p, 'heroDefinitionId', 'HeroAcquired');
        const index = state.roster.findIndex((r) => r.heroDefinitionId === heroId);
        const roster: RosterEntrySnapshot[] = [...state.roster];
        if (index < 0) roster.push({ heroDefinitionId: heroId, ownedCount: 1, starTier: 0 });
        else {
          const entry = roster[index] as RosterEntrySnapshot;
          roster[index] = { ...entry, ownedCount: entry.ownedCount + 1 };
        }
        return { ...state, roster };
      }
      case 'ActiveSquadChanged': {
        const p = readObject(payload, 'ActiveSquadChanged');
        const ids = readGuidList(p, 'heroDefinitionIds', 'ActiveSquadChanged');
        if (ids === null) {
          throw new EventValidationError('Malformed ActiveSquadChanged payload: heroDefinitionIds is required.');
        }
        if (ids.length > ACTIVE_SQUAD_CAPACITY) {
          throw new EventValidationError(`Active squad cannot exceed ${ACTIVE_SQUAD_CAPACITY} heroes.`);
        }
        if (new Set(ids).size !== ids.length) {
          throw new EventValidationError('Active squad cannot contain the same hero twice.');
        }
        for (const id of ids) {
          if (state.roster.every((r) => r.heroDefinitionId !== id)) {
            throw new EventValidationError(`Hero ${id} is not owned and cannot join the active squad.`);
          }
        }
        return { ...state, activeSquadHeroIds: ids };
      }
      default:
        throw new EventValidationError(`Unknown event type: ${type}`);
    }
  },
} as const;

function advanceSequence(state: PlayerStateSnapshot, sequenceNumber: number): PlayerStateSnapshot {
  return sequenceNumber > state.lastAppliedSequence ? { ...state, lastAppliedSequence: sequenceNumber } : state;
}

function setGold(state: PlayerStateSnapshot, gold: BigDouble): PlayerStateSnapshot {
  return { ...state, goldMantissa: gold.mantissa, goldExponent: gold.exponent };
}

// ---------- System.Text.Json-like payload reading ----------

type Obj = Record<string, unknown>;

function malformed(typeName: string): EventValidationError {
  return new EventValidationError(`Malformed ${typeName} payload.`);
}

function readObject(payload: unknown, typeName: string): Obj {
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) throw malformed(typeName);
  return payload as Obj;
}

/** Case-insensitive member lookup; undefined when absent. */
function member(o: Obj, name: string): unknown {
  const lower = name.toLowerCase();
  let found: unknown = undefined;
  for (const [k, v] of Object.entries(o)) if (k.toLowerCase() === lower) found = v;
  return found;
}

function readDouble(o: Obj, name: string, typeName: string): number {
  const v = member(o, name);
  if (v === undefined) return 0;
  if (typeof v !== 'number') throw malformed(typeName);
  return v;
}

function readInt(o: Obj, name: string, typeName: string): number {
  const v = member(o, name);
  if (v === undefined) return 0;
  if (typeof v !== 'number' || !Number.isInteger(v) || v > 2147483647 || v < -2147483648) throw malformed(typeName);
  return v;
}

const GUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const EMPTY_GUID = '00000000-0000-0000-0000-000000000000';

function readGuid(o: Obj, name: string, typeName: string): string {
  const v = member(o, name);
  if (v === undefined) return EMPTY_GUID;
  if (typeof v !== 'string' || !GUID.test(v)) throw malformed(typeName);
  return v.toLowerCase();
}

function readGuidList(o: Obj, name: string, typeName: string): string[] | null {
  const v = member(o, name);
  if (v === undefined || v === null) return null;
  if (!Array.isArray(v)) throw malformed(typeName);
  return v.map((item) => {
    if (typeof item !== 'string' || !GUID.test(item)) throw malformed(typeName);
    return item.toLowerCase();
  });
}
