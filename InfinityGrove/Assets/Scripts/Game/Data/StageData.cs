using InfinityGrove.Domain;
using UnityEngine;

/// <summary>
/// Design-time definition of one stage's rotating type modifier and power
/// requirement (PRD FR-10/FR-11/FR-15).
/// </summary>
[CreateAssetMenu(fileName = "New Stage", menuName = "Infinity Grove/Stage Data")]
public class StageData : ScriptableObject
{
    public int stageNumber = 1;
    public string displayName;

    [Tooltip("The hero type favored by this stage. A squad without this type is a Composition Mismatch risk.")]
    public HeroType favoredType;

    [Tooltip("Minimum total Active Squad power required to avoid a Power Gate failure, regardless of composition.")]
    public int powerFloor = 100;
}
