/** hero-art-pipeline ART-03, ART-04, ART-11: one negative fixture per rule, one accepting fixture. */
import { describe, expect, it } from 'vitest';
import type { EquipmentItemData, HeroData } from '../../src/domain/content/types';
import { validateHeroArt } from '../../src/services/content/HeroArtRules';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = Record<string, any>;

const frame = (duration: number, canvas = 512) => ({
  frame: { x: 0, y: 0, w: 10, h: 10 },
  spriteSourceSize: { x: 0, y: 0, w: 10, h: 10 },
  sourceSize: { w: canvas, h: canvas },
  duration,
});
const key = (frameNo: number) => ({ frame: frameNo, bounds: { x: 1, y: 1, w: 1, h: 1 } });
const TAGS = ['idle', 'attack', 'hit', 'hurt', 'ko'];

/** Five frames of 100 ms, one tag per frame, `grip`/`tip` keyed at frame 0. */
function sheet(over: Json = {}): Json {
  return {
    frames: [0, 1, 2, 3, 4].map(() => frame(100)),
    meta: {
      size: { w: 512, h: 128 },
      frameTags: TAGS.map((name, i) => ({ name, from: i, to: i })),
      slices: [
        { name: 'grip', keys: [key(0)] },
        { name: 'tip', keys: [key(0)] },
      ],
    },
    ...over,
  };
}
const withMeta = (change: (meta: Json) => void): Json => {
  const s = sheet();
  change(s['meta']);
  return s;
};

const hero = (art: HeroData['art'] = { mode: 'layered' }) => ({ heroId: 'tide', art }) as HeroData;
const item = (itemId: string, weaponModel?: string) =>
  ({ itemId, visual: weaponModel === undefined ? undefined : { weaponModel } }) as EquipmentItemData;

const weapon = (): Json => ({
  frames: [{ ...frame(100, 128) }],
  meta: { size: { w: 128, h: 128 }, slices: [{ name: 'grip', keys: [key(0)] }, { name: 'tip', keys: [key(0)] }] },
});

function run(sheets: Record<string, unknown>, heroes = [hero()], items: EquipmentItemData[] = []): string[] {
  return validateHeroArt(heroes, items, new Map(Object.entries(sheets)), Object.keys(sheets));
}
const good = (): Record<string, unknown> => ({
  'heroes/tide/body': sheet(),
  'heroes/tide/armor_chest': sheet(),
  'items/weapons/blade': weapon(),
});

describe('validateHeroArt', () => {
  it('accepts a conforming hero and weapon', () => {
    expect(run(good(), [hero()], [item('blade-1', 'blade')])).toEqual([]);
  });

  it('ignores legacy and art-less heroes', () => {
    expect(run({}, [hero({ mode: 'legacy' }), { heroId: 'x' } as HeroData])).toEqual([]);
  });

  it('requires the body layer', () => {
    expect(run({ 'heroes/tide/armor_chest': sheet() })).toEqual([
      "heroes/tide.json: hero 'tide' has no body layer (heroes/tide/body)",
    ]);
  });

  it('requires every tag', () => {
    const body = withMeta((m) => (m['frameTags'] = m['frameTags'].filter((t: Json) => t['name'] !== 'hurt')));
    expect(run({ 'heroes/tide/body': body })).toEqual(["heroes/tide.json: hero 'tide' lacks the 'hurt' tag"]);
  });

  it('caps the attack tag at 600 ms', () => {
    const body = withMeta((m) => (m['frameTags'][1] = { name: 'attack', from: 1, to: 1 }));
    body['frames'][1] = frame(650);
    expect(run({ 'heroes/tide/body': body })).toEqual([
      "heroes/tide.json: hero 'tide' attack tag lasts 650 ms (max 600 ms)",
    ]);
  });

  it('requires a 512x512 canvas', () => {
    const layer = sheet();
    layer['frames'][0] = frame(100, 256);
    expect(run({ ...good(), 'heroes/tide/armor_chest': layer })).toEqual([
      'heroes/tide/armor_chest.json: frame 0 canvas is 256x256 (must be 512x512)',
    ]);
  });

  it('requires the same frame count in every layer', () => {
    const layer = sheet();
    layer['frames'].pop();
    layer['meta'].frameTags.pop();
    expect(run({ ...good(), 'heroes/tide/armor_chest': layer })).toEqual([
      'heroes/tide/armor_chest.json: 4 frames but heroes/tide/body.json has 5',
    ]);
  });

  it('requires the same durations in every layer', () => {
    const layer = sheet();
    layer['frames'][3] = frame(120);
    expect(run({ ...good(), 'heroes/tide/armor_chest': layer })).toEqual([
      'heroes/tide/armor_chest.json: frame 3 lasts 120 ms but heroes/tide/body.json has 100 ms',
    ]);
  });

  it('requires grip and tip keys for every frame', () => {
    const body = withMeta((m) => (m['slices'][0]['keys'] = [key(1)]));
    expect(run({ 'heroes/tide/body': body })).toEqual([
      "heroes/tide.json: hero 'tide' slice 'grip' has no key for frame 0",
    ]);
    const noTip = withMeta((m) => (m['slices'] = [m['slices'][0]]));
    expect(run({ 'heroes/tide/body': noTip })).toEqual([
      "heroes/tide.json: hero 'tide' slice 'tip' has no key for frame 0",
    ]);
  });

  it('caps layer sheets at 4096x4096', () => {
    const body = withMeta((m) => (m['size'] = { w: 4097, h: 512 }));
    expect(run({ 'heroes/tide/body': body })).toEqual(['heroes/tide/body.json: sheet is 4097x512 (max 4096x4096)']);
  });

  it('requires the weapon grip and tip slices', () => {
    const w = weapon();
    w['meta']['slices'] = [w['meta']['slices'][0]];
    expect(run({ 'items/weapons/blade': w }, [], [item('blade-1', 'blade')])).toEqual([
      "items/weapons/blade.json: weapon model lacks the 'tip' slice",
    ]);
  });

  it('caps weapon models at 256x256', () => {
    const w = weapon();
    w['frames'][0] = frame(100, 300);
    expect(run({ 'items/weapons/blade': w }, [], [item('blade-1', 'blade')])).toEqual([
      'items/weapons/blade.json: weapon model is 300x300 (max 256x256)',
    ]);
  });

  it('requires visual.weaponModel to resolve', () => {
    expect(run({}, [], [item('blade-1', 'ghost')])).toEqual([
      "items/blade-1.json: visual.weaponModel 'ghost' has no exported model (items/weapons/ghost)",
    ]);
  });

  it('reports an unreadable sheet with its field path', () => {
    expect(run({ 'heroes/tide/body': { frames: [] } })[0]).toMatch(/^heroes\/tide\/body\.json: frames/);
  });
});
