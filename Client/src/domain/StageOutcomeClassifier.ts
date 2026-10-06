import type { HeroType } from './HeroType';
import type { StageOutcome } from './StageOutcome';

/**
 * Power Gate vs Composition Mismatch (FR-11), as one order-of-checks function:
 * below the floor is always a Power Gate regardless of composition; at or above
 * it, a type mismatch is always a Composition Mismatch.
 */
export const StageOutcomeClassifier = {
  classify(squadPower: number, powerFloor: number, stageFavoredType: HeroType, squadTypes: readonly HeroType[] | null): StageOutcome {
    if (squadPower < powerFloor) return 'PowerGate';
    const matchesModifier = squadTypes !== null && squadTypes.includes(stageFavoredType);
    return matchesModifier ? 'Success' : 'CompositionMismatch';
  },
} as const;
