/** hero-art-pipeline T9: `heroLook`, `enchantLevelOf`. ART-06. */
import { describe, expect, it } from 'vitest';
import { enchantLevelOf, heroLook } from '../../src/domain/art/HeroLook';
import type { EquipmentInstance } from '../../src/domain/EquipmentInstance';
import type { EquipmentSlot } from '../../src/domain/EquipmentSlot';
import type { EquipmentItemData } from '../../src/domain/content/types';

const item = (itemId: string, slot: EquipmentSlot, visual?: EquipmentItemData['visual']): EquipmentItemData => ({
  itemId, displayName: itemId, slot, archetype: 'Warrior' as EquipmentItemData['archetype'], icon: '', visual,
});
const inst = (itemId: string, extra: object = {}): EquipmentInstance =>
  ({ instanceId: `i-${itemId}`, itemId, affixRolls: {}, ...extra }) as EquipmentInstance;

const items = new Map(
  [
    item('sword', 'Weapon', { weaponModel: 'iron-sword' }),
    item('plain-blade', 'Weapon'),
    item('chest', 'Chest', { color: '#112233' }),
    item('gloves', 'Gloves', { color: '#445566' }),
    item('boots', 'Boots', { color: '#778899' }),
    item('bare-chest', 'Chest'),
  ].map((i) => [i.itemId, i]),
);

describe('heroLook', () => {
  it('reads weapon model and every armor color when all slots are filled', () => {
    const look = heroLook(
      { Weapon: inst('sword'), Chest: inst('chest'), Gloves: inst('gloves'), Boots: inst('boots') },
      items, undefined,
    );
    expect(look).toEqual({
      weaponModel: 'iron-sword',
      tint: { Chest: '#112233', Gloves: '#445566', Boots: '#778899' },
      tintDark: { Chest: null, Gloves: null, Boots: null },
      enchantLevel: 0,
    });
  });

  it.each(['Chest', 'Gloves', 'Boots'] as const)('uses the neutral color when %s is empty', (slot) => {
    const all = { Chest: inst('chest'), Gloves: inst('gloves'), Boots: inst('boots') };
    const { [slot]: _removed, ...rest } = all;
    const look = heroLook(rest, items, undefined, '#abcdef');
    expect(look.tint[slot]).toBe('#abcdef');
  });

  it('uses the neutral color for an item without visual.color, preferring the hero art neutral', () => {
    expect(heroLook({ Chest: inst('bare-chest') }, items, undefined, '#010101').tint.Chest).toBe('#010101');
    expect(heroLook({ Chest: inst('bare-chest') }, items, { mode: 'layered', neutral: '#222222' }, '#010101').tint.Chest).toBe('#222222');
  });

  it('has no weapon model without a weapon or when the weapon has no model', () => {
    expect(heroLook({}, items, undefined).weaponModel).toBeNull();
    expect(heroLook({ Weapon: inst('plain-blade') }, items, undefined).weaponModel).toBeNull();
    expect(heroLook({ Weapon: inst('missing') }, items, undefined).weaponModel).toBeNull();
  });

  it('carries the weapon enchant level', () => {
    expect(heroLook({ Weapon: inst('sword', { enchantLevel: 7 }) }, items, undefined).enchantLevel).toBe(7);
  });
});

describe('enchantLevelOf', () => {
  it('is 0 when absent or invalid and the level when present', () => {
    expect(enchantLevelOf(inst('sword'))).toBe(0);
    expect(enchantLevelOf(inst('sword', { enchantLevel: -2 }))).toBe(0);
    expect(enchantLevelOf(inst('sword', { enchantLevel: 12 }))).toBe(12);
  });
});
