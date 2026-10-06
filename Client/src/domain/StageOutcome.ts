/** The three ways a stage attempt can resolve (PRD FR-11). */
export const STAGE_OUTCOMES = ['Success', 'PowerGate', 'CompositionMismatch'] as const;
export type StageOutcome = (typeof STAGE_OUTCOMES)[number];
