/** stage-combat T11: `farmRate`. COMBAT-07. */
import { describe, expect, it } from 'vitest';
import type { StageSpec } from '../../src/domain/combat/StageCurves';
import { type CombatParams, type SquadMember, advance, startStage } from '../../src/domain/combat/CombatRules';
import { farmRate } from '../../src/domain/combat/FarmRate';

const stage1: StageSpec = { stageNumber: 1, favoredType: 'Nature', monsterIds: ['slime'], monsterHp: 100, goldPerKill: 7, monsterDps: 2 };
const stage2: StageSpec = { stageNumber: 2, favoredType: 'Fire', monsterIds: ['bat'], monsterHp: 100, goldPerKill: 9, monsterDps: 2 };
const bossStage: StageSpec = {
  stageNumber: 3,
  favoredType: 'Fire',
  monsterIds: ['bat'],
  monsterHp: 100,
  goldPerKill: 11,
  monsterDps: 2,
  boss: { monsterId: 'boss', powerFloor: 50, hp: 1000, dps: 9, gold: 80, timerSeconds: 30 },
};

const member = (power: number, over: Partial<SquadMember> = {}): SquadMember => ({
  heroId: 'h',
  heroType: 'Fire',
  power,
  maxHp: 200,
  defense: 10,
  attackIntervalMs: 800,
  ...over,
});

const params = (squad: SquadMember[]): CombatParams => ({
  monstersPerStage: 10,
  spawnDelayMs: 300,
  typeBonus: 1.5,
  clickDpsShare: 0.05,
  dpsPerPower: 2,
  defenseK: 50,
  squad,
  stages: [stage1, stage2, bossStage],
});

describe('farmRate', () => {
  it('equals the gold of 10 kills over kill time plus spawn delays', () => {
    // power 50 × 2 dps = 100 dps (stage 1 favors Nature, so no bonus): 100 hp dies in 1 s = 10 steps.
    const r = farmRate(stage1, params([member(50)]));
    expect(r.goldPerCycle).toBe(70);
    expect(r.cycleMs).toBe(10 * (300 + 1000));
    expect(r.goldPerSecond).toBeCloseTo(70 / 13, 10);
  });

  it('is zero for an empty squad', () => {
    expect(farmRate(stage1, params([]))).toEqual({ goldPerCycle: 0, cycleMs: 0, goldPerSecond: 0 });
  });

  it('yields the gold of the kills before a wipe', () => {
    // 1 dps vs 100 hp: no kill before the hero (1 hp, no defense) falls.
    const weak = params([member(0.5, { maxHp: 1, defense: 0 })]);
    expect(farmRate(stage1, weak)).toMatchObject({ goldPerCycle: 0, goldPerSecond: 0 });
    // Kills a monster or two, then the squad is wiped: gold of those kills over the time to the wipe.
    const r = farmRate(stage1, params([member(5, { maxHp: 30, defense: 0 })]));
    expect(r.goldPerCycle).toBeGreaterThan(0);
    expect(r.goldPerCycle % 7).toBe(0);
    expect(r.goldPerCycle).toBeLessThan(70);
    expect(r.goldPerSecond).toBeCloseTo(r.goldPerCycle / (r.cycleMs / 1000), 10);
  });

  it('farms the previous stage when asked about a boss stage', () => {
    const p = params([member(50)]);
    expect(farmRate(bossStage, p)).toEqual(farmRate(stage2, p));
  });

  it('matches one farming cycle run through advance', () => {
    const p = params([member(50)]);
    const r = farmRate(stage2, p);
    const run = advance(startStage(stage2, p), r.cycleMs / 100, p, 'farming');
    const gold = run.outcomes.reduce((s, o) => s + (o.kind === 'kill' ? o.gold : 0), 0);
    expect(gold).toBe(r.goldPerCycle);
  });
});
