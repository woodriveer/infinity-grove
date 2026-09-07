using System;
using InfinityGrove.Domain;

namespace InfinityGrove.Service
{
    /// <summary>Save/apply archetype loadout presets per hero (PRD FR-21).</summary>
    public interface ILoadoutPresetService
    {
        event Action<string> OnPresetsChanged; // heroId

        /// <summary>Snapshots the hero's currently equipped items into a preset for this archetype.</summary>
        void SavePreset(Archetype archetype, string heroId);

        LoadoutPreset GetPreset(Archetype archetype, string heroId);

        /// <summary>
        /// Re-equips all 4 slots from the saved preset where a matching bag item still
        /// exists (PRD FR-21 AC). Returns false if no preset was saved for this archetype/hero.
        /// </summary>
        bool TryApplyPreset(Archetype archetype, string heroId);
    }
}
