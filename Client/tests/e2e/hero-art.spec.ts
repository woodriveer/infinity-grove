/** Hero art paths (hero-art-pipeline ART-05, ART-07, ART-09): layered, legacy and portrait heroes on one field. */
import { expect, test } from '@playwright/test';
import { advance, ig, open } from './helpers';

const world = (page: Parameters<typeof ig>[0]) => ig(page, (g) => g.world());

test('layered, legacy and art-less heroes each use their own art path', async ({ page }) => {
  await open(page, { save: 'layered-squad', scene: 'game' });
  await advance(page, 300);
  const field = (await world(page)).field;
  const by = (id: string) => field.find((h) => h.heroId === id)!;
  expect(field.map((h) => h.heroId).sort()).toEqual(['krell', 'ranger', 'test-hero']);
  expect(by('test-hero')).toMatchObject({ art: 'layered', portraitFallback: false, weaponModel: 'test-blade', tint: { Chest: '#c04040', Gloves: '#808080', Boots: '#808080' } });
  expect(by('krell')).toMatchObject({ art: 'legacy', portraitFallback: false });
  expect(by('ranger')).toMatchObject({ art: 'portrait', portraitFallback: true });
});

test('a layered hero plays attack tags while fighting and reports no enchant band without bands', async ({ page }) => {
  await open(page, { save: 'layered-squad', scene: 'game' });
  await advance(page, 5000);
  const hero = (await world(page)).field.find((h) => h.heroId === 'test-hero')!;
  expect(hero.attacks).toBeGreaterThan(0);
  expect(['idle', 'attack', 'walk', 'hurt']).toContain(hero.tag);
  expect(hero.enchantBand).toBeNull();
});

test('a layered hero whose sheet is missing falls back to the portrait and logs its id once', async ({ page }) => {
  const logs: string[] = [];
  page.on('console', (m) => logs.push(m.text()));
  await page.route('**/heroes/test-hero/body.png', (r) => r.abort());
  await open(page, { save: 'layered-squad', scene: 'game' });
  await advance(page, 2000);
  const hero = (await world(page)).field.find((h) => h.heroId === 'test-hero')!;
  expect(hero).toMatchObject({ art: 'portrait', portraitFallback: true });
  expect(logs.filter((l) => l.includes("'test-hero'") && l.includes('failed to load'))).toHaveLength(1);
});
