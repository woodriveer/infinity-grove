import type { Equipment } from '../../domain/content/types';
import type { ServiceDeps } from '../core';

/** Krell's equipped weapon (Unity EquipmentService). Client-only; no event. */
export class EquipmentService {
  constructor(private readonly deps: ServiceDeps) {}

  current(): Equipment | null {
    const id = this.deps.store.get().krellEquipmentId;
    return id === null ? null : this.deps.content.equipmentById(id);
  }

  equip(equipmentId: string): void {
    if (!this.deps.content.equipmentById(equipmentId)) return;
    const s = this.deps.store.get();
    this.deps.store.commit({ ...s, krellEquipmentId: equipmentId });
  }

  unequip(): void {
    const s = this.deps.store.get();
    this.deps.store.commit({ ...s, krellEquipmentId: null });
  }
}
