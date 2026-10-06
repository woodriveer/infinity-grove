import type { Archetype } from '../../domain/Archetype';
import type { AffixType } from '../../domain/AffixType';
import type { EquipmentInstance } from '../../domain/EquipmentInstance';
import type { ScreenModel, UiDialog, UiNode, UiRow } from '../ui/model';
import type { ScreenController, UiContext } from './types';

/**
 * Equipment, crafting and loadout presets (P6, P7, P8; Unity EquipmentPresenter,
 * CraftingPresenter, LoadoutPresetPresenter). Heroes are tabs (LB/RB, Q/E). Slots
 * show Unequip; the bag shows Equip and Craft; the crafting panel shows the preview
 * and sends re-roll requests to the server (AD-22); presets Save/Apply with a confirm.
 */
export class EquipmentController implements ScreenController {
  readonly id = 'equipment' as const;
  private heroId: string | null = null;
  private craftingItem: string | null = null;
  private craftMessage: string | null = null;
  private pendingApply: Archetype | null = null;

  constructor(private readonly ui: UiContext) {}

  onOpen(): void {
    this.craftingItem = null;
    this.craftMessage = null;
    this.pendingApply = null;
  }

  back(): boolean {
    if (this.pendingApply) {
      const a = this.pendingApply;
      this.pendingApply = null;
      this.ui.focus(`equipment.preset.${a}.apply`);
      this.ui.refresh();
      return true;
    }
    if (this.craftingItem) {
      this.craftingItem = null;
      this.craftMessage = null;
      this.ui.refresh();
      return true;
    }
    return false;
  }

  build(): ScreenModel {
    const { roster, inventory, presets, crafting, content } = this.ui.app;
    const heroes = roster.allHeroes();
    if (!this.heroId || !heroes.some((h) => h.heroId === this.heroId)) this.heroId = heroes[0]?.heroId ?? null;
    const heroId = this.heroId;
    const sections: ScreenModel['sections'][number][] = [];

    sections.push({
      id: 'heroes',
      rows: [
        {
          id: 'tabs',
          nodes: heroes.map((h) => ({
            id: `equipment.hero.${h.heroId}`,
            role: 'tab' as const,
            label: content.hero(h.heroId).displayName,
            enabled: true,
            selected: h.heroId === heroId,
            onActivate: () => {
              this.heroId = h.heroId;
              this.craftingItem = null;
              this.pendingApply = null;
              this.ui.refresh();
            },
          })),
        },
      ],
    });

    const itemName = (i: EquipmentInstance) => content.item(i.itemId).displayName;
    if (!heroId) {
      sections.push({ id: 'slots', rows: [{ id: 'none', nodes: [{ id: 'equipment.none', role: 'text', label: 'No hero selected.' }] }] });
    } else {
      const equipped = inventory.getEquipped(heroId);
      sections.push({
        id: 'slots',
        title: `Slots — ${content.hero(heroId).displayName}`,
        rows: inventory.slots.map((slot) => {
          const item = equipped[slot];
          const nodes: UiNode[] = [{ id: `equipment.slot.${slot}`, role: 'slot', label: `${slot}: ${item ? itemName(item) : '(empty)'}`, enabled: !!item, onActivate: () => item && this.openCrafting(item.instanceId) }];
          if (item) nodes.push({ id: `equipment.slot.${slot}.unequip`, role: 'button', label: 'Unequip', enabled: true, onActivate: () => inventory.unequip(heroId, slot) });
          return { id: slot, nodes };
        }),
      });
    }

    const bag = inventory.bag();
    sections.push({
      id: 'bag',
      title: `Bag (${bag.length})`,
      rows:
        bag.length === 0
          ? [{ id: 'empty', nodes: [{ id: 'equipment.bag.empty', role: 'text', label: 'The bag is empty.' }] }]
          : bag.map((item) => {
              const data = content.item(item.itemId);
              return {
                id: item.instanceId,
                nodes: [
                  { id: `equipment.bag.${item.instanceId}.name`, role: 'text', label: `${data.displayName} [${data.slot}/${data.archetype}]` },
                  { id: `equipment.bag.${item.instanceId}.equip`, role: 'button', label: 'Equip', enabled: heroId !== null, onActivate: () => heroId && inventory.tryEquip(heroId, item.instanceId) },
                  { id: `equipment.bag.${item.instanceId}.craft`, role: 'button', label: 'Craft', enabled: true, onActivate: () => this.openCrafting(item.instanceId) },
                ],
              };
            }),
    });

    if (this.craftingItem) {
      const instanceId = this.craftingItem;
      const item = inventory.findInstance(instanceId);
      const rows: UiRow[] = [];
      if (!item) {
        rows.push({ id: 'gone', nodes: [{ id: 'equipment.craft.none', role: 'text', label: 'Select an equipment item to craft.' }] });
      } else {
        rows.push({ id: 'title', nodes: [{ id: 'equipment.craft.item', role: 'heading', label: itemName(item) }] });
        for (const affix of crafting.affixesFor(instanceId)) {
          const p = crafting.getPreview(instanceId, affix);
          if (!p) continue;
          rows.push({
            id: affix,
            nodes: [
              { id: `equipment.craft.${affix}`, role: 'text', label: `${affix}: ${p.currentRoll.toFixed(1)} (range ${p.minRoll.toFixed(1)}-${p.maxRoll.toFixed(1)})` },
              { id: `equipment.craft.${affix}.reroll`, role: 'button', label: `Reroll (${p.rerollCost}g)`, enabled: true, onActivate: () => void this.reroll(instanceId, affix) },
            ],
          });
        }
        if (this.craftMessage) rows.push({ id: 'msg', nodes: [{ id: 'equipment.craft.message', role: 'text', label: this.craftMessage, tone: 'muted' }] });
      }
      sections.push({ id: 'crafting', title: 'Crafting', rows });
    }

    if (heroId) {
      sections.push({
        id: 'presets',
        title: `Presets for ${content.hero(heroId).displayName}`,
        rows: presets.archetypes.map((archetype) => ({
          id: archetype,
          nodes: [
            { id: `equipment.preset.${archetype}`, role: 'text', label: archetype },
            { id: `equipment.preset.${archetype}.save`, role: 'button', label: 'Save', enabled: true, onActivate: () => presets.savePreset(archetype, heroId) },
            {
              id: `equipment.preset.${archetype}.apply`,
              role: 'button',
              label: 'Apply',
              enabled: presets.getPreset(archetype, heroId) !== null,
              onActivate: () => {
                this.pendingApply = archetype;
                this.ui.refresh();
              },
            },
          ],
        })),
      });
    }

    sections.push({ id: 'close', rows: [{ id: 'close', nodes: [{ id: 'equipment.close', role: 'button', label: 'Close', enabled: true, glyph: 'back', onActivate: () => this.ui.close() }] }] });

    let dialog: UiDialog | undefined;
    if (this.pendingApply && heroId) {
      const archetype = this.pendingApply;
      dialog = {
        id: 'equipment.apply',
        title: `Apply ${archetype} preset?`,
        body: `Apply ${archetype} preset to ${content.hero(heroId).displayName}? This re-equips all 4 slots.`,
        initialFocus: 'equipment.apply.cancel',
        nodes: [
          { id: 'equipment.apply.cancel', role: 'button', label: 'Cancel', enabled: true, glyph: 'back', onActivate: () => this.back() },
          {
            id: 'equipment.apply.confirm',
            role: 'button',
            label: 'Confirm',
            enabled: true,
            primary: true,
            onActivate: () => {
              presets.tryApplyPreset(archetype, heroId);
              this.pendingApply = null;
              this.ui.focus(`equipment.preset.${archetype}.apply`);
              this.ui.refresh();
            },
          },
        ],
      };
    }

    return {
      id: 'equipment',
      title: 'Equipment',
      initialFocus: heroId ? `equipment.hero.${heroId}` : 'equipment.close',
      dialog,
      sections,
    };
  }

  private openCrafting(instanceId: string): void {
    this.craftingItem = instanceId;
    this.craftMessage = null;
    const first = this.ui.app.crafting.affixesFor(instanceId)[0];
    if (first) this.ui.focus(`equipment.craft.${first}.reroll`);
    this.ui.refresh();
  }

  private async reroll(instanceId: string, affix: AffixType): Promise<void> {
    const r = await this.ui.app.crafting.requestReroll(instanceId, affix);
    this.craftMessage = r.status === 'ok' ? null : r.reason;
    this.ui.refresh();
  }
}
