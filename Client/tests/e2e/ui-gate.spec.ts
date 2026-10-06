/**
 * RFR-48 UI technology gate on the Roster spike (hybrid DOM menus), measured by the
 * agent: (1) gamepad-only focus walk reaches 100% of interactive nodes; (2) 200
 * scripted gamepad navigations with 0 failures; (3) visible focus updates within
 * 100 ms at p95; (5) describe() covers every visible element. Criterion 4 (Steam
 * overlay on a Deck) is not measurable here. Results → artifacts/ui-gate.json,
 * recorded in .antstack/specs/refactor-unity-to-phaser4/UI_GATE.md.
 *
 * Also RFR-43: every parity screen's interactive nodes are reachable by gamepad alone.
 */
import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { describe, ig, open, type SNode } from './helpers';

const results: Record<string, unknown> = {};

/** Walks focus with gamepad directions only and returns every node it visited. */
async function walk(page: Page): Promise<{ visited: string[]; interactive: string[] }> {
  return page.evaluate(() => {
    const g = (window as unknown as { __ig: { focused(): string | null; interactiveIds(): string[]; input(a: unknown): number } }).__ig;
    const interactive = g.interactiveIds();
    const visited = new Set<string>();
    for (const dir of ['Down', 'Right', 'Up', 'Left', 'Down', 'Right']) {
      for (let i = 0; i < interactive.length + 4; i++) {
        const f = g.focused();
        if (f) visited.add(f);
        g.input({ gamepad: dir });
      }
    }
    return { visited: [...visited], interactive };
  });
}

test.describe.configure({ mode: 'serial' });

test('criterion 1: a gamepad-only focus walk reaches 100% of the Roster nodes', async ({ page }) => {
  await open(page, { save: 'full-squad-plus-bench', scene: 'roster' });
  const { visited, interactive } = await walk(page);
  const missed = interactive.filter((id) => !visited.includes(id));
  results['criterion1'] = { interactive: interactive.length, reached: interactive.length - missed.length, missed };
  expect(missed).toEqual([]);
});

test('criterion 2: 200 scripted gamepad navigations, 0 failures', async ({ page }) => {
  await open(page, { save: 'full-squad-plus-bench', scene: 'roster' });
  const outcome = await page.evaluate(() => {
    const g = (window as unknown as { __ig: { focused(): string | null; describe(): Array<{ id: string; role: string }>; interactiveIds(): string[]; input(a: unknown): number } }).__ig;
    const dirs = ['Up', 'Down', 'Left', 'Right'];
    let seed = 20261006;
    const next = () => (seed = (seed * 1103515245 + 12345) >>> 0) % dirs.length;
    const failures: string[] = [];
    for (let i = 0; i < 200; i++) {
      const before = g.focused();
      const dir = dirs[next()] as string;
      g.input({ gamepad: dir });
      const after = g.focused();
      const ids = g.interactiveIds();
      if (after === null) failures.push(`#${i} ${dir}: focus lost`);
      else if (!g.describe().some((n) => n.id === after)) failures.push(`#${i} ${dir}: focus on '${after}', not in describe()`);
      else if (after === before && ids.length > 1) failures.push(`#${i} ${dir}: stuck on '${after}'`);
    }
    return failures;
  });
  results['criterion2'] = { navigations: 200, failures: outcome.length, details: outcome.slice(0, 10) };
  expect(outcome).toEqual([]);
});

test('criterion 3: visible focus updates within 100 ms at p95', async ({ page }) => {
  await open(page, { save: 'full-squad-plus-bench', scene: 'roster' });
  const samples = await page.evaluate(async () => {
    const g = (window as unknown as { __ig: { focused(): string | null; input(a: unknown): number } }).__ig;
    const out: number[] = [];
    const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
    for (let i = 0; i < 120; i++) {
      const t0 = g.input({ gamepad: i % 2 === 0 ? 'Down' : 'Up' });
      const id = g.focused();
      // Visible = the focused element carries the focus-ring class after a painted frame.
      for (let f = 0; f < 30; f++) {
        await frame();
        const el = id ? document.querySelector(`[data-node-id="${CSS.escape(id)}"]`) : null;
        if (el?.classList.contains('is-focused')) break;
      }
      out.push(performance.now() - t0);
    }
    return out;
  });
  const sorted = [...samples].sort((a, b) => a - b);
  const p95 = sorted[Math.floor(sorted.length * 0.95) - 1] as number;
  results['criterion3'] = { samples: samples.length, p50Ms: round(sorted[Math.floor(sorted.length / 2)] as number), p95Ms: round(p95), maxMs: round(sorted.at(-1) as number) };
  expect(p95).toBeLessThan(100);
});

test('criterion 5: describe() covers every visible element of the Roster', async ({ page }) => {
  await open(page, { save: 'full-squad-plus-bench', scene: 'roster' });
  await page.waitForSelector('[data-screen="roster"] [data-node-id="roster.close"]');
  const nodes = await describe(page);
  const dom = await page.evaluate(() => {
    const layer = document.querySelector('[data-screen="roster"]');
    const ids = [...(layer?.querySelectorAll('[data-node-id]') ?? [])].map((e) => e.getAttribute('data-node-id') as string);
    // Visible text that is not inside any element with a node id.
    const orphans: string[] = [];
    const walker = document.createTreeWalker(layer as Node, NodeFilter.SHOW_TEXT);
    for (let t = walker.nextNode(); t; t = walker.nextNode()) {
      const text = t.textContent?.trim();
      if (text && !(t.parentElement?.closest('[data-node-id]'))) orphans.push(text);
    }
    return { ids, orphans };
  });
  const described = new Set(nodes.map((n: SNode) => n.id));
  const notDescribed = dom.ids.filter((id) => !described.has(id));
  const notRendered = nodes.filter((n) => !dom.ids.includes(n.id)).map((n) => n.id);
  results['criterion5'] = { describedNodes: nodes.length, renderedNodes: dom.ids.length, notDescribed, notRendered, orphanText: dom.orphans };
  expect({ notDescribed, notRendered, orphans: dom.orphans }).toEqual({ notDescribed: [], notRendered: [], orphans: [] });
});

test.afterAll(() => {
  mkdirSync('artifacts', { recursive: true });
  writeFileSync('artifacts/ui-gate.json', `${JSON.stringify({ measuredAt: new Date().toISOString(), screen: 'roster', approach: 'hybrid (Preact DOM over Phaser)', ...results }, null, 2)}\n`);
});

for (const [scene, save, extra] of [
  ['menu', 'new-player', {}],
  ['settings', 'new-player', {}],
  ['game', 'mid-game', {}],
  ['roster', 'full-squad-plus-bench', {}],
  ['fusion', 'fusion-ready', { hero: 'ranger' }],
  ['equipment', 'crafting-ready', {}],
  ['stages', 'mid-game', {}],
] as const) {
  test(`RFR-43: every node on ${scene} is reachable by gamepad alone`, async ({ page }) => {
    await open(page, { save, scene, ...extra });
    if (scene === 'game') await ig(page, (g) => g.advance(2000));
    const { visited, interactive } = await walk(page);
    expect(interactive.filter((id) => !visited.includes(id)), `${scene}: unreachable nodes`).toEqual([]);
  });
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}
