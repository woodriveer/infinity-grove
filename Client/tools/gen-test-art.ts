/**
 * `npm run gen:test-art`: writes the code-generated `test-hero` layers and `test-blade` weapon to `assets/`
 * (hero-art-pipeline T15). Flat colored placeholders for tests; the release build leaves them out
 * (`TEST_ASSET_KEYS`). Uses the same generator and JSON normalization as the art:export tests.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { normalizeSheetJson } from './lib/artExport';
import { TEST_HERO_ID, TEST_HERO_LAYERS, testHeroLayer, testWeapon, type RawAsepriteOutput } from './lib/testHero';

function write(dir: string, name: string, out: RawAsepriteOutput): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${name}.png`), out.png);
  writeFileSync(join(dir, `${name}.json`), normalizeSheetJson(JSON.stringify(out.json), `${name}.png`));
}

for (const layer of TEST_HERO_LAYERS) write(join('assets', 'heroes', TEST_HERO_ID), layer, testHeroLayer(layer));
write(join('assets', 'items', 'weapons'), 'test-blade', testWeapon());
console.log('gen:test-art: test-hero layers + test-blade written');
