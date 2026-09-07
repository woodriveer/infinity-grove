using System.Collections.Generic;

namespace InfinityGrove.Domain
{
    /// <summary>
    /// A saved per-archetype gear snapshot for one hero (PRD FR-21): which bag
    /// item instance goes in each slot when the preset is applied.
    /// </summary>
    public class LoadoutPreset
    {
        public Archetype Archetype { get; }
        public string HeroId { get; }
        private readonly Dictionary<EquipmentSlot, string> _instanceIdBySlot = new Dictionary<EquipmentSlot, string>();

        public IReadOnlyDictionary<EquipmentSlot, string> InstanceIdBySlot => _instanceIdBySlot;

        public LoadoutPreset(Archetype archetype, string heroId)
        {
            Archetype = archetype;
            HeroId = heroId;
        }

        public void SetSlot(EquipmentSlot slot, string instanceId) => _instanceIdBySlot[slot] = instanceId;

        public bool TryGetSlot(EquipmentSlot slot, out string instanceId) => _instanceIdBySlot.TryGetValue(slot, out instanceId);
    }
}
