import type { Archetype } from './Archetype';
import type { EquipmentSlot } from './EquipmentSlot';

/** A saved per-archetype gear snapshot for one hero (FR-21). */
export interface LoadoutPreset {
  readonly archetype: Archetype;
  readonly heroId: string;
  readonly instanceIdBySlot: Readonly<Partial<Record<EquipmentSlot, string>>>;
}

export function newLoadoutPreset(archetype: Archetype, heroId: string): LoadoutPreset {
  return { archetype, heroId, instanceIdBySlot: {} };
}

/** Last write wins per slot. */
export function setSlot(preset: LoadoutPreset, slot: EquipmentSlot, instanceId: string): LoadoutPreset {
  return { ...preset, instanceIdBySlot: { ...preset.instanceIdBySlot, [slot]: instanceId } };
}

export function tryGetSlot(preset: LoadoutPreset, slot: EquipmentSlot): string | null {
  return preset.instanceIdBySlot[slot] ?? null;
}
