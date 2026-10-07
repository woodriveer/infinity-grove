import type { HeroType } from '../HeroType';
import type { CombatEconomy, StageData } from '../content/types';

/** A stage boss's numbers (COMBAT-04). */
export interface BossSpec {
  monsterId: string;
  /** FR-11 Power Gate threshold that labels a boss failure. */
  powerFloor: number;
  hp: number;
  dps: number;
  gold: number;
  /** Countdown; the stage's `timerSeconds`, else `CombatEconomy.defaultBossTimerSeconds`. */
  timerSeconds: number;
}

/** The numbers of one stage, in doubles (COMBAT-01). */
export interface StageSpec {
  stageNumber: number;
  favoredType: HeroType;
  /** Normal monster ids, drawn in order (visual identity only). */
  monsterIds: readonly string[];
  monsterHp: number;
  goldPerKill: number;
  monsterDps: number;
  /** Present on boss stages only. */
  boss?: BossSpec;
}

/**
 * Placeholder geometric curves: stage n's value is `base × growth^(n − 1)`, and a boss is the
 * stage's monster times the boss multipliers. economy-tuning replaces these with bands.
 */
export function stageSpec(stage: StageData, eco: CombatEconomy): StageSpec {
  const n = stage.stageNumber - 1;
  const m = eco.monster;
  const monsterHp = m.hpBase * m.hpGrowth ** n;
  const goldPerKill = m.goldBase * m.goldGrowth ** n;
  const monsterDps = m.dpsBase * m.dpsGrowth ** n;
  const spec: StageSpec = {
    stageNumber: stage.stageNumber,
    favoredType: stage.favoredType,
    monsterIds: stage.monsters,
    monsterHp,
    goldPerKill,
    monsterDps,
  };
  if (stage.boss) {
    spec.boss = {
      monsterId: stage.boss.monsterId,
      powerFloor: stage.boss.powerFloor,
      hp: monsterHp * eco.boss.hpMultiplier,
      dps: monsterDps * eco.boss.dpsMultiplier,
      gold: goldPerKill * eco.boss.goldMultiplier,
      timerSeconds: stage.boss.timerSeconds ?? eco.defaultBossTimerSeconds,
    };
  }
  return spec;
}
