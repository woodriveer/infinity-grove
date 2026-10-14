/** P1–P3 and P10 on the test build: menu, combat loop, equipment bonus, offline summary. */
import { expect, test } from '@playwright/test';
import { advance, describe, ig, key, node, open, pad, screen, shot, state } from './helpers';

test('main menu: Play enters the game with the keyboard only (P1)', async ({ page }) => {
  await open(page, { save: 'new-player' });
  expect(await screen(page)).toBe('menu');
  expect(await node(page, 'menu.play')).toMatchObject({ role: 'button', label: 'Play', enabled: true, focused: true });
  await shot(page, 'menu');
  await key(page, 'Enter');
  expect(await screen(page)).toBe('game');
  expect((await node(page, 'game.combat')).focused).toBe(true);
});

test('settings: music volume changes and persists (RFR-47)', async ({ page }) => {
  await open(page, { save: 'new-player', scene: 'settings' });
  const before = (await node(page, 'settings.volume')).value;
  await pad(page, 'A'); // focus starts on "Music +"
  const after = (await node(page, 'settings.volume')).value;
  expect(after).not.toBe(before);
  expect(await page.evaluate(() => localStorage.getItem('ig.settings'))).toContain(String(Number.parseInt(after ?? '0', 10)));
  await pad(page, 'B');
  expect(await screen(page)).toBe('menu');
});

test('combat: the squad searches, fights on its own and gamepad clicks add damage (P2, P3, RFR-43)', async ({ page }) => {
  await open(page, { save: 'new-player', scene: 'game' });
  expect(await node(page, 'game.combat')).toMatchObject({ label: 'Your squad is searching for a monster', enabled: false });
  expect((await ig(page, (g) => g.world())).field[0]).toMatchObject({ heroId: 'ranger', pose: 'walk' });
  await advance(page, 300);
  const target = await node(page, 'game.combat');
  expect(target).toMatchObject({ label: 'Attack Slime', value: '50/50 HP', enabled: true, focused: true });
  expect(await node(page, 'game.progress')).toMatchObject({ value: '1/10' });
  expect((await ig(page, (g) => g.world())).field[0]).toMatchObject({ pose: 'idle' });
  await shot(page, 'combat');
  await pad(page, 'A');
  // A click is 5% of the squad DPS: ranger 12 power x 1.5 (favored Nature) = 18 dps -> 0.9 damage.
  let s = await state(page);
  expect(s.combat.clicks).toBe(1);
  expect(s.combat.foe?.hp).toBeCloseTo(49.1, 6);
  expect((await ig(page, (g) => g.world())).field[0]?.pose).toBe('idle'); // a click is not a hero attack
  await advance(page, 2800); // 49.1 HP left at 18 dps
  s = await state(page);
  expect(s.combat.kills).toBe(1);
  expect(s.gold).toBe(5);
  expect((await node(page, 'game.gold')).value).toBe('5');
  expect(await node(page, 'game.progress')).toMatchObject({ value: '2/10' });
});

test('combat: damage floats over the foe, and the click shows its own number', async ({ page }) => {
  await open(page, { save: 'new-player', scene: 'game' });
  await advance(page, 300);
  await pad(page, 'A');
  const clickHit = (await ig(page, (g) => g.world())).damage.at(-1);
  expect(clickHit).toMatchObject({ text: '0.9', click: true });
  await advance(page, 1000);
  const hits = (await ig(page, (g) => g.world())).damage;
  expect(hits.some((d) => !d.click)).toBe(true);
});

test('combat: keyboard Space clicks while the Combat View is focused (RFR-43)', async ({ page }) => {
  await open(page, { save: 'new-player', scene: 'game' });
  await advance(page, 300);
  await key(page, 'Space');
  expect((await state(page)).combat.clicks).toBe(1);
});

test('combat: a mouse click on the world clicks the foe (P2)', async ({ page }) => {
  await open(page, { save: 'new-player', scene: 'game' });
  await advance(page, 300);
  await page.locator('[data-node-id="game.combat"]').click();
  expect((await state(page)).combat.clicks).toBe(1);
});

test('combat: ten kills clear the stage and the fight moves to stage 2 (P1)', async ({ page }) => {
  await open(page, { save: 'new-player', scene: 'game' });
  await advance(page, 40_000);
  expect(await node(page, 'game.stage')).toMatchObject({ value: '1' });
  expect(await node(page, 'game.current')).toMatchObject({ value: '2' });
});

test('offline accrual: eight hours away shows the welcome-back notice, which leaves after 6 s (P10)', async ({ page }) => {
  await open(page, { save: 'offline-8h', scene: 'game' });
  const notices = (await describe(page)).filter((n) => n.id.startsWith('game.notice.'));
  expect(notices.map((n) => n.label)).toEqual(['Welcome back! Your Active Squad earned 57,600.00 gold over 8h offline.']);
  expect((await node(page, 'game.gold')).value).toBe('57,918');
  await shot(page, 'offline-summary');
  await advance(page, 6000);
  expect((await describe(page)).some((n) => n.id.startsWith('game.notice.'))).toBe(false);
});

test('HUD menus open with R / I / M and back closes them; back on the bare game does nothing', async ({ page }) => {
  await open(page, { save: 'mid-game', scene: 'game' });
  for (const [k, s] of [['KeyR', 'roster'], ['KeyI', 'equipment'], ['KeyM', 'stages']] as const) {
    await key(page, k);
    expect(await screen(page)).toBe(s);
    await key(page, 'Escape');
    expect(await screen(page)).toBe('game');
  }
  await key(page, 'Escape');
  expect(await screen(page)).toBe('game');
});

test('field: one node per squad hero, attacks follow the interval, portrait fallback is flagged (COMBAT-02)', async ({ page }) => {
  await open(page, { save: 'new-player', scene: 'game' });
  await advance(page, 300);
  const nodes = (await describe(page)).filter((n) => n.id.startsWith('game.field.'));
  expect(nodes.map((n) => n.id)).toEqual(['game.field.ranger']);
  expect(nodes[0]).toMatchObject({ enabled: true });
  expect(nodes[0]?.value).toMatch(/^\d+\/\d+ HP$/);
  const before = (await ig(page, (g) => g.world())).field[0];
  expect(before?.portraitFallback).toBe(true);
  await advance(page, 3000);
  const after = (await ig(page, (g) => g.world())).field[0];
  expect(after?.attacks).toBeGreaterThan(before?.attacks ?? 0);
});
