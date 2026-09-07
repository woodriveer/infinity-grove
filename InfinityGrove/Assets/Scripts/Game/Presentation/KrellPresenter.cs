using System.Collections;
using InfinityGrove.Service;
using UnityEngine;
using UnityEngine.EventSystems;
using VContainer;

namespace InfinityGrove.Presentation
{
    /// <summary>
    /// Presentation-only view of Krell: drives the Animator and reads click
    /// input, then hands off to injected services for anything that is actually
    /// gameplay logic (damage calculation, combat state, equipment).
    /// </summary>
    [RequireComponent(typeof(Animator))]
    public class KrellPresenter : MonoBehaviour, IPointerClickHandler
    {
        private Animator _animator;
        private Coroutine _punchRoutine;

        private ICombatService _combatService;
        private IPlayerCombatService _playerCombatService;
        private IEquipmentService _equipmentService;

        private static readonly int ParamItemID      = Animator.StringToHash("ItemID");
        private static readonly int ParamAttack      = Animator.StringToHash("Attack");
        private static readonly int ParamIsAttacking = Animator.StringToHash("IsAttacking");
        private static readonly int ParamIsWalking   = Animator.StringToHash("IsWalking");

        [Inject]
        public void Construct(ICombatService combatService, IPlayerCombatService playerCombatService, IEquipmentService equipmentService)
        {
            _combatService = combatService;
            _playerCombatService = playerCombatService;
            _equipmentService = equipmentService;
        }

        private void Awake()
        {
            _animator = GetComponent<Animator>();
        }

        private void OnEnable()
        {
            _combatService.OnWalkingChanged += HandleWalkingChanged;
            _equipmentService.OnEquipmentChanged += HandleEquipmentChanged;
        }

        private void OnDisable()
        {
            _combatService.OnWalkingChanged -= HandleWalkingChanged;
            _equipmentService.OnEquipmentChanged -= HandleEquipmentChanged;
        }

        private void Start()
        {
            ApplyEquipment(_equipmentService.Current);
        }

        public void OnPointerClick(PointerEventData eventData)
        {
            if (_punchRoutine != null)
                StopCoroutine(_punchRoutine);

            _animator.SetBool(ParamIsAttacking, true);
            _animator.SetTrigger(ParamAttack);
            _punchRoutine = StartCoroutine(WaitForPunchEnd());

            _combatService.PlayerAttack(_playerCombatService.CalculateAttackDamage());
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

        private void HandleWalkingChanged(bool isWalking)
        {
            _animator.SetBool(ParamIsWalking, isWalking);
        }

        private void HandleEquipmentChanged(Equipment item)
        {
            ApplyEquipment(item);
        }

        private void ApplyEquipment(Equipment item)
        {
            _animator.SetInteger(ParamItemID, item != null ? item.animatorItemID : 0);
        }
    }
}
