using System;
using BreakInfinity;

namespace InfinityGrove.Domain
{
    /// <summary>Result of <see cref="OfflineAccrualCalculator"/>, surfaced to the player as a "welcome back" summary.</summary>
    public readonly struct OfflineAccrualResult
    {
        public BigDouble GoldAccrued { get; }
        public TimeSpan ElapsedActual { get; }
        public TimeSpan ElapsedCredited { get; }
        public bool WasCapped => ElapsedCredited < ElapsedActual;

        public OfflineAccrualResult(BigDouble goldAccrued, TimeSpan elapsedActual, TimeSpan elapsedCredited)
        {
            GoldAccrued = goldAccrued;
            ElapsedActual = elapsedActual;
            ElapsedCredited = elapsedCredited;
        }

        public static OfflineAccrualResult None { get; } = new OfflineAccrualResult(BigDouble.Zero, TimeSpan.Zero, TimeSpan.Zero);
    }
}
