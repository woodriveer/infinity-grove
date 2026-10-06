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

test('combat: walk, encounter, gamepad-only attacks kill the slime and award gold (P2, P3, RFR-43)', async ({ page }) => {
  await open(page, { save: 'new-player', scene: 'game' });
  expect(await node(page, 'game.combat')).toMatchObject({ label: 'Krell is searching for a monster', enabled: false });
  expect((await ig(page, (g) => g.world())).krellAnimation).toBe('walk');
  await advance(page, 2000);
  const target = await node(page, 'game.combat');
  expect(target).toMatchObject({ label: 'Attack Slime', value: '50/50 HP', enabled: true, focused: true });
  expect((await ig(page, (g) => g.world())).krellAnimation).toBe('idle');
  await shot(page, 'combat');
  await pad(page, 'A');
  // WCLAW01: level 1 × 5 + 10 bonus = 15 per hit (P3).
  expect((await node(page, 'game.combat')).value).toBe('35/50 HP');
  expect((await ig(page, (g) => g.world())).krellAnimation).toBe('punch');
  for (let i = 0; i < 3; i++) await pad(page, 'A');
  const s = await state(page);
  expect(s.combat.kills).toBe(1);
  expect(s.gold).toBeGreaterThanOrEqual(3);
  expect(s.gold).toBeLessThanOrEqual(8);
  expect((await node(page, 'game.gold')).value).toBe(String(s.gold));
  expect(s['pendingEvents']).toContain('GoldEarned');
});

test('combat: keyboard Space attacks while the Combat View is focused (RFR-43)', async ({ page }) => {
  await open(page, { save: 'new-player', scene: 'game' });
  await advance(page, 2000);
  await key(page, 'Space');
  expect((await node(page, 'game.combat')).value).toBe('35/50 HP');
});

test('combat: a mouse click on the world attacks (P2)', async ({ page }) => {
  await open(page, { save: 'new-player', scene: 'game' });
  await advance(page, 2000);
  await page.locator('[data-node-id="game.combat"]').click();
  expect((await node(page, 'game.combat')).value).toBe('35/50 HP');
});

test('offline accrual: eight hours away shows the welcome-back notice, which leaves after 6 s (P10)', async ({ page }) => {
  await open(page, { save: 'offline-8h', scene: 'game' });
  const notices = (await describe(page)).filter((n) => n.id.startsWith('game.notice.'));
  expect(notices.map((n) => n.label)).toEqual(['Welcome back! Your Active Squad earned 176.00 gold over 8h offline.']);
  expect((await node(page, 'game.gold')).value).toBe('426');
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
