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
  /** A clear moves to the next stage when on, else restarts the stage; a boss failure turns it off. */
  autoAdvance: boolean;
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
export function startStage(stage: StageSpec, p: CombatParams, autoAdvance = true): Encounter {
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
    autoAdvance,
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

/** Runs `steps` 100 ms steps in live mode. */
export function advance(enc: Encounter, steps: number, p: CombatParams): CombatResult {
  const outcomes: CombatOutcome[] = [];
  let current = enc;
  for (let i = 0; i < steps; i++) {
    const r = step(current, p);
    current = r.enc;
    outcomes.push(...r.outcomes);
  }
  return { enc: current, outcomes };
}

/** One step in the design's fixed order: spawn, squad strikes first, foe damage, then kill → knock-outs → leader → timer → wipe. */
function step(enc: Encounter, p: CombatParams): CombatResult {
  if (enc.phase === 'idle') return { enc, outcomes: [] };
  const timed = { ...enc, elapsedMs: enc.elapsedMs + STEP_MS };
  if (enc.phase === 'spawning') {
    const left = enc.spawnStepsLeft - 1;
    return { enc: left > 0 ? { ...timed, spawnStepsLeft: left } : spawnFoe({ ...timed, spawnStepsLeft: 0 }, p), outcomes: [] };
  }
  return fight(timed, p);
}

/** The next foe enters: normal monster `monsterIndex`, or the stage boss. */
function spawnFoe(enc: Encounter, p: CombatParams): Encounter {
  const stage = stageAt(enc.stageNumber, p);
  const foe: Foe = stage.boss
    ? { monsterId: stage.boss.monsterId, isBoss: true, maxHp: stage.boss.hp, hp: stage.boss.hp, hpAtSegmentStart: stage.boss.hp, dps: stage.boss.dps }
    : {
        monsterId: stage.monsterIds[enc.monsterIndex % stage.monsterIds.length] ?? '',
        isBoss: false,
        maxHp: stage.monsterHp,
        hp: stage.monsterHp,
        hpAtSegmentStart: stage.monsterHp,
        dps: stage.monsterDps,
      };
  return openSegment({ ...enc, phase: 'fighting', foe });
}

/** A fighting step: HP is `hpAtSegmentStart − k × perStep`, never accumulated (AD-007). */
function fight(enc: Encounter, p: CombatParams): CombatResult {
  const foe = enc.foe;
  if (!foe) return { enc, outcomes: [] };
  const k = enc.segmentSteps + 1;
  const foeHp = foe.hpAtSegmentStart - k * (squadDpsVsFoe(enc, p) / STEPS_PER_SECOND);
  const struck: Encounter = { ...enc, segmentSteps: k, foe: { ...foe, hp: foeHp } };
  // The squad strikes first: a foe killed this step deals no damage.
  if (foeHp <= 0) return killFoe(struck, p);

  const takers = damageTakers(enc, p);
  let knockedOut = false;
  const heroes = enc.heroes.map((h) => {
    if (!h.alive || !takers.includes(h)) return h;
    const hp = h.hpAtSegmentStart - k * ((foe.dps * damageTakenFactor(h.defense, p.defenseK)) / (takers.length * STEPS_PER_SECOND));
    if (hp > 0) return { ...h, hp };
    knockedOut = true;
    return { ...h, hp: 0, alive: false };
  });
  let next: Encounter = { ...struck, heroes };
  if (knockedOut) next = openSegment(next);

  const n = enc.stageNumber;
  if (foe.isBoss) {
    if (!heroes[0]?.alive) return failBoss(next, p, 'leader');
    const bossStepsLeft = (next.bossStepsLeft ?? 0) - 1;
    if (bossStepsLeft <= 0) return failBoss(next, p, 'timer');
    return { enc: { ...next, bossStepsLeft }, outcomes: [] };
  }
  if (heroes.every((h) => !h.alive)) {
    return { enc: restartAt(n, next, p, next.autoAdvance), outcomes: [{ kind: 'squadWiped', stageNumber: n }] };
  }
  return { enc: next, outcomes: [] };
}

/** Living heroes that share the foe's damage: all of them, or only the leader against a boss when no squad hero has the favored type (AD-004). */
function damageTakers(enc: Encounter, p: CombatParams): FieldHero[] {
  const living = enc.heroes.filter((h) => h.alive);
  if (!enc.foe?.isBoss) return living;
  const favored = stageAt(enc.stageNumber, p).favoredType;
  if (enc.heroes.some((h) => h.heroType === favored)) return living;
  return living.filter((h) => h.slot === 0);
}

/** The foe dies: its gold is awarded; the last monster or the boss clears the stage, otherwise the next spawn starts counting. */
function killFoe(enc: Encounter, p: CombatParams): CombatResult {
  const n = enc.stageNumber;
  const stage = stageAt(n, p);
  if (enc.foe?.isBoss) {
    return {
      enc: clearStage(enc, p),
      outcomes: [
        { kind: 'kill', gold: stage.boss?.gold ?? 0 },
        { kind: 'bossDefeated', stageNumber: n },
      ],
    };
  }
  const monsterIndex = enc.monsterIndex + 1;
  if (monsterIndex >= p.monstersPerStage) {
    return {
      enc: clearStage(enc, p),
      outcomes: [
        { kind: 'kill', gold: stage.goldPerKill },
        { kind: 'stageCleared', stageNumber: n },
      ],
    };
  }
  return {
    enc: { ...enc, phase: 'spawning', foe: null, monsterIndex, spawnStepsLeft: p.spawnDelayMs / STEP_MS },
    outcomes: [{ kind: 'kill', gold: stage.goldPerKill }],
  };
}

/** After a clear: the next stage with auto-advance on and one exists, otherwise the same stage again. */
function clearStage(enc: Encounter, p: CombatParams): Encounter {
  const n = enc.stageNumber;
  const target = enc.autoAdvance && n < p.stages.length ? n + 1 : n;
  return restartAt(target, enc, p, enc.autoAdvance);
}

/** A boss failure: back to the previous stage with auto-advance off (COMBAT-06 AC 4). */
function failBoss(enc: Encounter, p: CombatParams, cause: 'timer' | 'leader'): CombatResult {
  const n = enc.stageNumber;
  return { enc: restartAt(Math.max(1, n - 1), enc, p, false), outcomes: [{ kind: 'bossFailed', stageNumber: n, cause }] };
}

/** Starts stage `n` at full HP; the animation clock keeps running. */
function restartAt(n: number, enc: Encounter, p: CombatParams, autoAdvance: boolean): Encounter {
  return { ...startStage(stageAt(n, p), p, autoAdvance), elapsedMs: enc.elapsedMs };
}
