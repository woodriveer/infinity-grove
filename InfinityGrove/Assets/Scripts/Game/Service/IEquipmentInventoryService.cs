using System;
using System.Collections.Generic;
using InfinityGrove.Domain;

namespace InfinityGrove.Service
{
    /// <summary>
    /// The shared account-wide equipment bag plus each hero's 4-slot equipped
    /// loadout (PRD FR-19/FR-20).
    /// </summary>
    public interface IEquipmentInventoryService
    {
        IReadOnlyList<EquipmentInstance> Bag { get; }

        event Action OnBagChanged;
        event Action<string> OnEquippedChanged; // heroId

        void AddToBag(EquipmentInstance item);

        IReadOnlyDictionary<EquipmentSlot, EquipmentInstance> GetEquipped(string heroId);

        /// <summary>Equips a bag item to the given hero/slot, returning any previously equipped item to the bag (PRD FR-20 AC).</summary>
        bool TryEquip(string heroId, EquipmentInstance item);

        void Unequip(string heroId, EquipmentSlot slot);
    }
}
