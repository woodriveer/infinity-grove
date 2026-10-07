/** stage-combat T15 (COMBAT-01, 03, 04, 06, 08): StageCombatService step, click and outcomes. */
import { describe, expect, it } from 'vitest';
import type { CombatEconomy, HeroData, StageData } from '../../src/domain/content/types';
import type { HeroType } from '../../src/domain/HeroType';
import { StageCombatService } from '../../src/services/combat/StageCombatService';
import type { ServiceDeps } from '../../src/services/core';
import { GameStore } from '../../src/services/state/GameStore';
import { emptyGameState } from '../../src/services/state/projection';
import type { GameState } from '../../src/services/state/types';

const combat: CombatEconomy = {
  monstersPerStage: 3,
  bossEvery: 5,
  spawnDelayMs: 300,
  defaultBossTimerSeconds: 30,
  typeBonus: 1,
  clickDpsShare: 0.5,
  dpsPerPower: 1,
  defenseK: 50,
  monster: { hpBase: 50, hpGrowth: 1, goldBase: 5, goldGrowth: 1, dpsBase: 1, dpsGrowth: 1 },
  boss: { hpMultiplier: 10, dpsMultiplier: 3, goldMultiplier: 7 },
};

const hero = (heroId: string, basePower: number, heroType: HeroType = 'Nature'): HeroData => ({
  heroId,
  serverHeroId: '',
  displayName: heroId,
  heroType,
  portrait: '',
  basePower,
  baseHp: 1000,
  baseDefense: 5,
  attackIntervalMs: 800,
  abilityByStarTier: [],
});
const heroes = new Map([hero('strong', 100), hero('weak', 1), hero('other', 100, 'Fire')].map((h) => [h.heroId, h]));

const stages: StageData[] = [1, 2, 3, 4, 5].map((n) => ({
  stageId: `s${n}`,
  stageNumber: n,
  displayName: `S${n}`,
  favoredType: 'Nature',
  powerFloor: 0,
  monsters: ['slime'],
  ...(n === 5 ? { boss: { monsterId: 'boss', powerFloor: 1000 } } : {}),
}));

function setup(squad: string[], furthest: number, stageNumber: number): { svc: StageCombatService; store: GameStore; events: () => string[] } {
  const base = emptyGameState();
  const store = new GameStore({
    ...base,
    furthestStageCleared: furthest,
    activeSquad: squad,
    heroes: [...heroes.keys()].map((id) => ({ heroId: id, starTier: 1, duplicatesOwned: 0, isInActiveSquad: squad.includes(id) })),
    stageCombat: { ...base.stageCombat, stageNumber },
  } as GameState);
  let id = 0;
  const deps = {
    store,
    clock: { nowMs: () => 1000 },
    rng: {},
    ids: { next: () => `id-${++id}` },
    content: { combat, stages, hero: (h: string) => heroes.get(h)! },
    logger: { info() {}, warn() {}, error() {} },
  } as unknown as ServiceDeps;
  return {
    svc: new StageCombatService(deps),
    store,
    events: () => store.get().eventLog.pending.map((e) => `${e.type}:${e.payloadJson}`),
  };
}

describe('StageCombatService', () => {
  it('starts the encounter on the first step', () => {
    const { svc, store } = setup(['strong'], 0, 1);
    expect(store.get().stageCombat.encounter).toBeNull();
    svc.step(100);
    expect(store.get().stageCombat.encounter?.stageNumber).toBe(1);
  });

  it('a kill adds its gold to the wallet and to the pending income', () => {
    const { svc, store } = setup(['strong'], 0, 1);
    svc.step(2000);
    const s = store.get();
    expect(s.stageCombat.kills).toBeGreaterThan(0);
    expect(s.gold).toBe(s.stageCombat.kills * 5);
    expect(s.stageCombat.pendingIncome).toBe(s.gold);
  });

  it('the first clear sets furthest, emits StageCleared once and auto-advances', () => {
    const { svc, store, events } = setup(['strong'], 0, 1);
    svc.step(5000);
    const s = store.get();
    expect(s.furthestStageCleared).toBeGreaterThanOrEqual(1);
    expect(events().filter((e) => e.startsWith('StageCleared:{"stageNumber":1}'))).toHaveLength(1);
    expect(s.stageCombat.stageNumber).toBeGreaterThan(1);
  });

  it('a replay of a cleared stage emits no StageCleared and keeps furthest', () => {
    const { svc, store, events } = setup(['strong'], 3, 1);
    svc.step(6000);
    expect(store.get().furthestStageCleared).toBe(3);
    expect(events().filter((e) => e.startsWith('StageCleared'))).toHaveLength(0);
  });

  it('a boss victory emits BossDefeated before StageCleared, once', () => {
    const { svc, store, events } = setup(['strong'], 4, 5);
    svc.step(20000);
    expect(store.get().furthestStageCleared).toBe(5);
    expect(events().map((e) => e.split(':')[0]).filter((t) => t !== 'GoldEarned')).toEqual(['BossDefeated', 'StageCleared']);
    svc.step(20000);
    expect(events().filter((e) => e.startsWith('BossDefeated'))).toHaveLength(1);
  });

  it('a boss timeout labels the failure, returns to the previous stage and turns auto-advance off', () => {
    const { svc, store, events } = setup(['weak'], 4, 5);
    svc.step(40000);
    const sc = store.get().stageCombat;
    expect(sc.lastBossResult).toEqual({ stageNumber: 5, outcome: 'PowerGate' });
    expect(sc.stageNumber).toBe(4);
    expect(sc.autoAdvance).toBe(false);
    expect(store.get().furthestStageCleared).toBe(4);
    expect(events().filter((e) => e.startsWith('BossDefeated'))).toHaveLength(0);
  });

  it('a boss failure without the favored type is a Composition Mismatch', () => {
    // Enough power, wrong type, and a leader that the whole boss damage knocks out at once.
    heroes.set('glass', { ...hero('glass', 1000, 'Fire'), baseHp: 1 });
    try {
      const { svc, store } = setup(['glass'], 4, 5);
      store.commit({ ...store.get(), heroes: [{ heroId: 'glass', starTier: 1, duplicatesOwned: 0, isInActiveSquad: true }] });
      svc.step(40000);
      expect(store.get().stageCombat.lastBossResult).toEqual({ stageNumber: 5, outcome: 'CompositionMismatch' });
    } finally {
      heroes.delete('glass');
    }
  });

  it('a leader that disappears mid-boss fails the fight', () => {
    const { svc, store } = setup(['strong', 'other'], 4, 5);
    svc.step(100);
    const s = store.get();
    store.commit({ ...s, activeSquad: ['other'] });
    svc.step(100);
    const sc = store.get().stageCombat;
    expect(sc.lastBossResult?.stageNumber).toBe(5);
    expect(sc.stageNumber).toBe(4);
    expect(sc.autoAdvance).toBe(false);
  });

  it('a click counts and damages the foe once fighting', () => {
    const { svc, store } = setup(['strong'], 0, 1);
    svc.step(600);
    const hpBefore = store.get().stageCombat.encounter?.foe?.hp ?? 0;
    svc.click();
    const sc = store.get().stageCombat;
    expect(sc.clicks).toBe(1);
    expect(sc.encounter?.foe?.hp ?? 0).toBeLessThan(hpBefore);
  });
});
