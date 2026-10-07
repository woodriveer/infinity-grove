/** stage-combat T21 (COMBAT-03..06, spec P1 FR-11 AC 6): the content makes the favored type decide every boss fight. */
import { describe, expect, it } from 'vitest';
import { compose } from '../../src/app/compose';
import { defaultConfig } from '../../src/app/config';
import { BossFailureLabel } from '../../src/domain/combat/BossFailureLabel';
import { type CombatOutcome, type CombatParams, type SquadMember, advance, startStage } from '../../src/domain/combat/CombatRules';
import { stageSpec } from '../../src/domain/combat/StageCurves';
import type { HeroType } from '../../src/domain/HeroType';
import { createNodePlatform } from '../../src/platform/node/nodePlatform';

const { content } = compose(defaultConfig('test'), createNodePlatform());
const eco = content.combat;
const specs = [...content.stages].sort((a, b) => a.stageNumber - b.stageNumber).map((s) => stageSpec(s, eco));
const bossStages = specs.filter((s) => s.boss);
const TYPES: readonly HeroType[] = ['Nature', 'Fire', 'Water', 'Light', 'Dark'];
const MAX_BOSS_STEPS = 600;

const hp = content.heroes.map((h) => h.baseHp);
const def = content.heroes.map((h) => h.baseDefense);
/** The sturdiest and the frailest content hero: a win must hold for the frail one, a loss for the sturdy one. */
const sturdy = { maxHp: Math.max(...hp), defense: Math.max(...def) };
const frail = { maxHp: Math.min(...hp), defense: Math.min(...def) };

function squad(totalPower: number, types: readonly HeroType[], stats: { maxHp: number; defense: number }): SquadMember[] {
  return types.map((heroType, i) => ({ heroId: `h${i}`, heroType, power: totalPower / types.length, attackIntervalMs: 800, ...stats }));
}

function params(members: SquadMember[]): CombatParams {
  return {
    monstersPerStage: eco.monstersPerStage,
    spawnDelayMs: eco.spawnDelayMs,
    typeBonus: eco.typeBonus,
    clickDpsShare: eco.clickDpsShare,
    dpsPerPower: eco.dpsPerPower,
    defenseK: eco.defenseK,
    squad: members,
    stages: specs,
  };
}

/** Plays the boss fight of `stage` untouched and returns how it ended and how long it took. */
function fight(stageNumber: number, members: SquadMember[]) {
  const p = params(members);
  let enc = startStage(specs[stageNumber - 1]!, p);
  for (let steps = 1; steps <= MAX_BOSS_STEPS + 10; steps++) {
    const r = advance(enc, 1, p);
    enc = r.enc;
    const end = r.outcomes.find((o): o is Extract<CombatOutcome, { kind: 'bossDefeated' | 'bossFailed' }> => o.kind === 'bossDefeated' || o.kind === 'bossFailed');
    if (end) return { end, seconds: steps / 10 };
  }
  throw new Error(`boss fight of stage ${stageNumber} did not end within ${MAX_BOSS_STEPS / 10} s`);
}

describe('FR-11 tuning check over every boss stage (spec P1 FR-11 AC 6)', () => {
  it('content has boss stages to check', () => {
    expect(bossStages.length).toBeGreaterThanOrEqual(2);
  });

  describe.each(bossStages.map((s) => [s.stageNumber, s] as const))('boss stage %i', (n, stage) => {
    const boss = stage.boss!;
    const other = TYPES.find((t) => t !== stage.favoredType)!;
    const others = (count: number) => Array<HeroType>(count).fill(other);

    it.each([1, 2, 3, 4, 5])('a matching squad of %i exactly at the floor wins', (size) => {
      const allFavored = fight(n, squad(boss.powerFloor, Array<HeroType>(size).fill(stage.favoredType), frail));
      expect(allFavored.end.kind).toBe('bossDefeated');
      // One favored hero among off-type ones, in the last slot: the weakest matching squad.
      const onlyOne = fight(n, squad(boss.powerFloor, [...others(size - 1), stage.favoredType], frail));
      expect(onlyOne.end.kind).toBe('bossDefeated');
      expect(allFavored.seconds).toBeLessThanOrEqual(boss.timerSeconds);
      expect(onlyOne.seconds).toBeLessThanOrEqual(boss.timerSeconds);
    });

    it.each([1, 2, 3, 4, 5])('a non-matching squad of %i exactly at the floor loses and is labelled Composition Mismatch', (size) => {
      const types = others(size);
      const result = fight(n, squad(boss.powerFloor, types, sturdy));
      expect(result.end.kind).toBe('bossFailed');
      expect(BossFailureLabel.label(boss.powerFloor, boss.powerFloor, stage.favoredType, types)).toBe('CompositionMismatch');
    });

    it('no boss fight lasts more than 60 s', () => {
      expect(boss.timerSeconds).toBeLessThanOrEqual(60);
      for (let size = 1; size <= 5; size++) {
        for (const types of [Array<HeroType>(size).fill(stage.favoredType), others(size)]) {
          for (const power of [boss.powerFloor / 4, boss.powerFloor, boss.powerFloor * 4]) {
            expect(fight(n, squad(power, types, frail)).seconds).toBeLessThanOrEqual(60);
          }
        }
      }
    });
  });
});
