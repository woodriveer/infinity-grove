using System;
using UnityEngine;
using UnityEngine.UI;

public class Monster : MonoBehaviour
{
    public event Action OnDeath;
    public event Action<int, int> OnHpChanged; // current, max

    public int CurrentHp  { get; private set; }
    public int MaxHp      { get; private set; }
    public int GoldReward { get; private set; }

    private Image _image;

    private void Awake()
    {
        _image = GetComponent<Image>();
    }

    public void Initialize(MonsterData data)
    {
        MaxHp      = data.maxHp;
        CurrentHp  = data.maxHp;
        GoldReward = UnityEngine.Random.Range(data.goldMin, data.goldMax + 1);

        if (_image != null && data.sprite != null)
            _image.sprite = data.sprite;

        OnHpChanged?.Invoke(CurrentHp, MaxHp);
    }

    public void TakeDamage(int amount)
    {
        if (CurrentHp == 0) return;
        CurrentHp = Mathf.Max(0, CurrentHp - amount);
        OnHpChanged?.Invoke(CurrentHp, MaxHp);
        if (CurrentHp == 0)
            OnDeath?.Invoke();
    }
}
