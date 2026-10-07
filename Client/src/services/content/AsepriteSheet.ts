import { z } from 'zod';

/** Reader for the Aseprite json-array subset the hero art pipeline uses (hero-art-pipeline ART-03). */

const size = z.object({ w: z.number().int().nonnegative(), h: z.number().int().nonnegative() });
const rect = size.extend({ x: z.number().int(), y: z.number().int() });

const sheetSchema = z.object({
  frames: z
    .array(z.object({ duration: z.number().int().positive(), sourceSize: size, frame: rect, spriteSourceSize: rect }))
    .min(1),
  meta: z.object({
    size: size.optional(),
    frameTags: z
      .array(z.object({ name: z.string().min(1), from: z.number().int().nonnegative(), to: z.number().int().nonnegative() }))
      .default([]),
    slices: z
      .array(
        z.object({
          name: z.string().min(1),
          keys: z.array(z.object({ frame: z.number().int().nonnegative(), bounds: rect })),
        }),
      )
      .default([]),
  }),
});

export interface SheetTag {
  readonly from: number;
  readonly to: number;
  /** Sum of the durations of the tag's frames, in ms. */
  readonly durationMs: number;
}

export interface SheetSliceKey {
  /** First frame the key applies to; it holds until the next key. */
  readonly frame: number;
  readonly bounds: { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
}

export interface SheetInfo {
  readonly frameCount: number;
  readonly durations: readonly number[];
  /** Untrimmed canvas size (`sourceSize` of the first frame). */
  readonly canvas: { readonly w: number; readonly h: number };
  /** Size of the packed PNG (`meta.size`), or null when absent. */
  readonly imageSize: { readonly w: number; readonly h: number } | null;
  readonly tags: ReadonlyMap<string, SheetTag>;
  readonly slices: ReadonlyMap<string, readonly SheetSliceKey[]>;
}

export class SheetError extends Error {
  constructor(readonly problems: readonly string[]) {
    super(problems.join('; '));
  }
}

/** Parses an Aseprite json-array export. Throws `SheetError` naming each bad field. */
export function parseAsepriteSheet(json: unknown): SheetInfo {
  const r = sheetSchema.safeParse(json);
  if (!r.success) {
    throw new SheetError(r.error.issues.map((i) => `${i.path.length > 0 ? i.path.join('.') : '(root)'}: ${i.message}`));
  }
  const { frames, meta } = r.data;
  const durations = frames.map((f) => f.duration);
  const problems: string[] = [];
  const tags = new Map<string, SheetTag>();
  meta.frameTags.forEach((t, i) => {
    if (t.to < t.from || t.to >= frames.length) {
      problems.push(`meta.frameTags.${i}: tag "${t.name}" range ${t.from}-${t.to} is outside the ${frames.length} frames`);
      return;
    }
    let durationMs = 0;
    for (let f = t.from; f <= t.to; f++) durationMs += durations[f] ?? 0;
    tags.set(t.name, { from: t.from, to: t.to, durationMs });
  });
  const slices = new Map<string, readonly SheetSliceKey[]>();
  for (const s of meta.slices) {
    slices.set(s.name, [...s.keys].sort((a, b) => a.frame - b.frame));
  }
  if (problems.length > 0) throw new SheetError(problems);
  const canvas = frames[0]!.sourceSize;
  return { frameCount: frames.length, durations, canvas, imageSize: meta.size ?? null, tags, slices };
}

/** Bounds of a slice at a frame: the last key at or before it, or null when the slice has none yet. */
export function sliceAt(info: SheetInfo, name: string, frame: number): SheetSliceKey['bounds'] | null {
  const keys = info.slices.get(name);
  if (!keys) return null;
  let found: SheetSliceKey | null = null;
  for (const k of keys) if (k.frame <= frame) found = k;
  return found ? found.bounds : null;
}
