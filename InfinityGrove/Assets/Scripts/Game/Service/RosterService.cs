using System;
using System.Collections.Generic;
using System.Linq;
using InfinityGrove.Domain;

namespace InfinityGrove.Service
{
    /// <summary>
    /// Enforces the Active Squad hard cap and duplicate-vs-new-hero card
    /// resolution. Benched heroes are excluded from every other service's power/
    /// automation math (PRD FR-4) simply by never appearing in <see cref="ActiveSquad"/>.
    /// </summary>
    public class RosterService : IRosterService
    {
        private readonly List<HeroEntity> _allHeroes = new List<HeroEntity>();
        private readonly List<HeroEntity> _activeSquad = new List<HeroEntity>();

        public IReadOnlyList<HeroEntity> AllHeroes => _allHeroes;
        public IReadOnlyList<HeroEntity> ActiveSquad => _activeSquad;
        public IReadOnlyList<HeroEntity> Bench => _allHeroes.Where(h => !h.IsInActiveSquad).ToList();

        public event Action OnRosterChanged;

        public HeroEntity AddHeroCard(HeroData data)
        {
            var existing = FindByHeroId(data.heroId);
            if (existing != null)
            {
                existing.AddDuplicate();
                OnRosterChanged?.Invoke();
                return existing;
            }

            var hero = new HeroEntity(data);
            _allHeroes.Add(hero);
            OnRosterChanged?.Invoke();
            return hero;
        }

        public HeroEntity FindByHeroId(string heroId) =>
            _allHeroes.FirstOrDefault(h => h.Data.heroId == heroId);

        public bool TryActivate(HeroEntity hero)
        {
            if (hero == null || hero.IsInActiveSquad) return false;
            if (_activeSquad.Count >= RosterRules.ActiveSquadCapacity) return false;

            hero.IsInActiveSquad = true;
            _activeSquad.Add(hero);
            OnRosterChanged?.Invoke();
            return true;
        }

        public void BenchHero(HeroEntity hero)
        {
            if (hero == null || !hero.IsInActiveSquad) return;

            hero.IsInActiveSquad = false;
            _activeSquad.Remove(hero);
            OnRosterChanged?.Invoke();
        }

        public HeroEntity ReconcileHero(HeroData data, int ownedCount, int starTier)
        {
            var existing = FindByHeroId(data.heroId);
            if (existing != null)
            {
                existing.ReconcileTo(ownedCount, starTier);
                OnRosterChanged?.Invoke();
                return existing;
            }

            var hero = new HeroEntity(data, Math.Max(starTier, 1), Math.Max(ownedCount - 1, 0));
            _allHeroes.Add(hero);
            OnRosterChanged?.Invoke();
            return hero;
        }

        public void ReconcileActiveSquad(IEnumerable<HeroEntity> heroes)
        {
            foreach (var hero in _activeSquad)
            {
                hero.IsInActiveSquad = false;
            }
            _activeSquad.Clear();

            foreach (var hero in heroes)
            {
                if (hero == null || hero.IsInActiveSquad) continue;
                if (_activeSquad.Count >= RosterRules.ActiveSquadCapacity) break;

                hero.IsInActiveSquad = true;
                _activeSquad.Add(hero);
            }

            OnRosterChanged?.Invoke();
        }
    }
}
