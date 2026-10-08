/** Session-replaced modal (SESSION-02 AC 3-5): another device took the account. */
import { expect, test, type Page } from '@playwright/test';
import { advance, describe, focused, node, open, pad, state } from './helpers';

const modalOpen = (page: Page) => page.waitForFunction(() => (window as unknown as { __ig: { describe(): Array<{ id: string }> } }).__ig.describe().some((n) => n.id === 'session.quit'));
const replace = (page: Page) => page.evaluate(() => (window as unknown as { __ig: { sessionReplaced(): void } }).__ig.sessionReplaced());

test('no modal before the first failing sync', async ({ page }) => {
  await open(page, { save: 'new-player', scene: 'game', backend: 'fake' });
  await replace(page);
  await advance(page, 40_000);
  expect((await describe(page)).some((n) => n.id.startsWith('session.'))).toBe(false);
});

test('the modal opens on Quit, pauses combat, and Play here by gamepad resumes it', async ({ page }) => {
  await open(page, { save: 'new-player', scene: 'game', backend: 'fake' });
  await advance(page, 40_000);
  expect(((await state(page)).pendingEvents as string[]).length).toBeGreaterThan(0);
  await replace(page);
  await advance(page, 61_000);
  await modalOpen(page);
  expect(await focused(page)).toBe('session.quit');
  expect((await node(page, 'session.playHere')).label).toBe('Play here');
  const frozen = (await state(page)).combat;
  await advance(page, 10_000);
  expect((await state(page)).combat).toEqual(frozen);
  await pad(page, 'B');
  expect(await focused(page)).toBe('session.quit');
  await pad(page, 'Right');
  expect(await focused(page)).toBe('session.playHere');
  await pad(page, 'A');
  await page.waitForFunction(() => !(window as unknown as { __ig: { describe(): Array<{ id: string }> } }).__ig.describe().some((n) => n.id.startsWith('session.')));
  await advance(page, 10_000);
  expect((await state(page)).combat.kills).toBeGreaterThan(frozen.kills);
});

test('Quit asks the shell to close the app', async ({ page }) => {
  await open(page, { save: 'new-player', scene: 'game', backend: 'fake' });
  await advance(page, 40_000);
  await replace(page);
  await advance(page, 61_000);
  await modalOpen(page);
  await page.evaluate(() => {
    (window as unknown as { __closed: number }).__closed = 0;
    window.close = () => void ((window as unknown as { __closed: number }).__closed += 1);
  });
  await pad(page, 'A');
  await expect.poll(() => page.evaluate(() => (window as unknown as { __closed: number }).__closed)).toBe(1);
});
