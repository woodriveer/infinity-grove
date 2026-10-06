/**
 * Runtime ownership/fusion state of one owned hero (FR-6/FR-7). Immutable: every
 * transition returns a new value (AD-5); only services call these.
 */
export interface HeroEntity {
  readonly heroId: string;
  readonly starTier: number;
  readonly duplicatesOwned: number;
  readonly isInActiveSquad: boolean;
}

export function newHeroEntity(heroId: string, starTier = 1, duplicatesOwned = 0): HeroEntity {
  return { heroId, starTier, duplicatesOwned, isInActiveSquad: false };
}

export function addDuplicate(hero: HeroEntity): HeroEntity {
  return { ...hero, duplicatesOwned: hero.duplicatesOwned + 1 };
}

/** Consumes cost duplicates and advances one star tier. Caller validates eligibility. */
export function applyFusion(hero: HeroEntity, cost: number): HeroEntity {
  return { ...hero, duplicatesOwned: hero.duplicatesOwned - cost, starTier: hero.starTier + 1 };
}

/**
 * Server-authoritative correction: ownedCount is the backend's total copies
 * (first copy included), so duplicates is one less. Reconciliation only.
 */
export function reconcileTo(hero: HeroEntity, ownedCount: number, starTier: number): HeroEntity {
  return { ...hero, duplicatesOwned: Math.max(ownedCount - 1, 0), starTier };
}
