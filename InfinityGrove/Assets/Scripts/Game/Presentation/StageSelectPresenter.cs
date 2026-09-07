using InfinityGrove.Domain;
using InfinityGrove.Service;
using UnityEngine;
using VContainer;

namespace InfinityGrove.Presentation
{
    /// <summary>
    /// Stage-select screen (PRD FR-10/FR-11/FR-46): surfaces each stage's type
    /// modifier and predicted Power Gate / Composition Mismatch risk before the
    /// player attempts it, then gives unambiguous, visibly distinct feedback
    /// (icon glyph + color + text, per NFR-3) on the actual result.
    /// </summary>
    public class StageSelectPresenter : MonoBehaviour
    {
        [Header("Containers")]
        [SerializeField] private Transform _stageListContainer;
        [SerializeField] private Transform _resultContainer;

        private IStageService _stageService;
        private IRosterService _rosterService;

        [Inject]
        public void Construct(IStageService stageService, IRosterService rosterService)
        {
            _stageService = stageService;
            _rosterService = rosterService;
        }

        private void OnEnable()
        {
            UiFactory.PrepareListContainer(_stageListContainer);
            UiFactory.PrepareListContainer(_resultContainer);

            _rosterService.OnRosterChanged += RefreshList;
            _stageService.OnStageAttempted += HandleStageAttempted;
            RefreshList();
        }

        private void OnDisable()
        {
            _rosterService.OnRosterChanged -= RefreshList;
            _stageService.OnStageAttempted -= HandleStageAttempted;
        }

        private void RefreshList()
        {
            UiFactory.ClearChildren(_stageListContainer);

            foreach (var stage in _stageService.Stages)
            {
                var preview = _stageService.GetPreview(stage);
                var row = UiFactory.CreateRow(_stageListContainer, stage.displayName);

                UiFactory.CreateLabel(row, $"Stage {stage.stageNumber}: {stage.displayName}", 24);
                UiFactory.CreateLabel(row, HeroTypeDisplay.Abbreviation(stage.favoredType), 20, HeroTypeDisplay.Color(stage.favoredType));
                UiFactory.CreateLabel(row, $"Power floor: {stage.powerFloor} (yours: {preview.SquadPower})", 18);
                UiFactory.CreateLabel(row, RiskLabel(preview.PredictedOutcome), 18, RiskColor(preview.PredictedOutcome));

                UiFactory.CreateButton(row, "Attempt", () => Attempt(stage));
            }
        }

        private void Attempt(StageData stage)
        {
            _stageService.AttemptStage(stage);
        }

        private void HandleStageAttempted(StageData stage, StageOutcome outcome)
        {
            UiFactory.ClearChildren(_resultContainer);

            switch (outcome)
            {
                case StageOutcome.Success:
                    UiFactory.CreateLabel(_resultContainer, $"✓ CLEARED - Stage {stage.stageNumber}", 26, new Color(0.3f, 0.85f, 0.3f));
                    break;
                case StageOutcome.PowerGate:
                    UiFactory.CreateLabel(_resultContainer, "⚠ POWER GATE", 26, new Color(0.9f, 0.55f, 0.1f));
                    UiFactory.CreateLabel(_resultContainer, "Your account power/gear/star quality is too low for this stage. Go grind - swapping heroes will not help.", 20);
                    break;
                case StageOutcome.CompositionMismatch:
                    UiFactory.CreateLabel(_resultContainer, "⇄ COMPOSITION MISMATCH", 26, new Color(0.55f, 0.4f, 0.9f));
                    UiFactory.CreateLabel(_resultContainer, $"Your power is sufficient, but no hero in your Active Squad matches this stage's {HeroTypeDisplay.Abbreviation(stage.favoredType)} modifier. Swap your squad.", 20);
                    break;
            }

            RefreshList();
        }

        private static string RiskLabel(StageOutcome predicted)
        {
            switch (predicted)
            {
                case StageOutcome.Success: return "Ready";
                case StageOutcome.PowerGate: return "⚠ Power Gate risk";
                case StageOutcome.CompositionMismatch: return "⇄ Composition Mismatch risk";
                default: return "";
            }
        }

        private static Color RiskColor(StageOutcome predicted)
        {
            switch (predicted)
            {
                case StageOutcome.Success: return new Color(0.3f, 0.85f, 0.3f);
                case StageOutcome.PowerGate: return new Color(0.9f, 0.55f, 0.1f);
                case StageOutcome.CompositionMismatch: return new Color(0.55f, 0.4f, 0.9f);
                default: return Color.white;
            }
        }
    }
}
