/** Equipment drives the layered hero look (hero-art-pipeline ART-06), through the Equipment screen by gamepad. */
import { expect, test } from '@playwright/test';
import { advance, describe, focusWith, ig, open, pad } from './helpers';

const testHero = async (page: Parameters<typeof ig>[0]) => (await ig(page, (g) => g.world())).field.find((h) => h.heroId === 'test-hero')!;

test('equipping and unequipping weapon and armor changes model and tint on the next frames', async ({ page }) => {
  await open(page, { save: 'layered-squad', scene: 'equipment' });
  await focusWith(page, 'equipment.hero.test-hero', 'gamepad');
  await pad(page, 'A');
  await focusWith(page, 'equipment.slot.Weapon.unequip', 'gamepad');
  await pad(page, 'A');
  await focusWith(page, 'equipment.slot.Chest.unequip', 'gamepad');
  await pad(page, 'A');
  await advance(page, 200);
  expect(await testHero(page)).toMatchObject({ art: 'layered', weaponModel: null, tint: { Chest: '#808080', Gloves: '#808080', Boots: '#808080' } });

  const bagEquip = async (label: string) => {
    const id = (await describe(page)).find((n) => n.label.startsWith(label) && n.id.startsWith('equipment.bag.'))?.id ?? '';
    const instance = id.split('.')[2];
    await focusWith(page, `equipment.bag.${instance}.equip`, 'gamepad');
    await pad(page, 'A');
  };
  await bagEquip('Test Blade');
  await bagEquip('Test Vest');
  await advance(page, 200);
  expect(await testHero(page)).toMatchObject({ weaponModel: 'test-blade', tint: { Chest: '#c04040' } });
});
