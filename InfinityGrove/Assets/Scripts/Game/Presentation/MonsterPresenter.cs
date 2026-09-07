using InfinityGrove.Domain;
using InfinityGrove.Service;
using UnityEngine;
using UnityEngine.UI;
using VContainer;

namespace InfinityGrove.Presentation
{
    /// <summary>
    /// Visual-only view of the current monster encounter. Shows/hides itself and
    /// updates its sprite by reacting to ICombatService events; it never owns HP
    /// or gold logic (that lives in the Domain/Service layers).
    /// </summary>
    [RequireComponent(typeof(Image))]
    public class MonsterPresenter : MonoBehaviour
    {
        private Image _image;
        private ICombatService _combatService;
        private MonsterEntity _currentMonster;

        [Inject]
        public void Construct(ICombatService combatService)
        {
            _combatService = combatService;
        }

        private void Awake()
        {
            _image = GetComponent<Image>();
        }

        private void OnEnable()
        {
            _combatService.OnMonsterSpawned += HandleMonsterSpawned;
            _combatService.OnWalkingChanged += HandleWalkingChanged;
        }

        private void OnDisable()
        {
            _combatService.OnMonsterSpawned -= HandleMonsterSpawned;
            _combatService.OnWalkingChanged -= HandleWalkingChanged;
            UnsubscribeCurrentMonster();
        }

        private void HandleWalkingChanged(bool isWalking)
        {
            if (!isWalking) return;

            UnsubscribeCurrentMonster();
            gameObject.SetActive(false);
        }

        private void HandleMonsterSpawned(MonsterEntity monster)
        {
            UnsubscribeCurrentMonster();

            _currentMonster = monster;
            _currentMonster.OnHpChanged += HandleHpChanged;

            if (_image != null && monster.Sprite != null)
                _image.sprite = monster.Sprite;

            gameObject.SetActive(true);
        }

        private void HandleHpChanged(int current, int max)
        {
            // Reserved for a health bar view once one exists in the UI.
        }

        private void UnsubscribeCurrentMonster()
        {
            if (_currentMonster == null) return;

            _currentMonster.OnHpChanged -= HandleHpChanged;
            _currentMonster = null;
        }
    }
}
