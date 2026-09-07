using System;
using UnityEngine;

namespace InfinityGrove.Domain
{
    /// <summary>
    /// Pure runtime state/rules for a single monster encounter, independent of any
    /// MonoBehaviour. Presentation reads this via events; it never owns HP itself.
    /// </summary>
    public class MonsterEntity
    {
        public string Name { get; }
        public Sprite Sprite { get; }
        public int MaxHp { get; }
        public int CurrentHp { get; private set; }
        public int GoldReward { get; }

        public event Action<int, int> OnHpChanged; // current, max
        public event Action OnDefeated;

        public MonsterEntity(string name, Sprite sprite, int maxHp, int goldReward)
        {
            Name = name;
            Sprite = sprite;
            MaxHp = maxHp;
            CurrentHp = maxHp;
            GoldReward = goldReward;
        }

        public void TakeDamage(int amount)
        {
            if (CurrentHp == 0) return;

            CurrentHp = Mathf.Max(0, CurrentHp - amount);
            OnHpChanged?.Invoke(CurrentHp, MaxHp);

            if (CurrentHp == 0)
                OnDefeated?.Invoke();
        }
    }
}
