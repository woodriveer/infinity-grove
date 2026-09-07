using System;
using System.Collections.Generic;
using System.Linq;
using InfinityGrove.Domain;

namespace InfinityGrove.Service
{
    /// <summary>
    /// A preset only records instance ids; applying it is a live re-check against
    /// the current bag, not a re-grant of items (PRD FR-21 AC: "where matching
    /// items exist in the bag").
    /// </summary>
    public class LoadoutPresetService : ILoadoutPresetService
    {
        private readonly IEquipmentInventoryService _equipmentInventoryService;
        private readonly Dictionary<(Archetype, string), LoadoutPreset> _presets = new Dictionary<(Archetype, string), LoadoutPreset>();

        public event Action<string> OnPresetsChanged;

        public LoadoutPresetService(IEquipmentInventoryService equipmentInventoryService)
        {
            _equipmentInventoryService = equipmentInventoryService;
        }

        public void SavePreset(Archetype archetype, string heroId)
        {
            var preset = new LoadoutPreset(archetype, heroId);
            foreach (var kvp in _equipmentInventoryService.GetEquipped(heroId))
                preset.SetSlot(kvp.Key, kvp.Value.InstanceId);

            _presets[(archetype, heroId)] = preset;
            OnPresetsChanged?.Invoke(heroId);
        }

        public LoadoutPreset GetPreset(Archetype archetype, string heroId) =>
            _presets.TryGetValue((archetype, heroId), out var preset) ? preset : null;

        public bool TryApplyPreset(Archetype archetype, string heroId)
        {
            var preset = GetPreset(archetype, heroId);
            if (preset == null) return false;

            foreach (var slotEntry in preset.InstanceIdBySlot)
            {
                var item = _equipmentInventoryService.Bag.FirstOrDefault(i => i.InstanceId == slotEntry.Value);
                if (item != null)
                    _equipmentInventoryService.TryEquip(heroId, item);
            }

            return true;
        }
    }
}
