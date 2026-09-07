using System.Collections.Generic;

namespace InfinityGrove.Domain
{
    /// <summary>
    /// Everything the stage-select screen needs to predict risk before entry
    /// (PRD FR-46): the stage's modifier, the player's squad, and the current
    /// squad power vs. the stage's power floor.
    /// </summary>
    public readonly struct StageAttemptPreview
    {
        public StageData Stage { get; }
        public int SquadPower { get; }
        public IReadOnlyList<HeroType> SquadTypes { get; }
        public StageOutcome PredictedOutcome { get; }

        public StageAttemptPreview(StageData stage, int squadPower, IReadOnlyList<HeroType> squadTypes, StageOutcome predictedOutcome)
        {
            Stage = stage;
            SquadPower = squadPower;
            SquadTypes = squadTypes;
            PredictedOutcome = predictedOutcome;
        }
    }
}
