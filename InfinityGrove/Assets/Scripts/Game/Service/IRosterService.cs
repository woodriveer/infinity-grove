using System;
using System.Collections.Generic;
using InfinityGrove.Domain;

namespace InfinityGrove.Service
{
    /// <summary>
    /// Owns the owned-hero roster split into the 5-slot Active Squad and an
    /// unlimited Bench (PRD FR-3/FR-4/FR-47).
    /// </summary>
    public interface IRosterService
    {
        IReadOnlyList<HeroEntity> AllHeroes { get; }
        IReadOnlyList<HeroEntity> ActiveSquad { get; }
        IReadOnlyList<HeroEntity> Bench { get; }

        event Action OnRosterChanged;

        /// <summary>Adds a new hero (benched) or, if already owned, a duplicate for fusion (PRD FR-17).</summary>
        HeroEntity AddHeroCard(HeroData data);

        HeroEntity FindByHeroId(string heroId);

        /// <summary>Returns false without effect if the Active Squad is already at capacity (PRD FR-3 AC).</summary>
        bool TryActivate(HeroEntity hero);

        void BenchHero(HeroEntity hero);

        /// <summary>
        /// Server-authoritative correction (AD-6/AD-9): creates or updates the hero
        /// for <paramref name="data"/> to match the backend's owned count/star
        /// tier exactly, bypassing AddHeroCard's "+1 duplicate" semantics. Used by
        /// save/backend reconciliation on load or after a rejected event.
        /// </summary>
        HeroEntity ReconcileHero(HeroData data, int ownedCount, int starTier);

        /// <summary>Server-authoritative correction (AD-6/AD-9): replaces the Active Squad membership with exactly these already-owned heroes.</summary>
        void ReconcileActiveSquad(IEnumerable<HeroEntity> heroes);
    }
}
