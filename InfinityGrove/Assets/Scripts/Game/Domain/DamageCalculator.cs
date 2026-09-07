using System;

namespace InfinityGrove.Domain
{
    /// <summary>
    /// Pure damage-calculation rules, kept free of Unity/service concerns so they
    /// can be unit tested and reused (e.g. server-side validation later on).
    /// </summary>
    public static class DamageCalculator
    {
        public static int CalculatePlayerDamage(int level, int damagePerLevel, int equipmentBonusDamage)
        {
            int damage = level * damagePerLevel + equipmentBonusDamage;
            return Math.Max(1, damage);
        }
    }
}
