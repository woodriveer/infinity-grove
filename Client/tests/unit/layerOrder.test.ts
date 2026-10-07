/** hero-art-pipeline T8: `layerOrder`. ART-05. */
import { describe, expect, it } from 'vitest';
import { LAYER_ORDER, layerOrder } from '../../src/domain/art/LayerOrder';

describe('layerOrder', () => {
  it('stacks body, boots, gloves, chest, weapon, fx when the weapon is in front', () => {
    expect(layerOrder(false)).toEqual(['body', 'armor_boots', 'armor_gloves', 'armor_chest', 'weapon', 'fx']);
    expect(layerOrder(false)).toBe(LAYER_ORDER);
  });

  it('moves the weapon under the body when behind', () => {
    expect(layerOrder(true)).toEqual(['weapon', 'body', 'armor_boots', 'armor_gloves', 'armor_chest', 'fx']);
  });

  it('keeps the same layers in both orders', () => {
    expect([...layerOrder(true)].sort()).toEqual([...layerOrder(false)].sort());
  });
});
