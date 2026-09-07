using System;
using System.Collections.Generic;
using BreakInfinity;
using Newtonsoft.Json;

namespace InfinityGrove.Domain
{
    /// <summary>
    /// Client-side mirror of the backend's canonical PlayerStateDto (AD-6/AD-9):
    /// the state the client reconciles its local view against. Gold travels as the
    /// same (mantissa, exponent) pair BreakInfinity.cs uses everywhere else (AD-7).
    /// </summary>
    public class PlayerStateSnapshot
    {
        public double GoldMantissa { get; set; }
        public int GoldExponent { get; set; }
        public int FurthestStageCleared { get; set; }
        public long LastAppliedSequence { get; set; }
        public List<RosterEntrySnapshot> Roster { get; set; } = new List<RosterEntrySnapshot>();
        public List<Guid> ActiveSquadHeroIds { get; set; } = new List<Guid>();

        [JsonIgnore]
        public BigDouble Gold => new BigDouble(GoldMantissa, GoldExponent);

        public static PlayerStateSnapshot Empty() => new PlayerStateSnapshot();
    }
}
