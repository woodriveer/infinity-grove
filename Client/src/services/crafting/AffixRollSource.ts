import type { AffixType } from '../../domain/AffixType';
import type { EquipmentInstance } from '../../domain/EquipmentInstance';

/**
 * Where affix re-rolls come from (AD-22). The client never rolls locally: the only
 * implementation calls the backend, which returns the rolled value and debits gold
 * as canonical state.
 */
export type AffixRollResult =
  | { readonly status: 'ok'; readonly item: EquipmentInstance }
  | { readonly status: 'unavailable'; readonly reason: string }
  | { readonly status: 'rejected'; readonly reason: string };

export interface AffixRollSource {
  requestReroll(item: EquipmentInstance, affix: AffixType): Promise<AffixRollResult>;
}
