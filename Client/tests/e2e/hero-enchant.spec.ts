/** Enchant effects, attack speed and the hit event on layered heroes (hero-art-pipeline ART-08). */
import { expect, test } from '@playwright/test';
import { advance, ig, open } from './helpers';

const testHero = async (page: Parameters<typeof ig>[0]) => (await ig(page, (g) => g.world())).field.find((h) => h.heroId === 'test-hero')!;

const CASES: Array<[number, number | null, string[]]> = [
  [6, null, []],
  [7, 7, ['glow']],
  [10, 10, ['glow', 'aura']],
  [15, 15, ['glow', 'aura', 'particles']],
];

for (const [level, band, effects] of CASES) {
  test(`a +${level} weapon reports band ${band} and shows ${effects.join('+') || 'no effect'}`, async ({ page }) => {
    await open(page, { save: `layered-squad-e${level}`, scene: 'game', effects: 'on' });
    await advance(page, 300);
    expect(await testHero(page)).toMatchObject({ enchantBand: band, effects });
  });
}

test('effects off shows no enchant effect although the band is reported', async ({ page }) => {
  await open(page, { save: 'layered-squad-e15', scene: 'game' });
  await advance(page, 300);
  expect(await testHero(page)).toMatchObject({ enchantBand: 15, effects: [] });
});

test('the attack plays no slower than normal speed and the hit event fires once for one attack', async ({ page }) => {
  await open(page, { save: 'layered-squad-e6', scene: 'game' });
  await advance(page, 800);
  expect((await testHero(page)).attacks).toBe(1);
  // Phaser animations run in real time while the game clock is stepped: wait for the pass to reach its hit frame.
  await expect.poll(async () => (await testHero(page)).hits, { timeout: 20_000 }).toBe(1);
  await page.waitForTimeout(1000);
  const hero = await testHero(page);
  expect(hero.hits).toBe(1);
  expect(hero.attackSpeed).toBeGreaterThanOrEqual(1);
});
