/** stage-combat T13 (COMBAT-01): combat params from content and the Active Squad. */
import { describe, expect, it } from 'vitest';
import type { CombatEconomy, HeroData, StageData } from '../../src/domain/content/types';
import { CombatParamsBuilder } from '../../src/services/combat/CombatParamsBuilder';
import type { GameState } from '../../src/services/state/types';

const combat: CombatEconomy = {
  monstersPerStage: 10,
  bossEvery: 5,
  spawnDelayMs: 300,
  defaultBossTimerSeconds: 30,
  typeBonus: 1.5,
  clickDpsShare: 0.05,
  dpsPerPower: 2,
  defenseK: 50,
  monster: { hpBase: 50, hpGrowth: 1.2, goldBase: 5, goldGrowth: 1.1, dpsBase: 2, dpsGrowth: 1.5 },
  boss: { hpMultiplier: 10, dpsMultiplier: 3, goldMultiplier: 7 },
};

const hero = (heroId: string, basePower: number): HeroData => ({
  heroId,
  serverHeroId: '',
  displayName: heroId,
  heroType: heroId === 'b' ? 'Fire' : 'Nature',
  portrait: '',
  basePower,
  baseHp: 100 + basePower,
  baseDefense: 5,
  attackIntervalMs: 800,
  abilityByStarTier: [],
});
const heroes = new Map(['a', 'b', 'c'].map((id, i) => [id, hero(id, 10 * (i + 1))]));

const stages: StageData[] = [2, 1].map((n) => ({
  stageId: `s${n}`,
  stageNumber: n,
  displayName: `S${n}`,
  favoredType: 'Nature',
  monsters: ['slime'],
}));

const content = { combat, stages, hero: (id: string) => heroes.get(id)! };

const state = (squad: string[], tiers: Record<string, number> = {}): GameState =>
  ({
    activeSquad: squad,
    heroes: ['a', 'b', 'c'].map((id) => ({ heroId: id, starTier: tiers[id] ?? 1, duplicatesOwned: 0, isInActiveSquad: squad.includes(id) })),
  }) as unknown as GameState;

describe('CombatParamsBuilder.build', () => {
  it('keeps squad slot order with the leader first', () => {
    const p = CombatParamsBuilder.build(content, state(['c', 'a']), 1);
    expect(p.squad.map((m) => m.heroId)).toEqual(['c', 'a']);
  });

  it('excludes benched heroes', () => {
    const p = CombatParamsBuilder.build(content, state(['a']), 1);
    expect(p.squad.map((m) => m.heroId)).toEqual(['a']);
  });

  it('an empty squad has no heroes', () => {
    expect(CombatParamsBuilder.build(content, state([]), 1).squad).toEqual([]);
  });

  it('star tier scales power and carries hero stats', () => {
    const [m] = CombatParamsBuilder.build(content, state(['b'], { b: 3 }), 1).squad;
    expect(m).toEqual({ heroId: 'b', heroType: 'Fire', power: 60, maxHp: 120, defense: 5, attackIntervalMs: 800 });
  });

  it('takes economy constants and orders stage specs by number', () => {
    const p = CombatParamsBuilder.build(content, state(['a']), 2);
    expect(p.dpsPerPower).toBe(2);
    expect(p.defenseK).toBe(50);
    expect(p.stages.map((s) => s.stageNumber)).toEqual([1, 2]);
  });

  it('rejects an unknown stage', () => {
    expect(() => CombatParamsBuilder.build(content, state(['a']), 9)).toThrow(/stage 9/);
  });
});
