/** hero-art-pipeline T7: validate:content reads layered hero sheets from assets/ and applies the art rules. */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ALL_ASSET_KEYS } from '../../src/generated/assets.gen';
import { loadContent, type ContentCatalog } from '../../src/services/content/ContentLoader';
import { FsContentSource } from '../../src/platform/node/NodePorts';
import { checkHeroArt } from '../../tools/lib/artCheck';

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

const catalog = (): ContentCatalog => loadContent(new FsContentSource('content').entries(), ALL_ASSET_KEYS);

function fixtureAssets(files: Record<string, unknown>): string {
  const dir = mkdtempSync(join(tmpdir(), 'ig-art-'));
  dirs.push(dir);
  for (const [name, json] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, name)), { recursive: true });
    writeFileSync(join(dir, name), typeof json === 'string' ? json : JSON.stringify(json));
  }
  return dir;
}

describe('checkHeroArt', () => {
  it('passes on the repo content (legacy and art-less heroes need no sheets)', () => {
    expect(checkHeroArt(catalog(), 'assets', ALL_ASSET_KEYS)).toEqual([]);
  });

  it('reports a layered hero whose body sheet is missing', () => {
    const c = catalog();
    const broken = { ...c, heroes: [{ ...c.heroes[0]!, heroId: 'tide', art: { mode: 'layered' as const } }] };
    const problems = checkHeroArt(broken, fixtureAssets({}), ALL_ASSET_KEYS);
    expect(problems).toEqual(["heroes/tide.json: hero 'tide' has no body layer (heroes/tide/body)"]);
  });

  it('reports rule violations found in a sheet read from disk', () => {
    const c = catalog();
    const broken = { ...c, heroes: [{ ...c.heroes[0]!, heroId: 'tide', art: { mode: 'layered' as const } }] };
    const body = { frames: [{ frame: { x: 0, y: 0, w: 1, h: 1 }, spriteSourceSize: { x: 0, y: 0, w: 1, h: 1 }, sourceSize: { w: 64, h: 64 }, duration: 100 }], meta: { size: { w: 1, h: 1 }, frameTags: [], slices: [] } };
    const dir = fixtureAssets({ 'heroes/tide/body.json': body });
    const problems = checkHeroArt(broken, dir, [...ALL_ASSET_KEYS, 'heroes/tide/body']);
    expect(problems).toContain("heroes/tide.json: hero 'tide' lacks the 'idle' tag");
    expect(problems).toContain('heroes/tide/body.json: frame 0 canvas is 64x64 (must be 512x512)');
  });

  it('reports a sheet that is not valid JSON', () => {
    const c = catalog();
    const broken = { ...c, heroes: [{ ...c.heroes[0]!, heroId: 'tide', art: { mode: 'layered' as const } }] };
    const dir = fixtureAssets({ 'heroes/tide/body.json': '{nope' });
    const problems = checkHeroArt(broken, dir, [...ALL_ASSET_KEYS, 'heroes/tide/body']);
    expect(problems[0]).toMatch(/^heroes\/tide\/body\.json: not valid JSON/);
  });
});
