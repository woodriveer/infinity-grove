/** hero-art-pipeline T13: `exportArt` against a stub Aseprite. ART-01, ART-02, ART-11. */
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { exportArt, normalizeSheetJson } from '../../tools/lib/artExport';
import type { RunProcess } from '../../tools/lib/aseprite';
import { parseAsepriteSheet } from '../../src/services/content/AsepriteSheet';
import { validateHeroArt } from '../../src/services/content/HeroArtRules';
import {
  TEST_HERO_ID,
  TEST_HERO_LAYERS,
  TEST_WEAPON_MODEL,
  testHeroLayer,
  testWeapon,
  type RawAsepriteOutput,
} from '../../tools/lib/testHero';

const GOLDEN = join(__dirname, '..', 'fixtures', 'art-export');

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'ig-art-test-'));
  mkdirSync(join(root, 'content', 'heroes'), { recursive: true });
  mkdirSync(join(root, 'art-src', 'heroes', TEST_HERO_ID), { recursive: true });
  mkdirSync(join(root, 'art-src', 'items', 'weapons'), { recursive: true });
  writeFileSync(join(root, 'content', 'heroes', `${TEST_HERO_ID}.json`), '{}');
  writeFileSync(join(root, 'art-src', 'heroes', TEST_HERO_ID, `${TEST_HERO_ID}.aseprite`), 'stub');
  writeFileSync(join(root, 'art-src', 'heroes', TEST_HERO_ID, 'portrait.png'), testHeroLayer('body').png);
  writeFileSync(join(root, 'art-src', 'items', 'weapons', `${TEST_WEAPON_MODEL}.aseprite`), 'stub');
});

afterEach(() => rmSync(root, { recursive: true, force: true }));

const heroFile = () => join(root, 'art-src', 'heroes', TEST_HERO_ID, `${TEST_HERO_ID}.aseprite`);
const weaponFile = () => join(root, 'art-src', 'items', 'weapons', `${TEST_WEAPON_MODEL}.aseprite`);

/** A stand-in for the Aseprite executable: lists layers, writes recorded sheets for `--layer`. */
function stub(opts: { layers?: string[]; failOn?: string; calls?: string[][] } = {}): RunProcess {
  const layers = opts.layers ?? [...TEST_HERO_LAYERS, 'ref sketch', 'guide grid'];
  return async (_exe, args) => {
    opts.calls?.push([...args]);
    if (args.includes('--list-layers')) return { code: 0, stderr: '', stdout: layers.join('\r\n') + '\r\n' };
    const layer = args.includes('--layer') ? (args[args.indexOf('--layer') + 1] as string) : null;
    if (layer !== null && layer === opts.failOn) return { code: 1, stderr: 'boom' };
    const raw: RawAsepriteOutput = layer === null ? testWeapon() : testHeroLayer(layer);
    writeFileSync(args[args.indexOf('--sheet') + 1] as string, raw.png);
    writeFileSync(args[args.indexOf('--data') + 1] as string, JSON.stringify(raw.json));
    return { code: 0, stderr: '' };
  };
}

const list = (dir: string): string[] => (existsSync(dir) ? readdirSync(dir).sort() : []);
const readAll = (dir: string): Buffer[] => list(dir).map((f) => readFileSync(join(dir, f)));

describe('exportArt (hero)', () => {
  it('writes every known layer and the portrait; skips ref/guide layers', async () => {
    const res = await exportArt({ file: heroFile(), root, exe: 'ase', run: stub() });
    expect(list(join(root, 'assets', 'heroes', TEST_HERO_ID))).toEqual([
      'armor_boots.json', 'armor_boots.png', 'armor_chest.json', 'armor_chest.png',
      'armor_gloves.json', 'armor_gloves.png', 'body.json', 'body.png', 'fx.json', 'fx.png', 'portrait.png',
    ]);
    expect(res.keys).toEqual([
      ...TEST_HERO_LAYERS.map((l) => `heroes/${TEST_HERO_ID}/${l}`),
      `heroes/${TEST_HERO_ID}/portrait`,
    ]);
  });

  it('matches the committed golden files', async () => {
    await exportArt({ file: heroFile(), root, exe: 'ase', run: stub() });
    const out = join(root, 'assets', 'heroes', TEST_HERO_ID);
    const golden = join(GOLDEN, 'heroes', TEST_HERO_ID);
    if (process.env['UPDATE_GOLDEN'] === '1') cpSync(out, golden, { recursive: true });
    expect(list(golden)).toEqual(list(out));
    for (const f of list(out)) expect(readFileSync(join(out, f)).equals(readFileSync(join(golden, f))), f).toBe(true);
  });

  it('is byte-identical on a second export', async () => {
    const out = join(root, 'assets', 'heroes', TEST_HERO_ID);
    await exportArt({ file: heroFile(), root, exe: 'ase', run: stub() });
    const first = readAll(out);
    await exportArt({ file: heroFile(), root, exe: 'ase', run: stub() });
    const second = readAll(out);
    expect(second.every((b, i) => b.equals(first[i] as Buffer))).toBe(true);
  });

  it('writes normalized JSON: no version, relative image, LF endings', async () => {
    await exportArt({ file: heroFile(), root, exe: 'ase', run: stub() });
    const text = readFileSync(join(root, 'assets', 'heroes', TEST_HERO_ID, 'body.json'), 'utf8');
    expect(text).not.toContain('\r');
    expect(text.endsWith('\n')).toBe(true);
    const meta = (JSON.parse(text) as { meta: Record<string, unknown> }).meta;
    expect(meta['image']).toBe('body.png');
    expect(meta['version']).toBeUndefined();
  });

  it('exports sheets that satisfy the guide rules', async () => {
    await exportArt({ file: heroFile(), root, exe: 'ase', run: stub() });
    const sheets = new Map<string, unknown>();
    for (const l of TEST_HERO_LAYERS) {
      const key = `heroes/${TEST_HERO_ID}/${l}`;
      sheets.set(key, JSON.parse(readFileSync(join(root, 'assets', `${key}.json`), 'utf8')));
    }
    const hero = { heroId: TEST_HERO_ID, art: { mode: 'layered' } } as never;
    expect(validateHeroArt([hero], [], sheets, [...sheets.keys()])).toEqual([]);
    expect(parseAsepriteSheet(sheets.get(`heroes/${TEST_HERO_ID}/body`)).frameCount).toBe(5);
  });

  it('warns on an unknown layer and does not export it', async () => {
    const warnings: string[] = [];
    await exportArt({
      file: heroFile(), root, exe: 'ase', warn: (m) => warnings.push(m),
      run: stub({ layers: ['body', 'armor_hat'] }),
    });
    expect(warnings.some((w) => w.includes("unknown layer 'armor_hat'"))).toBe(true);
    expect(list(join(root, 'assets', 'heroes', TEST_HERO_ID))).not.toContain('armor_hat.png');
  });

  it('fails when the body layer is missing', async () => {
    await expect(
      exportArt({ file: heroFile(), root, exe: 'ase', run: stub({ layers: ['armor_chest'] }) }),
    ).rejects.toThrow(/no 'body' layer/);
    expect(existsSync(join(root, 'assets'))).toBe(false);
  });

  it('names the missing hero content file', async () => {
    rmSync(join(root, 'content', 'heroes', `${TEST_HERO_ID}.json`));
    await expect(exportArt({ file: heroFile(), root, exe: 'ase', run: stub() })).rejects.toThrow(
      /hero 'test-hero'.*content[\\/]heroes[\\/]test-hero\.json/,
    );
  });

  it('leaves assets/ unchanged when an Aseprite call fails', async () => {
    const out = join(root, 'assets', 'heroes', TEST_HERO_ID);
    await exportArt({ file: heroFile(), root, exe: 'ase', run: stub() });
    const before = readAll(out);
    await expect(
      exportArt({ file: heroFile(), root, exe: 'ase', run: stub({ failOn: 'armor_gloves' }) }),
    ).rejects.toThrow(/armor_gloves.*boom/s);
    expect(readAll(out).every((b, i) => b.equals(before[i] as Buffer))).toBe(true);
  });

  it('writes nothing on a first-time failure', async () => {
    await expect(exportArt({ file: heroFile(), root, exe: 'ase', run: stub({ failOn: 'fx' }) })).rejects.toThrow(/boom/);
    expect(existsSync(join(root, 'assets'))).toBe(false);
  });

  it('warns when portrait.png is absent', async () => {
    rmSync(join(root, 'art-src', 'heroes', TEST_HERO_ID, 'portrait.png'));
    const warnings: string[] = [];
    const res = await exportArt({ file: heroFile(), root, exe: 'ase', run: stub(), warn: (m) => warnings.push(m) });
    expect(warnings.some((w) => w.includes('portrait.png'))).toBe(true);
    expect(res.keys).not.toContain(`heroes/${TEST_HERO_ID}/portrait`);
  });
});

describe('exportArt (weapon model)', () => {
  it('exports one sheet with no layer filter and no content lookup', async () => {
    rmSync(join(root, 'content'), { recursive: true });
    const calls: string[][] = [];
    const res = await exportArt({ file: weaponFile(), root, exe: 'ase', run: stub({ calls }) });
    expect(res.keys).toEqual([`items/weapons/${TEST_WEAPON_MODEL}`]);
    expect(calls).toHaveLength(1);
    expect(calls[0]).not.toContain('--layer');
    const dir = join(root, 'assets', 'items', 'weapons');
    expect(list(dir)).toEqual([`${TEST_WEAPON_MODEL}.json`, `${TEST_WEAPON_MODEL}.png`]);
    const golden = join(GOLDEN, 'items', 'weapons');
    if (process.env['UPDATE_GOLDEN'] === '1') cpSync(dir, golden, { recursive: true });
    for (const f of list(dir)) expect(readFileSync(join(dir, f)).equals(readFileSync(join(golden, f))), f).toBe(true);
  });

  it('exports a weapon that satisfies the weapon rules', async () => {
    await exportArt({ file: weaponFile(), root, exe: 'ase', run: stub() });
    const key = `items/weapons/${TEST_WEAPON_MODEL}`;
    const sheets = new Map([[key, JSON.parse(readFileSync(join(root, 'assets', `${key}.json`), 'utf8')) as unknown]]);
    const item = { itemId: 'blade', visual: { weaponModel: TEST_WEAPON_MODEL } } as never;
    expect(validateHeroArt([], [item], sheets, [key])).toEqual([]);
  });
});

describe('normalizeSheetJson', () => {
  it('sorts keys at every depth', () => {
    const a = normalizeSheetJson('{"meta":{"b":1,"a":{"y":1,"x":2}},"frames":[{"z":1,"a":2}]}', 'k.png');
    const b = normalizeSheetJson('{"frames":[{"a":2,"z":1}],"meta":{"a":{"x":2,"y":1},"b":1}}', 'k.png');
    expect(a).toBe(b);
  });
});
