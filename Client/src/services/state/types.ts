import type { Encounter } from '../../domain/combat/CombatRules';
import type { EquipmentInstance } from '../../domain/EquipmentInstance';
import type { EquipmentSlot } from '../../domain/EquipmentSlot';
import type { HeroEntity } from '../../domain/HeroEntity';
import type { LoadoutPreset } from '../../domain/LoadoutPreset';
import type { PlayerEventRecord } from '../../domain/PlayerEventRecord';
import type { PlayerStateSnapshot } from '../../domain/PlayerStateSnapshot';

/**
 * The whole game state as one immutable snapshot (AD-5). Services are the only
 * writers (through GameStore.commit); presentation reads through ReadonlyStore.
 */
export interface GameState {
  /** Last state the backend confirmed (the save's lastReconciledState). */
  readonly canonical: PlayerStateSnapshot;
  readonly lastReconciledAtMs: number;
  readonly steamId64: string;

  /** Unity CombatService.Gold: an int, displayed in big-number notation. */
  readonly gold: number;
  readonly furthestStageCleared: number;
  /** All owned heroes, in acquisition order (Unity RosterService.AllHeroes). */
  readonly heroes: readonly HeroEntity[];
  /** Active Squad hero ids in slot order (cap 5). */
  readonly activeSquad: readonly string[];

  readonly stageCombat: StageCombatSnapshot;
  /** Krell's weapon (Unity EquipmentService.Current). */
  readonly krellEquipmentId: string | null;
  readonly equipment: EquipmentState;
  readonly presets: readonly LoadoutPreset[];

  readonly eventLog: EventLogState;
  readonly sync: SyncStatus;
  /** Player-facing notices not yet dismissed (offline summary, sync corrections). */
  readonly notices: readonly Notice[];
}

/** Continuous stage combat (stage-combat design). Only stageNumber and autoAdvance are persisted. */
export interface StageCombatSnapshot {
  /** The stage being fought, always <= furthestStageCleared + 1. */
  readonly stageNumber: number;
  readonly autoAdvance: boolean;
  /** Null until StageCombatService starts the stage (an encounter needs the squad and params). */
  readonly encounter: Encounter | null;
  readonly kills: number;
  /** Increments on every click so views can play the hit. */
  readonly clicks: number;
  /** Gold earned since the last GoldEarned flush. */
  readonly pendingIncome: number;
  readonly lastBossResult: { readonly stageNumber: number; readonly outcome: 'Success' | 'PowerGate' | 'CompositionMismatch' } | null;
}

export interface EquipmentState {
  readonly bag: readonly EquipmentInstance[];
  readonly equippedByHero: Readonly<Record<string, Readonly<Partial<Record<EquipmentSlot, EquipmentInstance>>>>>;
}

export interface EventLogState {
  /** Appended, not yet answered by the backend (Unity PlayerEventLog.PendingEvents). */
  readonly pending: readonly PlayerEventRecord[];
  readonly nextSequenceNumber: number;
}

export interface SyncStatus {
  readonly authenticated: boolean;
  /** False once a backend call failed; true again after one succeeds. */
  readonly online: boolean;
  readonly lastSyncAtMs: number;
  readonly inFlight: boolean;
  /** Transient: the backend answered `session-replaced` (the account signed in on another device). */
  readonly sessionReplaced: boolean;
}

export type Notice =
  | {
      readonly id: number;
      readonly kind: 'offline-accrual';
      readonly message: string;
      readonly goldAccrued: string;
      readonly hoursCredited: number;
      readonly wasCapped: boolean;
    }
  | { readonly id: number; readonly kind: 'correction'; readonly message: string };

export type Listener = (state: GameState, previous: GameState) => void;

/** What presentation gets: read and subscribe, never commit (AD-5). */
export interface ReadonlyStore {
  get(): GameState;
  subscribe(listener: Listener): () => void;
  /** Calls onChange whenever selector's result changes (Object.is). */
  select<T>(selector: (s: GameState) => T, onChange: (value: T) => void): () => void;
}
