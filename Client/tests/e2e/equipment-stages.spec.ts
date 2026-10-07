/** P6, P7, P8, P9 by gamepad and keyboard only. */
import { expect, test } from '@playwright/test';
import { describe, focusWith, key, node, open, pad, shot, state } from './helpers';

test('equipment: equip from the bag and unequip back to it, gamepad only (P6, RFR-43)', async ({ page }) => {
  await open(page, { save: 'crafting-ready', scene: 'equipment' });
  expect((await node(page, 'equipment.slot.Chest')).label).toBe('Chest: Leaf Mail');
  expect((await node(page, 'equipment.slots.title')).label).toBe('Slots — Ranger');
  const blade = (await describe(page)).find((n) => n.label === 'Bark Blade [Weapon/Strength]');
  expect(blade).toBeDefined();
  const instance = (blade?.id ?? '').split('.')[2];
  await focusWith(page, `equipment.bag.${instance}.equip`, 'gamepad');
  await pad(page, 'A');
  expect((await node(page, 'equipment.slot.Weapon')).label).toBe('Weapon: Bark Blade');
  await focusWith(page, 'equipment.slot.Weapon.unequip', 'gamepad');
  await pad(page, 'A');
  expect((await node(page, 'equipment.slot.Weapon')).label).toBe('Weapon: (empty)');
  await shot(page, 'equipment');
});

test('crafting: the preview shows the range and the re-roll request is unavailable (P7, RFR-41)', async ({ page }) => {
  await open(page, { save: 'crafting-ready', scene: 'equipment' });
  await focusWith(page, 'equipment.slot.Chest', 'keyboard');
  await key(page, 'Enter');
  expect((await node(page, 'equipment.craft.Defense')).label).toBe('Defense: 0.0 (range 1.0-40.0)');
  await focusWith(page, 'equipment.craft.Defense.reroll', 'keyboard');
  await key(page, 'Enter');
  await expect.poll(async () => (await describe(page)).find((n) => n.id === 'equipment.craft.message')?.label).toBe(
    'Crafting is not available yet: the server crafting endpoint has not shipped.',
  );
  expect((await node(page, 'equipment.craft.Defense')).label).toBe('Defense: 0.0 (range 1.0-40.0)');
});

test('loadout presets: save, change gear, apply with confirm (P8)', async ({ page }) => {
  await open(page, { save: 'crafting-ready', scene: 'equipment' });
  expect((await node(page, 'equipment.preset.Strength.apply')).enabled).toBe(true);
  expect((await node(page, 'equipment.preset.Agility.apply')).enabled).toBe(false);
  await focusWith(page, 'equipment.slot.Chest.unequip', 'gamepad');
  await pad(page, 'A');
  expect((await node(page, 'equipment.slot.Chest')).label).toBe('Chest: (empty)');
  await focusWith(page, 'equipment.preset.Strength.apply', 'gamepad');
  await pad(page, 'A');
  expect(await node(page, 'equipment.apply.cancel')).toMatchObject({ focused: true });
  await focusWith(page, 'equipment.apply.confirm', 'gamepad');
  await pad(page, 'A');
  expect((await node(page, 'equipment.slot.Chest')).label).toBe('Chest: Leaf Mail');
});

test('hero tabs switch with LB/RB and Q/E (EXPERIENCE tabs)', async ({ page }) => {
  await open(page, { save: 'mid-game', scene: 'equipment' });
  expect((await node(page, 'equipment.hero.ranger')).selected).toBe(true);
  await pad(page, 'RB');
  expect((await node(page, 'equipment.hero.druid')).selected).toBe(true);
  await key(page, 'KeyQ');
  expect((await node(page, 'equipment.hero.ranger')).selected).toBe(true);
});

test('stage select lists cleared stages plus the next and jumps to one (P9, COMBAT-03)', async ({ page }) => {
  await open(page, { save: 'mid-game', scene: 'stages' });
  const ids = (await describe(page)).filter((n) => n.id.endsWith('.go')).map((n) => n.id);
  expect(ids).toEqual(['stages.mossy-hollow.go', 'stages.ember-ridge.go']);
  expect((await node(page, 'stages.mossy-hollow.go')).label).toBe('Farm');
  expect((await node(page, 'stages.ember-ridge.go')).label).toBe('Fighting here');
  await focusWith(page, 'stages.mossy-hollow.go', 'gamepad');
  await pad(page, 'A');
  expect((await state(page)).combat.stageNumber).toBe(1);
  expect((await node(page, 'stages.mossy-hollow.go')).label).toBe('Fighting here');
  await shot(page, 'stages');
  await focusWith(page, 'stages.close', 'gamepad');
  await pad(page, 'A');
  expect((await node(page, 'game.current')).value).toBe('1');
});

test('stage select shows the boss risk line: floor vs squad power and the predicted label (FR-11, FR-46)', async ({ page }) => {
  await open(page, { save: 'boss-ready', scene: 'stages' });
  expect((await node(page, 'stages.bramble-throne.name')).label).toBe('Stage 5: Bramble Throne (Boss)');
  expect((await node(page, 'stages.bramble-throne.type')).label).toBe('NAT · Nature');
  expect((await node(page, 'stages.bramble-throne.power')).label).toBe('Power floor: 56 (yours: 58)');
  expect((await node(page, 'stages.bramble-throne.risk')).label).toMatch(/Ready|Power Gate risk|Composition Mismatch risk/);
  expect((await describe(page)).some((n) => n.id === 'stages.mossy-hollow.risk')).toBe(false);
});
