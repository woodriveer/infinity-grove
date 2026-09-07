using System;
using System.Collections.Generic;
using System.Linq;
using InfinityGrove.Domain;

namespace InfinityGrove.Service
{
    /// <summary>
    /// A bag item is never equipped to more than one hero at a time: equipping
    /// removes it from the bag, unequipping returns it (PRD FR-20).
    /// </summary>
    public class EquipmentInventoryService : IEquipmentInventoryService
    {
        private readonly List<EquipmentInstance> _bag = new List<EquipmentInstance>();
        private readonly Dictionary<string, Dictionary<EquipmentSlot, EquipmentInstance>> _equippedByHero =
            new Dictionary<string, Dictionary<EquipmentSlot, EquipmentInstance>>();

        public IReadOnlyList<EquipmentInstance> Bag => _bag;

        public event Action OnBagChanged;
        public event Action<string> OnEquippedChanged;

        public void AddToBag(EquipmentInstance item)
        {
            if (item == null) return;

            _bag.Add(item);
            OnBagChanged?.Invoke();
        }

        public IReadOnlyDictionary<EquipmentSlot, EquipmentInstance> GetEquipped(string heroId)
        {
            return _equippedByHero.TryGetValue(heroId, out var slots)
                ? slots
                : new Dictionary<EquipmentSlot, EquipmentInstance>();
        }

        public bool TryEquip(string heroId, EquipmentInstance item)
        {
            if (string.IsNullOrEmpty(heroId) || item == null || !_bag.Contains(item)) return false;

            if (!_equippedByHero.TryGetValue(heroId, out var slots))
            {
                slots = new Dictionary<EquipmentSlot, EquipmentInstance>();
                _equippedByHero[heroId] = slots;
            }

            _bag.Remove(item);

            if (slots.TryGetValue(item.Data.slot, out var previous))
                _bag.Add(previous);

            slots[item.Data.slot] = item;

            OnBagChanged?.Invoke();
            OnEquippedChanged?.Invoke(heroId);
            return true;
        }

        public void Unequip(string heroId, EquipmentSlot slot)
        {
            if (!_equippedByHero.TryGetValue(heroId, out var slots) || !slots.TryGetValue(slot, out var item)) return;

            slots.Remove(slot);
            _bag.Add(item);

            OnBagChanged?.Invoke();
            OnEquippedChanged?.Invoke(heroId);
        }
    }
}
