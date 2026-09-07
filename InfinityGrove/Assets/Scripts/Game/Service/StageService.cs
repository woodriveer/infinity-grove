using System;
using System.Linq;
using InfinityGrove.Domain;

namespace InfinityGrove.Service
{
    /// <summary>
    /// Computes total Active Squad power/types from <see cref="IRosterService"/>
    /// and hands them to the pure <see cref="StageOutcomeClassifier"/> (PRD FR-11).
    /// Stages may always be retried or replayed (FR-12/FR-13) - this service never
    /// blocks an attempt, it only classifies the outcome.
    /// </summary>
    public class StageService : IStageService
    {
        private readonly IRosterService _rosterService;

        public StageData[] Stages { get; }
        public int FurthestClearedStage { get; private set; }

        public event Action<StageData, StageOutcome> OnStageAttempted;
        public event Action<int> OnFurthestStageReconciled;

        public StageService(StageData[] stages, IRosterService rosterService)
        {
            Stages = stages ?? Array.Empty<StageData>();
            _rosterService = rosterService;
        }

        public StageAttemptPreview GetPreview(StageData stage)
        {
            int squadPower = CalculateSquadPower();
            var squadTypes = _rosterService.ActiveSquad.Select(h => h.Data.heroType).ToList();
            var outcome = StageOutcomeClassifier.Classify(squadPower, stage.powerFloor, stage.favoredType, squadTypes);

            return new StageAttemptPreview(stage, squadPower, squadTypes, outcome);
        }

        public StageOutcome AttemptStage(StageData stage)
        {
            var preview = GetPreview(stage);

            if (preview.PredictedOutcome == StageOutcome.Success && stage.stageNumber > FurthestClearedStage)
                FurthestClearedStage = stage.stageNumber;

            OnStageAttempted?.Invoke(stage, preview.PredictedOutcome);
            return preview.PredictedOutcome;
        }

        private int CalculateSquadPower()
        {
            return _rosterService.ActiveSquad.Sum(h => h.Data.basePower * h.StarTier);
        }

        public void ReconcileFurthestClearedStage(int stageNumber)
        {
            if (stageNumber == FurthestClearedStage) return;

            FurthestClearedStage = stageNumber;
            OnFurthestStageReconciled?.Invoke(FurthestClearedStage);
        }
    }
}
