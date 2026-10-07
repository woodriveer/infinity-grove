/** AD-002: the client's boss-stage rule and default cadence match the backend's. */
import { describe, expect, it } from 'vitest';
import { DEFAULT_BOSS_EVERY, isBossStage } from '../../src/domain/StageRules';
import { loadVectors } from './vectorFile';

type StageRuleCase =
  | { op: 'defaultBossEvery'; result: number }
  | { op: 'isBossStage'; stageNumber: number; bossEvery: number; result: boolean };

describe('stage-rules (backend)', () => {
  const file = loadVectors<StageRuleCase>('stage-rules');

  it('uses the backend default BossEvery', () => {
    const c = file.cases.find((x) => x.op === 'defaultBossEvery');
    expect(c?.result).toBe(DEFAULT_BOSS_EVERY);
  });

  it('classifies boss stages exactly as the backend', () => {
    const cases = file.cases.filter((x) => x.op === 'isBossStage');
    expect(cases.length).toBeGreaterThan(0);
    for (const c of cases) {
      expect(isBossStage(c.stageNumber, c.bossEvery), `stage ${c.stageNumber} every ${c.bossEvery}`).toBe(c.result);
    }
  });
});
