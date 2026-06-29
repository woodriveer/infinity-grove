using System.Collections;
using UnityEngine;
using UnityEngine.EventSystems;

[RequireComponent(typeof(Animator))]
public class KrellController : MonoBehaviour, IPointerClickHandler
{
    [SerializeField] private Equipment _equippedItem;
    [SerializeField] private PlayerStats _playerStats;
    [SerializeField] private CombatManager _combatManager;

    private Animator _animator;
    private Coroutine _punchRoutine;

    private static readonly int ParamItemID      = Animator.StringToHash("ItemID");
    private static readonly int ParamAttack      = Animator.StringToHash("Attack");
    private static readonly int ParamIsAttacking = Animator.StringToHash("IsAttacking");
    private static readonly int ParamIsWalking   = Animator.StringToHash("IsWalking");

    private void Awake()
    {
        _animator = GetComponent<Animator>();
    }

    private void Start()
    {
        ApplyEquipment();
    }

    public void Equip(Equipment item)
    {
        _equippedItem = item;
        ApplyEquipment();
    }

    public void Unequip()
    {
        _equippedItem = null;
        ApplyEquipment();
    }

    public void SetWalking(bool walking)
    {
        _animator.SetBool(ParamIsWalking, walking);
    }

    public void OnPointerClick(PointerEventData eventData)
    {
        if (_punchRoutine != null)
            StopCoroutine(_punchRoutine);

        _animator.SetBool(ParamIsAttacking, true);
        _animator.SetTrigger(ParamAttack);
        _punchRoutine = StartCoroutine(WaitForPunchEnd());

        _combatManager?.OnPlayerAttack(CalculateDamage());
    }

    private IEnumerator WaitForPunchEnd()
    {
        yield return null;
        yield return null;

        while (_animator.GetCurrentAnimatorStateInfo(0).IsName("Punch - Empty") ||
               _animator.GetCurrentAnimatorStateInfo(0).IsName("Punch - WCLAW01"))
        {
            yield return null;
        }

        _animator.SetBool(ParamIsAttacking, false);
        _punchRoutine = null;
    }

    private int CalculateDamage()
    {
        int damage = _playerStats != null ? _playerStats.level * _playerStats.damagePerLevel : 0;
        damage += _equippedItem != null ? _equippedItem.bonusDamage : 0;
        return Mathf.Max(1, damage);
    }

    private void ApplyEquipment()
    {
        _animator.SetInteger(ParamItemID, _equippedItem != null ? _equippedItem.animatorItemID : 0);
    }

#if UNITY_EDITOR
    private void OnValidate()
    {
        if (_animator == null)
            _animator = GetComponent<Animator>();
        if (_animator != null)
            ApplyEquipment();
    }
#endif
}
