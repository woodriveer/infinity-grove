using InfinityGrove.Domain;
using InfinityGrove.Service;
using UnityEngine;
using VContainer;

namespace InfinityGrove.Presentation
{
    /// <summary>
    /// Fusion screen with star-tier preview (PRD FR-6 AC): lists owned heroes,
    /// and shows current tier / duplicates owned-vs-required / next-tier ability
    /// preview for whichever hero is selected.
    /// </summary>
    public class FusionPresenter : MonoBehaviour
    {
        [Header("Containers")]
        [SerializeField] private Transform _heroListContainer;
        [SerializeField] private Transform _previewContainer;

        private IRosterService _rosterService;
        private IFusionService _fusionService;
        private HeroEntity _selectedHero;

        [Inject]
        public void Construct(IRosterService rosterService, IFusionService fusionService)
        {
            _rosterService = rosterService;
            _fusionService = fusionService;
        }

        private void OnEnable()
        {
            UiFactory.PrepareListContainer(_heroListContainer);
            UiFactory.PrepareListContainer(_previewContainer);

            _rosterService.OnRosterChanged += RefreshList;
            RefreshList();
        }

        private void OnDisable()
        {
            _rosterService.OnRosterChanged -= RefreshList;
        }

        private void RefreshList()
        {
            UiFactory.ClearChildren(_heroListContainer);

            foreach (var hero in _rosterService.AllHeroes)
            {
                var row = UiFactory.CreateRow(_heroListContainer, hero.Data.displayName);
                UiFactory.CreateLabel(row, HeroTypeDisplay.Abbreviation(hero.Data.heroType), 20, HeroTypeDisplay.Color(hero.Data.heroType));
                UiFactory.CreateLabel(row, $"{hero.Data.displayName}  {hero.StarTier}★  (x{hero.DuplicatesOwned} dupes)", 22);
                UiFactory.CreateButton(row, "Select", () => Select(hero));
            }

            if (_selectedHero == null && _rosterService.AllHeroes.Count > 0)
                Select(_rosterService.AllHeroes[0]);
            else
                RefreshPreview();
        }

        private void Select(HeroEntity hero)
        {
            _selectedHero = hero;
            RefreshPreview();
        }

        private void RefreshPreview()
        {
            UiFactory.ClearChildren(_previewContainer);
            if (_selectedHero == null)
            {
                UiFactory.CreateLabel(_previewContainer, "No hero owned yet.");
                return;
            }

            var preview = _fusionService.GetPreview(_selectedHero);

            UiFactory.CreateLabel(_previewContainer, $"{_selectedHero.Data.displayName} - Tier {preview.CurrentStarTier}★", 28);
            UiFactory.CreateLabel(_previewContainer, preview.IsMaxTier
                ? "Max star tier reached (12★)."
                : $"Duplicates: {preview.DuplicatesOwned} / {preview.DuplicatesRequired} required for next tier", 22);
            UiFactory.CreateLabel(_previewContainer, $"Next ability: {preview.NextTierAbilityDescription}", 20);

            UiFactory.CreateButton(_previewContainer, "Fuse", () =>
            {
                if (_fusionService.TryFuse(_selectedHero))
                    RefreshPreview();
            }, preview.CanFuse);
        }
    }
}
