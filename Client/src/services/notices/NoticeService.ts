import type { ServiceDeps } from '../core';

/** Dismisses player notices (toasts). Not progress: no event. */
export class NoticeService {
  constructor(private readonly deps: ServiceDeps) {}

  dismiss(id: number): void {
    const s = this.deps.store.get();
    if (!s.notices.some((n) => n.id === id)) return;
    this.deps.store.commit({ ...s, notices: s.notices.filter((n) => n.id !== id) });
  }
}
