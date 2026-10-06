import { PlayerProgressReplay } from '../../domain/PlayerProgressReplay';
import type { PlayerEventRecord } from '../../domain/PlayerEventRecord';
import { PlayerStateSnapshot } from '../../domain/PlayerStateSnapshot';
import type { SaveGameData } from '../../domain/SaveGameData';
import { CombatService } from '../combat/CombatService';
import type { ContentCatalog } from '../content/ContentLoader';
import { bigToInt } from '../core';
import { PlayerEventLog } from '../events/PlayerEventLog';
import { RosterService } from '../roster/RosterService';
import type { GameState } from './types';

/** An empty game, before any save is loaded. */
export function emptyGameState(): GameState {
  return {
    canonical: PlayerStateSnapshot.empty(),
    lastReconciledAtMs: 0,
    steamId64: '',
    gold: 0,
    furthestStageCleared: 0,
    heroes: [],
    activeSquad: [],
    combat: CombatService.initial(),
    krellEquipmentId: null,
    equipment: { bag: [], equippedByHero: {} },
    presets: [],
    lastStageAttempt: null,
    eventLog: PlayerEventLog.empty(),
    sync: { authenticated: false, online: false, lastSyncAtMs: 0, inFlight: false },
    notices: [],
  };
}

/** Projects unsynced events onto the reconciled snapshot (PORT_MAP B4): a prediction only. */
export function project(canonical: PlayerStateSnapshot, pending: readonly PlayerEventRecord[]): PlayerStateSnapshot {
  const events = pending.map((e) => ({
    clientEventId: e.clientEventId,
    sequenceNumber: e.sequenceNumber,
    type: e.type,
    payload: JSON.parse(e.payloadJson) as unknown,
  }));
  return PlayerProgressReplay.ingestBatch(PlayerProgressReplay.newLedger(canonical), events).ledger.state;
}

/**
 * Unity ApplyStateToLiveServices: sets gold, stage progress, roster and squad from a
 * snapshot, with no events (reconciliation is silent). Heroes the backend does not
 * know stay as they are; backend star tiers are 0-based, client tiers 1-based.
 */
export function applySnapshotToLive(s: GameState, snap: PlayerStateSnapshot, content: ContentCatalog): GameState {
  let next: GameState = { ...s, gold: bigToInt(PlayerStateSnapshot.gold(snap)), furthestStageCleared: snap.furthestStageCleared };
  for (const entry of snap.roster) {
    const data = content.heroByServerId(entry.heroDefinitionId);
    if (data) next = RosterService.reconcileHero(next, data.heroId, entry.ownedCount, entry.starTier + 1);
  }
  const squad = snap.activeSquadHeroIds
    .map((id) => content.heroByServerId(id)?.heroId)
    .filter((id): id is string => id !== undefined);
  return RosterService.reconcileActiveSquad(next, squad);
}

/** Live state from a save: reconciled state + projected pending events + local-only progress. */
export function stateFromSave(save: SaveGameData, content: ContentCatalog): GameState {
  const base = emptyGameState();
  let log = PlayerEventLog.seedSequence(base.eventLog, save.nextSequenceNumber);
  log = PlayerEventLog.seedSequence(log, save.lastReconciledState.lastAppliedSequence + 1);
  log = PlayerEventLog.loadPending(log, save.unsyncedEvents);
  const s: GameState = {
    ...base,
    canonical: save.lastReconciledState,
    lastReconciledAtMs: save.lastReconciledAtMs,
    steamId64: save.steamId64,
    krellEquipmentId: save.local.krellEquipmentId,
    equipment: { bag: save.local.equipmentBag, equippedByHero: save.local.equippedByHero },
    presets: save.local.presets,
    eventLog: log,
  };
  return applySnapshotToLive(s, project(save.lastReconciledState, save.unsyncedEvents), content);
}

/** The save envelope for the current state (AD-12). */
export function saveFromState(s: GameState, nowMs: number): SaveGameData {
  return {
    formatVersion: 1,
    steamId64: s.steamId64,
    lastReconciledAtMs: s.lastReconciledAtMs,
    lastSeenAtMs: nowMs,
    lastReconciledState: s.canonical,
    unsyncedEvents: s.eventLog.pending,
    nextSequenceNumber: s.eventLog.nextSequenceNumber,
    local: {
      equipmentBag: s.equipment.bag,
      equippedByHero: s.equipment.equippedByHero,
      presets: s.presets,
      krellEquipmentId: s.krellEquipmentId,
    },
  };
}
