/**
 * Code-generated `test-hero` art (hero-art-pipeline T13): flat colored layers with valid tags and slices,
 * shaped like raw Aseprite CLI output (packed, trimmed, json-array). Used as the stub Aseprite's output in the
 * export tests and as the source of the committed golden files; never real art.
 */
import { blank, encodePng } from './png';

export const TEST_HERO_ID = 'test-hero';
export const TEST_HERO_LAYERS = ['body', 'armor_chest', 'armor_gloves', 'armor_boots', 'fx'] as const;
export const TEST_WEAPON_MODEL = 'test-blade';

const FRAME_MS = 100;
const CELL = 8;
const TAGS = [
  { name: 'idle', from: 0, to: 0 },
  { name: 'attack', from: 1, to: 2 },
  { name: 'hit', from: 2, to: 2 },
  { name: 'hurt', from: 3, to: 3 },
  { name: 'ko', from: 4, to: 4 },
];
const FRAME_COUNT = 5;

const COLORS: Record<string, [number, number, number]> = {
  body: [200, 160, 120],
  armor_chest: [220, 220, 220],
  armor_gloves: [160, 160, 160],
  armor_boots: [100, 100, 100],
  fx: [255, 240, 120],
  weapon: [180, 200, 255],
};

export interface RawAsepriteOutput {
  png: Buffer;
  /** As the Aseprite CLI writes it: absolute `meta.image`, its own `app` and `version`. */
  json: Record<string, unknown>;
}

function slice(name: string, color: string, keys: Array<{ frame: number; x: number; y: number }>) {
  return { name, color, keys: keys.map((k) => ({ frame: k.frame, bounds: { x: k.x, y: k.y, w: 1, h: 1 } })) };
}

function flatSheet(layer: string, cells: number, cell: number, canvas: number, at: { x: number; y: number }): RawAsepriteOutput {
  const img = blank(cells * cell, cell);
  const [r, g, b] = COLORS[layer] ?? [255, 0, 255];
  for (let i = 0; i < img.data.length; i += 4) img.data.set([r, g, b, 255], i);
  const frames = Array.from({ length: cells }, (_, i) => ({
    filename: `${layer} ${i}.aseprite`,
    frame: { x: i * cell, y: 0, w: cell, h: cell },
    rotated: false,
    trimmed: true,
    spriteSourceSize: { x: at.x, y: at.y, w: cell, h: cell },
    sourceSize: { w: canvas, h: canvas },
    duration: FRAME_MS,
  }));
  return {
    png: encodePng(img),
    json: {
      frames,
      meta: {
        app: 'https://www.aseprite.org/',
        version: '1.3.10-x64',
        image: `C:\\Users\\dev\\AppData\\Local\\Temp\\ig-export\\${layer}.png`,
        format: 'RGBA8888',
        size: { w: img.width, h: img.height },
        scale: '1',
      },
    },
  };
}

/** One exportable layer of the test hero: 5 frames of 100 ms on a 512 × 512 canvas, tags and slices on every layer. */
export function testHeroLayer(layer: string): RawAsepriteOutput {
  const out = flatSheet(layer, FRAME_COUNT, CELL, 512, { x: 250, y: 400 });
  const meta = out.json['meta'] as Record<string, unknown>;
  meta['frameTags'] = TAGS.map((t) => ({ ...t, direction: 'forward' }));
  const perFrame = (dx: number, dy: number) =>
    Array.from({ length: FRAME_COUNT }, (_, frame) => ({ frame, x: 280 + dx + frame, y: 420 + dy }));
  meta['slices'] = [
    slice('grip', '#0000ffff', perFrame(0, 0)),
    slice('tip', '#ff0000ff', perFrame(30, -20)),
    slice('grip_behind', '#00ff00ff', [{ frame: 4, x: 284, y: 420 }]),
  ];
  return out;
}

/** The test weapon model: one 64 × 16 frame with `grip` at the handle and `tip` at the point. */
export function testWeapon(): RawAsepriteOutput {
  const img = blank(64, 16);
  const [r, g, b] = COLORS['weapon'] as [number, number, number];
  for (let i = 0; i < img.data.length; i += 4) img.data.set([r, g, b, 255], i);
  return {
    png: encodePng(img),
    json: {
      frames: [
        {
          filename: 'test-blade 0.aseprite',
          frame: { x: 0, y: 0, w: 64, h: 16 },
          rotated: false,
          trimmed: false,
          spriteSourceSize: { x: 0, y: 0, w: 64, h: 16 },
          sourceSize: { w: 64, h: 16 },
          duration: FRAME_MS,
        },
      ],
      meta: {
        app: 'https://www.aseprite.org/',
        version: '1.3.10-x64',
        image: 'C:\\Users\\dev\\AppData\\Local\\Temp\\ig-export\\test-blade.png',
        format: 'RGBA8888',
        size: { w: 64, h: 16 },
        scale: '1',
        frameTags: [],
        slices: [
          slice('tip', '#ff0000ff', [{ frame: 0, x: 60, y: 8 }]),
          slice('grip', '#0000ffff', [{ frame: 0, x: 4, y: 8 }]),
        ],
      },
    },
  };
}
