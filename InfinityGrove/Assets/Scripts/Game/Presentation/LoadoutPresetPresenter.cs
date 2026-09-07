using InfinityGrove.Domain;
using InfinityGrove.Service;
using UnityEngine;
using VContainer;

namespace InfinityGrove.Presentation
{
    /// <summary>
    /// Loadout preset screen (PRD FR-21): save the selected hero's current gear
    /// as an archetype preset, or apply a saved preset back. Applying is a
    /// two-step confirm so the swap stays reversible before it commits (FR-21 AC).
    /// </summary>
    public class LoadoutPresetPresenter : MonoBehaviour
    {
        private static readonly Archetype[] Archetypes = { Archetype.Strength, Archetype.Intelligence, Archetype.Agility };

        [Header("Containers")]
        [SerializeField] private Transform _heroSelectContainer;
        [SerializeField] private Transform _presetActionsContainer;
        [SerializeField] private Transform _confirmContainer;

        private IRosterService _rosterService;
        private ILoadoutPresetService _loadoutPresetService;
        private HeroEntity _selectedHero;
        private Archetype? _pendingApply;

        [Inject]
        public void Construct(IRosterService rosterService, ILoadoutPresetService loadoutPresetService)
        {
            _rosterService = rosterService;
            _loadoutPresetService = loadoutPresetService;
        }

        private void OnEnable()
        {
            UiFactory.PrepareListContainer(_heroSelectContainer);
            UiFactory.PrepareListContainer(_presetActionsContainer);
            UiFactory.PrepareListContainer(_confirmContainer);

            _rosterService.OnRosterChanged += RefreshHeroSelect;
            RefreshHeroSelect();
        }

        private void OnDisable()
        {
            _rosterService.OnRosterChanged -= RefreshHeroSelect;
        }

        private void RefreshHeroSelect()
        {
            UiFactory.ClearChildren(_heroSelectContainer);

            foreach (var hero in _rosterService.AllHeroes)
            {
                var row = UiFactory.CreateRow(_heroSelectContainer, hero.Data.displayName);
                UiFactory.CreateLabel(row, hero.Data.displayName, 22);
                UiFactory.CreateButton(row, "Select", () => Select(hero));
            }

            if (_selectedHero == null && _rosterService.AllHeroes.Count > 0)
                Select(_rosterService.AllHeroes[0]);
            else
                RefreshActions();
        }

        private void Select(HeroEntity hero)
        {
            _selectedHero = hero;
            _pendingApply = null;
            RefreshActions();
        }

        private void RefreshActions()
        {
            UiFactory.ClearChildren(_presetActionsContainer);
            UiFactory.ClearChildren(_confirmContainer);

            if (_selectedHero == null)
            {
                UiFactory.CreateLabel(_presetActionsContainer, "No hero selected.");
                return;
            }

            UiFactory.CreateLabel(_presetActionsContainer, $"Presets for {_selectedHero.Data.displayName}", 24);

            foreach (var archetype in Archetypes)
            {
                var row = UiFactory.CreateRow(_presetActionsContainer, archetype.ToString());
                UiFactory.CreateLabel(row, archetype.ToString(), 20);
                UiFactory.CreateButton(row, "Save", () => SavePreset(archetype));

                bool hasPreset = _loadoutPresetService.GetPreset(archetype, _selectedHero.Data.heroId) != null;
                UiFactory.CreateButton(row, "Apply", () => RequestApply(archetype), hasPreset);
            }
        }

        private void SavePreset(Archetype archetype)
        {
            _loadoutPresetService.SavePreset(archetype, _selectedHero.Data.heroId);
            RefreshActions();
        }

        private void RequestApply(Archetype archetype)
        {
            _pendingApply = archetype;

            UiFactory.ClearChildren(_confirmContainer);
            UiFactory.CreateLabel(_confirmContainer, $"Apply {archetype} preset to {_selectedHero.Data.displayName}? This re-equips all 4 slots.", 20);
            UiFactory.CreateButton(_confirmContainer, "Confirm", ConfirmApply);
            UiFactory.CreateButton(_confirmContainer, "Cancel", CancelApply);
        }

        private void ConfirmApply()
        {
            if (_pendingApply.HasValue && _selectedHero != null)
                _loadoutPresetService.TryApplyPreset(_pendingApply.Value, _selectedHero.Data.heroId);

            _pendingApply = null;
            UiFactory.ClearChildren(_confirmContainer);
        }

        private void CancelApply()
        {
            _pendingApply = null;
            UiFactory.ClearChildren(_confirmContainer);
        }
    }
}
