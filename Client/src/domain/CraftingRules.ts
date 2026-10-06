import type { AffixType } from './AffixType';
import type { EquipmentSlot } from './EquipmentSlot';

/**
 * Pure crafting math (PRD FR-22/FR-23): legal affixes per slot, ranges and cost.
 * Preview only: the roll itself is server-authoritative (AD-22) and never happens
 * on the client.
 */
export const CraftingRules = {
  RerollCost: 50,

  affixesForSlot(slot: EquipmentSlot): readonly AffixType[] {
    switch (slot) {
      case 'Weapon':
        return ['CritChance', 'AttackPercent', 'CritDamage'];
      case 'Chest':
        return ['Defense'];
      case 'Boots':
        return ['Speed'];
      case 'Gloves':
        return ['Precision'];
    }
  },

  affixRange(affix: AffixType): { min: number; max: number } {
    switch (affix) {
      case 'CritChance':
        return { min: 1, max: 25 };
      case 'AttackPercent':
        return { min: 1, max: 50 };
      case 'CritDamage':
        return { min: 5, max: 100 };
      case 'Defense':
        return { min: 1, max: 40 };
      case 'Speed':
        return { min: 1, max: 30 };
      case 'Precision':
        return { min: 1, max: 30 };
    }
  },
} as const;
