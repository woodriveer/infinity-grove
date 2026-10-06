import type { AppServices } from '../services/AppServices';

/** Unity ReconciliationNotificationPresenter._displaySeconds. */
export const NOTICE_DISPLAY_MS = 6000;

/**
 * Removes toasts after 6 s of game time. Driven by the same clock as the game loop,
 * so tests on a manual clock see deterministic dismissal (RNFR-1).
 */
export class NoticeTimer {
  private readonly firstSeen = new Map<number, number>();

  constructor(
    private readonly app: AppServices,
    private readonly now: () => number,
  ) {
    this.stamp();
    app.store.select((s) => s.notices, () => this.stamp());
  }

  /** A notice's 6 s start when it appears, not at the next frame. */
  private stamp(): void {
    for (const n of this.app.store.get().notices) if (!this.firstSeen.has(n.id)) this.firstSeen.set(n.id, this.now());
  }

  update(nowMs: number): void {
    const notices = this.app.store.get().notices;
    this.stamp();
    for (const [id, seen] of [...this.firstSeen]) {
      if (!notices.some((n) => n.id === id)) this.firstSeen.delete(id);
      else if (nowMs - seen >= NOTICE_DISPLAY_MS) {
        this.firstSeen.delete(id);
        this.app.notices.dismiss(id);
      }
    }
  }
}
