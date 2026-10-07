import type { EquipmentInstance } from '../EquipmentInstance';
import type { EquipmentSlot } from '../EquipmentSlot';
import type { EquipmentItemData, HeroArt, HexColor } from '../content/types';

export type ArmorSlot = 'Chest' | 'Gloves' | 'Boots';

export interface HeroLook {
  /** `items/weapons/<id>` key suffix, or null when no weapon model is shown. */
  weaponModel: string | null;
  tint: Record<ArmorSlot, HexColor>;
  enchantLevel: number;
}

export const NEUTRAL_TINT: HexColor = '#808080';

const ARMOR_SLOTS: readonly ArmorSlot[] = ['Chest', 'Gloves', 'Boots'];

/** Enchant level of an instance; absent means 0 (ART-08). */
export function enchantLevelOf(instance: EquipmentInstance): number {
  const level = instance.enchantLevel;
  return typeof level === 'number' && level > 0 ? level : 0;
}

/** What a hero looks like from what it wears (ART-06). Empty slots and missing colors use the neutral tint. */
export function heroLook(
  equipped: Readonly<Partial<Record<EquipmentSlot, EquipmentInstance>>>,
  items: ReadonlyMap<string, EquipmentItemData>,
  art: HeroArt | undefined,
  neutral: HexColor = NEUTRAL_TINT,
): HeroLook {
  const fallback = art?.neutral ?? neutral;
  const itemOf = (slot: EquipmentSlot): EquipmentItemData | undefined => {
    const inst = equipped[slot];
    return inst ? items.get(inst.itemId) : undefined;
  };
  const tint = {} as Record<ArmorSlot, HexColor>;
  for (const slot of ARMOR_SLOTS) tint[slot] = itemOf(slot)?.visual?.color ?? fallback;
  const weapon = equipped.Weapon;
  return {
    weaponModel: itemOf('Weapon')?.visual?.weaponModel ?? null,
    tint,
    enchantLevel: weapon ? enchantLevelOf(weapon) : 0,
  };
}
