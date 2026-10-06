/**
 * `npm run art:slice -- <spec.json>` (AD-9, RFR-45): wraps legacy sprite sheets in
 * Aseprite-format JSON once. A spec names the source sheets and their frame rects
 * (Unity Sprite Editor rects: origin bottom-left, as in the .meta files) and the
 * animation tags with per-frame durations (from the Unity .anim clips). The tool
 * packs every distinct frame into one strip, writes <output>.png + <output>.json,
 * and the pair is then the checked-in runtime source. Frames keep a common canvas
 * (sourceSize) and are centered in it, matching Unity's center pivot.
 *
 * Deterministic: same spec + sources → identical bytes.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { blank, blit, decodePng, encodePng, type Rgba } from './lib/png';

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Spec {
  /** Output path under assets/, without extension. */
  output: string;
  sources: Record<string, { png: string; frames: Rect[] }>;
  tags: Array<{ name: string; repeat: boolean; frames: Array<{ source: string; index: number; durationMs: number }> }>;
}

const specPaths = process.argv.slice(2);
if (specPaths.length === 0) {
  console.error('usage: npm run art:slice -- <spec.json> [...]');
  process.exit(1);
}

for (const specPath of specPaths) {
  const spec = JSON.parse(readFileSync(specPath, 'utf8')) as { variants: Spec[] };
  for (const variant of spec.variants) sliceVariant(variant, dirname(resolve(specPath)));
}

function sliceVariant(spec: Spec, baseDir: string): void {
  const images = new Map<string, Rgba>();
  for (const [name, src] of Object.entries(spec.sources)) {
    images.set(name, decodePng(readFileSync(join(baseDir, src.png)), `${spec.output}:${name}`));
  }

  // Distinct frames in first-use order.
  const used: Array<{ source: string; index: number }> = [];
  for (const tag of spec.tags) {
    for (const f of tag.frames) {
      if (!spec.sources[f.source]?.frames[f.index]) throw new Error(`${spec.output}: tag ${tag.name} references missing frame ${f.source}#${f.index}`);
      if (!used.some((u) => u.source === f.source && u.index === f.index)) used.push({ source: f.source, index: f.index });
    }
  }

  const rectOf = (u: { source: string; index: number }): Rect => spec.sources[u.source]!.frames[u.index]!;
  const canvasW = Math.max(...used.map((u) => rectOf(u).w));
  const canvasH = Math.max(...used.map((u) => rectOf(u).h));
  const pad = 2;
  const sheetW = used.reduce((sum, u) => sum + rectOf(u).w + pad, 0);
  const sheet = blank(sheetW, canvasH);

  const packed = new Map<string, Rect>();
  let x = 0;
  for (const u of used) {
    const r = rectOf(u);
    const img = images.get(u.source)!;
    const top = img.height - r.y - r.h; // Unity rects are bottom-left based
    blit(img, r.x, top, r.w, r.h, sheet, x, 0);
    packed.set(`${u.source}#${u.index}`, { x, y: 0, w: r.w, h: r.h });
    x += r.w + pad;
  }

  const name = spec.output.split('/').pop() as string;
  const frames: Record<string, unknown> = {};
  const frameTags: Array<{ name: string; from: number; to: number; direction: string; repeat?: string }> = [];
  let n = 0;
  for (const tag of spec.tags) {
    const from = n;
    for (const f of tag.frames) {
      const p = packed.get(`${f.source}#${f.index}`)!;
      frames[`${name} ${n}.aseprite`] = {
        frame: p,
        rotated: false,
        trimmed: true,
        spriteSourceSize: { x: Math.floor((canvasW - p.w) / 2), y: Math.floor((canvasH - p.h) / 2), w: p.w, h: p.h },
        sourceSize: { w: canvasW, h: canvasH },
        duration: f.durationMs,
      };
      n += 1;
    }
    frameTags.push({ name: tag.name, from, to: n - 1, direction: 'forward', ...(tag.repeat ? {} : { repeat: '1' }) });
  }

  const json = {
    frames,
    meta: {
      app: 'infinity-grove art:slice (Aseprite JSON format)',
      version: '1',
      image: `${name}.png`,
      format: 'RGBA8888',
      size: { w: sheet.width, h: sheet.height },
      scale: '1',
      frameTags,
      layers: [],
      slices: [],
    },
  };

  const out = resolve('assets', spec.output);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(`${out}.png`, encodePng(sheet));
  writeFileSync(`${out}.json`, `${JSON.stringify(json, null, 2)}\n`);
  console.log(`art:slice: ${spec.output} → ${used.length} frames, ${n} timeline frames, ${frameTags.length} tags (${sheet.width}x${sheet.height})`);
}
