/**
 * Locates and runs the Aseprite CLI (ART-02). Export policy lives in `tools/art-export.ts`.
 */
import { spawn } from 'node:child_process';

export const STEAM_ASEPRITE_PATH = 'C:/Program Files (x86)/Steam/steamapps/common/Aseprite/Aseprite.exe';

export class AsepriteNotFound extends Error {
  constructor(readonly tried: readonly string[]) {
    super(
      `Aseprite not found. Tried: ${tried.join(', ')}. ` +
        'Install Aseprite or set ASEPRITE_PATH to the executable.',
    );
    this.name = 'AsepriteNotFound';
  }
}

/** Order: `ASEPRITE_PATH`, `aseprite` on PATH, the Steam install path. */
export function findAseprite(
  env: Readonly<Record<string, string | undefined>>,
  exists: (path: string) => boolean,
): string | AsepriteNotFound {
  const fromEnv = env['ASEPRITE_PATH'];
  if (fromEnv && exists(fromEnv)) return fromEnv;

  const exeNames = process.platform === 'win32' ? ['aseprite.exe', 'aseprite'] : ['aseprite'];
  const sep = process.platform === 'win32' ? ';' : ':';
  for (const dir of (env['PATH'] ?? '').split(sep).filter((d) => d.length > 0)) {
    for (const name of exeNames) {
      const candidate = `${dir.replace(/[\\/]+$/, '')}/${name}`;
      if (exists(candidate)) return candidate;
    }
  }

  if (exists(STEAM_ASEPRITE_PATH)) return STEAM_ASEPRITE_PATH;

  return new AsepriteNotFound([
    fromEnv ? `ASEPRITE_PATH (${fromEnv})` : 'ASEPRITE_PATH (unset)',
    'aseprite on PATH',
    STEAM_ASEPRITE_PATH,
  ]);
}

/** Packed, trimmed sheet; no `--merge-duplicates` so frame count and order match across layers. */
export function exportArgs(file: string, layer: string, outBase: string): string[] {
  return [
    '--batch',
    file,
    '--layer',
    layer,
    '--sheet-type',
    'packed',
    '--trim',
    '--format',
    'json-array',
    '--list-tags',
    '--list-slices',
    '--sheet',
    `${outBase}.png`,
    '--data',
    `${outBase}.json`,
  ];
}

export type RunProcess = (exe: string, args: readonly string[]) => Promise<{ code: number; stderr: string }>;

const defaultRun: RunProcess = (exe, args) =>
  new Promise((resolve, reject) => {
    const child = spawn(exe, [...args], { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (chunk: Buffer) => (stderr += chunk.toString()));
    child.on('error', reject);
    child.on('close', (code) => resolve({ code: code ?? 1, stderr }));
  });

export async function exportLayer(
  exe: string,
  file: string,
  layer: string,
  outBase: string,
  run: RunProcess = defaultRun,
): Promise<void> {
  const { code, stderr } = await run(exe, exportArgs(file, layer, outBase));
  if (code !== 0) {
    throw new Error(`Aseprite failed on layer "${layer}" of ${file} (exit ${code}): ${stderr.trim()}`);
  }
}
