using System;
using System.Threading;
using System.Threading.Tasks;
using InfinityGrove.Domain;
using UnityEngine;
using Random = UnityEngine.Random;

namespace InfinityGrove.Service
{
    /// <summary>
    /// Orchestrates the walk/fight loop: picks the next monster, forwards player
    /// damage into it, and awards gold on death. Has no MonoBehaviour/scene
    /// dependency, so its timing runs independent of the frame loop.
    /// </summary>
    public class CombatService : ICombatService, IDisposable
    {
        private static readonly TimeSpan WalkDuration = TimeSpan.FromSeconds(2);

        private readonly MonsterData[] _monsterPool;
        private readonly CancellationTokenSource _cts = new CancellationTokenSource();

        private CombatState _state;
        private MonsterEntity _currentMonster;

        public int Gold { get; private set; }

        public event Action<int> OnGoldChanged;
        public event Action<bool> OnWalkingChanged;
        public event Action<MonsterEntity> OnMonsterSpawned;

        public CombatService(MonsterData[] monsterPool)
        {
            _monsterPool = monsterPool;
        }

        public void Begin()
        {
            StartWalking();
        }

        public void PlayerAttack(int damage)
        {
            if (_state != CombatState.Fighting || _currentMonster == null) return;
            _currentMonster.TakeDamage(damage);
        }

        public bool TrySpendGold(int amount)
        {
            if (amount < 0 || Gold < amount) return false;

            Gold -= amount;
            OnGoldChanged?.Invoke(Gold);
            return true;
        }

        public void AddGold(int amount)
        {
            if (amount <= 0) return;

            Gold += amount;
            OnGoldChanged?.Invoke(Gold);
        }

        public void SetGold(int amount)
        {
            if (amount == Gold) return;

            Gold = Math.Max(amount, 0);
            OnGoldChanged?.Invoke(Gold);
        }

        private async void StartWalking()
        {
            _state = CombatState.Walking;
            _currentMonster = null;
            OnWalkingChanged?.Invoke(true);

            try
            {
                await Task.Delay(WalkDuration, _cts.Token);
            }
            catch (TaskCanceledException)
            {
                return;
            }

            SpawnMonster();
        }

        private void SpawnMonster()
        {
            if (_monsterPool == null || _monsterPool.Length == 0)
            {
                Debug.LogWarning("CombatService has no monster pool configured; staying in walking state.");
                return;
            }

            var data = _monsterPool[Random.Range(0, _monsterPool.Length)];
            int goldReward = Random.Range(data.goldMin, data.goldMax + 1);

            _currentMonster = new MonsterEntity(data.monsterName, data.sprite, data.maxHp, goldReward);
            _currentMonster.OnDefeated += HandleMonsterDefeated;

            _state = CombatState.Fighting;
            OnWalkingChanged?.Invoke(false);
            OnMonsterSpawned?.Invoke(_currentMonster);
        }

        private void HandleMonsterDefeated()
        {
            _currentMonster.OnDefeated -= HandleMonsterDefeated;
            Gold += _currentMonster.GoldReward;
            OnGoldChanged?.Invoke(Gold);
            StartWalking();
        }

        public void Dispose()
        {
            _cts.Cancel();
            _cts.Dispose();
        }
    }
}
