import type { HeroType } from '../HeroType';
import type { CombatEconomy } from '../content/types';
import type { StageSpec } from './StageCurves';

/** Steps per second: one combat step is 100 ms (AD-007). */
const STEPS_PER_SECOND = 10;
const STEP_MS = 1000 / STEPS_PER_SECOND;

/** One Active Squad hero as combat sees it; benched heroes are never members. */
export interface SquadMember {
  heroId: string;
  heroType: HeroType;
  power: number;
  maxHp: number;
  defense: number;
  attackIntervalMs: number;
}

/** Everything `CombatRules` reads besides the encounter (built by `CombatParamsBuilder`). */
export interface CombatParams
  extends Pick<CombatEconomy, 'monstersPerStage' | 'spawnDelayMs' | 'typeBonus' | 'clickDpsShare' | 'dpsPerPower' | 'defenseK'> {
  /** Active Squad in slot order; index 0 is the leader. */
  squad: readonly SquadMember[];
  /** Every stage in content; `stages[n − 1]` is stage n. */
  stages: readonly StageSpec[];
}

export interface FieldHero {
  heroId: string;
  heroType: HeroType;
  /** 0 = leader. */
  slot: number;
  maxHp: number;
  hp: number;
  hpAtSegmentStart: number;
  dps: number;
  defense: number;
  /** Animation pacing only. */
  attackIntervalMs: number;
  alive: boolean;
}

export interface Foe {
  monsterId: string;
  isBoss: boolean;
  maxHp: number;
  hp: number;
  hpAtSegmentStart: number;
  dps: number;
}

export interface Encounter {
  stageNumber: number;
  phase: 'idle' | 'spawning' | 'fighting';
  /** 0..monstersPerStage − 1. */
  monsterIndex: number;
  foe: Foe | null;
  heroes: readonly FieldHero[];
  /** Steps since the last event. */
  segmentSteps: number;
  spawnStepsLeft: number;
  bossStepsLeft: number | null;
  /** Drives animation cadence. */
  elapsedMs: number;
}

export type CombatOutcome =
  | { kind: 'kill'; gold: number }
  | { kind: 'stageCleared'; stageNumber: number }
  | { kind: 'bossDefeated'; stageNumber: number }
  | { kind: 'bossFailed'; stageNumber: number; cause: 'timer' | 'leader' }
  | { kind: 'squadWiped'; stageNumber: number };

export interface CombatResult {
  enc: Encounter;
  outcomes: CombatOutcome[];
}

/** The stage spec of stage `n`. */
export function stageAt(n: number, p: CombatParams): StageSpec {
  const stage = p.stages[n - 1];
  if (!stage) throw new Error(`No stage ${n} in combat params`);
  return stage;
}

/** Fraction of incoming damage a hero takes: `1 − def / (def + K)`. */
export function damageTakenFactor(defense: number, k: number): number {
  return 1 - defense / (defense + k);
}

/** A stage at its start: every hero at full HP, the first spawn pending, the boss timer full. */
export function startStage(stage: StageSpec, p: CombatParams): Encounter {
  const heroes = p.squad.map(
    (m, slot): FieldHero => ({
      heroId: m.heroId,
      heroType: m.heroType,
      slot,
      maxHp: m.maxHp,
      hp: m.maxHp,
      hpAtSegmentStart: m.maxHp,
      dps: m.power * p.dpsPerPower,
      defense: m.defense,
      attackIntervalMs: m.attackIntervalMs,
      alive: true,
    }),
  );
  return {
    stageNumber: stage.stageNumber,
    phase: heroes.length === 0 ? 'idle' : 'spawning',
    monsterIndex: 0,
    foe: null,
    heroes,
    segmentSteps: 0,
    spawnStepsLeft: p.spawnDelayMs / STEP_MS,
    bossStepsLeft: stage.boss ? Math.round(stage.boss.timerSeconds * STEPS_PER_SECOND) : null,
    elapsedMs: 0,
  };
}

/** Squad damage per second against the current stage's foes: living heroes, `typeBonus` on the favored type. */
export function squadDpsVsFoe(enc: Encounter, p: CombatParams): number {
  const favored = stageAt(enc.stageNumber, p).favoredType;
  let dps = 0;
  for (const h of enc.heroes) {
    if (h.alive) dps += h.dps * (h.heroType === favored ? p.typeBonus : 1);
  }
  return dps;
}

/** A click: `clickDpsShare × squadDpsVsFoe` at once. It opens a new segment and may kill the foe. */
export function click(enc: Encounter, p: CombatParams): CombatResult {
  const foe = enc.foe;
  if (enc.phase !== 'fighting' || !foe) return { enc, outcomes: [] };
  const hp = foe.hp - p.clickDpsShare * squadDpsVsFoe(enc, p);
  const opened = openSegment({ ...enc, foe: { ...foe, hp } });
  return hp <= 0 ? killFoe(opened, p) : { enc: opened, outcomes: [] };
}

/** Starts a new segment at the current HP values. */
function openSegment(enc: Encounter): Encounter {
  return {
    ...enc,
    foe: enc.foe ? { ...enc.foe, hpAtSegmentStart: enc.foe.hp } : null,
    heroes: enc.heroes.map((h) => ({ ...h, hpAtSegmentStart: h.hp })),
    segmentSteps: 0,
  };
}

/** The foe dies: its gold is awarded and the next spawn starts counting. */
function killFoe(enc: Encounter, p: CombatParams): CombatResult {
  const stage = stageAt(enc.stageNumber, p);
  const gold = enc.foe?.isBoss ? (stage.boss?.gold ?? 0) : stage.goldPerKill;
  return {
    enc: {
      ...enc,
      phase: 'spawning',
      foe: null,
      monsterIndex: enc.monsterIndex + 1,
      spawnStepsLeft: p.spawnDelayMs / STEP_MS,
    },
    outcomes: [{ kind: 'kill', gold }],
  };
}
