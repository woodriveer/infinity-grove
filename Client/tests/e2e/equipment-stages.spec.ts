/** P6, P7, P8, P9 by gamepad and keyboard only. */
import { expect, test } from '@playwright/test';
import { describe, focusWith, key, node, open, pad, shot } from './helpers';

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

test('stage select: risk preview and the three outcomes, keyboard only (P9, FR-11/FR-46)', async ({ page }) => {
  await open(page, { save: 'mid-game', scene: 'stages' });
  expect((await node(page, 'stages.mossy-hollow.risk')).label).toBe('Ready');
  expect((await node(page, 'stages.ember-ridge.power')).label).toBe('Power floor: 30 (yours: 22)');
  expect((await node(page, 'stages.ember-ridge.risk')).label).toBe('⚠ Power Gate risk');
  expect((await node(page, 'stages.ember-ridge.type')).label).toBe('FIR · Fire');
  await focusWith(page, 'stages.ember-ridge.attempt', 'keyboard');
  await key(page, 'Enter');
  expect((await node(page, 'stages.result')).label).toBe('⚠ POWER GATE');
  await focusWith(page, 'stages.mossy-hollow.attempt', 'keyboard');
  await key(page, 'Enter');
  expect((await node(page, 'stages.result')).label).toBe('✓ CLEARED - Stage 1');
  await shot(page, 'stages');
});

test('stage select shows Composition Mismatch when power is enough but no type matches (FR-11)', async ({ page }) => {
  await open(page, { save: 'mid-game', scene: 'roster' });
  await focusWith(page, 'roster.active.ranger.bench', 'gamepad');
  await pad(page, 'A');
  await key(page, 'KeyM');
  expect((await node(page, 'stages.mossy-hollow.risk')).label).toBe('⇄ Composition Mismatch risk');
  await focusWith(page, 'stages.mossy-hollow.attempt', 'gamepad');
  await pad(page, 'A');
  expect((await node(page, 'stages.result')).label).toBe('⇄ COMPOSITION MISMATCH');
  expect((await node(page, 'stages.result.detail')).label).toBe(
    "Your power is sufficient, but no hero in your Active Squad matches this stage's NAT modifier. Swap your squad.",
  );
});
