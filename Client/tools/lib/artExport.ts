/**
 * Export policy of `npm run art:export` (hero-art-pipeline ART-01, ART-02, ART-11): which layers of an
 * `.aseprite` file are exported, where the files land, and how the Aseprite JSON is normalized so a second
 * export is byte-identical. Running Aseprite itself lives in `aseprite.ts`.
 */
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { exportLayer, listLayers, type RunProcess } from './aseprite';
import { HERO_LAYERS } from '../../src/services/content/HeroArtRules';


export interface ArtExportOptions {
  /** The `.aseprite` file: `art-src/heroes/<heroId>/<heroId>.aseprite` or `art-src/items/weapons/<modelId>.aseprite`. */
  file: string;
  /** The Client directory (holds `assets/` and `content/`). */
  root: string;
  exe: string;
  run?: RunProcess;
  warn?: (message: string) => void;
}

export interface ArtExportResult {
  /** Asset manifest keys written (e.g. `heroes/<heroId>/body`, `heroes/<heroId>/portrait`). */
  keys: string[];
}

/** Sorted keys at every depth, so output does not depend on the Aseprite version's field order. */
function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((k) => [k, sortKeys((value as Record<string, unknown>)[k])]),
    );
  }
  return value;
}

/** Drops machine-specific meta (`version`, absolute `image`) and fixes `app`, then renders with `\n` endings. */
export function normalizeSheetJson(raw: string, imageName: string): string {
  const doc = JSON.parse(raw) as { meta?: Record<string, unknown> };
  const meta = doc.meta ?? {};
  delete meta['version'];
  meta['app'] = 'https://www.aseprite.org/';
  meta['image'] = imageName;
  doc.meta = meta;
  return `${JSON.stringify(sortKeys(doc), null, 2)}\n`;
}

const skipped = (layer: string): boolean => /^(ref|guide)/i.test(layer);

interface Plan {
  /** Destination folder under `assets/`, relative. */
  dir: string;
  /** Output base name and the Aseprite layer it comes from (`null` = all visible layers). */
  outputs: Array<{ name: string; layer: string | null }>;
  /** Manifest key prefix. */
  keyPrefix: string;
  portrait: string | null;
}

async function plan(opts: ArtExportOptions, warn: (m: string) => void): Promise<Plan> {
  const file = resolve(opts.file);
  const norm = file.replace(/\\/g, '/');
  if (!existsSync(file)) throw new Error(`art:export: ${opts.file} does not exist`);

  if (norm.includes('/items/weapons/')) {
    const model = basename(file).replace(/\.aseprite$/i, '');
    return {
      dir: 'items/weapons',
      outputs: [{ name: model, layer: null }],
      keyPrefix: 'items/weapons/',
      portrait: null,
    };
  }

  const heroId = basename(dirname(file));
  const heroContent = join(opts.root, 'content', 'heroes', `${heroId}.json`);
  if (!existsSync(heroContent)) {
    throw new Error(
      `art:export: hero '${heroId}' (from the folder of ${opts.file}) has no content file ${heroContent}; add it first`,
    );
  }

  const layers = await listLayers(opts.exe, file, opts.run);
  const outputs: Plan['outputs'] = [];
  for (const layer of layers) {
    if (skipped(layer)) continue;
    if ((HERO_LAYERS as readonly string[]).includes(layer)) outputs.push({ name: layer, layer });
    else warn(`art:export: unknown layer '${layer}' in ${opts.file} is not exported (known: ${HERO_LAYERS.join(', ')})`);
  }
  if (!outputs.some((o) => o.name === 'body')) {
    throw new Error(`art:export: ${opts.file} has no 'body' layer (layers: ${layers.join(', ') || 'none'})`);
  }
  const portrait = join(dirname(file), 'portrait.png');
  if (!existsSync(portrait)) warn(`art:export: no portrait.png next to ${opts.file}; the portrait is not updated`);
  return { dir: `heroes/${heroId}`, outputs, keyPrefix: `heroes/${heroId}/`, portrait: existsSync(portrait) ? portrait : null };
}

/**
 * Exports every exportable layer to a temp dir first and only then copies into `assets/`, so a failing
 * Aseprite call leaves the previous files untouched.
 */
export async function exportArt(opts: ArtExportOptions): Promise<ArtExportResult> {
  const warn = opts.warn ?? ((m: string) => console.warn(m));
  const file = resolve(opts.file);
  const p = await plan(opts, warn);

  const tmp = mkdtempSync(join(tmpdir(), 'ig-art-export-'));
  try {
    const written: Array<{ name: string; png: string; json: string }> = [];
    for (const out of p.outputs) {
      const base = join(tmp, out.name);
      await exportLayer(opts.exe, file, out.layer, base, opts.run);
      if (!existsSync(`${base}.png`) || !existsSync(`${base}.json`)) {
        throw new Error(`art:export: Aseprite wrote no ${out.name}.png/.json for ${opts.file}`);
      }
      written.push({ name: out.name, png: `${base}.png`, json: normalizeSheetJson(readFileSync(`${base}.json`, 'utf8'), `${out.name}.png`) });
    }

    const target = join(opts.root, 'assets', p.dir);
    mkdirSync(target, { recursive: true });
    const keys: string[] = [];
    for (const w of written) {
      copyFileSync(w.png, join(target, `${w.name}.png`));
      writeFileSync(join(target, `${w.name}.json`), w.json);
      keys.push(`${p.keyPrefix}${w.name}`);
    }
    if (p.portrait !== null) {
      copyFileSync(p.portrait, join(target, 'portrait.png'));
      keys.push(`${p.keyPrefix}portrait`);
    }
    return { keys };
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}
