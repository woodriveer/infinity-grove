import type { AffixType } from './AffixType';

/** What the crafting UI shows before the player commits currency (PRD FR-22 AC). */
export interface CraftingPreview {
  readonly affix: AffixType;
  readonly currentRoll: number;
  readonly minRoll: number;
  readonly maxRoll: number;
  readonly rerollCost: number;
}
