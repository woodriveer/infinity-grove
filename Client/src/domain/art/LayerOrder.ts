export type LayerSlot = 'body' | 'armor_boots' | 'armor_gloves' | 'armor_chest' | 'weapon' | 'fx';

/** Bottom to top. */
export const LAYER_ORDER: readonly LayerSlot[] = ['body', 'armor_boots', 'armor_gloves', 'armor_chest', 'weapon', 'fx'];

const BEHIND_ORDER: readonly LayerSlot[] = ['weapon', 'body', 'armor_boots', 'armor_gloves', 'armor_chest', 'fx'];

/** Stacking order for one frame; the weapon sits under the body when the `grip_behind` slice has a key (ART-05). */
export function layerOrder(weaponBehind: boolean): readonly LayerSlot[] {
  return weaponBehind ? BEHIND_ORDER : LAYER_ORDER;
}
