/** Pure damage rules (Unity DamageCalculator). */
export const DamageCalculator = {
  calculatePlayerDamage(level: number, damagePerLevel: number, equipmentBonusDamage: number): number {
    const damage = toInt32(level * damagePerLevel + equipmentBonusDamage);
    return Math.max(1, damage);
  },
} as const;

function toInt32(n: number): number {
  return Math.trunc(n) | 0;
}
