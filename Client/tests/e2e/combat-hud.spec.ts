/** Combat HUD (COMBAT-03, 04, 06, 08): boss timer, failure label, auto toggle, empty squad, last stage. */
import { expect, test } from '@playwright/test';
import { advance, describe, node, open, pad, state } from './helpers';

test('a boss failure shows the label, and Fight boss restarts the boss with a full timer', async ({ page }) => {
  await open(page, { save: 'boss-weak', scene: 'game' });
  await advance(page, 300);
  expect(await node(page, 'game.progress')).toMatchObject({ label: 'Boss timer' });
  expect((await node(page, 'game.goldRate')).value).toMatch(/\/s$/);
  await advance(page, 61_000);
  expect((await node(page, 'game.result')).label).toBe('⚠ POWER GATE - Stage 5 boss');
  expect((await node(page, 'game.current')).value).toBe('4');
  expect((await node(page, 'game.auto')).value).toBe('Off');
  await node(page, 'game.fightBoss');
  await page.evaluate(() => (window as unknown as { __ig: { click(id: string): void } }).__ig.click('game.fightBoss'));
  expect((await node(page, 'game.current')).value).toBe('5');
  expect((await node(page, 'game.progress')).value).toMatch(/^Boss \d+s$/);
  expect((await describe(page)).some((n) => n.id === 'game.fightBoss')).toBe(false);
});

test('auto-advance toggles by gamepad', async ({ page }) => {
  await open(page, { save: 'new-player', scene: 'game' });
  expect((await node(page, 'game.auto')).value).toBe('On');
  await pad(page, 'Down');
  expect((await node(page, 'game.auto')).focused).toBe(true);
  await pad(page, 'A');
  expect((await node(page, 'game.auto')).value).toBe('Off');
  expect((await state(page)).combat.stageNumber).toBe(1);
});

test('an empty Active Squad shows the add-a-hero text and no monster spawns', async ({ page }) => {
  await open(page, { save: 'new-player', scene: 'roster' });
  await page.evaluate(() => (window as unknown as { __ig: { click(id: string): void } }).__ig.click('roster.active.ranger.bench'));
  await page.evaluate(() => (window as unknown as { __ig: { goto(s: string): void } }).__ig.goto('game'));
  await advance(page, 2000);
  expect((await node(page, 'game.emptySquad')).label).toBe('Add a hero to your Active Squad to fight');
  expect(await node(page, 'game.combat')).toMatchObject({ enabled: false, value: 'no squad' });
  expect((await describe(page)).some((n) => n.id === 'game.fightBoss')).toBe(false);
});
