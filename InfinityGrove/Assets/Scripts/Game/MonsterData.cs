using UnityEngine;

[CreateAssetMenu(fileName = "New Monster", menuName = "Infinity Grove/Monster Data")]
public class MonsterData : ScriptableObject
{
    public string monsterName;
    public Sprite sprite;
    public int maxHp;
    public int goldMin;
    public int goldMax;
}
