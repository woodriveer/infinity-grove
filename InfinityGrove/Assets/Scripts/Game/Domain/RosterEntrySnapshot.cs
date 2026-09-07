using System;

namespace InfinityGrove.Domain
{
    /// <summary>
    /// Mirrors Backend RosterEntryDto: total copies ever owned of one hero and its
    /// server-tracked fusion star tier. Backend star tiers start at 0 (first copy,
    /// not yet fused); the client's <see cref="HeroEntity"/> star tiers start at 1
    /// per PRD FR-6's "1st, 2nd, 3rd..." framing, so callers reconciling into a
    /// HeroEntity must add 1 - see HeroEntity.ReconcileTo.
    /// </summary>
    public class RosterEntrySnapshot
    {
        public Guid HeroDefinitionId { get; set; }
        public int OwnedCount { get; set; }
        public int StarTier { get; set; }
    }
}
