import type { StageData } from '../../domain/content/types';
import { RosterRules } from '../../domain/RosterRules';
import type { StageAttemptPreview } from '../../domain/StageAttemptPreview';
import { StageOutcomeClassifier } from '../../domain/StageOutcomeClassifier';
import type { ServiceDeps } from '../core';
import { RosterService } from '../roster/RosterService';

/** A row of Stage Select: a stage the player may jump to, with the boss risk line for boss stages. */
export interface StageEntry {
  readonly stage: StageData;
  readonly cleared: boolean;
  /** Boss stages only: the FR-11 prediction against the current Active Squad. */
  readonly preview: StageAttemptPreview | null;
}

/** Stage Select (P9): which stages can be jumped to and the boss risk preview; the jump itself is `combat.jumpToStage`. */
export class StageService {
  constructor(private readonly deps: ServiceDeps) {}

  stages(): readonly StageData[] {
    return this.deps.content.stages;
  }

  furthestClearedStage(): number {
    return this.deps.store.get().furthestStageCleared;
  }

  /** Every cleared stage plus the next uncleared one (COMBAT-03 AC 4). */
  selectableStages(): readonly StageEntry[] {
    const furthest = this.furthestClearedStage();
    return this.stages()
      .filter((st) => st.stageNumber <= furthest + 1)
      .map((stage) => ({ stage, cleared: stage.stageNumber <= furthest, preview: stage.boss ? this.getPreview(stage.stageId) : null }));
  }

  /** The prediction uses the boss's Power Gate floor; a stage without a boss has none, so it is always `Success`. */
  getPreview(stageId: string): StageAttemptPreview {
    const stage = this.deps.content.stage(stageId);
    const squad = RosterService.activeSquadOf(this.deps.store.get());
    const squadPower = RosterRules.squadPower(squad, (id) => this.deps.content.hero(id));
    const squadTypes = squad.map((h) => this.deps.content.hero(h.heroId).heroType);
    const predictedOutcome = StageOutcomeClassifier.classify(squadPower, stage.boss?.powerFloor ?? 0, stage.favoredType, squadTypes);
    return { stage, squadPower, squadTypes, predictedOutcome };
  }
}
