/**
 * boss-drops T2: builds the drop catalog the backend embeds (design decision 1).
 * Pure: content in, JSON text out. Deterministic (sorted, no timestamps) so gen:check can diff it.
 */
import { CraftingRules } from '../../src/domain/CraftingRules';
import { EQUIPMENT_SLOTS } from '../../src/domain/EquipmentSlot';
import type { ContentCatalog } from '../../src/services/content/ContentLoader';
import { TEST_HERO_ID } from './testHero';

export interface DropCatalogJson {
  heroes: { heroId: string; serverHeroId: string; heroType: string; minStage: number }[];
  stages: { stageNumber: number; favoredType: string; isBoss: boolean }[];
  itemBands: { fromStage: number; itemIds: string[] }[];
  items: { itemId: string; slot: string }[];
  affixRanges: Record<string, { affix: string; min: number; max: number }[]>;
  normalDropChance: number;
  bossDropChance: number;
  bagCapacity: number;
}

export function buildDropCatalog(c: ContentCatalog): DropCatalogJson {
  const byId = <T>(key: (x: T) => string) => (a: T, b: T) => key(a).localeCompare(key(b));
  return {
    // Heroes without a server id cannot sync; the generated test hero never drops.
    heroes: c.heroes
      .filter((h) => h.serverHeroId !== '' && h.heroId !== TEST_HERO_ID)
      .map((h) => ({ heroId: h.heroId, serverHeroId: h.serverHeroId, heroType: h.heroType, minStage: h.minStage ?? 1 }))
      .sort(byId((h) => h.heroId)),
    stages: [...c.stages]
      .sort((a, b) => a.stageNumber - b.stageNumber)
      .map((s) => ({ stageNumber: s.stageNumber, favoredType: s.favoredType, isBoss: s.boss !== undefined })),
    itemBands: c.drops.itemBands.map((b) => ({ fromStage: b.fromStage, itemIds: [...b.itemIds].sort() })),
    items: c.items.map((i) => ({ itemId: i.itemId, slot: i.slot })).sort(byId((i) => i.itemId)),
    affixRanges: Object.fromEntries(
      EQUIPMENT_SLOTS.map((slot) => [
        slot,
        CraftingRules.affixesForSlot(slot).map((affix) => ({ affix, ...CraftingRules.affixRange(affix) })),
      ]),
    ),
    normalDropChance: c.drops.normalChance,
    bossDropChance: c.drops.bossChance,
    bagCapacity: c.drops.bagCapacity,
  };
}

export const renderDropCatalog = (c: ContentCatalog): string => `${JSON.stringify(buildDropCatalog(c), null, 2)}\n`;
