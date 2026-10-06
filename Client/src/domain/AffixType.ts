/** Rollable affixes (PRD FR-22). Valid affixes per slot: CraftingRules.affixesForSlot. */
export const AFFIX_TYPES = ['CritChance', 'AttackPercent', 'CritDamage', 'Defense', 'Speed', 'Precision'] as const;
export type AffixType = (typeof AFFIX_TYPES)[number];
