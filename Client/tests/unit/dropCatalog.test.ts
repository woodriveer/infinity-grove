/** boss-drops T2: the drop catalog built from content (DROP-01, DROP-03, DROP-04). */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CraftingRules } from '../../src/domain/CraftingRules';
import { ALL_ASSET_KEYS } from '../../src/generated/assets.gen';
import { FsContentSource } from '../../src/platform/node/NodePorts';
import { loadContent } from '../../src/services/content/ContentLoader';
import type { ContentEntry } from '../../src/services/ports';
import { buildDropCatalog, renderDropCatalog } from '../../tools/lib/dropCatalog';

const entries = new FsContentSource(resolve(__dirname, '../../content')).entries();
const build = (list: readonly ContentEntry[] = entries) => loadContent(list, ALL_ASSET_KEYS);

describe('buildDropCatalog', () => {
  const catalog = buildDropCatalog(build());

  it('lists every syncable hero with its server id, type and minStage', () => {
    const content = build();
    for (const h of content.heroes.filter((x) => x.heroId !== 'test-hero')) {
      expect(catalog.heroes).toContainEqual({
        heroId: h.heroId,
        serverHeroId: h.serverHeroId,
        heroType: h.heroType,
        minStage: h.minStage ?? 1,
      });
    }
    expect(catalog.heroes.find((h) => h.heroId === 'test-hero')).toBeUndefined();
  });

  it('flags boss stages and keeps the favored type per stage', () => {
    const content = build();
    expect(catalog.stages).toHaveLength(content.stages.length);
    expect(catalog.stages.filter((s) => s.isBoss).map((s) => s.stageNumber)).toEqual([5, 10]);
    expect(catalog.stages[0]?.favoredType).toBe(content.stages.find((s) => s.stageNumber === 1)?.favoredType);
  });

  it('slot affix ranges equal CraftingRules', () => {
    expect(catalog.affixRanges.Weapon).toEqual(
      CraftingRules.affixesForSlot('Weapon').map((affix) => ({ affix, ...CraftingRules.affixRange(affix) })),
    );
    expect(catalog.affixRanges.Chest).toEqual([{ affix: 'Defense', min: 1, max: 40 }]);
    expect(Object.keys(catalog.affixRanges).sort()).toEqual(['Boots', 'Chest', 'Gloves', 'Weapon']);
  });

  it('carries chances, bag size, bands and item slots from content', () => {
    expect(catalog.normalDropChance).toBe(0.03);
    expect(catalog.bossDropChance).toBe(0.25);
    expect(catalog.bagCapacity).toBe(100);
    expect(catalog.itemBands[0]?.fromStage).toBe(1);
    expect(catalog.items).toContainEqual({ itemId: 'bark-blade', slot: 'Weapon' });
  });
});

describe('checked-in catalog', () => {
  it('matches content (gen:check detects a stale file)', () => {
    const file = readFileSync(resolve(__dirname, '../../../shared/drop-catalog/drop-catalog.json'), 'utf8');
    expect(file).toBe(renderDropCatalog(build()));
  });

  it('differs when a hero minStage changes without regeneration', () => {
    const file = readFileSync(resolve(__dirname, '../../../shared/drop-catalog/drop-catalog.json'), 'utf8');
    const changed = entries.map((e) =>
      e.path.endsWith('heroes/ranger.json') ? { ...e, json: { ...(e.json as object), minStage: 2 } } : e,
    );
    expect(renderDropCatalog(build(changed))).not.toBe(file);
  });
});
