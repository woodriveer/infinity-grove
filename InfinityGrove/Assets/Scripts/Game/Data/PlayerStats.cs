using UnityEngine;

[CreateAssetMenu(fileName = "Player Stats", menuName = "Infinity Grove/Player Stats")]
public class PlayerStats : ScriptableObject
{
    public int level = 1;
    public int damagePerLevel = 5;
}
