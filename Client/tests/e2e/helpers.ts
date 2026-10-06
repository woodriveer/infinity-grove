import { expect, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';

/** describe() node (RFR-16). */
export interface SNode {
  id: string;
  screen: string;
  role: string;
  label: string;
  enabled: boolean;
  value: string | null;
  focused: boolean;
  selected: boolean;
}

type Ig = {
  ready: boolean;
  describe(): SNode[];
  screen(): string;
  focused(): string | null;
  focusChangedAt(): number;
  interactiveIds(): string[];
  goto(screen: string, params?: Record<string, string>): void;
  advance(ms: number): void;
  input(arg: unknown): number;
  click(id: string): void;
  state(): Record<string, unknown> & { gold: number; activeSquad: string[]; heroes: Array<{ heroId: string; starTier: number; duplicatesOwned: number }>; combat: { state: string; kills: number } };
  world(): { krellAnimation: string | null };
};

/** Opens a boot URL (RFR-15) on the test build and waits for the dev hook. */
export async function open(page: Page, query: Record<string, string>): Promise<void> {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const q = new URLSearchParams({ seed: '42', clock: 'manual', ...query });
  await page.goto(`/?${q.toString()}`);
  await page.waitForFunction(() => (window as unknown as { __ig?: { ready: boolean } }).__ig?.ready === true);
  expect(errors, 'page errors during boot').toEqual([]);
}

export function ig<T>(page: Page, fn: (ig: Ig) => T): Promise<T> {
  return page.evaluate(`(${fn.toString()})(window.__ig)`) as Promise<T>;
}

export const describe = (page: Page) => ig(page, (g) => g.describe());
export const state = (page: Page) => ig(page, (g) => g.state());
export const focused = (page: Page) => ig(page, (g) => g.focused());
export const screen = (page: Page) => ig(page, (g) => g.screen());

export async function node(page: Page, id: string): Promise<SNode> {
  const n = (await describe(page)).find((x) => x.id === id);
  expect(n, `describe() has no node '${id}'`).toBeDefined();
  return n as SNode;
}

export async function key(page: Page, code: string): Promise<void> {
  await page.evaluate((c) => (window as unknown as { __ig: Ig }).__ig.input({ key: c }), code);
}

export async function pad(page: Page, button: string): Promise<void> {
  await page.evaluate((b) => (window as unknown as { __ig: Ig }).__ig.input({ gamepad: b }), button);
}

export async function advance(page: Page, ms: number): Promise<void> {
  await page.evaluate((m) => (window as unknown as { __ig: Ig }).__ig.advance(m), ms);
}

/**
 * Moves focus to a node with directional input only (gamepad D-pad or arrow keys),
 * as a player would. Fails naming the screen and node if it is unreachable (RNFR-11).
 */
export async function focusWith(page: Page, id: string, device: 'gamepad' | 'keyboard'): Promise<void> {
  // Runs in the page (one round trip) through the same input path as real devices.
  const result = await page.evaluate(
    ({ target, dev }) => {
      const g = (window as unknown as { __ig: Ig }).__ig;
      const dirs = dev === 'gamepad' ? ['Down', 'Right', 'Up', 'Left'] : ['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft'];
      for (const dir of dirs) {
        for (let i = 0; i < 60; i++) {
          if (g.focused() === target) return { ok: true, at: target, screen: g.screen() };
          g.input(dev === 'gamepad' ? { gamepad: dir } : { key: dir });
        }
      }
      return { ok: g.focused() === target, at: g.focused(), screen: g.screen() };
    },
    { target: id, dev: device },
  );
  if (!result.ok) {
    throw new Error(`${result.screen}: node '${id}' is unreachable with ${device} navigation (focus stayed on '${result.at}')`);
  }
}

/** Optional screenshots for the agent/developer (RFR-17); never asserted. */
export async function shot(page: Page, name: string): Promise<void> {
  if (!process.env['IG_SCREENSHOTS']) return;
  mkdirSync('artifacts/screenshots', { recursive: true });
  await page.waitForTimeout(150);
  await page.screenshot({ path: `artifacts/screenshots/${name}.png` });
}
