/**
 * stage-combat T9: `CombatRules.advance` in live mode, one 100 ms step at a time.
 * COMBAT-01 (AC 1, 4, 7, 8), COMBAT-03 (AC 1, 2), COMBAT-04 (AC 1, 6–8), COMBAT-05, COMBAT-08.
 */
import { describe, expect, it } from 'vitest';
import type { StageSpec } from '../../src/domain/combat/StageCurves';
import {
  type CombatParams,
  type Encounter,
  type SquadMember,
  advance,
  click,
  startStage,
} from '../../src/domain/combat/CombatRules';

const stage1: StageSpec = { stageNumber: 1, favoredType: 'Nature', monsterIds: ['slime', 'bat'], monsterHp: 100, goldPerKill: 7, monsterDps: 2 };
const stage2: StageSpec = {
  stageNumber: 2,
  favoredType: 'Fire',
  monsterIds: ['slime'],
  monsterHp: 120,
  goldPerKill: 8,
  monsterDps: 3,
  boss: { monsterId: 'elder-slime', powerFloor: 50, hp: 1200, dps: 9, gold: 56, timerSeconds: 30 },
};
const stage3: StageSpec = { stageNumber: 3, favoredType: 'Water', monsterIds: ['bat'], monsterHp: 100, goldPerKill: 9, monsterDps: 2 };

const member = (heroId: string, heroType: SquadMember['heroType'], power: number, over: Partial<SquadMember> = {}): SquadMember => ({
  heroId,
  heroType,
  power,
  maxHp: 200,
  defense: 10,
  attackIntervalMs: 800,
  ...over,
});

const params = (squad: SquadMember[], over: Partial<CombatParams> = {}): CombatParams => ({
  monstersPerStage: 10,
  spawnDelayMs: 300,
  typeBonus: 1.5,
  clickDpsShare: 0.05,
  dpsPerPower: 2,
  defenseK: 50,
  squad,
  stages: [stage1, stage2, stage3],
  ...over,
});

/** Runs steps until the foe is on the field (the 300 ms spawn delay). */
const spawned = (enc: Encounter, p: CombatParams): Encounter => advance(enc, 3, p).enc;

/** Damage one taker receives per step: foe DPS × 0.1 × (1 − def/(def+K)) / takers. */
const perStep = (foeDps: number, defense: number, takers: number) => (foeDps * (1 - defense / (defense + 50))) / (takers * 10);

describe('advance: empty squad (COMBAT-08)', () => {
  it('spawns nothing and changes nothing', () => {
    const p = params([]);
    const enc = startStage(stage1, p);
    const r = advance(enc, 600, p);
    expect(r.outcomes).toEqual([]);
    expect(r.enc).toEqual(enc);
    expect(r.enc.foe).toBeNull();
  });
});

describe('advance: spawning (COMBAT-01 AC 4)', () => {
  it('spawns the first monster after the spawn delay at full HP', () => {
    const p = params([member('n', 'Nature', 10)]);
    const enc = startStage(stage1, p);
    expect(advance(enc, 2, p).enc).toMatchObject({ phase: 'spawning', foe: null });
    const r = advance(enc, 3, p);
    expect(r.enc.phase).toBe('fighting');
    expect(r.enc.foe).toEqual({ monsterId: 'slime', isBoss: false, maxHp: 100, hp: 100, hpAtSegmentStart: 100, dps: 2 });
    expect(r.enc.elapsedMs).toBe(300);
  });

  it('spawns within 500 ms at the largest allowed delay', () => {
    const p = params([member('n', 'Nature', 10)], { spawnDelayMs: 500 });
    const enc = startStage(stage1, p);
    expect(advance(enc, 4, p).enc.foe).toBeNull();
    expect(advance(enc, 5, p).enc.foe).not.toBeNull();
  });

  it('spawns the next monster, in content order, within 500 ms of a kill', () => {
    // Nature 100 power vs stage 1: 100 × 2 × 1.5 = 300 DPS = 30 per step; 100 HP dies on step 4.
    const p = params([member('n', 'Nature', 100)]);
    const killed = advance(spawned(startStage(stage1, p), p), 4, p);
    expect(killed.outcomes).toEqual([{ kind: 'kill', gold: 7 }]);
    expect(killed.enc).toMatchObject({ phase: 'spawning', foe: null, monsterIndex: 1 });
    const next = advance(killed.enc, 3, p).enc;
    expect(next.foe).toMatchObject({ monsterId: 'bat', hp: 100 });
  });
});

describe('advance: squad damage (COMBAT-01 AC 1)', () => {
  it('applies squad DPS × 0.1 per step with typeBonus on the favored type', () => {
    // 10 × 2 × 1.5 + 5 × 2 = 40 DPS = 4 per step.
    const p = params([member('n', 'Nature', 10), member('w', 'Water', 5)]);
    const fighting = spawned(startStage(stage1, p), p);
    expect(advance(fighting, 1, p).enc.foe?.hp).toBe(96);
    const five = advance(fighting, 5, p).enc;
    expect(five.foe?.hp).toBe(80);
    expect(five.foe?.hpAtSegmentStart).toBe(100);
    expect(five.segmentSteps).toBe(5);
  });

  it('kills at HP 0 and awards the stage gold per kill', () => {
    // 40 DPS vs 100 HP: exactly 0 after 25 steps.
    const p = params([member('n', 'Nature', 10), member('w', 'Water', 5)]);
    const fighting = spawned(startStage(stage1, p), p);
    expect(advance(fighting, 24, p).outcomes).toEqual([]);
    expect(advance(fighting, 25, p).outcomes).toEqual([{ kind: 'kill', gold: 7 }]);
  });
});

describe('advance: monster damage (COMBAT-01 AC 7, 8)', () => {
  it('splits a normal monster evenly over living heroes, reduced by each hero defense', () => {
    const p = params([member('a', 'Nature', 10, { defense: 10 }), member('b', 'Water', 5, { defense: 50 })]);
    const enc = advance(spawned(startStage(stage1, p), p), 6, p).enc;
    expect(enc.heroes[0]?.hp).toBeCloseTo(200 - 6 * perStep(2, 10, 2), 12);
    expect(enc.heroes[1]?.hp).toBeCloseTo(200 - 6 * perStep(2, 50, 2), 12);
    expect(enc.heroes[1]?.hp).toBeCloseTo(200 - 6 * 0.05, 12);
  });

  it('a foe killed this step deals no damage that step', () => {
    // 300 DPS kills the 100 HP monster on step 4.
    const p = params([member('n', 'Nature', 100)]);
    const fighting = spawned(startStage(stage1, p), p);
    const before = advance(fighting, 3, p).enc;
    const after = advance(before, 1, p);
    expect(after.outcomes).toEqual([{ kind: 'kill', gold: 7 }]);
    expect(after.enc.heroes[0]?.hp).toBe(before.heroes[0]?.hp);
    expect(before.heroes[0]?.hp).toBeCloseTo(200 - 3 * perStep(2, 10, 1), 12);
  });

  it('restarts the stage at full HP when every hero falls on a normal stage', () => {
    // 2 × (50/60) / 10 ≈ 0.167 damage on the first step knocks out a 0.1 HP hero.
    const p = params([member('n', 'Nature', 1, { maxHp: 0.1 })]);
    const fighting = spawned(startStage(stage1, p), p);
    const r = advance(fighting, 1, p);
    expect(r.outcomes).toEqual([{ kind: 'squadWiped', stageNumber: 1 }]);
    expect(r.enc).toMatchObject({ stageNumber: 1, phase: 'spawning', monsterIndex: 0, foe: null, autoAdvance: true });
    expect(r.enc.heroes.map((h) => [h.hp, h.alive])).toEqual([[0.1, true]]);
  });
});

describe('advance: knocked-out heroes (COMBAT-05 AC 5)', () => {
  it('neither attack nor share damage', () => {
    // b (0.2 HP) takes 2 × (50/60) / 20 ≈ 0.083 per step and falls on step 3.
    const p = params([member('a', 'Nature', 10), member('b', 'Water', 5, { maxHp: 0.2 })]);
    const s3 = advance(spawned(startStage(stage1, p), p), 3, p);
    expect(s3.outcomes).toEqual([]);
    expect(s3.enc.heroes[1]).toMatchObject({ hp: 0, alive: false });
    expect(s3.enc.foe?.hp).toBe(88);
    const aAfter3 = 200 - 3 * perStep(2, 10, 2);
    expect(s3.enc.heroes[0]?.hp).toBeCloseTo(aAfter3, 12);

    const s4 = advance(s3.enc, 1, p).enc;
    // Only a attacks now: 10 × 2 × 1.5 = 30 DPS = 3 per step.
    expect(s4.foe?.hp).toBe(85);
    // a takes the whole monster damage.
    expect(s4.heroes[0]?.hp).toBeCloseTo(aAfter3 - perStep(2, 10, 1), 12);
    expect(s4.heroes[1]).toMatchObject({ hp: 0, alive: false });
  });
});

describe('advance: stage progression (COMBAT-03 AC 1, 2)', () => {
  // 300 DPS: 3 spawn steps + 4 fight steps per monster, 70 steps for 10 monsters.
  const p = params([member('n', 'Nature', 100)]);

  it('the 10th kill clears the stage and auto-advance starts the next one at full HP', () => {
    const r = advance(startStage(stage1, p), 70, p);
    expect(r.outcomes.filter((o) => o.kind === 'kill')).toHaveLength(10);
    expect(r.outcomes.at(-1)).toEqual({ kind: 'stageCleared', stageNumber: 1 });
    expect(r.outcomes.filter((o) => o.kind === 'stageCleared')).toHaveLength(1);
    expect(r.enc).toMatchObject({ stageNumber: 2, phase: 'spawning', monsterIndex: 0, foe: null, bossStepsLeft: 300 });
    expect(r.enc.heroes[0]?.hp).toBe(200);
  });

  it('with auto-advance off a clear restarts the same stage', () => {
    const r = advance(startStage(stage1, p, false), 70, p);
    expect(r.outcomes.at(-1)).toEqual({ kind: 'stageCleared', stageNumber: 1 });
    expect(r.enc).toMatchObject({ stageNumber: 1, monsterIndex: 0, autoAdvance: false });
    expect(r.enc.heroes[0]?.hp).toBe(200);
  });

  it('the last stage in content keeps farming after a clear', () => {
    const w = params([member('w', 'Water', 100)]);
    const r = advance(startStage(stage3, w), 70, w);
    expect(r.outcomes.at(-1)).toEqual({ kind: 'stageCleared', stageNumber: 3 });
    expect(r.enc).toMatchObject({ stageNumber: 3, monsterIndex: 0, autoAdvance: true });
  });
});

describe('advance: boss fights (COMBAT-04, COMBAT-05)', () => {
  it('spawns only the boss and runs its timer while it fights', () => {
    const p = params([member('f', 'Fire', 1, { defense: 1000 })]);
    const enc = spawned(startStage(stage2, p), p);
    expect(enc.foe).toMatchObject({ monsterId: 'elder-slime', isBoss: true, hp: 1200, dps: 9 });
    expect(enc.bossStepsLeft).toBe(300);
    expect(advance(enc, 10, p).enc.bossStepsLeft).toBe(290);
  });

  it('defeating the boss emits bossDefeated and starts the next stage at full HP', () => {
    // Fire 100 power vs a Fire stage: 300 DPS kills 1200 HP on step 40.
    const p = params([member('f', 'Fire', 100)]);
    const fighting = spawned(startStage(stage2, p), p);
    const r = advance(fighting, 40, p);
    expect(r.outcomes).toEqual([
      { kind: 'kill', gold: 56 },
      { kind: 'bossDefeated', stageNumber: 2 },
    ]);
    expect(r.enc).toMatchObject({ stageNumber: 3, phase: 'spawning', bossStepsLeft: null, autoAdvance: true });
    expect(r.enc.heroes[0]?.hp).toBe(200);
  });

  it('fails on the timer, returns to the previous stage with auto-advance off and full HP', () => {
    // 3 DPS never kills 1200 HP in 30 s; defense 1000 keeps the hero alive.
    const p = params([member('f', 'Fire', 1, { defense: 1000 })]);
    const fighting = spawned(startStage(stage2, p), p);
    expect(advance(fighting, 299, p).outcomes).toEqual([]);
    const r = advance(fighting, 300, p);
    expect(r.outcomes).toEqual([{ kind: 'bossFailed', stageNumber: 2, cause: 'timer' }]);
    expect(r.enc).toMatchObject({ stageNumber: 1, phase: 'spawning', foe: null, bossStepsLeft: null, autoAdvance: false });
    expect(r.enc.heroes[0]?.hp).toBe(200);
  });

  it('splits boss damage evenly when a squad hero has the favored type', () => {
    const p = params([member('w', 'Water', 1), member('f', 'Fire', 1)]);
    const enc = advance(spawned(startStage(stage2, p), p), 10, p).enc;
    expect(enc.heroes[0]?.hp).toBeCloseTo(200 - 10 * perStep(9, 10, 2), 12);
    expect(enc.heroes[1]?.hp).toBeCloseTo(200 - 10 * perStep(9, 10, 2), 12);
  });

  it('deals all boss damage to the leader when no squad hero has the favored type (AD-004)', () => {
    const p = params([member('w', 'Water', 1), member('n', 'Nature', 1)]);
    const enc = advance(spawned(startStage(stage2, p), p), 10, p).enc;
    expect(enc.heroes[0]?.hp).toBeCloseTo(200 - 10 * perStep(9, 10, 1), 12);
    expect(enc.heroes[1]?.hp).toBe(200);
  });

  it('fails when the leader is knocked out, before the timer ends', () => {
    // The Water leader takes 9 × (50/60) / 10 = 0.75 per step alone and falls on step 27.
    const p = params([member('w', 'Water', 1, { maxHp: 20 }), member('n', 'Nature', 1)]);
    const fighting = spawned(startStage(stage2, p), p);
    expect(advance(fighting, 26, p).outcomes).toEqual([]);
    const r = advance(fighting, 27, p);
    expect(r.outcomes).toEqual([{ kind: 'bossFailed', stageNumber: 2, cause: 'leader' }]);
    expect(r.enc).toMatchObject({ stageNumber: 1, autoAdvance: false });
    expect(r.enc.heroes.map((h) => [h.hp, h.alive])).toEqual([
      [20, true],
      [200, true],
    ]);
  });

  it('a non-leader knock-out on a boss stage does not fail the fight', () => {
    // Even split: the 1 HP Fire hero falls on step 3 (0.375 per step); the fight goes on.
    const p = params([member('w', 'Water', 1), member('f', 'Fire', 1, { maxHp: 1 })]);
    const r = advance(spawned(startStage(stage2, p), p), 3, p);
    expect(r.outcomes).toEqual([]);
    expect(r.enc).toMatchObject({ stageNumber: 2, phase: 'fighting', bossStepsLeft: 297 });
    expect(r.enc.heroes[1]).toMatchObject({ hp: 0, alive: false });
  });

  it('a click that kills the boss defeats it', () => {
    const p = params([member('f', 'Fire', 100)]);
    // After 39 steps the boss has 30 HP left; a click deals 5% of 300 DPS = 15, so two clicks kill it.
    const nearlyDead = advance(spawned(startStage(stage2, p), p), 39, p).enc;
    expect(nearlyDead.foe?.hp).toBe(30);
    expect(click(nearlyDead, p).outcomes).toEqual([]);
    const r = click(click(nearlyDead, p).enc, p);
    expect(r.outcomes).toEqual([
      { kind: 'kill', gold: 56 },
      { kind: 'bossDefeated', stageNumber: 2 },
    ]);
    expect(r.enc.stageNumber).toBe(3);
  });
});
