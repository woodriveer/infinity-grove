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
export function exportArgs(file: string, layer: string | null, outBase: string): string[] {
  return [
    '--batch',
    file,
    ...(layer === null ? [] : ['--layer', layer]),
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

export type RunProcess = (exe: string, args: readonly string[]) => Promise<{ code: number; stderr: string; stdout?: string }>;

const defaultRun: RunProcess = (exe, args) =>
  new Promise((resolve, reject) => {
    const child = spawn(exe, [...args], { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk: Buffer) => (stdout += chunk.toString()));
    child.stderr.on('data', (chunk: Buffer) => (stderr += chunk.toString()));
    child.on('error', reject);
    child.on('close', (code) => resolve({ code: code ?? 1, stderr, stdout }));
  });

/** Layer names of the file, one per line of `--list-layers` output (groups appear by their path). */
export async function listLayers(exe: string, file: string, run: RunProcess = defaultRun): Promise<string[]> {
  const { code, stderr, stdout } = await run(exe, ['--batch', file, '--list-layers']);
  if (code !== 0) throw new Error(`Aseprite failed listing layers of ${file} (exit ${code}): ${stderr.trim()}`);
  return (stdout ?? '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

/** `layer` null exports every visible layer merged (weapon models have a single implicit layer). */
export async function exportLayer(
  exe: string,
  file: string,
  layer: string | null,
  outBase: string,
  run: RunProcess = defaultRun,
): Promise<void> {
  const { code, stderr } = await run(exe, exportArgs(file, layer, outBase));
  if (code !== 0) {
    throw new Error(`Aseprite failed on ${layer === null ? 'all layers' : `layer "${layer}"`} of ${file} (exit ${code}): ${stderr.trim()}`);
  }
}
