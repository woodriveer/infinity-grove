using InfinityGrove.Domain;
using UnityEngine;

namespace InfinityGrove.Service
{
    /// <summary>
    /// Per Architecture AD-15, affix rolls happen only here (never predicted
    /// client-side) and gold is debited atomically with the roll.
    /// </summary>
    public class CraftingService : ICraftingService
    {
        private readonly ICombatService _combatService;

        public CraftingService(ICombatService combatService)
        {
            _combatService = combatService;
        }

        public CraftingPreview GetPreview(EquipmentInstance item, AffixType affix)
        {
            var (min, max) = CraftingRules.AffixRange(affix);
            return new CraftingPreview(affix, item.GetAffix(affix), min, max, CraftingRules.RerollCost);
        }

        public bool TryReroll(EquipmentInstance item, AffixType affix)
        {
            if (item == null) return false;
            if (!_combatService.TrySpendGold(CraftingRules.RerollCost)) return false;

            var (min, max) = CraftingRules.AffixRange(affix);
            item.SetAffix(affix, Random.Range(min, max));
            return true;
        }
    }
}
