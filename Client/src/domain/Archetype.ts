/** Loadout preset archetypes (PRD FR-21). */
export const ARCHETYPES = ['Strength', 'Intelligence', 'Agility'] as const;
export type Archetype = (typeof ARCHETYPES)[number];
