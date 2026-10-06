import { HeroTypeDisplay } from '../HeroTypeDisplay';
import type { ScreenModel, UiDialog, UiNode } from '../ui/model';
import type { ScreenController, UiContext } from './types';

/**
 * Fusion panel (P5, Unity FusionPresenter): hero list, preview (tier, duplicates
 * owned/required, next ability, 12★ cap) and Fuse. Fusing is irreversible (FR-7), so
 * it asks first, with focus on Cancel (EXPERIENCE: a double press never fuses).
 */
export class FusionController implements ScreenController {
  readonly id = 'fusion' as const;
  private selected: string | null = null;
  private confirming = false;

  constructor(private readonly ui: UiContext) {}

  onOpen(params: Record<string, string>): void {
    this.selected = params['heroId'] ?? null;
    this.confirming = false;
  }

  back(): boolean {
    if (!this.confirming) return false;
    this.confirming = false;
    this.ui.focus('fusion.fuse');
    this.ui.refresh();
    return true;
  }

  build(): ScreenModel {
    const { roster, fusion, content } = this.ui.app;
    const heroes = roster.allHeroes();
    if (!this.selected || !heroes.some((h) => h.heroId === this.selected)) this.selected = heroes[0]?.heroId ?? null;
    const selectedId = this.selected;

    const list = heroes.map((h) => {
      const data = content.hero(h.heroId);
      return {
        id: h.heroId,
        nodes: [
          { id: `fusion.hero.${h.heroId}.type`, role: 'text' as const, label: HeroTypeDisplay.label(data.heroType), heroType: data.heroType },
          {
            id: `fusion.hero.${h.heroId}`,
            role: 'listitem' as const,
            label: `${data.displayName}  ${h.starTier}★  (x${h.duplicatesOwned} dupes)`,
            enabled: true,
            selected: h.heroId === selectedId,
            onActivate: () => {
              this.selected = h.heroId;
              this.ui.focus('fusion.fuse');
              this.ui.refresh();
            },
          },
        ],
      };
    });

    const previewNodes: UiNode[] = [];
    let dialog: UiDialog | undefined;
    const preview = selectedId ? fusion.getPreview(selectedId) : null;
    if (!selectedId || !preview) {
      previewNodes.push({ id: 'fusion.empty', role: 'text', label: 'No hero owned yet.' });
    } else {
      const name = content.hero(selectedId).displayName;
      previewNodes.push(
        { id: 'fusion.tier', role: 'heading', label: `${name} - Tier ${preview.currentStarTier}★` },
        {
          id: 'fusion.duplicates',
          role: 'text',
          label: preview.isMaxTier
            ? 'Max star tier reached (12★).'
            : `Duplicates: ${preview.duplicatesOwned} / ${preview.duplicatesRequired} required for next tier`,
        },
        { id: 'fusion.ability', role: 'text', label: `Next ability: ${preview.nextTierAbilityDescription}` },
        {
          id: 'fusion.fuse',
          role: 'button',
          label: preview.isMaxTier
            ? 'Fuse — max star tier reached'
            : preview.canFuse
              ? `Fuse — ${preview.duplicatesRequired}/${preview.duplicatesRequired} duplicates`
              : `Fuse — needs ${preview.duplicatesRequired} duplicates, have ${preview.duplicatesOwned}`,
          enabled: preview.canFuse,
          primary: true,
          glyph: 'confirm',
          onActivate: () => {
            if (!preview.canFuse) return;
            this.confirming = true;
            this.ui.refresh();
          },
        },
      );
      if (this.confirming && preview.canFuse) {
        dialog = {
          id: 'fusion.confirm',
          title: `Fuse ${name} to ${preview.currentStarTier + 1}★?`,
          body: `This permanently consumes ${preview.duplicatesRequired} duplicates.`,
          initialFocus: 'fusion.confirm.cancel',
          nodes: [
            { id: 'fusion.confirm.cancel', role: 'button', label: 'Cancel', enabled: true, glyph: 'back', onActivate: () => this.back() },
            {
              id: 'fusion.confirm.fuse',
              role: 'button',
              label: 'Fuse',
              enabled: true,
              primary: true,
              onActivate: () => {
                fusion.tryFuse(selectedId);
                this.confirming = false;
                this.ui.focus('fusion.fuse');
                this.ui.refresh();
              },
            },
          ],
        };
      }
    }

    return {
      id: 'fusion',
      title: 'Fusion',
      initialFocus: 'fusion.fuse',
      dialog,
      sections: [
        { id: 'heroes', title: 'Heroes', rows: list },
        { id: 'preview', title: 'Preview', rows: previewNodes.map((n) => ({ id: n.id, nodes: [n] })) },
        { id: 'close', rows: [{ id: 'close', nodes: [{ id: 'fusion.close', role: 'button', label: 'Back', enabled: true, glyph: 'back', onActivate: () => this.ui.close() }] }] },
      ],
    };
  }
}
