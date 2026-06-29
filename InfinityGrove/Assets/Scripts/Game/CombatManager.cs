using System;
using System.Collections;
using UnityEngine;

public class CombatManager : MonoBehaviour
{
    [SerializeField] private KrellController _krell;
    [SerializeField] private Monster _monster;
    [SerializeField] private MonsterData[] _monsterPool;

    public event Action<int> OnGoldChanged;

    public int Gold { get; private set; }

    private enum State { Walking, Fighting }
    private State _state;

    private void Start()
    {
        StartWalking();
    }

    public void OnPlayerAttack(int damage)
    {
        if (_state != State.Fighting) return;
        _monster.TakeDamage(damage);
    }

    private void StartWalking()
    {
        _state = State.Walking;
        _monster.gameObject.SetActive(false);
        _krell.SetWalking(true);
        StartCoroutine(WalkRoutine());
    }

    private IEnumerator WalkRoutine()
    {
        yield return new WaitForSeconds(2f);
        SpawnMonster();
    }

    private void SpawnMonster()
    {
        var data = _monsterPool[UnityEngine.Random.Range(0, _monsterPool.Length)];
        _monster.Initialize(data);
        _monster.gameObject.SetActive(true);
        _monster.OnDeath += HandleMonsterDeath;

        _krell.SetWalking(false);
        _state = State.Fighting;
    }

    private void HandleMonsterDeath()
    {
        _monster.OnDeath -= HandleMonsterDeath;
        Gold += _monster.GoldReward;
        OnGoldChanged?.Invoke(Gold);
        StartWalking();
    }
}
