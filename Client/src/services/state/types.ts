import type { CombatState } from '../../domain/CombatState';
import type { EquipmentInstance } from '../../domain/EquipmentInstance';
import type { EquipmentSlot } from '../../domain/EquipmentSlot';
import type { HeroEntity } from '../../domain/HeroEntity';
import type { LoadoutPreset } from '../../domain/LoadoutPreset';
import type { MonsterEntity } from '../../domain/MonsterEntity';
import type { PlayerEventRecord } from '../../domain/PlayerEventRecord';
import type { PlayerStateSnapshot } from '../../domain/PlayerStateSnapshot';
import type { StageOutcome } from '../../domain/StageOutcome';

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

  readonly combat: CombatSnapshot;
  /** Krell's weapon (Unity EquipmentService.Current). */
  readonly krellEquipmentId: string | null;
  readonly equipment: EquipmentState;
  readonly presets: readonly LoadoutPreset[];
  readonly lastStageAttempt: { readonly stageId: string; readonly outcome: StageOutcome } | null;

  readonly eventLog: EventLogState;
  readonly sync: SyncStatus;
  /** Player-facing notices not yet dismissed (offline summary, sync corrections). */
  readonly notices: readonly Notice[];
}

export interface CombatSnapshot {
  readonly state: CombatState;
  readonly started: boolean;
  readonly walkElapsedMs: number;
  readonly monster: MonsterEntity | null;
  readonly kills: number;
  /** Increments on every player attack, so views can play the punch even when damage is clamped. */
  readonly attackCount: number;
  readonly lastDamage: number;
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
