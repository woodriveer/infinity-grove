import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ContentCatalog } from '../../src/services/content/ContentLoader';
import { validateHeroArt } from '../../src/services/content/HeroArtRules';

/**
 * Build-time hero art check (hero-art-pipeline ART-03, ART-04, ART-09): reads the Aseprite JSON of every
 * layered hero layer and every weapon model from `assetsDir` (by manifest key) and runs `validateHeroArt`.
 * Runtime `loadContent` does not do this; art rules are validate-only.
 */
export function checkHeroArt(catalog: ContentCatalog, assetsDir: string, assetKeys: readonly string[]): string[] {
  const keys = new Set<string>();
  for (const h of catalog.heroes) {
    if (h.art?.mode !== 'layered') continue;
    for (const layer of ['body', 'armor_chest', 'armor_gloves', 'armor_boots', 'fx']) keys.add(`heroes/${h.heroId}/${layer}`);
  }
  for (const i of catalog.items) {
    if (i.visual?.weaponModel !== undefined) keys.add(`items/weapons/${i.visual.weaponModel}`);
  }
  const sheets = new Map<string, unknown>();
  const problems: string[] = [];
  for (const key of keys) {
    if (!assetKeys.includes(key)) continue;
    const file = join(assetsDir, `${key}.json`);
    if (!existsSync(file)) continue;
    try {
      sheets.set(key, JSON.parse(readFileSync(file, 'utf8')));
    } catch (e) {
      problems.push(`${key}.json: not valid JSON (${(e as Error).message})`);
    }
  }
  return [...problems, ...validateHeroArt(catalog.heroes, catalog.items, sheets, assetKeys)];
}
