import type { AffixType } from './AffixType';

/**
 * One rolled, ownable copy of an EquipmentItemData template (FR-19/FR-22). Lives
 * either in the shared bag or on exactly one hero's slot, never both (FR-20).
 */
export interface EquipmentInstance {
  readonly instanceId: string;
  readonly itemId: string;
  readonly affixRolls: Readonly<Partial<Record<AffixType, number>>>;
}

export function getAffix(item: EquipmentInstance, affix: AffixType): number {
  return item.affixRolls[affix] ?? 0;
}

/** Applies a server-returned roll (AD-22). Never called with a locally computed roll. */
export function setAffix(item: EquipmentInstance, affix: AffixType, value: number): EquipmentInstance {
  return { ...item, affixRolls: { ...item.affixRolls, [affix]: value } };
}
