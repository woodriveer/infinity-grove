import { DamageCalculator } from '../../domain/DamageCalculator';
import type { ServiceDeps } from '../core';
import type { EquipmentService } from '../equipment/EquipmentService';

/** Krell's click damage with equipment bonus (P3, Unity PlayerCombatService). */
export class PlayerCombatService {
  constructor(
    private readonly deps: ServiceDeps,
    private readonly equipment: EquipmentService,
  ) {}

  calculateAttackDamage(): number {
    const stats = this.deps.content.settings.playerStats;
    const bonus = this.equipment.current()?.bonusDamage ?? 0;
    return DamageCalculator.calculatePlayerDamage(stats.level, stats.damagePerLevel, bonus);
  }
}
