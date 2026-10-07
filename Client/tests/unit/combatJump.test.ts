/**
 * stage-combat T10: event jumping and farming mode of `CombatRules.advance`.
 * COMBAT-07 (AC 3), AD-007: N single steps and one N-step jump are bit-identical.
 */
import { describe, expect, it } from 'vitest';
import type { HeroType } from '../../src/domain/HeroType';
import type { StageSpec } from '../../src/domain/combat/StageCurves';
import {
  type CombatMode,
  type CombatOutcome,
  type CombatParams,
  type SquadMember,
  advance,
  startStage,
} from '../../src/domain/combat/CombatRules';

/** mulberry32: a seeded PRNG local to the test. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TYPES: HeroType[] = ['Fire', 'Water', 'Nature'];

function randomParams(r: () => number): CombatParams {
  const between = (lo: number, hi: number) => lo + r() * (hi - lo);
  const squadSize = 1 + Math.floor(r() * 4);
  const squad: SquadMember[] = Array.from({ length: squadSize }, (_, i) => ({
    heroId: `h${i}`,
    heroType: TYPES[Math.floor(r() * 3)] as HeroType,
    power: between(5, 400),
    maxHp: between(40, 600),
    defense: between(0, 80),
    attackIntervalMs: 800,
  }));
  const stages: StageSpec[] = Array.from({ length: 6 }, (_, i): StageSpec => {
    const n = i + 1;
    const growth = 1.3 ** i;
    const base: StageSpec = {
      stageNumber: n,
      favoredType: TYPES[Math.floor(r() * 3)] as HeroType,
      monsterIds: ['slime', 'bat'],
      monsterHp: between(30, 300) * growth,
      goldPerKill: Math.round(between(3, 20) * growth),
      monsterDps: between(1, 30) * growth,
    };
    return n % 3 === 0
      ? { ...base, boss: { monsterId: 'boss', powerFloor: 10, hp: base.monsterHp * 10, dps: base.monsterDps * 3, gold: base.goldPerKill * 8, timerSeconds: Math.round(between(10, 60)) } }
      : base;
  });
  return {
    monstersPerStage: 3 + Math.floor(r() * 5),
    spawnDelayMs: 100 * (1 + Math.floor(r() * 5)),
    typeBonus: 1.5,
    clickDpsShare: 0.05,
    dpsPerPower: between(0.5, 3),
    defenseK: 50,
    squad,
    stages,
  };
}

describe('advance: single steps equal one jump', () => {
  for (const mode of ['live', 'farming'] as CombatMode[]) {
    it(`is bit-identical over 220 seeded setups (${mode})`, () => {
      const r = rng(mode === 'live' ? 11 : 29);
      for (let i = 0; i < 220; i++) {
        const p = randomParams(r);
        const stage = p.stages[Math.floor(r() * p.stages.length)] as StageSpec;
        const total = 1 + Math.floor(r() * 1500);
        const chunk = 1 + Math.floor(r() * 400);

        let stepped = startStage(stage, p, r() < 0.8);
        const jumped = advance(stepped, total, p, mode);
        const steppedOutcomes: CombatOutcome[] = [];
        if (mode === 'farming') {
          // Farming first moves a boss stage back; run that move through the same entry once.
          const first = advance(stepped, 0, p, mode);
          stepped = first.enc;
        }
        for (let s = 0; s < total; s++) {
          const one = advance(stepped, 1, p, mode);
          stepped = one.enc;
          steppedOutcomes.push(...one.outcomes);
        }
        expect(jumped.enc, `setup ${i}`).toEqual(stepped);
        expect(jumped.outcomes, `setup ${i}`).toEqual(steppedOutcomes);

        // Any split of the same total gives the same result as well.
        const a = advance(startStage(stage, p), chunk, p, mode);
        const b = advance(a.enc, total, p, mode);
        const c = advance(startStage(stage, p), chunk + total, p, mode);
        expect(b.enc, `split ${i}`).toEqual(c.enc);
        expect([...a.outcomes, ...b.outcomes], `split ${i}`).toEqual(c.outcomes);
      }
    });
  }
});

describe('advance: farming mode', () => {
  const stage1: StageSpec = { stageNumber: 1, favoredType: 'Nature', monsterIds: ['slime'], monsterHp: 100, goldPerKill: 7, monsterDps: 2 };
  const stage2: StageSpec = {
    stageNumber: 2,
    favoredType: 'Fire',
    monsterIds: ['slime'],
    monsterHp: 120,
    goldPerKill: 8,
    monsterDps: 3,
    boss: { monsterId: 'boss', powerFloor: 50, hp: 600, dps: 9, gold: 56, timerSeconds: 30 },
  };
  const squad: SquadMember[] = [{ heroId: 'a', heroType: 'Fire', power: 40, maxHp: 500, defense: 20, attackIntervalMs: 800 }];
  const p: CombatParams = {
    monstersPerStage: 10,
    spawnDelayMs: 300,
    typeBonus: 1.5,
    clickDpsShare: 0.05,
    dpsPerPower: 2,
    defenseK: 50,
    squad,
    stages: [stage1, stage2],
  };

  it('runs 12 h in under 50 ms with no stageCleared or bossDefeated', () => {
    const run = () => advance(startStage(stage1, p), 12 * 3600 * 10, p, 'farming');
    // Best of seven: the first run pays JIT warm-up, which is not what the bound is about.
    let best = Infinity;
    let r = run();
    for (let i = 0; i < 7; i++) {
      const t0 = performance.now();
      r = run();
      best = Math.min(best, performance.now() - t0);
    }
    expect(best).toBeLessThan(50);
    expect(r.outcomes.filter((o) => o.kind === 'kill').length).toBeGreaterThan(1000);
    expect(r.outcomes.some((o) => o.kind === 'stageCleared' || o.kind === 'bossDefeated')).toBe(false);
    expect(r.enc.stageNumber).toBe(1);
  });

  it('farms the stage before a boss stage and never fights the boss', () => {
    const r = advance(startStage(stage2, p), 20000, p, 'farming');
    expect(r.enc.stageNumber).toBe(1);
    expect(r.outcomes.some((o) => o.kind === 'bossFailed' || o.kind === 'bossDefeated')).toBe(false);
  });

  it('live mode still clears the stage and advances', () => {
    const r = advance(startStage(stage1, p), 20000, p, 'live');
    expect(r.outcomes.some((o) => o.kind === 'stageCleared')).toBe(true);
  });
});
