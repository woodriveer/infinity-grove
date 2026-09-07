using System;
using System.Collections.Generic;

namespace InfinityGrove.Domain
{
    /// <summary>
    /// One rolled, ownable copy of an <see cref="EquipmentItemData"/> template
    /// (PRD FR-19/FR-22). Lives either in the shared account bag or equipped on
    /// exactly one hero's slot, never both (FR-20).
    /// </summary>
    public class EquipmentInstance
    {
        public string InstanceId { get; }
        public EquipmentItemData Data { get; }
        private readonly Dictionary<AffixType, float> _affixRolls = new Dictionary<AffixType, float>();

        public IReadOnlyDictionary<AffixType, float> AffixRolls => _affixRolls;

        public EquipmentInstance(EquipmentItemData data, string instanceId = null)
        {
            Data = data;
            InstanceId = string.IsNullOrEmpty(instanceId) ? Guid.NewGuid().ToString("N") : instanceId;
        }

        public float GetAffix(AffixType affix) => _affixRolls.TryGetValue(affix, out var value) ? value : 0f;

        public void SetAffix(AffixType affix, float value) => _affixRolls[affix] = value;
    }
}
