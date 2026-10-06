import type { CombatService } from '../combat/CombatService';
import type { ServiceDeps } from '../core';
import type { SaveSyncService } from '../sync/SaveSyncService';

export const STEP_MS = 100;
export const CATCH_UP_CAP_MS = 60_000;

/**
 * The delta-based game loop (RFR-8, AD-6). Phaser's update, the sim and the debug
 * hook all call advance(elapsedMs). Time is stepped in fixed 100 ms steps up to a
 * 60 s catch-up cap; anything beyond the cap goes through offline accrual, the
 * same path as a launch. Throttled or suspended frames delay results, never lose them.
 */
export class TickDriver {
  private carryMs = 0;
  private syncElapsedMs = 0;

  constructor(
    private readonly deps: ServiceDeps,
    private readonly combat: CombatService,
    private readonly sync: SaveSyncService,
    private readonly syncIntervalMs: number,
  ) {}

  advance(elapsedMs: number): void {
    if (!(elapsedMs > 0)) return;
    let pending = this.carryMs + elapsedMs;
    if (pending > CATCH_UP_CAP_MS) {
      const excess = pending - CATCH_UP_CAP_MS;
      pending = CATCH_UP_CAP_MS;
      const now = this.deps.clock.nowMs();
      this.sync.applyOfflineAccrual(now - excess, now);
    }
    while (pending >= STEP_MS) {
      this.step(STEP_MS);
      pending -= STEP_MS;
    }
    this.carryMs = pending;
  }

  private step(dtMs: number): void {
    this.combat.step(dtMs);
    this.syncElapsedMs += dtMs;
    if (this.syncElapsedMs >= this.syncIntervalMs) {
      this.syncElapsedMs -= this.syncIntervalMs;
      void this.sync.syncNow().catch((e: Error) => this.deps.logger.warn(`Periodic sync failed: ${e.message}`));
    }
  }
}
