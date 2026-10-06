/** Rotating type axis for stage modifiers (FR-10) and Composition Mismatch (FR-11). */
export const HERO_TYPES = ['Fire', 'Water', 'Nature', 'Light', 'Dark'] as const;
export type HeroType = (typeof HERO_TYPES)[number];
