import { newMonsterEntity, takeDamage } from '../../domain/MonsterEntity';
import type { ServiceDeps } from '../core';
import { withGold } from '../core';
import type { CombatSnapshot } from '../state/types';

/** Unity CombatService.WalkDuration. */
export const WALK_DURATION_MS = 2000;

/**
 * The combat loop (P2, Unity CombatService): Krell walks for 2 s, a monster from the
 * pool spawns, clicks damage it, its death awards gold, and the walk starts again.
 * The walk timer is driven by TickDriver time (RFR-8), not by Task.Delay.
 */
export class CombatService {
  constructor(private readonly deps: ServiceDeps) {}

  static initial(): CombatSnapshot {
    return { state: 'Walking', started: false, walkElapsedMs: 0, monster: null, kills: 0, attackCount: 0, lastDamage: 0 };
  }

  get gold(): number {
    return this.deps.store.get().gold;
  }

  /** Begin(): start walking (CombatPresenter.Start). Idempotent. */
  begin(): void {
    const s = this.deps.store.get();
    if (s.combat.started) return;
    this.deps.store.commit({ ...s, combat: { ...s.combat, started: true, state: 'Walking', walkElapsedMs: 0, monster: null } });
  }

  /** Advances the walk timer; spawns a monster when it elapses. Called in fixed steps by TickDriver. */
  step(dtMs: number): void {
    const s = this.deps.store.get();
    const c = s.combat;
    if (!c.started || c.state !== 'Walking') return;
    const walkElapsedMs = c.walkElapsedMs + dtMs;
    if (walkElapsedMs < WALK_DURATION_MS) {
      this.deps.store.commit({ ...s, combat: { ...c, walkElapsedMs } });
      return;
    }
    const pool = this.deps.content.settings.monsterPool;
    if (pool.length === 0) {
      this.deps.logger.warn('CombatService has no monster pool configured; staying in walking state.');
      this.deps.store.commit({ ...s, combat: { ...c, walkElapsedMs } });
      return;
    }
    const data = this.deps.content.monster(pool[this.deps.rng.rangeInt(0, pool.length)] as string);
    const goldReward = this.deps.rng.rangeInt(data.goldMin, data.goldMax + 1);
    const monster = newMonsterEntity(data.monsterId, data.monsterName, data.sprite, data.maxHp, goldReward);
    this.deps.store.commit({ ...s, combat: { ...c, state: 'Fighting', walkElapsedMs: 0, monster } });
  }

  /** PlayerAttack(damage): only while fighting a live monster. */
  playerAttack(damage: number): void {
    const s = this.deps.store.get();
    const c = s.combat;
    const attacked = { ...c, attackCount: c.attackCount + 1, lastDamage: damage };
    if (c.state !== 'Fighting' || c.monster === null) {
      this.deps.store.commit({ ...s, combat: attacked });
      return;
    }
    const { monster, defeated } = takeDamage(c.monster, damage);
    if (!defeated) {
      this.deps.store.commit({ ...s, combat: { ...attacked, monster } });
      return;
    }
    // HandleMonsterDefeated: award gold, start walking again.
    const next = withGold(this.deps, s, s.gold + monster.goldReward);
    this.deps.store.commit({
      ...next,
      combat: { ...attacked, state: 'Walking', walkElapsedMs: 0, monster: null, kills: c.kills + 1 },
    });
  }

  trySpendGold(amount: number): boolean {
    const s = this.deps.store.get();
    if (amount < 0 || s.gold < amount) return false;
    this.deps.store.commit(withGold(this.deps, s, s.gold - amount));
    return true;
  }

  addGold(amount: number): void {
    if (amount <= 0) return;
    const s = this.deps.store.get();
    this.deps.store.commit(withGold(this.deps, s, s.gold + amount));
  }
}
