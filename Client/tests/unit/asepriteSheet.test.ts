/** hero-art-pipeline ART-03: the Aseprite json-array reader. */
import { describe, expect, it } from 'vitest';
import { parseAsepriteSheet, SheetError, sliceAt } from '../../src/services/content/AsepriteSheet';

const frame = (duration: number) => ({
  filename: 'f',
  frame: { x: 0, y: 0, w: 100, h: 120 },
  rotated: false,
  trimmed: true,
  spriteSourceSize: { x: 200, y: 150, w: 100, h: 120 },
  sourceSize: { w: 512, h: 512 },
  duration,
});

const sheet = () => ({
  frames: [frame(100), frame(100), frame(150), frame(200)],
  meta: {
    app: 'https://www.aseprite.org/',
    size: { w: 512, h: 128 },
    frameTags: [
      { name: 'idle', from: 0, to: 1, direction: 'forward' },
      { name: 'attack', from: 2, to: 3, direction: 'forward' },
    ],
    slices: [
      {
        name: 'grip',
        color: '#0000ffff',
        keys: [
          { frame: 2, bounds: { x: 300, y: 260, w: 1, h: 1 } },
          { frame: 0, bounds: { x: 280, y: 250, w: 1, h: 1 } },
        ],
      },
    ],
  },
});

describe('parseAsepriteSheet', () => {
  it('reads frame count, durations, canvas, tags and slice keys', () => {
    const info = parseAsepriteSheet(sheet());
    expect(info.frameCount).toBe(4);
    expect(info.durations).toEqual([100, 100, 150, 200]);
    expect(info.canvas).toEqual({ w: 512, h: 512 });
    expect(info.imageSize).toEqual({ w: 512, h: 128 });
    expect(info.tags.get('idle')).toEqual({ from: 0, to: 1, durationMs: 200 });
    expect(info.tags.get('attack')).toEqual({ from: 2, to: 3, durationMs: 350 });
    expect(info.slices.get('grip')?.map((k) => k.frame)).toEqual([0, 2]);
  });

  it('holds a slice key until the next one', () => {
    const info = parseAsepriteSheet(sheet());
    expect(sliceAt(info, 'grip', 1)).toEqual({ x: 280, y: 250, w: 1, h: 1 });
    expect(sliceAt(info, 'grip', 3)).toEqual({ x: 300, y: 260, w: 1, h: 1 });
    expect(sliceAt(info, 'tip', 0)).toBeNull();
  });

  it('accepts a sheet without tags or slices', () => {
    const s = sheet();
    delete (s.meta as Record<string, unknown>).frameTags;
    delete (s.meta as Record<string, unknown>).slices;
    const info = parseAsepriteSheet(s);
    expect(info.tags.size).toBe(0);
    expect(info.slices.size).toBe(0);
  });

  it('names the field of a malformed frame', () => {
    const s = sheet();
    (s.frames[2] as Record<string, unknown>).duration = 'fast';
    expect(() => parseAsepriteSheet(s)).toThrow(SheetError);
    try {
      parseAsepriteSheet(s);
    } catch (e) {
      expect((e as SheetError).problems[0]).toContain('frames.2.duration');
    }
  });

  it('rejects a document without frames', () => {
    expect(() => parseAsepriteSheet({ meta: {} })).toThrow(/frames/);
    expect(() => parseAsepriteSheet({ frames: [], meta: {} })).toThrow(/frames/);
  });

  it('rejects a tag outside the frames', () => {
    const s = sheet();
    s.meta.frameTags[1]!.to = 9;
    expect(() => parseAsepriteSheet(s)).toThrow(/meta\.frameTags\.1.*attack/);
  });
});
