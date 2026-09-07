using System;

namespace InfinityGrove.Domain
{
    /// <summary>
    /// Pure crafting/enchanting math (PRD FR-22/FR-23). Which affixes are legal
    /// per slot is fixed by design (FR-22); exact costs/ranges are a tuning
    /// deliverable per FR-23 and isolated here so tuning can replace the numbers
    /// without touching Service/Presentation.
    /// </summary>
    public static class CraftingRules
    {
        public static AffixType[] AffixesForSlot(EquipmentSlot slot)
        {
            switch (slot)
            {
                case EquipmentSlot.Weapon:
                    return new[] { AffixType.CritChance, AffixType.AttackPercent, AffixType.CritDamage };
                case EquipmentSlot.Chest:
                    return new[] { AffixType.Defense };
                case EquipmentSlot.Boots:
                    return new[] { AffixType.Speed };
                case EquipmentSlot.Gloves:
                    return new[] { AffixType.Precision };
                default:
                    throw new ArgumentOutOfRangeException(nameof(slot), slot, null);
            }
        }

        public static (float min, float max) AffixRange(AffixType affix)
        {
            switch (affix)
            {
                case AffixType.CritChance: return (1f, 25f);
                case AffixType.AttackPercent: return (1f, 50f);
                case AffixType.CritDamage: return (5f, 100f);
                case AffixType.Defense: return (1f, 40f);
                case AffixType.Speed: return (1f, 30f);
                case AffixType.Precision: return (1f, 30f);
                default: throw new ArgumentOutOfRangeException(nameof(affix), affix, null);
            }
        }

        public const int RerollCost = 50;
    }
}
