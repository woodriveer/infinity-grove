using System;
using InfinityGrove.Domain;

namespace InfinityGrove.Service
{
    public interface ICombatService
    {
        int Gold { get; }

        event Action<int> OnGoldChanged;
        event Action<bool> OnWalkingChanged; // true = walking/searching, false = fighting
        event Action<MonsterEntity> OnMonsterSpawned;

        void Begin();
        void PlayerAttack(int damage);

        /// <summary>Deducts gold for a non-combat purchase (e.g. crafting) if the balance allows it.</summary>
        bool TrySpendGold(int amount);

        /// <summary>Credits gold from a source outside combat (PRD FR-41 offline accrual). Amount must not be negative.</summary>
        void AddGold(int amount);

        /// <summary>Force-sets the gold balance to a server-authoritative value (AD-6 reconciliation correction). Never used by normal gameplay.</summary>
        void SetGold(int amount);
    }
}
