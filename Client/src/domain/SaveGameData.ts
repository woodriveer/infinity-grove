import type { EquipmentInstance } from './EquipmentInstance';
import type { EquipmentSlot } from './EquipmentSlot';
import type { LoadoutPreset } from './LoadoutPreset';
import type { PlayerEventRecord } from './PlayerEventRecord';
import { PlayerStateSnapshot } from './PlayerStateSnapshot';

/**
 * The local save envelope (ARCHITECTURE AD-12; Unity SaveGameData). A cache, never
 * authority: the last state reconciled with the backend, the events not yet
 * confirmed, and the timestamps that drive Steam Cloud resolution (AD-20) and
 * offline accrual (FR-41). New format (PRD S1): Unity saves are not read.
 */
export interface SaveGameData {
  readonly formatVersion: number;
  /** Empty until the first successful Steam auth exchange. */
  readonly steamId64: string;
  /** Client clock time of the last backend-confirmed state; 0 if never synced. */
  readonly lastReconciledAtMs: number;
  /** FR-41: offline accrual on next launch is computed from this. */
  readonly lastSeenAtMs: number;
  readonly lastReconciledState: PlayerStateSnapshot;
  /** Events appended locally that the backend has not confirmed yet. */
  readonly unsyncedEvents: readonly PlayerEventRecord[];
  readonly nextSequenceNumber: number;
  /**
   * Client-only progress the backend does not model yet (equipment bag, loadouts,
   * presets, Krell's weapon). The Unity client kept these in memory only; they are
   * persisted locally so fixtures can describe them (RFR-14). Not synced.
   */
  readonly local: LocalProgress;
}

export interface LocalProgress {
  readonly equipmentBag: readonly EquipmentInstance[];
  readonly equippedByHero: Readonly<Record<string, Readonly<Partial<Record<EquipmentSlot, EquipmentInstance>>>>>;
  readonly presets: readonly LoadoutPreset[];
  readonly krellEquipmentId: string | null;
}

export const SaveGameData = {
  CurrentFormatVersion: 1,

  createNew(nowMs: number, krellEquipmentId: string | null): SaveGameData {
    return {
      formatVersion: SaveGameData.CurrentFormatVersion,
      steamId64: '',
      lastReconciledAtMs: 0,
      lastSeenAtMs: nowMs,
      lastReconciledState: PlayerStateSnapshot.empty(),
      unsyncedEvents: [],
      nextSequenceNumber: 1,
      local: {
        equipmentBag: [],
        equippedByHero: {},
        presets: [],
        krellEquipmentId,
      },
    };
  },
} as const;
