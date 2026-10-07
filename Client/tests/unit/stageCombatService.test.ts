/** stage-combat T15 (COMBAT-01, 03, 04, 06, 08): StageCombatService step, click and outcomes. */
import { describe, expect, it } from 'vitest';
import type { CombatEconomy, HeroData, StageData } from '../../src/domain/content/types';
import type { HeroType } from '../../src/domain/HeroType';
import { RosterService } from '../../src/services/roster/RosterService';
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

function setup(squad: string[], furthest: number, stageNumber: number): { svc: StageCombatService; roster: RosterService; store: GameStore; events: () => string[] } {
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
    roster: new RosterService(deps),
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

  it('jumps to a cleared stage and to furthest + 1, never beyond, and turns auto-advance off', () => {
    const { svc, store } = setup(['strong'], 2, 1);
    expect(svc.jumpToStage(2)).toBe(true);
    expect(store.get().stageCombat.stageNumber).toBe(2);
    expect(store.get().stageCombat.autoAdvance).toBe(false);
    expect(svc.jumpToStage(3)).toBe(true);
    expect(svc.jumpToStage(4)).toBe(false);
    expect(svc.jumpToStage(0)).toBe(false);
    expect(store.get().stageCombat.stageNumber).toBe(3);
    expect(store.get().stageCombat.encounter?.autoAdvance).toBe(false);
  });

  it('fight boss restarts the boss with a full timer and full HP', () => {
    const { svc, store } = setup(['strong'], 4, 4);
    expect(svc.fightBoss()).toBe(true);
    const full = store.get().stageCombat.encounter?.bossStepsLeft;
    expect(full).toBe(300);
    svc.step(5000);
    expect(store.get().stageCombat.encounter?.bossStepsLeft).toBeLessThan(full ?? 0);
    expect(svc.fightBoss()).toBe(true);
    expect(store.get().stageCombat.encounter?.bossStepsLeft).toBe(300);
    expect(store.get().stageCombat.encounter?.heroes[0]?.hp).toBe(1000);
  });

  it('fight boss is refused when the next stage is not a boss stage', () => {
    const { svc } = setup(['strong'], 1, 1);
    expect(svc.fightBoss()).toBe(false);
  });

  it('setAutoAdvance flips the flag on the state and the encounter', () => {
    const { svc, store } = setup(['strong'], 0, 1);
    svc.step(100);
    svc.setAutoAdvance(false);
    expect(store.get().stageCombat.autoAdvance).toBe(false);
    expect(store.get().stageCombat.encounter?.autoAdvance).toBe(false);
  });

  it('squad changes are refused during a boss fight and allowed after', () => {
    const { svc, roster, store } = setup(['strong'], 4, 5);
    svc.step(100);
    expect(roster.squadLocked()).toBe(true);
    expect(roster.tryActivate('other')).toBe(false);
    expect(roster.swap('strong', 'other')).toBe(false);
    roster.benchHero('strong');
    expect(store.get().activeSquad).toEqual(['strong']);
    svc.jumpToStage(4);
    expect(roster.squadLocked()).toBe(false);
    expect(roster.tryActivate('other')).toBe(true);
    expect(store.get().activeSquad).toEqual(['strong', 'other']);
  });
  describe('fast-forward and income (T17)', () => {
    it('10 min of steps and fastForward(10 min) give the same gold within 1e-6', () => {
      const a = setup(['strong'], 3, 2);
      a.svc.setAutoAdvance(false);
      a.svc.step(100);
      const b = setup(['strong'], 3, 2);
      b.svc.setAutoAdvance(false);
      b.svc.step(100);
      const g0 = a.store.get().gold;
      for (let i = 0; i < 6000; i++) a.svc.step(100);
      const r = b.svc.fastForward(600000);
      const stepped = a.store.get().gold - g0;
      expect(r.gold).toBeGreaterThan(0);
      expect(Math.abs(r.gold - stepped) / stepped).toBeLessThan(1e-6);
      expect(r.kills).toBeGreaterThan(0);
    });

    it('fast-forward never clears stages or emits stage events', () => {
      const { svc, store, events } = setup(['strong'], 0, 1);
      svc.fastForward(600000);
      expect(store.get().furthestStageCleared).toBe(0);
      expect(events().filter((e) => e.startsWith('StageCleared') || e.startsWith('BossDefeated'))).toHaveLength(0);
    });

    it('a boss stage farms the stage before it and keeps its encounter', () => {
      const { svc, store } = setup(['strong'], 4, 5);
      svc.step(100);
      const before = store.get().stageCombat.encounter;
      const r = svc.fastForward(60000);
      expect(r.gold).toBeGreaterThan(0);
      expect(store.get().stageCombat.encounter).toBe(before);
      expect(store.get().furthestStageCleared).toBe(4);
    });

    it('a spend after kills logs GoldEarned before GoldSpent and clears the pending income', () => {
      const { svc, store, events } = setup(['strong'], 3, 2);
      svc.fastForward(60000);
      const gold = store.get().gold;
      expect(gold).toBeGreaterThan(5);
      expect(svc.trySpendGold(5)).toBe(true);
      expect(events().map((e) => e.split(':')[0])).toEqual(['GoldEarned', 'GoldSpent']);
      expect(store.get().gold).toBe(gold - 5);
      expect(store.get().stageCombat.pendingIncome).toBe(0);
      expect(svc.trySpendGold(1e9)).toBe(false);
    });

    it('zero income flushes nothing', () => {
      const { svc, events } = setup(['strong'], 3, 2);
      svc.flushIncome();
      expect(events()).toHaveLength(0);
    });
  });
});
