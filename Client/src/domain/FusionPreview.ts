/** Everything the Fusion UI renders in one shot (PRD FR-6 AC). */
export interface FusionPreview {
  readonly currentStarTier: number;
  readonly duplicatesOwned: number;
  readonly duplicatesRequired: number;
  readonly nextTierAbilityDescription: string;
  readonly canFuse: boolean;
  readonly isMaxTier: boolean;
}
