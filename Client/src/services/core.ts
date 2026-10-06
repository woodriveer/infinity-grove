import { BigDouble } from '../domain/bignum/BigDouble';
import { tryGetServerHeroId } from '../domain/HeroData';
import type { PlayerEventType } from '../domain/PlayerEventType';
import type { Rng } from '../domain/rng';
import { uuidV4 } from '../domain/rng';
import type { ContentCatalog } from './content/ContentLoader';
import { PlayerEventLog } from './events/PlayerEventLog';
import type { PayloadOf } from './events/payloads';
import type { Clock, Logger } from './ports';
import type { GameStore } from './state/GameStore';
import type { GameState } from './state/types';

/** clientEventId / instance id source: UUIDv4 drawn from the seeded Rng (AD-6). */
export interface IdGenerator {
  next(): string;
}

export function rngIdGenerator(rng: Rng): IdGenerator {
  return { next: () => uuidV4(rng) };
}

/** What every service command needs. */
export interface ServiceDeps {
  readonly store: GameStore;
  readonly clock: Clock;
  readonly rng: Rng;
  readonly ids: IdGenerator;
  readonly content: ContentCatalog;
  readonly logger: Logger;
}

/** Appends one event to the state's log (AD-5 step 3). */
export function withEvent<T extends PlayerEventType>(deps: ServiceDeps, s: GameState, type: T, payload: PayloadOf<T>): GameState {
  const { log } = PlayerEventLog.append(s.eventLog, type, payload, deps.ids.next(), deps.clock.nowMs());
  return { ...s, eventLog: log };
}

/**
 * Gold change + its event, as Unity SaveSyncService.HandleGoldChanged did:
 * a positive delta is GoldEarned, a negative one GoldSpent, both as big numbers.
 */
export function withGold(deps: ServiceDeps, s: GameState, newGold: number): GameState {
  const gold = Math.max(0, Math.min(2147483647, Math.trunc(newGold)));
  const delta = gold - s.gold;
  if (delta === 0) return s;
  const next = { ...s, gold };
  const big = BigDouble.fromDouble(Math.abs(delta));
  return withEvent(deps, next, delta > 0 ? 'GoldEarned' : 'GoldSpent', { goldMantissa: big.mantissa, goldExponent: big.exponent });
}

/**
 * ActiveSquadChanged when the squad *set* changed (Unity HandleRosterChanged), only
 * if every hero maps to a backend GUID; otherwise the change stays local (logged).
 */
export function withSquadEvent(deps: ServiceDeps, before: GameState, after: GameState): GameState {
  const a = new Set(before.activeSquad);
  const b = new Set(after.activeSquad);
  if (a.size === b.size && [...a].every((x) => b.has(x))) return after;
  const ids: string[] = [];
  for (const heroId of after.activeSquad) {
    const serverId = tryGetServerHeroId(deps.content.hero(heroId));
    if (!serverId) {
      deps.logger.warn(`Active Squad contains '${heroId}' with no serverHeroId mapping; the squad change will not sync.`);
      return after;
    }
    ids.push(serverId);
  }
  return withEvent(deps, after, 'ActiveSquadChanged', { heroDefinitionIds: ids });
}

/** Unity ConvertToInt: big-number gold to the int the combat loop keeps. */
export function bigToInt(value: BigDouble): number {
  const d = value.toDouble();
  if (Number.isNaN(d) || d <= 0) return 0;
  if (d >= 2147483647) return 2147483647;
  return roundHalfEven(d);
}

/** .NET Math.Round(double): ties to even. */
function roundHalfEven(d: number): number {
  const f = Math.floor(d);
  const diff = d - f;
  if (diff > 0.5) return f + 1;
  if (diff < 0.5) return f;
  return f % 2 === 0 ? f : f + 1;
}
