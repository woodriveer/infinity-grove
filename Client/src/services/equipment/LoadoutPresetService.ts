import type { Archetype } from '../../domain/Archetype';
import { EQUIPMENT_SLOTS } from '../../domain/EquipmentSlot';
import { newLoadoutPreset, setSlot, type LoadoutPreset } from '../../domain/LoadoutPreset';
import type { ServiceDeps } from '../core';
import type { EquipmentInventoryService } from './EquipmentInventoryService';

/** Per-archetype loadout presets (P8, Unity LoadoutPresetService). Local only. */
export class LoadoutPresetService {
  constructor(
    private readonly deps: ServiceDeps,
    private readonly inventory: EquipmentInventoryService,
  ) {}

  /** Snapshots what the hero has equipped now. */
  savePreset(archetype: Archetype, heroId: string): void {
    let preset = newLoadoutPreset(archetype, heroId);
    const equipped = this.inventory.getEquipped(heroId);
    for (const slot of EQUIPMENT_SLOTS) {
      const item = equipped[slot];
      if (item) preset = setSlot(preset, slot, item.instanceId);
    }
    const s = this.deps.store.get();
    const others = s.presets.filter((p) => !(p.archetype === archetype && p.heroId === heroId));
    this.deps.store.commit({ ...s, presets: [...others, preset] });
  }

  getPreset(archetype: Archetype, heroId: string): LoadoutPreset | null {
    return this.deps.store.get().presets.find((p) => p.archetype === archetype && p.heroId === heroId) ?? null;
  }

  /** Re-equips every slot whose saved item is still in the bag. */
  tryApplyPreset(archetype: Archetype, heroId: string): boolean {
    const preset = this.getPreset(archetype, heroId);
    if (!preset) return false;
    for (const slot of EQUIPMENT_SLOTS) {
      const instanceId = preset.instanceIdBySlot[slot];
      if (instanceId && this.inventory.bag().some((i) => i.instanceId === instanceId)) {
        this.inventory.tryEquip(heroId, instanceId);
      }
    }
    return true;
  }
}
