import type { StageData } from '../../domain/content/types';
import { RosterRules } from '../../domain/RosterRules';
import type { StageAttemptPreview } from '../../domain/StageAttemptPreview';
import type { StageOutcome } from '../../domain/StageOutcome';
import { StageOutcomeClassifier } from '../../domain/StageOutcomeClassifier';
import type { ServiceDeps } from '../core';
import { withEvent } from '../core';
import { RosterService } from '../roster/RosterService';
import type { GameState } from '../state/types';

/** Stage select with risk preview and classification (P9, Unity StageService). */
export class StageService {
  constructor(private readonly deps: ServiceDeps) {}

  stages(): readonly StageData[] {
    return this.deps.content.stages;
  }

  furthestClearedStage(): number {
    return this.deps.store.get().furthestStageCleared;
  }

  getPreview(stageId: string): StageAttemptPreview {
    const stage = this.deps.content.stage(stageId);
    const squad = RosterService.activeSquadOf(this.deps.store.get());
    const squadPower = RosterRules.squadPower(squad, (id) => this.deps.content.hero(id));
    const squadTypes = squad.map((h) => this.deps.content.hero(h.heroId).heroType);
    const predictedOutcome = StageOutcomeClassifier.classify(squadPower, stage.powerFloor, stage.favoredType, squadTypes);
    return { stage, squadPower, squadTypes, predictedOutcome };
  }

  /** AttemptStage: the outcome is the preview's; Success advances progress and emits StageCleared. */
  attemptStage(stageId: string): StageOutcome {
    const preview = this.getPreview(stageId);
    const s = this.deps.store.get();
    let next: GameState = { ...s, lastStageAttempt: { stageId, outcome: preview.predictedOutcome } };
    if (preview.predictedOutcome === 'Success') {
      if (preview.stage.stageNumber > s.furthestStageCleared) next = { ...next, furthestStageCleared: preview.stage.stageNumber };
      next = withEvent(this.deps, next, 'StageCleared', { stageNumber: preview.stage.stageNumber });
    }
    this.deps.store.commit(next);
    return preview.predictedOutcome;
  }
}
