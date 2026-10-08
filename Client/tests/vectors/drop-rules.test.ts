/** DROP-04: client content and sim numbers equal the backend's drop and kill-rate options. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { STEP_MS } from '../../src/domain/combat/CombatRules';
import { MAX_KILLS_PER_EVENT } from '../../src/domain/PlayerProgressReplay';
import { loadVectors } from './vectorFile';

interface ConfigCase {
  op: 'config';
  minKillIntervalMs: number;
  killBucketCap: number;
  maxKillsPerEvent: number;
  normalDropChance: number;
  bossDropChance: number;
  bagCapacity: number;
}

const content = (path: string): Record<string, number> =>
  JSON.parse(readFileSync(resolve(__dirname, '../../content', path), 'utf8')) as Record<string, number>;

describe('drop-rules (backend)', () => {
  const config = loadVectors<ConfigCase>('drop-rules').cases.find((c) => c.op === 'config') as ConfigCase;
  const drops = content('economy/drops.json');
  const combat = content('economy/combat.json');
  const game = content('settings/game.json');

  it('uses the content drop chances and bag capacity', () => {
    expect(drops.normalChance).toBe(config.normalDropChance);
    expect(drops.bossChance).toBe(config.bossDropChance);
    expect(drops.bagCapacity).toBe(config.bagCapacity);
  });

  it('allows one kill per spawn delay plus one step, as the sim kills', () => {
    expect((combat.spawnDelayMs as number) + STEP_MS).toBe(config.minKillIntervalMs);
  });

  it('caps the offline bucket at the offline accrual cap in kills', () => {
    const capMs = (game.offlineAccrualCapHours as number) * 3_600_000;
    expect(capMs / config.minKillIntervalMs).toBe(config.killBucketCap);
  });

  it('bounds one kill batch like the backend', () => {
    expect(MAX_KILLS_PER_EVENT).toBe(config.maxKillsPerEvent);
  });
});
