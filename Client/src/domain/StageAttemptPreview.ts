import type { StageData } from './content/types';
import type { HeroType } from './HeroType';
import type { StageOutcome } from './StageOutcome';

/** Everything Stage Select shows to predict risk before entry (PRD FR-46). */
export interface StageAttemptPreview {
  readonly stage: StageData;
  readonly squadPower: number;
  readonly squadTypes: readonly HeroType[];
  readonly predictedOutcome: StageOutcome;
}
