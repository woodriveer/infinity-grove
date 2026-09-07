using System;
using BreakInfinity;

namespace InfinityGrove.Domain
{
    /// <summary>
    /// Pure calculation of offline gold accrual from a persisted last-seen
    /// timestamp (PRD FR-41), capped per FR-42's assumed capped model. Contains no
    /// side effects and no Unity dependency so it can be unit tested directly,
    /// matching this codebase's other pure rule classes (StageOutcomeClassifier,
    /// FusionRules).
    /// </summary>
    public static class OfflineAccrualCalculator
    {
        public static OfflineAccrualResult Calculate(
            DateTimeOffset lastSeenUtc,
            DateTimeOffset nowUtc,
            int activeSquadPower,
            double goldPerSquadPowerPerHour,
            TimeSpan cap)
        {
            var elapsedActual = nowUtc - lastSeenUtc;
            if (elapsedActual <= TimeSpan.Zero || activeSquadPower <= 0 || goldPerSquadPowerPerHour <= 0d)
            {
                return OfflineAccrualResult.None;
            }

            var elapsedCredited = elapsedActual > cap ? cap : elapsedActual;
            var hoursCredited = elapsedCredited.TotalHours;

            BigDouble gold = (double)activeSquadPower * goldPerSquadPowerPerHour * hoursCredited;

            return new OfflineAccrualResult(gold, elapsedActual, elapsedCredited);
        }
    }
}
