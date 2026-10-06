/** P4, P5, P15: roster, tap-to-swap and fusion, by gamepad and keyboard only. */
import { expect, test } from '@playwright/test';
import { describe, focused, focusWith, key, node, open, pad, screen, shot, state } from './helpers';

test('roster shows the cap, the bench, type text and the fusable marker (P4, P15)', async ({ page }) => {
  await open(page, { save: 'full-squad-plus-bench', scene: 'roster' });
  const nodes = await describe(page);
  expect(nodes.find((n) => n.id === 'roster.active.title')?.label).toBe('Active Squad (5/5) - full, bench a hero to add another');
  expect(nodes.find((n) => n.id === 'roster.bench.title')?.label).toBe('Bench (1)');
  // Type is never color alone (NFR-3): abbreviation + name as text.
  expect(nodes.find((n) => n.id === 'roster.active.ranger.type')?.label).toBe('NAT · Nature');
  expect(nodes.find((n) => n.id === 'roster.bench.tide-caller.swap')).toMatchObject({ role: 'button', label: 'Swap', enabled: true });
  await shot(page, 'roster');
});

test('tap-to-swap with the gamepad only: pick the benched hero, then the slot; B cancels a pick (P4, RFR-43)', async ({ page }) => {
  await open(page, { save: 'full-squad-plus-bench', scene: 'roster' });
  await focusWith(page, 'roster.bench.tide-caller.swap', 'gamepad');
  await pad(page, 'A');
  expect(await node(page, 'roster.picking')).toMatchObject({ label: 'Swapping Tide Caller: choose the active hero to replace. Back cancels.' });
  await pad(page, 'B');
  expect((await describe(page)).some((n) => n.id === 'roster.picking')).toBe(false);
  expect(await screen(page)).toBe('roster');
  expect(await focused(page)).toBe('roster.bench.tide-caller.swap');

  await pad(page, 'A');
  await focusWith(page, 'roster.active.druid.swap-target', 'gamepad');
  await pad(page, 'A');
  expect((await state(page)).activeSquad).toEqual(['ranger', 'tide-caller', 'ember-warden', 'dawn-cleric', 'shade-stalker']);
});

test('bench and activate with the keyboard only (P4)', async ({ page }) => {
  await open(page, { save: 'mid-game', scene: 'roster' });
  await focusWith(page, 'roster.bench.ember-warden.activate', 'keyboard');
  await key(page, 'Enter');
  expect((await state(page)).activeSquad).toContain('ember-warden');
  await focusWith(page, 'roster.active.druid.bench', 'keyboard');
  await key(page, 'Enter');
  expect((await state(page)).activeSquad).not.toContain('druid');
});

test('fusion with the gamepad: the confirm opens on Cancel; a double press never fuses (P5, EXPERIENCE flow 3)', async ({ page }) => {
  await open(page, { save: 'fusion-ready', scene: 'fusion', hero: 'ranger' });
  expect(await node(page, 'fusion.fuse')).toMatchObject({ label: 'Fuse — 2/2 duplicates', enabled: true, focused: true });
  expect((await node(page, 'fusion.duplicates')).label).toBe('Duplicates: 2 / 2 required for next tier');
  await pad(page, 'A');
  expect(await node(page, 'fusion.confirm.cancel')).toMatchObject({ focused: true });
  expect((await node(page, 'fusion.confirm.body')).label).toBe('This permanently consumes 2 duplicates.');
  await shot(page, 'fusion-confirm');
  await pad(page, 'A'); // the habitual second press lands on Cancel
  expect((await state(page)).heroes[0]).toMatchObject({ starTier: 1, duplicatesOwned: 2 });
  await pad(page, 'A');
  await focusWith(page, 'fusion.confirm.fuse', 'gamepad');
  await pad(page, 'A');
  expect((await state(page)).heroes[0]).toMatchObject({ starTier: 2, duplicatesOwned: 0 });
  expect(await node(page, 'fusion.fuse')).toMatchObject({ label: 'Fuse — needs 3 duplicates, have 0', enabled: false });
});

test('fusion with the keyboard: Enter, Cancel by Esc, then fuse (P5, EXPERIENCE flow 2)', async ({ page }) => {
  await open(page, { save: 'fusion-ready', scene: 'fusion', hero: 'ranger' });
  await key(page, 'Enter');
  await key(page, 'Escape');
  expect((await describe(page)).some((n) => n.id === 'fusion.confirm.cancel')).toBe(false);
  await key(page, 'Enter');
  await focusWith(page, 'fusion.confirm.fuse', 'keyboard');
  await key(page, 'Enter');
  expect((await state(page)).heroes[0]?.starTier).toBe(2);
});
