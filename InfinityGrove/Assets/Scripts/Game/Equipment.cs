using UnityEngine;

[CreateAssetMenu(fileName = "New Equipment", menuName = "Infinity Grove/Equipment")]
public class Equipment : ScriptableObject
{
    public string itemName;

    [Tooltip("Value sent to the Animator's ItemID parameter. 0 = none, 1 = WCLAW01.")]
    public int animatorItemID;
}
