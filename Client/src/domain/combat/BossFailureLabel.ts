import type { HeroType } from '../HeroType';
import { StageOutcomeClassifier } from '../StageOutcomeClassifier';

export type BossFailureOutcome = 'PowerGate' | 'CompositionMismatch';

/** FR-11 label of a failed boss fight; the classifier's `Success` never shows for a failure, so it maps to Power Gate. */
export const BossFailureLabel = {
  label(squadPower: number, powerFloor: number, favoredType: HeroType, squadTypes: readonly HeroType[]): BossFailureOutcome {
    const outcome = StageOutcomeClassifier.classify(squadPower, powerFloor, favoredType, squadTypes);
    return outcome === 'CompositionMismatch' ? 'CompositionMismatch' : 'PowerGate';
  },
} as const;
