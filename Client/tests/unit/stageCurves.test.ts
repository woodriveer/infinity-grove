/** stage-combat T7 (COMBAT-01, COMBAT-04 AC 1): stage numbers from the placeholder curves. */
import { describe, expect, it } from 'vitest';
import type { CombatEconomy, StageData } from '../../src/domain/content/types';
import { stageSpec } from '../../src/domain/combat/StageCurves';

const eco: CombatEconomy = {
  monstersPerStage: 10,
  bossEvery: 5,
  spawnDelayMs: 300,
  defaultBossTimerSeconds: 30,
  typeBonus: 1.5,
  clickDpsShare: 0.05,
  dpsPerPower: 1,
  defenseK: 50,
  monster: { hpBase: 50, hpGrowth: 1.2, goldBase: 5, goldGrowth: 1.1, dpsBase: 2, dpsGrowth: 1.5 },
  boss: { hpMultiplier: 10, dpsMultiplier: 3, goldMultiplier: 7 },
};

const stage = (stageNumber: number, boss?: StageData['boss']): StageData => ({
  stageId: `s${stageNumber}`,
  stageNumber,
  displayName: `Stage ${stageNumber}`,
  favoredType: 'Nature',
  monsters: ['slime'],
  ...(boss ? { boss } : {}),
});

describe('stageSpec', () => {
  it('stage 1 values equal the bases', () => {
    const s = stageSpec(stage(1), eco);
    expect(s.stageNumber).toBe(1);
    expect(s.favoredType).toBe('Nature');
    expect(s.monsterIds).toEqual(['slime']);
    expect(s.monsterHp).toBe(50);
    expect(s.goldPerKill).toBe(5);
    expect(s.monsterDps).toBe(2);
    expect(s.boss).toBeUndefined();
  });

  it('each value grows by its own factor per stage', () => {
    const s = stageSpec(stage(4), eco);
    expect(s.monsterHp).toBeCloseTo(50 * 1.2 ** 3, 9);
    expect(s.goldPerKill).toBeCloseTo(5 * 1.1 ** 3, 9);
    expect(s.monsterDps).toBeCloseTo(2 * 1.5 ** 3, 9);
  });

  it('a boss is the stage monster times the boss multipliers', () => {
    const s = stageSpec(stage(5, { monsterId: 'elder-slime', powerFloor: 400, timerSeconds: 45 }), eco);
    const hp = 50 * 1.2 ** 4;
    const dps = 2 * 1.5 ** 4;
    const gold = 5 * 1.1 ** 4;
    expect(s.monsterHp).toBeCloseTo(hp, 9);
    expect(s.boss?.monsterId).toBe('elder-slime');
    expect(s.boss?.powerFloor).toBe(400);
    expect(s.boss?.hp).toBeCloseTo(hp * 10, 9);
    expect(s.boss?.dps).toBeCloseTo(dps * 3, 9);
    expect(s.boss?.gold).toBeCloseTo(gold * 7, 9);
  });

  it('uses the stage boss timer when set, else the default', () => {
    expect(stageSpec(stage(5, { monsterId: 'elder-slime', powerFloor: 400, timerSeconds: 45 }), eco).boss?.timerSeconds).toBe(45);
    expect(stageSpec(stage(10, { monsterId: 'elder-slime', powerFloor: 900 }), eco).boss?.timerSeconds).toBe(30);
  });
});
