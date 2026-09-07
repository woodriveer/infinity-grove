using InfinityGrove.Domain;
using InfinityGrove.Service;
using UnityEngine;
using VContainer;

namespace InfinityGrove.Presentation
{
    /// <summary>
    /// Active Squad / Bench roster screen (PRD FR-3/FR-4/FR-47). Presentation-only:
    /// all capacity and duplicate-vs-new-hero rules live in <see cref="IRosterService"/>.
    /// </summary>
    public class RosterPresenter : MonoBehaviour
    {
        [Header("Containers (assign empty RectTransforms with a Vertical Layout Group)")]
        [SerializeField] private Transform _activeSquadContainer;
        [SerializeField] private Transform _benchContainer;

        private IRosterService _rosterService;

        [Inject]
        public void Construct(IRosterService rosterService)
        {
            _rosterService = rosterService;
        }

        private void OnEnable()
        {
            UiFactory.PrepareListContainer(_activeSquadContainer);
            UiFactory.PrepareListContainer(_benchContainer);

            _rosterService.OnRosterChanged += Refresh;
            Refresh();
        }

        private void OnDisable()
        {
            _rosterService.OnRosterChanged -= Refresh;
        }

        private void Refresh()
        {
            UiFactory.ClearChildren(_activeSquadContainer);
            UiFactory.ClearChildren(_benchContainer);

            foreach (var hero in _rosterService.ActiveSquad)
                BuildHeroRow(_activeSquadContainer, hero, isActive: true);

            var capacityLabel = _rosterService.ActiveSquad.Count >= RosterRules.ActiveSquadCapacity
                ? $"Active Squad ({_rosterService.ActiveSquad.Count}/{RosterRules.ActiveSquadCapacity}) - full, bench a hero to add another"
                : $"Active Squad ({_rosterService.ActiveSquad.Count}/{RosterRules.ActiveSquadCapacity})";
            UiFactory.CreateLabel(_activeSquadContainer, capacityLabel, 22).transform.SetAsFirstSibling();

            foreach (var hero in _rosterService.Bench)
                BuildHeroRow(_benchContainer, hero, isActive: false);

            UiFactory.CreateLabel(_benchContainer, $"Bench ({_rosterService.Bench.Count})", 22).transform.SetAsFirstSibling();
        }

        private void BuildHeroRow(Transform container, HeroEntity hero, bool isActive)
        {
            var row = UiFactory.CreateRow(container, hero.Data.displayName);

            UiFactory.CreateLabel(row, HeroTypeDisplay.Abbreviation(hero.Data.heroType), 20, HeroTypeDisplay.Color(hero.Data.heroType));
            UiFactory.CreateLabel(row, $"{hero.Data.displayName}  {hero.StarTier}★", 24);

            if (!isActive && hero.DuplicatesOwned > 0)
                UiFactory.CreateLabel(row, $"x{hero.DuplicatesOwned} fusable", 18, new Color(1f, 0.8f, 0.3f));

            if (isActive)
            {
                UiFactory.CreateButton(row, "Bench", () => _rosterService.BenchHero(hero));
            }
            else
            {
                bool canActivate = _rosterService.ActiveSquad.Count < RosterRules.ActiveSquadCapacity;
                UiFactory.CreateButton(row, "Activate", () => _rosterService.TryActivate(hero), canActivate);
            }
        }
    }
}
