import type { HeroData } from './content/types';
import type { HeroEntity } from './HeroEntity';

/** Pure roster constraints (PRD FR-3). */
export const RosterRules = {
  ActiveSquadCapacity: 5,

  /**
   * Active Squad power: sum of basePower * starTier (Unity StageService and
   * SaveSyncService both computed it inline). Benched heroes contribute zero (FR-4).
   */
  squadPower(activeSquad: readonly HeroEntity[], heroData: (heroId: string) => HeroData): number {
    let total = 0;
    for (const hero of activeSquad) total = (total + heroData(hero.heroId).basePower * hero.starTier) | 0;
    return total;
  },
} as const;
