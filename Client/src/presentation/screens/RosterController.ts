import type { HeroEntity } from '../../domain/HeroEntity';
import { HeroTypeDisplay } from '../HeroTypeDisplay';
import type { ScreenModel, UiNode, UiRow } from '../ui/model';
import type { ScreenController, UiContext } from './types';

/**
 * Roster and Active Squad (P4, P15; Unity RosterPresenter). Rows show the hero type
 * as abbreviation + name (never color alone), star tier, the fusable marker on the
 * bench (FR-47) and Bench / Activate. With a full squad, a benched hero offers
 * "Swap in" (tap-to-swap): pick it, then pick the active hero it replaces; back
 * cancels the pick.
 */
export class RosterController implements ScreenController {
  readonly id = 'roster' as const;
  private swapSource: string | null = null;

  constructor(private readonly ui: UiContext) {}

  onOpen(): void {
    this.swapSource = null;
  }

  back(): boolean {
    if (this.swapSource === null) return false;
    const source = this.swapSource;
    this.swapSource = null;
    this.ui.focus(`roster.bench.${source}.swap`);
    this.ui.refresh();
    return true;
  }

  build(): ScreenModel {
    const { roster, content } = this.ui.app;
    const active = roster.activeSquad();
    const bench = roster.bench();
    const full = active.length >= roster.capacity;
    const capacityLabel = full
      ? `Active Squad (${active.length}/${roster.capacity}) - full, bench a hero to add another`
      : `Active Squad (${active.length}/${roster.capacity})`;
    const sourceName = this.swapSource ? content.hero(this.swapSource).displayName : null;

    const heroRow = (hero: HeroEntity, isActive: boolean): UiRow => {
      const data = content.hero(hero.heroId);
      const prefix = `roster.${isActive ? 'active' : 'bench'}.${hero.heroId}`;
      const nodes: UiNode[] = [
        { id: `${prefix}.type`, role: 'text', label: HeroTypeDisplay.label(data.heroType), heroType: data.heroType },
        { id: `${prefix}.name`, role: 'text', label: `${data.displayName}  ${hero.starTier}★` },
      ];
      if (!isActive && hero.duplicatesOwned > 0) {
        nodes.push({ id: `${prefix}.fusable`, role: 'text', label: `x${hero.duplicatesOwned} fusable`, tone: 'gold' });
      }
      if (isActive) {
        if (this.swapSource && sourceName) {
          const source = this.swapSource;
          nodes.push({
            id: `${prefix}.swap-target`,
            role: 'button',
            label: `Swap in ${sourceName}`,
            enabled: true,
            primary: true,
            onActivate: () => {
              this.ui.app.roster.swap(hero.heroId, source);
              this.swapSource = null;
              this.ui.focus(`roster.active.${source}.bench`);
              this.ui.refresh();
            },
          });
        } else {
          nodes.push({ id: `${prefix}.bench`, role: 'button', label: 'Bench', enabled: true, onActivate: () => this.ui.app.roster.benchHero(hero.heroId) });
        }
      } else if (full) {
        nodes.push({
          id: `${prefix}.swap`,
          role: 'button',
          label: this.swapSource === hero.heroId ? 'Picked — choose an active hero' : 'Swap',
          enabled: this.swapSource === null,
          selected: this.swapSource === hero.heroId,
          onActivate: () => {
            this.swapSource = hero.heroId;
            this.ui.focus(`roster.active.${active[0]?.heroId ?? ''}.swap-target`);
            this.ui.refresh();
          },
        });
      } else {
        nodes.push({ id: `${prefix}.activate`, role: 'button', label: 'Activate', enabled: true, onActivate: () => this.ui.app.roster.tryActivate(hero.heroId) });
      }
      nodes.push({ id: `${prefix}.fuse`, role: 'button', label: 'Fusion', enabled: this.swapSource === null, onActivate: () => this.ui.open('fusion', { heroId: hero.heroId }) });
      return { id: `${prefix}`, nodes };
    };

    return {
      id: 'roster',
      title: 'Roster',
      initialFocus: active[0] ? `roster.active.${active[0].heroId}.bench` : 'roster.close',
      sections: [
        {
          id: 'active',
          title: capacityLabel,
          rows: active.length > 0 ? active.map((h) => heroRow(h, true)) : [{ id: 'empty', nodes: [{ id: 'roster.active.empty', role: 'text', label: 'No heroes in the Active Squad.' }] }],
        },
        {
          id: 'bench',
          title: `Bench (${bench.length})`,
          rows: bench.length > 0 ? bench.map((h) => heroRow(h, false)) : [{ id: 'empty', nodes: [{ id: 'roster.bench.empty', role: 'text', label: 'The bench is empty.' }] }],
        },
        {
          id: 'footer',
          rows: [
            {
              id: 'close',
              nodes: [
                ...(sourceName ? [{ id: 'roster.picking', role: 'text' as const, label: `Swapping ${sourceName}: choose the active hero to replace. Back cancels.`, tone: 'gold' as const }] : []),
                { id: 'roster.close', role: 'button', label: 'Close', enabled: true, glyph: 'back', onActivate: () => this.ui.close() },
              ],
            },
          ],
        },
      ],
    };
  }
}
