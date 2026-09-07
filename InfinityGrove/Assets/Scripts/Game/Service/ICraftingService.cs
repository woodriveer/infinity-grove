using InfinityGrove.Domain;

namespace InfinityGrove.Service
{
    /// <summary>Affix re-rolling for one equipped or bagged item (PRD FR-22).</summary>
    public interface ICraftingService
    {
        CraftingPreview GetPreview(EquipmentInstance item, AffixType affix);

        /// <summary>Deducts gold and rolls a new value for the affix. Returns false if the player can't afford it.</summary>
        bool TryReroll(EquipmentInstance item, AffixType affix);
    }
}
