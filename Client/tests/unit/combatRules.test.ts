/** stage-combat T8 (COMBAT-01 AC 1–3): encounter model, damage factors and click. */
import { describe, expect, it } from 'vitest';
import type { StageSpec } from '../../src/domain/combat/StageCurves';
import {
  type CombatParams,
  type Encounter,
  type SquadMember,
  click,
  damageTakenFactor,
  squadDpsVsFoe,
  startStage,
} from '../../src/domain/combat/CombatRules';

const normal: StageSpec = { stageNumber: 1, favoredType: 'Nature', monsterIds: ['slime'], monsterHp: 100, goldPerKill: 7, monsterDps: 2 };
const bossStage: StageSpec = {
  stageNumber: 2,
  favoredType: 'Fire',
  monsterIds: ['slime'],
  monsterHp: 120,
  goldPerKill: 8,
  monsterDps: 3,
  boss: { monsterId: 'elder-slime', powerFloor: 50, hp: 1200, dps: 9, gold: 56, timerSeconds: 30 },
};

const member = (heroId: string, heroType: SquadMember['heroType'], power: number): SquadMember => ({
  heroId,
  heroType,
  power,
  maxHp: 200,
  defense: 10,
  attackIntervalMs: 800,
});

const params = (squad: SquadMember[]): CombatParams => ({
  monstersPerStage: 10,
  spawnDelayMs: 300,
  typeBonus: 1.5,
  clickDpsShare: 0.05,
  dpsPerPower: 2,
  defenseK: 50,
  squad,
  stages: [normal, bossStage],
});

/** The encounter with a live foe of the given HP. */
const fighting = (enc: Encounter, hp: number, isBoss = false): Encounter => ({
  ...enc,
  phase: 'fighting',
  foe: { monsterId: isBoss ? 'elder-slime' : 'slime', isBoss, maxHp: hp, hp, hpAtSegmentStart: hp, dps: 2 },
  segmentSteps: 4,
});

describe('startStage', () => {
  it('puts exactly the Active Squad on the field at full HP, leader in slot 0', () => {
    const p = params([member('a', 'Fire', 10), member('b', 'Water', 5)]);
    const enc = startStage(normal, p);
    expect(enc.heroes.map((h) => [h.heroId, h.slot, h.hp, h.maxHp, h.hpAtSegmentStart, h.alive])).toEqual([
      ['a', 0, 200, 200, 200, true],
      ['b', 1, 200, 200, 200, true],
    ]);
    expect(enc.heroes.map((h) => h.dps)).toEqual([20, 10]);
    expect(enc).toMatchObject({ stageNumber: 1, phase: 'spawning', monsterIndex: 0, foe: null, segmentSteps: 0, elapsedMs: 0 });
  });

  it('counts the spawn delay in 100 ms steps', () => {
    expect(startStage(normal, params([member('a', 'Fire', 1)])).spawnStepsLeft).toBe(3);
  });

  it('starts the boss timer on a boss stage only', () => {
    const p = params([member('a', 'Fire', 1)]);
    expect(startStage(bossStage, p).bossStepsLeft).toBe(300);
    expect(startStage(normal, p).bossStepsLeft).toBeNull();
  });

  it('is idle with an empty Active Squad', () => {
    const enc = startStage(normal, params([]));
    expect(enc.phase).toBe('idle');
    expect(enc.heroes).toEqual([]);
  });
});

describe('squadDpsVsFoe', () => {
  it('sums living heroes and applies typeBonus to the favored type only', () => {
    // Stage 1 favors Nature: 10×2×1.5 + 5×2 = 40.
    const p = params([member('n', 'Nature', 10), member('w', 'Water', 5)]);
    expect(squadDpsVsFoe(startStage(normal, p), p)).toBe(40);
  });

  it('takes the favored type from the encounter stage', () => {
    // Stage 2 favors Fire: the Nature hero gets no bonus there.
    const p = params([member('n', 'Nature', 10), member('f', 'Fire', 5)]);
    expect(squadDpsVsFoe(startStage(bossStage, p), p)).toBe(20 + 15);
  });

  it('adds nothing for a knocked-out hero', () => {
    const p = params([member('n', 'Nature', 10), member('w', 'Water', 5)]);
    const enc = startStage(normal, p);
    const downed = { ...enc, heroes: enc.heroes.map((h) => (h.heroId === 'n' ? { ...h, hp: 0, alive: false } : h)) };
    expect(squadDpsVsFoe(downed, p)).toBe(10);
  });

  it('adds nothing for benched heroes (only the Active Squad is in the params)', () => {
    const active = params([member('w', 'Water', 5)]);
    expect(squadDpsVsFoe(startStage(normal, active), active)).toBe(10);
  });

  it('is 0 with an empty squad', () => {
    const p = params([]);
    expect(squadDpsVsFoe(startStage(normal, p), p)).toBe(0);
  });
});

describe('damageTakenFactor', () => {
  it('is 1 − def / (def + K)', () => {
    expect(damageTakenFactor(0, 50)).toBe(1);
    expect(damageTakenFactor(50, 50)).toBe(0.5);
    expect(damageTakenFactor(150, 50)).toBe(0.25);
  });
});

describe('click', () => {
  // Squad DPS vs stage 1: 10×2×1.5 + 5×2 = 40; a click deals 5% = 2.
  const p = params([member('n', 'Nature', 10), member('w', 'Water', 5)]);

  it('deals clickDpsShare of the squad DPS and opens a new segment', () => {
    const enc = fighting(startStage(normal, p), 100);
    const r = click(enc, p);
    expect(r.outcomes).toEqual([]);
    expect(r.enc.foe?.hp).toBe(98);
    expect(r.enc.foe?.hpAtSegmentStart).toBe(98);
    expect(r.enc.segmentSteps).toBe(0);
    expect(r.enc.phase).toBe('fighting');
  });

  it('restarts every hero segment at its current HP', () => {
    const base = fighting(startStage(normal, p), 100);
    const enc = { ...base, heroes: base.heroes.map((h) => ({ ...h, hp: 150, hpAtSegmentStart: 200 })) };
    expect(click(enc, p).enc.heroes.map((h) => h.hpAtSegmentStart)).toEqual([150, 150]);
  });

  it('kills a foe at or below the click damage and emits kill with the stage gold', () => {
    const r = click(fighting(startStage(normal, p), 2), p);
    expect(r.outcomes).toEqual([{ kind: 'kill', gold: 7 }]);
    expect(r.enc).toMatchObject({ phase: 'spawning', foe: null, monsterIndex: 1 });
    expect(r.enc.spawnStepsLeft * 100).toBeLessThanOrEqual(500);
  });

  it('pays the boss gold for a boss kill and defeats the boss', () => {
    const r = click(fighting(startStage(bossStage, p), 1, true), p);
    expect(r.outcomes).toEqual([
      { kind: 'kill', gold: 56 },
      { kind: 'bossDefeated', stageNumber: 2 },
    ]);
  });

  it('does nothing without a foe', () => {
    const spawning = startStage(normal, p);
    expect(click(spawning, p)).toEqual({ enc: spawning, outcomes: [] });
    const idle = startStage(normal, params([]));
    expect(click(idle, params([]))).toEqual({ enc: idle, outcomes: [] });
  });
});
