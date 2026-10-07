/**
 * `npm run art:export -- <file.aseprite>` (hero-art-pipeline ART-01, ART-02): exports the layers of a hero
 * (`art-src/heroes/<heroId>/<heroId>.aseprite`) or a weapon model (`art-src/items/weapons/<modelId>.aseprite`)
 * to `assets/`, then regenerates the asset manifest. Policy in `tools/lib/artExport.ts`.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { AsepriteNotFound, findAseprite } from './lib/aseprite';
import { exportArt } from './lib/artExport';

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error('usage: npm run art:export -- <file.aseprite> [...]');
  process.exit(1);
}

const exe = findAseprite(process.env, existsSync);
if (exe instanceof AsepriteNotFound) {
  console.error(exe.message);
  process.exit(1);
}

const keys: string[] = [];
try {
  for (const file of files) keys.push(...(await exportArt({ file, root: '.', exe })).keys);
} catch (e) {
  console.error((e as Error).message);
  process.exit(1);
}

const gen = spawnSync('npx', ['tsx', 'tools/gen-assets.ts'], { stdio: 'inherit', shell: true });
if (gen.status !== 0) process.exit(gen.status ?? 1);
console.log(`art:export: ${keys.length} assets\n${keys.map((k) => `  ${k}`).join('\n')}`);
