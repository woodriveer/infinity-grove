import type { EquipmentInstance } from '../../domain/EquipmentInstance';
import type { EquipmentSlot } from '../../domain/EquipmentSlot';
import type { ServiceDeps } from '../core';

/** Shared bag + per-hero 4-slot loadout (P6, Unity EquipmentInventoryService). Local only. */
export class EquipmentInventoryService {
  constructor(private readonly deps: ServiceDeps) {}

  bag(): readonly EquipmentInstance[] {
    return this.deps.store.get().equipment.bag;
  }

  /** Creates a new instance of an item template and puts it in the bag. */
  addNewToBag(itemId: string): EquipmentInstance {
    this.deps.content.item(itemId);
    const item: EquipmentInstance = { instanceId: this.deps.ids.next().replace(/-/g, ''), itemId, affixRolls: {} };
    this.addToBag(item);
    return item;
  }

  addToBag(item: EquipmentInstance): void {
    const s = this.deps.store.get();
    this.deps.store.commit({ ...s, equipment: { ...s.equipment, bag: [...s.equipment.bag, item] } });
  }

  getEquipped(heroId: string): Readonly<Partial<Record<EquipmentSlot, EquipmentInstance>>> {
    return this.deps.store.get().equipment.equippedByHero[heroId] ?? {};
  }

  /** TryEquip: moves the item out of the bag; a previous item in that slot goes back to the bag. */
  tryEquip(heroId: string, instanceId: string): boolean {
    const s = this.deps.store.get();
    const item = s.equipment.bag.find((i) => i.instanceId === instanceId);
    if (heroId === '' || !item) return false;
    const slot = this.deps.content.item(item.itemId).slot;
    const slots = { ...(s.equipment.equippedByHero[heroId] ?? {}) };
    let bag = s.equipment.bag.filter((i) => i !== item);
    const previous = slots[slot];
    if (previous) bag = [...bag, previous];
    slots[slot] = item;
    this.deps.store.commit({
      ...s,
      equipment: { bag, equippedByHero: { ...s.equipment.equippedByHero, [heroId]: slots } },
    });
    return true;
  }

  unequip(heroId: string, slot: EquipmentSlot): void {
    const s = this.deps.store.get();
    const slots = s.equipment.equippedByHero[heroId];
    const item = slots?.[slot];
    if (!slots || !item) return;
    const rest = { ...slots };
    delete rest[slot];
    this.deps.store.commit({
      ...s,
      equipment: { bag: [...s.equipment.bag, item], equippedByHero: { ...s.equipment.equippedByHero, [heroId]: rest } },
    });
  }

  /** Replaces an instance wherever it lives (bag or equipped), e.g. after a server re-roll. */
  replaceInstance(updated: EquipmentInstance): void {
    const s = this.deps.store.get();
    const bag = s.equipment.bag.map((i) => (i.instanceId === updated.instanceId ? updated : i));
    const equippedByHero = Object.fromEntries(
      Object.entries(s.equipment.equippedByHero).map(([hero, slots]) => [
        hero,
        Object.fromEntries(Object.entries(slots).map(([slot, i]) => [slot, i?.instanceId === updated.instanceId ? updated : i])),
      ]),
    );
    this.deps.store.commit({ ...s, equipment: { bag, equippedByHero } });
  }

  findInstance(instanceId: string): EquipmentInstance | null {
    const s = this.deps.store.get();
    const inBag = s.equipment.bag.find((i) => i.instanceId === instanceId);
    if (inBag) return inBag;
    for (const slots of Object.values(s.equipment.equippedByHero)) {
      for (const i of Object.values(slots)) if (i?.instanceId === instanceId) return i;
    }
    return null;
  }
}
