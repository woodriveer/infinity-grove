import type { CombatOutcome, CombatParams, CombatResult, Encounter } from '../../domain/combat/CombatRules';
import { advance, click, stageAt, startStage } from '../../domain/combat/CombatRules';
import { BigDouble } from '../../domain/bignum/BigDouble';
import { BossFailureLabel } from '../../domain/combat/BossFailureLabel';
import type { ServiceDeps } from '../core';
import { withEvent, withGold } from '../core';
import type { GameState, StageCombatSnapshot } from '../state/types';
import { CombatParamsBuilder } from './CombatParamsBuilder';

/** One combat step is 100 ms (AD-007). */
const STEP_MS = 100;

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
    sc = { ...sc, kills: sc.kills + kills, pendingIncome: sc.pendingIncome + gold, encounter: stageAt(enc.stageNumber, params).boss ? enc : r.enc };
    this.deps.store.commit({ ...state, stageCombat: sc });
    return { gold, kills };
  }

  /** Appends one `GoldEarned` for the income gathered since the last flush (the wallet already holds it). */
  flushIncome(): void {
    const s = this.deps.store.get();
    const pending = s.stageCombat.pendingIncome;
    if (!(pending > 0)) return;
    const big = BigDouble.fromDouble(pending);
    const next = withEvent(this.deps, s, 'GoldEarned', { goldMantissa: big.mantissa, goldExponent: big.exponent });
    this.deps.store.commit({ ...next, stageCombat: { ...next.stageCombat, pendingIncome: 0 } });
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
    for (const o of outcomes) {
      const applied = this.apply(next, sc, o, params);
      next = applied.state;
      sc = applied.sc;
    }
    sc = { ...sc, stageNumber: enc.stageNumber, autoAdvance: enc.autoAdvance, encounter: enc };
    next = { ...next, stageCombat: sc };
    this.deps.store.commit(next);
    return next;
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
