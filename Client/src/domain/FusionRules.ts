import type { HeroData } from './content/types';
import type { FusionPreview } from './FusionPreview';
import type { HeroEntity } from './HeroEntity';
import { getAbilityDescription } from './HeroData';

/** Pure fusion math (FR-6/FR-8). Client star tiers are 1-based; placeholder linear curve. */
export const FusionRules = {
  MaxStarTier: 12,

  /** Duplicates required to advance from currentTier to currentTier + 1. */
  duplicatesRequiredForNextTier(currentTier: number): number {
    if (currentTier >= FusionRules.MaxStarTier) return 0;
    return currentTier + 1;
  },

  canFuse(currentTier: number, duplicatesOwned: number): boolean {
    if (currentTier >= FusionRules.MaxStarTier) return false;
    return duplicatesOwned >= FusionRules.duplicatesRequiredForNextTier(currentTier);
  },

  /** Unity FusionService.GetPreview, moved next to the rules it composes. */
  preview(hero: HeroEntity, data: HeroData): FusionPreview {
    const isMaxTier = hero.starTier >= FusionRules.MaxStarTier;
    const duplicatesRequired = FusionRules.duplicatesRequiredForNextTier(hero.starTier);
    const canFuse = !isMaxTier && FusionRules.canFuse(hero.starTier, hero.duplicatesOwned);
    const nextTierAbilityDescription = isMaxTier
      ? 'Max star tier reached.'
      : getAbilityDescription(data, hero.starTier + 1);
    return {
      currentStarTier: hero.starTier,
      duplicatesOwned: hero.duplicatesOwned,
      duplicatesRequired,
      nextTierAbilityDescription,
      canFuse,
      isMaxTier,
    };
  },
} as const;
