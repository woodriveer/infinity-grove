import type { FusionPreview } from '../../domain/FusionPreview';
import { FusionRules } from '../../domain/FusionRules';
import { applyFusion } from '../../domain/HeroEntity';
import type { ServiceDeps } from '../core';

/**
 * Fusion (P5, Unity FusionService). Local only: Unity emitted no event for it, so
 * the next reconciliation resets the tier (PORT_MAP B3). The backend's synchronous
 * /api/v1/cards/fuse flow is the future path.
 */
export class FusionService {
  constructor(private readonly deps: ServiceDeps) {}

  getPreview(heroId: string): FusionPreview | null {
    const hero = this.deps.store.get().heroes.find((h) => h.heroId === heroId);
    return hero ? FusionRules.preview(hero, this.deps.content.hero(heroId)) : null;
  }

  tryFuse(heroId: string): boolean {
    const s = this.deps.store.get();
    const hero = s.heroes.find((h) => h.heroId === heroId);
    if (!hero) return false;
    const preview = FusionRules.preview(hero, this.deps.content.hero(heroId));
    if (!preview.canFuse) return false;
    const fused = applyFusion(hero, preview.duplicatesRequired);
    this.deps.store.commit({ ...s, heroes: s.heroes.map((h) => (h.heroId === heroId ? fused : h)) });
    return true;
  }
}
