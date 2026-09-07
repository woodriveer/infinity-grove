using System;
using InfinityGrove.Domain;

namespace InfinityGrove.Service
{
    /// <summary>
    /// Stage-select data and Power Gate vs Composition Mismatch resolution
    /// (PRD FR-10/FR-11/FR-46).
    /// </summary>
    public interface IStageService
    {
        StageData[] Stages { get; }
        int FurthestClearedStage { get; }

        event Action<StageData, StageOutcome> OnStageAttempted;

        /// <summary>Raised when save/backend reconciliation (AD-6/AD-9) changes FurthestClearedStage outside a normal attempt - e.g. seeding from a cloud save, or a server correction.</summary>
        event Action<int> OnFurthestStageReconciled;

        StageAttemptPreview GetPreview(StageData stage);

        /// <summary>Runs the stage against the current Active Squad and classifies the result.</summary>
        StageOutcome AttemptStage(StageData stage);

        /// <summary>Server-authoritative correction (AD-6/AD-9): sets FurthestClearedStage to the backend's value. Never used by normal gameplay.</summary>
        void ReconcileFurthestClearedStage(int stageNumber);
    }
}
