using InfinityGrove.Domain;
using UnityEngine;

/// <summary>
/// Design-time base template for a droppable/craftable gear item (PRD FR-19).
/// Rolled affix values live on the runtime <see cref="InfinityGrove.Domain.EquipmentInstance"/>,
/// never on this shared asset.
/// </summary>
[CreateAssetMenu(fileName = "New Equipment Item", menuName = "Infinity Grove/Equipment Item Data")]
public class EquipmentItemData : ScriptableObject
{
    public string itemId;
    public string displayName;
    public EquipmentSlot slot;
    public Archetype archetype;
    public Sprite icon;
}
