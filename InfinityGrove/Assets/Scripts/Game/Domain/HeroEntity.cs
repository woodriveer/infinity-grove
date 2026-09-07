using System;

namespace InfinityGrove.Domain
{
    /// <summary>
    /// Pure runtime ownership/fusion state for one owned hero, independent of any
    /// MonoBehaviour (PRD FR-6/FR-7). Presentation reads this via events; the
    /// Roster/Fusion services own the only code allowed to mutate it.
    /// </summary>
    public class HeroEntity
    {
        public HeroData Data { get; }
        public int StarTier { get; private set; }
        public int DuplicatesOwned { get; private set; }
        public bool IsInActiveSquad { get; internal set; }

        public event Action<int> OnStarTierChanged;
        public event Action<int> OnDuplicatesChanged;

        public HeroEntity(HeroData data, int starTier = 1, int duplicatesOwned = 0)
        {
            Data = data;
            StarTier = starTier;
            DuplicatesOwned = duplicatesOwned;
        }

        public void AddDuplicate()
        {
            DuplicatesOwned++;
            OnDuplicatesChanged?.Invoke(DuplicatesOwned);
        }

        /// <summary>Consumes <paramref name="cost"/> duplicates and advances one star tier. Caller validates eligibility.</summary>
        public void ApplyFusion(int cost)
        {
            DuplicatesOwned -= cost;
            StarTier++;
            OnDuplicatesChanged?.Invoke(DuplicatesOwned);
            OnStarTierChanged?.Invoke(StarTier);
        }

        /// <summary>
        /// Server-authoritative correction (AD-6/AD-9): forces this hero's owned/
        /// duplicate count and star tier to the backend's values, bypassing the
        /// incremental AddDuplicate/ApplyFusion API. Used only by save/backend
        /// reconciliation on load or after a rejected event, never by normal
        /// gameplay - <paramref name="ownedCount"/> is the backend's total copies
        /// (RosterEntry.OwnedCount, first copy included), so duplicates is one less.
        /// </summary>
        public void ReconcileTo(int ownedCount, int starTier)
        {
            DuplicatesOwned = Math.Max(ownedCount - 1, 0);
            StarTier = starTier;
            OnDuplicatesChanged?.Invoke(DuplicatesOwned);
            OnStarTierChanged?.Invoke(StarTier);
        }
    }
}
