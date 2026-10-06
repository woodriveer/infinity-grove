export type Direction = 'up' | 'down' | 'left' | 'right';

/** Nodes whose centers are within this many px of the nearest one count as the same row/column. */
const BAND_PX = 24;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Spatial focus navigation over node rects (AD-16). The only source of the focus
 * ring. When nothing lies in the pressed direction it falls back to list order, so
 * focus always lands on a real node and is never lost (EXPERIENCE "No focus target").
 */
export class FocusNavigator {
  /** Focused node id per screen key (an overlay keeps its focus when a panel closes). */
  private readonly byScreen = new Map<string, string>();

  get(screen: string): string | null {
    return this.byScreen.get(screen) ?? null;
  }

  set(screen: string, id: string): void {
    this.byScreen.set(screen, id);
  }

  forget(screen: string): void {
    this.byScreen.delete(screen);
  }

  /** Keeps focus on a node that still exists; otherwise the preferred node, then the first one. */
  reconcile(screen: string, ids: readonly string[], preferred: string | undefined): string | null {
    const current = this.get(screen);
    if (current && ids.includes(current)) return current;
    const next = preferred && ids.includes(preferred) ? preferred : (ids[0] ?? null);
    if (next) this.set(screen, next);
    else this.forget(screen);
    return next;
  }

  move(screen: string, ids: readonly string[], dir: Direction, rectOf: (id: string) => Rect | null): string | null {
    const current = this.get(screen);
    if (ids.length === 0) return null;
    if (!current || !ids.includes(current)) {
      this.set(screen, ids[0] as string);
      return ids[0] as string;
    }
    const from = rectOf(current);
    let best: { id: string } | null = null;
    if (from) {
      // Row-first (grid-like): go to the nearest row/column in that direction, then
      // to the node there closest along the other axis.
      const fx = from.x + from.w / 2;
      const fy = from.y + from.h / 2;
      const candidates: Array<{ id: string; primary: number; secondary: number }> = [];
      for (const id of ids) {
        if (id === current) continue;
        const r = rectOf(id);
        if (!r) continue;
        const cx = r.x + r.w / 2;
        const cy = r.y + r.h / 2;
        const primary = dir === 'left' ? fx - cx : dir === 'right' ? cx - fx : dir === 'up' ? fy - cy : cy - fy;
        const secondary = dir === 'left' || dir === 'right' ? Math.abs(cy - fy) : Math.abs(cx - fx);
        // Horizontal moves stay within the current row band.
        if (primary <= 1 || ((dir === 'left' || dir === 'right') && secondary > Math.max(from.h, r.h))) continue;
        candidates.push({ id, primary, secondary });
      }
      const nearest = Math.min(...candidates.map((c) => c.primary));
      const band = candidates.filter((c) => c.primary <= nearest + BAND_PX);
      band.sort((a, b) => a.secondary - b.secondary || a.primary - b.primary);
      best = band[0] ?? null;
    }
    if (!best) {
      const i = ids.indexOf(current);
      const step = dir === 'up' || dir === 'left' ? -1 : 1;
      const id = ids[(i + step + ids.length) % ids.length] as string;
      this.set(screen, id);
      return id;
    }
    this.set(screen, best.id);
    return best.id;
  }
}
