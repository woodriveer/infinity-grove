import type { EquipmentItemData, HeroData } from '../../domain/content/types';
import { parseAsepriteSheet, SheetError, sliceAt, type SheetInfo } from './AsepriteSheet';

/**
 * The hero art guide's rules (hero-art-pipeline ART-03, ART-04, ART-11) over parsed Aseprite JSON.
 * Pure: `sheets` maps asset key (`heroes/<id>/<layer>`, `items/weapons/<id>`) to the sheet JSON.
 * Problems are strings in the content loader's `file: message` form.
 */

export const REQUIRED_TAGS = ['idle', 'attack', 'hit', 'hurt', 'ko'] as const;
export const HERO_LAYERS = ['body', 'armor_chest', 'armor_gloves', 'armor_boots', 'fx'] as const;
export const MAX_ATTACK_MS = 600;
export const HERO_CANVAS = 512;
export const MAX_LAYER_PX = 4096;
export const MAX_WEAPON_PX = 256;

type Sheets = ReadonlyMap<string, unknown>;

const heroLayerKey = (heroId: string, layer: string) => `heroes/${heroId}/${layer}`;
const weaponKey = (model: string) => `items/weapons/${model}`;

function parse(key: string, sheets: Sheets, problems: string[]): SheetInfo | null {
  if (!sheets.has(key)) return null;
  try {
    return parseAsepriteSheet(sheets.get(key));
  } catch (e) {
    if (e instanceof SheetError) {
      for (const p of e.problems) problems.push(`${key}.json: ${p}`);
      return null;
    }
    throw e;
  }
}

function requiredTags(file: string, heroId: string, body: SheetInfo): string[] {
  return REQUIRED_TAGS.filter((t) => !body.tags.has(t)).map((t) => `${file}: hero '${heroId}' lacks the '${t}' tag`);
}

function attackDuration(file: string, heroId: string, body: SheetInfo): string[] {
  const attack = body.tags.get('attack');
  return attack && attack.durationMs > MAX_ATTACK_MS
    ? [`${file}: hero '${heroId}' attack tag lasts ${attack.durationMs} ms (max ${MAX_ATTACK_MS} ms)`]
    : [];
}

function canvasSize(layerFile: string, info: SheetInfo): string[] {
  return info.canvas.w === HERO_CANVAS && info.canvas.h === HERO_CANVAS
    ? []
    : [`${layerFile}: frame 0 canvas is ${info.canvas.w}x${info.canvas.h} (must be ${HERO_CANVAS}x${HERO_CANVAS})`];
}

function sameTiming(layerFile: string, bodyFile: string, layer: SheetInfo, body: SheetInfo): string[] {
  if (layer.frameCount !== body.frameCount) {
    return [`${layerFile}: ${layer.frameCount} frames but ${bodyFile} has ${body.frameCount}`];
  }
  const f = layer.durations.findIndex((d, i) => d !== body.durations[i]);
  return f < 0 ? [] : [`${layerFile}: frame ${f} lasts ${layer.durations[f]} ms but ${bodyFile} has ${body.durations[f]} ms`];
}

function pngSize(layerFile: string, info: SheetInfo): string[] {
  const s = info.imageSize;
  return s && (s.w > MAX_LAYER_PX || s.h > MAX_LAYER_PX)
    ? [`${layerFile}: sheet is ${s.w}x${s.h} (max ${MAX_LAYER_PX}x${MAX_LAYER_PX})`]
    : [];
}

function gripTipKeys(file: string, subject: string, info: SheetInfo, slices: readonly string[]): string[] {
  const out: string[] = [];
  for (const name of slices) {
    for (let f = 0; f < info.frameCount; f++) {
      if (sliceAt(info, name, f) === null) {
        out.push(`${file}: ${subject} slice '${name}' has no key for frame ${f}`);
        break;
      }
    }
  }
  return out;
}

function heroProblems(hero: HeroData, sheets: Sheets, out: string[]): void {
  const file = `heroes/${hero.heroId}.json`;
  const bodyKey = heroLayerKey(hero.heroId, 'body');
  const body = parse(bodyKey, sheets, out);
  if (!sheets.has(bodyKey)) {
    out.push(`${file}: hero '${hero.heroId}' has no body layer (${bodyKey})`);
    return;
  }
  if (!body) return;
  out.push(...requiredTags(file, hero.heroId, body), ...attackDuration(file, hero.heroId, body));
  out.push(...gripTipKeys(file, `hero '${hero.heroId}'`, body, ['grip', 'tip']));
  for (const layer of HERO_LAYERS) {
    const key = heroLayerKey(hero.heroId, layer);
    const info = layer === 'body' ? body : parse(key, sheets, out);
    if (!info) continue;
    const layerFile = `${key}.json`;
    out.push(...canvasSize(layerFile, info), ...pngSize(layerFile, info));
    if (layer !== 'body') out.push(...sameTiming(layerFile, `${bodyKey}.json`, info, body));
  }
}

function weaponProblems(model: string, sheets: Sheets, out: string[]): void {
  const key = weaponKey(model);
  const info = parse(key, sheets, out);
  if (!info) return;
  const file = `${key}.json`;
  for (const name of ['grip', 'tip']) {
    if (!info.slices.has(name)) out.push(`${file}: weapon model lacks the '${name}' slice`);
  }
  if (info.canvas.w > MAX_WEAPON_PX || info.canvas.h > MAX_WEAPON_PX) {
    out.push(`${file}: weapon model is ${info.canvas.w}x${info.canvas.h} (max ${MAX_WEAPON_PX}x${MAX_WEAPON_PX})`);
  }
}

/** Checks every layered hero and every weapon model against the guide; returns the problems (empty = valid). */
export function validateHeroArt(
  heroes: readonly HeroData[],
  items: readonly EquipmentItemData[],
  sheets: Sheets,
  assetKeys: readonly string[],
): string[] {
  const out: string[] = [];
  for (const hero of heroes) if (hero.art?.mode === 'layered') heroProblems(hero, sheets, out);
  const checked = new Set<string>();
  for (const item of items) {
    const model = item.visual?.weaponModel;
    if (model === undefined) continue;
    if (!assetKeys.includes(weaponKey(model))) {
      out.push(`items/${item.itemId}.json: visual.weaponModel '${model}' has no exported model (${weaponKey(model)})`);
    } else if (!checked.has(model)) {
      checked.add(model);
      weaponProblems(model, sheets, out);
    }
  }
  return out;
}
