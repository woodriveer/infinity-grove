import type { CombatOutcome, CombatParams, CombatResult, Encounter } from '../../domain/combat/CombatRules';
import { advance, click, stageAt, startStage } from '../../domain/combat/CombatRules';
import { BigDouble } from '../../domain/bignum/BigDouble';
import { BossFailureLabel } from '../../domain/combat/BossFailureLabel';
import { farmRate } from '../../domain/combat/FarmRate';
import type { ServiceDeps } from '../core';
import { withEvent, withGold } from '../core';
import type { GameState, StageCombatSnapshot } from '../state/types';
import { CombatParamsBuilder } from './CombatParamsBuilder';

/** One combat step is 100 ms (AD-007). */
const STEP_MS = 100;
/** The backend rejects a `MonsterKillsBatch` above this count (boss-drops design). */
const MAX_KILLS_PER_EVENT = 1000;

/**
 * The field's commands over the pure `CombatRules` (stage-combat design): `step` and `click` run the
 * encounter and turn its outcomes into state and events. A stage's first clear is the only one that
 * emits `StageCleared` (and `BossDefeated` for a boss stage, before it); replays emit nothing.
 */
export class StageCombatService {
  constructor(private readonly deps: ServiceDeps) {}

  /** Advances the fight by `dtMs` (whole 100 ms steps, at least one). */
  step(dtMs: number): void {
    const s = this.prepared();
    const params = this.params(s);
    const enc = s.stageCombat.encounter;
    if (!enc) return;
    this.commit(s, advance(enc, Math.max(1, Math.round(dtMs / STEP_MS)), params), params);
  }

  /** A click on the foe: `clickDpsShare` of the squad's damage at once. */
  click(): void {
    const s = this.prepared();
    const enc = s.stageCombat.encounter;
    if (!enc) return;
    const params = this.params(s);
    const next = this.commit(s, click(enc, params), params);
    this.deps.store.commit({ ...next, stageCombat: { ...next.stageCombat, clicks: s.stageCombat.clicks + 1 } });
  }

  /** Jumps to a cleared stage or the one after the furthest; auto-advance goes off (COMBAT-03 AC 2, 3). */
  jumpToStage(stageNumber: number): boolean {
    const s = this.deps.store.get();
    const params = this.params(s);
    if (!Number.isInteger(stageNumber) || stageNumber < 1 || stageNumber > s.furthestStageCleared + 1 || stageNumber > params.stages.length) return false;
    this.withEncounter(s, startStage(stageAt(stageNumber, params), params, false));
    return true;
  }

  /** Starts the boss stage that follows the furthest clear with a full timer and full HP (COMBAT-06 AC 5). */
  fightBoss(): boolean {
    const s = this.deps.store.get();
    const n = s.furthestStageCleared + 1;
    const params = this.params(s);
    if (n > params.stages.length) return false;
    const stage = stageAt(n, params);
    if (!stage.boss) return false;
    this.withEncounter(s, startStage(stage, params, true));
    return true;
  }

  /**
   * Farms `ms` of game time without clearing stages (COMBAT-07): the offline and gap catch-up. Kill gold goes to
   * the wallet and the pending income; the fight itself stays where it was (a boss stage keeps its encounter).
   */
  fastForward(ms: number): { gold: number; kills: number } {
    const none = { gold: 0, kills: 0 };
    const steps = Math.floor(ms / STEP_MS);
    if (!(steps > 0)) return none;
    const s = this.prepared();
    const enc = s.stageCombat.encounter;
    if (!enc) return none;
    const params = this.params(s);
    const r = advance(enc, steps, params, 'farming');
    let state = s;
    let sc: StageCombatSnapshot = { ...s.stageCombat };
    let gold = 0;
    let kills = 0;
    for (const o of r.outcomes) {
      if (o.kind !== 'kill') continue;
      const g = Math.max(0, Math.round(o.gold));
      gold += g;
      kills++;
      state = { ...state, gold: Math.min(2147483647, state.gold + g) };
    }
    // Farming a boss stage fights the stage before it (see CombatRules.advance).
    const farmed = this.countKills(state, sc, stageAt(enc.stageNumber, params).boss ? Math.max(1, enc.stageNumber - 1) : enc.stageNumber, kills);
    state = farmed.state;
    sc = { ...farmed.sc, kills: sc.kills + kills, pendingIncome: sc.pendingIncome + gold, encounter: stageAt(enc.stageNumber, params).boss ? enc : r.enc };
    this.deps.store.commit({ ...state, stageCombat: sc });
    return { gold, kills };
  }

  /** Appends one `GoldEarned` for the income gathered since the last flush (the wallet already holds it), then the pending `MonsterKillsBatch` events. */
  flushIncome(): void {
    const s = this.deps.store.get();
    const pending = s.stageCombat.pendingIncome;
    if (!(pending > 0) && !s.stageCombat.pendingKills) return;
    let next = s;
    if (pending > 0) {
      const big = BigDouble.fromDouble(pending);
      next = withEvent(this.deps, next, 'GoldEarned', { goldMantissa: big.mantissa, goldExponent: big.exponent });
    }
    const flushed = this.flushKills(next, next.stageCombat);
    this.deps.store.commit({ ...flushed.state, stageCombat: { ...flushed.sc, pendingIncome: 0 } });
  }

  /** Spends gold if the wallet covers it; pending income is flushed first so the log stays in order. */
  trySpendGold(amount: number): boolean {
    const s = this.deps.store.get();
    if (amount < 0 || s.gold < amount) return false;
    this.flushIncome();
    this.deps.store.commit(withGold(this.deps, this.deps.store.get(), s.gold - amount));
    return true;
  }

  /** Rewards and other whole-gold grants: wallet plus its own `GoldEarned`. */
  addGold(amount: number): void {
    if (amount <= 0) return;
    const s = this.deps.store.get();
    this.deps.store.commit(withGold(this.deps, s, s.gold + amount));
  }

  /** Gold per second the squad earns farming the current stage (the stage before it when that is a boss): the HUD rate. */
  goldPerSecond(): number {
    const s = this.deps.store.get();
    const params = this.params(s);
    const n = s.stageCombat.encounter?.stageNumber ?? s.stageCombat.stageNumber;
    const stage = stageAt(n, params);
    return farmRate(stage.boss && n > 1 ? stageAt(n - 1, params) : stage, params).goldPerSecond;
  }

  setAutoAdvance(on: boolean): void {
    const s = this.deps.store.get();
    const enc = s.stageCombat.encounter;
    this.deps.store.commit({ ...s, stageCombat: { ...s.stageCombat, autoAdvance: on, encounter: enc ? { ...enc, autoAdvance: on } : enc } });
  }

  /** The state with an encounter that matches the squad: started when missing, restarted when the squad changed, boss failed when the leader is gone. */
  private prepared(): GameState {
    const s = this.deps.store.get();
    const sc = s.stageCombat;
    const params = this.params(s);
    const enc = sc.encounter;
    if (!enc) return this.withEncounter(s, startStage(stageAt(sc.stageNumber, params), params, sc.autoAdvance));
    const squad = params.squad.map((m) => m.heroId);
    if (squad.length === enc.heroes.length && squad.every((id, i) => id === enc.heroes[i]?.heroId)) return s;
    if (stageAt(enc.stageNumber, params).boss && enc.heroes[0]?.alive && squad[0] !== enc.heroes[0]?.heroId) {
      return this.commit(s, this.failBossForLeader(enc, params), params);
    }
    return this.withEncounter(s, startStage(stageAt(enc.stageNumber, params), params, enc.autoAdvance));
  }

  private withEncounter(s: GameState, encounter: Encounter): GameState {
    const next = { ...s, stageCombat: { ...s.stageCombat, stageNumber: encounter.stageNumber, autoAdvance: encounter.autoAdvance, encounter } };
    this.deps.store.commit(next);
    return next;
  }

  private params(s: GameState): CombatParams {
    return CombatParamsBuilder.build(this.deps.content, s, s.stageCombat.encounter?.stageNumber ?? s.stageCombat.stageNumber);
  }

  /** Applies a result: the encounter, then each outcome in order. */
  private commit(s: GameState, result: CombatResult, params: CombatParams): GameState {
    const { enc, outcomes } = result;
    let next: GameState = s;
    let sc: StageCombatSnapshot = { ...s.stageCombat };
    // The stage a kill happens on follows the outcomes: a clear or boss win moves on when auto-advance is set, a boss failure falls back one.
    let killStage = s.stageCombat.encounter?.stageNumber ?? s.stageCombat.stageNumber;
    outcomes.forEach((o, i) => {
      const applied = this.apply(next, sc, o, params);
      next = applied.state;
      sc = applied.sc;
      if (o.kind === 'kill' && outcomes[i + 1]?.kind !== 'bossDefeated') {
        const counted = this.countKills(next, sc, killStage, 1);
        next = counted.state;
        sc = counted.sc;
      } else if (o.kind === 'stageCleared' || o.kind === 'bossDefeated') {
        killStage = result.enc.autoAdvance && o.stageNumber < params.stages.length ? o.stageNumber + 1 : o.stageNumber;
      } else if (o.kind === 'bossFailed') {
        killStage = Math.max(1, o.stageNumber - 1);
      }
    });
    sc = { ...sc, stageNumber: enc.stageNumber, autoAdvance: enc.autoAdvance, encounter: enc };
    next = { ...next, stageCombat: sc };
    this.deps.store.commit(next);
    return next;
  }

  /** Adds kills on `stage`; a different stage than the pending one flushes the pending batch first, so a batch never mixes stages. */
  private countKills(s: GameState, sc: StageCombatSnapshot, stage: number, count: number): { state: GameState; sc: StageCombatSnapshot } {
    if (count <= 0) return { state: s, sc };
    const flushed = sc.pendingKills && sc.pendingKills.stageNumber !== stage ? this.flushKills(s, sc) : { state: s, sc };
    const have = flushed.sc.pendingKills?.count ?? 0;
    return { state: flushed.state, sc: { ...flushed.sc, pendingKills: { stageNumber: stage, count: have + count } } };
  }

  /** Appends the pending kills as `MonsterKillsBatch` events of at most `MAX_KILLS_PER_EVENT`. */
  private flushKills(s: GameState, sc: StageCombatSnapshot): { state: GameState; sc: StageCombatSnapshot } {
    const pending = sc.pendingKills;
    if (!pending) return { state: s, sc };
    let state = s;
    for (let left = pending.count; left > 0; left -= MAX_KILLS_PER_EVENT) {
      state = withEvent(this.deps, state, 'MonsterKillsBatch', { stageNumber: pending.stageNumber, count: Math.min(left, MAX_KILLS_PER_EVENT) });
    }
    return { state, sc: { ...sc, pendingKills: null } };
  }

  /** The leader is gone mid-boss: the fight fails to the previous stage with auto-advance off, like any boss failure (COMBAT-06 AC 4). */
  private failBossForLeader(enc: Encounter, params: CombatParams): CombatResult {
    const n = Math.max(1, enc.stageNumber - 1);
    return {
      enc: startStage(stageAt(n, params), params, false),
      outcomes: [{ kind: 'bossFailed', stageNumber: enc.stageNumber, cause: 'leader' }],
    };
  }

  private apply(s: GameState, sc: StageCombatSnapshot, o: CombatOutcome, params: CombatParams): { state: GameState; sc: StageCombatSnapshot } {
    switch (o.kind) {
      case 'kill': {
        // Gold is whole: the same rounded amount goes to the wallet and to the income the next flush reports.
        const gold = Math.max(0, Math.round(o.gold));
        return { state: { ...s, gold: Math.min(2147483647, s.gold + gold) }, sc: { ...sc, kills: sc.kills + 1, pendingIncome: sc.pendingIncome + gold } };
      }
      case 'bossDefeated': {
        if (o.stageNumber <= s.furthestStageCleared) return { state: s, sc };
        let state = withEvent(this.deps, s, 'BossDefeated', { stageNumber: o.stageNumber });
        state = withEvent(this.deps, state, 'StageCleared', { stageNumber: o.stageNumber });
        return { state: { ...state, furthestStageCleared: o.stageNumber }, sc };
      }
      case 'stageCleared': {
        if (o.stageNumber <= s.furthestStageCleared) return { state: s, sc };
        const state = withEvent(this.deps, s, 'StageCleared', { stageNumber: o.stageNumber });
        return { state: { ...state, furthestStageCleared: o.stageNumber }, sc };
      }
      case 'bossFailed': {
        const boss = stageAt(o.stageNumber, params);
        const power = params.squad.reduce((sum, m) => sum + m.power, 0);
        const outcome = BossFailureLabel.label(power, boss.boss?.powerFloor ?? 0, boss.favoredType, params.squad.map((m) => m.heroType));
        return { state: s, sc: { ...sc, lastBossResult: { stageNumber: o.stageNumber, outcome } } };
      }
      case 'squadWiped':
        return { state: s, sc };
    }
  }
}
