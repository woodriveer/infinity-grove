import type { z } from 'zod';
import type {
  Equipment,
  EquipmentItemData,
  GameSettings,
  HeroData,
  MonsterData,
  StageData,
} from '../../domain/content/types';
import type { ContentEntry } from '../ports';
import {
  CONTENT_KINDS,
  settingsSchema,
  type AnimationData,
  type ContentKind,
  type EffectData,
  type FrameData,
} from './schema';

/** Validated, cross-referenced content (AD-8). Every list is sorted by id. */
export interface ContentCatalog {
  readonly settings: GameSettings;
  readonly heroes: readonly HeroData[];
  readonly monsters: readonly MonsterData[];
  readonly stages: readonly StageData[];
  readonly items: readonly EquipmentItemData[];
  readonly equipment: readonly Equipment[];
  readonly animations: readonly AnimationData[];
  readonly effects: readonly EffectData[];
  readonly frames: readonly FrameData[];
  hero(heroId: string): HeroData;
  heroByServerId(serverHeroId: string): HeroData | null;
  monster(monsterId: string): MonsterData;
  stage(stageId: string): StageData;
  item(itemId: string): EquipmentItemData;
  equipmentById(equipmentId: string): Equipment | null;
}

export class ContentError extends Error {
  constructor(readonly problems: readonly string[]) {
    super(`Content is invalid (${problems.length} problem${problems.length === 1 ? '' : 's'}):\n${problems.map((p) => `  - ${p}`).join('\n')}`);
    this.name = 'ContentError';
  }
}

const SETTINGS_PATH = 'settings/game.json';

/**
 * Validates schema, id/file-name agreement, uniqueness and every cross-reference;
 * every problem names the file and field (RNFR-11). Throws ContentError listing all
 * problems at once. `assetKeys` is the generated manifest's key list.
 */
export function loadContent(entries: readonly ContentEntry[], assetKeys: readonly string[]): ContentCatalog {
  const problems: string[] = [];
  const byKind: Record<ContentKind, unknown[]> = {
    heroes: [], monsters: [], stages: [], items: [], equipment: [], animations: [], effects: [], frames: [],
  };
  let settings: GameSettings | null = null;
  const assets = new Set(assetKeys);
  const seenIds: Record<string, Map<string, string>> = {};

  const sorted = [...entries].sort((a, b) => a.path.localeCompare(b.path));
  for (const entry of sorted) {
    const path = entry.path.replace(/\\/g, '/');
    if (path === SETTINGS_PATH) {
      const r = settingsSchema.safeParse(entry.json);
      if (r.success) settings = r.data;
      else problems.push(...issues(path, r.error));
      continue;
    }
    const [kind, file] = path.split('/');
    if (!kind || !file || !(kind in CONTENT_KINDS)) {
      problems.push(`${path}: unknown content kind '${kind ?? ''}' (expected one of ${Object.keys(CONTENT_KINDS).join(', ')}, or ${SETTINGS_PATH})`);
      continue;
    }
    const def = CONTENT_KINDS[kind as ContentKind];
    const r = (def.schema as z.ZodType).safeParse(entry.json);
    if (!r.success) {
      problems.push(...issues(path, r.error));
      continue;
    }
    const data = r.data as Record<string, unknown>;
    const entityId = String(data[def.idField]);
    const expected = file.replace(/\.json$/, '');
    if (entityId !== expected) problems.push(`${path}: ${def.idField} '${entityId}' must equal the file name '${expected}'`);
    const ids = (seenIds[kind] ??= new Map());
    const dup = ids.get(entityId);
    if (dup) problems.push(`${path}: duplicate ${def.idField} '${entityId}' (also in ${dup})`);
    else ids.set(entityId, path);
    byKind[kind as ContentKind].push(data);
  }

  const heroes = byKind.heroes as HeroData[];
  const monsters = byKind.monsters as MonsterData[];
  const stages = byKind.stages as StageData[];
  const items = byKind.items as EquipmentItemData[];
  const equipment = byKind.equipment as Equipment[];
  const animations = byKind.animations as AnimationData[];
  const effects = byKind.effects as EffectData[];
  const frames = byKind.frames as FrameData[];

  // Cross-references.
  const assetRef = (path: string, field: string, key: string) => {
    if (key !== '' && !assets.has(key)) problems.push(`${path}: ${field} '${key}' is not an asset key (run npm run gen:assets?)`);
  };
  const serverIds = new Map<string, string>();
  for (const h of heroes) {
    const path = `heroes/${h.heroId}.json`;
    assetRef(path, 'portrait', h.portrait);
    if (h.serverHeroId !== '') {
      const key = h.serverHeroId.toLowerCase();
      const other = serverIds.get(key);
      if (other) problems.push(`${path}: serverHeroId duplicates heroes/${other}.json`);
      serverIds.set(key, h.heroId);
    }
  }
  for (const m of monsters) assetRef(`monsters/${m.monsterId}.json`, 'sprite', m.sprite);
  for (const i of items) assetRef(`items/${i.itemId}.json`, 'icon', i.icon);
  const stageNumbers = new Map<number, string>();
  for (const s of stages) {
    const other = stageNumbers.get(s.stageNumber);
    if (other) problems.push(`stages/${s.stageId}.json: stageNumber ${s.stageNumber} duplicates stages/${other}.json`);
    stageNumbers.set(s.stageNumber, s.stageId);
  }
  for (const a of animations) {
    for (const [name, v] of Object.entries(a.variants)) {
      if (!assets.has(v.sheet)) problems.push(`animations/${a.characterId}.json: variants.${name}.sheet '${v.sheet}' is not an asset key`);
    }
    for (const [itemId, variant] of Object.entries(a.variantByItemId)) {
      if (!(variant in a.variants)) problems.push(`animations/${a.characterId}.json: variantByItemId.${itemId} '${variant}' is not a variant`);
    }
  }
  for (const e of effects) assetRef(`effects/${e.effectId}.json`, 'texture', e.texture);
  for (const f of frames) assetRef(`frames/${f.frameId}.json`, 'image', f.image);

  if (!settings) {
    problems.push(`${SETTINGS_PATH}: missing`);
  } else {
    if (!heroes.some((h) => h.heroId === settings!.starterHeroId)) {
      problems.push(`${SETTINGS_PATH}: starterHeroId '${settings.starterHeroId}' has no heroes/${settings.starterHeroId}.json`);
    }
    if (!equipment.some((e) => e.equipmentId === settings!.startingEquipmentId)) {
      problems.push(`${SETTINGS_PATH}: startingEquipmentId '${settings.startingEquipmentId}' has no equipment/${settings.startingEquipmentId}.json`);
    }
    settings.monsterPool.forEach((m, i) => {
      if (!monsters.some((x) => x.monsterId === m)) problems.push(`${SETTINGS_PATH}: monsterPool[${i}] '${m}' has no monsters/${m}.json`);
    });
  }

  if (problems.length > 0) throw new ContentError(problems);

  const index = <T>(list: T[], key: (t: T) => string) => new Map(list.map((t) => [key(t), t]));
  const heroMap = index(heroes, (h) => h.heroId);
  const serverMap = index(heroes.filter((h) => h.serverHeroId !== ''), (h) => h.serverHeroId.toLowerCase());
  const monsterMap = index(monsters, (m) => m.monsterId);
  const stageMap = index(stages, (s) => s.stageId);
  const itemMap = index(items, (i) => i.itemId);
  const equipmentMap = index(equipment, (e) => e.equipmentId);
  const must = <T>(map: Map<string, T>, kind: string, key: string): T => {
    const v = map.get(key);
    if (v === undefined) throw new Error(`Unknown ${kind} '${key}'`);
    return v;
  };

  return {
    settings: settings as GameSettings,
    heroes: [...heroes].sort((a, b) => a.heroId.localeCompare(b.heroId)),
    monsters,
    stages: [...stages].sort((a, b) => a.stageNumber - b.stageNumber),
    items,
    equipment,
    animations,
    effects,
    frames,
    hero: (heroId) => must(heroMap, 'hero', heroId),
    heroByServerId: (serverHeroId) => serverMap.get(serverHeroId.toLowerCase()) ?? null,
    monster: (monsterId) => must(monsterMap, 'monster', monsterId),
    stage: (stageId) => must(stageMap, 'stage', stageId),
    item: (itemId) => must(itemMap, 'item', itemId),
    equipmentById: (equipmentId) => equipmentMap.get(equipmentId) ?? null,
  };
}

function issues(path: string, error: z.ZodError): string[] {
  return error.issues.map((i) => `${path}: ${i.path.length > 0 ? i.path.join('.') : '(root)'}: ${i.message}`);
}
