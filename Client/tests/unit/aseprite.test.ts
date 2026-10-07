import { describe, expect, it } from 'vitest';
import {
  AsepriteNotFound,
  STEAM_ASEPRITE_PATH,
  exportArgs,
  exportLayer,
  findAseprite,
} from '../../tools/lib/aseprite';

const onPath = (p: string): boolean => p === 'C:/tools/aseprite.exe' || p === '/opt/bin/aseprite';

describe('findAseprite', () => {
  it('prefers ASEPRITE_PATH', () => {
    const exists = (): boolean => true;
    expect(findAseprite({ ASEPRITE_PATH: 'X:/a.exe', PATH: 'C:/tools' }, exists)).toBe('X:/a.exe');
  });

  it('falls back to PATH when ASEPRITE_PATH does not exist', () => {
    const sep = process.platform === 'win32' ? ';' : ':';
    const dir = process.platform === 'win32' ? 'C:/tools' : '/opt/bin';
    const found = findAseprite({ ASEPRITE_PATH: 'X:/missing.exe', PATH: `/nope${sep}${dir}` }, onPath);
    expect(found).toBe(process.platform === 'win32' ? 'C:/tools/aseprite.exe' : '/opt/bin/aseprite');
  });

  it('falls back to the Steam path', () => {
    expect(findAseprite({ PATH: '' }, (p) => p === STEAM_ASEPRITE_PATH)).toBe(STEAM_ASEPRITE_PATH);
  });

  it('reports the three locations and ASEPRITE_PATH when nothing exists', () => {
    const result = findAseprite({ PATH: '/x' }, () => false);
    expect(result).toBeInstanceOf(AsepriteNotFound);
    const message = (result as AsepriteNotFound).message;
    expect(message).toContain('ASEPRITE_PATH (unset)');
    expect(message).toContain('aseprite on PATH');
    expect(message).toContain(STEAM_ASEPRITE_PATH);
    expect((result as AsepriteNotFound).tried).toHaveLength(3);
  });

  it('names the configured ASEPRITE_PATH in the error', () => {
    const result = findAseprite({ ASEPRITE_PATH: 'X:/gone.exe' }, () => false) as AsepriteNotFound;
    expect(result.message).toContain('ASEPRITE_PATH (X:/gone.exe)');
  });
});

describe('exportLayer', () => {
  it('passes the exact command arguments', async () => {
    const calls: Array<{ exe: string; args: readonly string[] }> = [];
    await exportLayer('ase', 'krell.aseprite', 'body', '/tmp/body', async (exe, args) => {
      calls.push({ exe, args });
      return { code: 0, stderr: '' };
    });
    expect(calls).toEqual([
      {
        exe: 'ase',
        args: [
          '--batch', 'krell.aseprite', '--layer', 'body', '--sheet-type', 'packed', '--trim',
          '--format', 'json-array', '--list-tags', '--list-slices',
          '--sheet', '/tmp/body.png', '--data', '/tmp/body.json',
        ],
      },
    ]);
    expect(exportArgs('f', 'l', 'o')).not.toContain('--merge-duplicates');
  });

  it('throws with layer, file and exit code on failure', async () => {
    await expect(
      exportLayer('ase', 'k.aseprite', 'hair', '/tmp/h', async () => ({ code: 2, stderr: 'boom\n' })),
    ).rejects.toThrow('Aseprite failed on layer "hair" of k.aseprite (exit 2): boom');
  });
});
