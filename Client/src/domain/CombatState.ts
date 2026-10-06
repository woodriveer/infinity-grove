export const COMBAT_STATES = ['Walking', 'Fighting'] as const;
export type CombatState = (typeof COMBAT_STATES)[number];
