import type { AffixType } from '../../domain/AffixType';
import type { CraftingPreview } from '../../domain/CraftingPreview';
import { CraftingRules } from '../../domain/CraftingRules';
import { getAffix } from '../../domain/EquipmentInstance';
import type { ServiceDeps } from '../core';
import type { EquipmentInventoryService } from '../equipment/EquipmentInventoryService';
import type { AffixRollResult, AffixRollSource } from './AffixRollSource';

/**
 * Crafting preview and re-roll request (P7, Unity CraftingService). The Unity local
 * roll is not ported (AD-22, PORT_MAP): the request goes to the AffixRollSource and
 * only a server result changes state.
 */
export class CraftingService {
  constructor(
    private readonly deps: ServiceDeps,
    private readonly inventory: EquipmentInventoryService,
    private readonly rolls: AffixRollSource,
  ) {}

  affixesFor(instanceId: string): readonly AffixType[] {
    const item = this.inventory.findInstance(instanceId);
    return item ? CraftingRules.affixesForSlot(this.deps.content.item(item.itemId).slot) : [];
  }

  getPreview(instanceId: string, affix: AffixType): CraftingPreview | null {
    const item = this.inventory.findInstance(instanceId);
    if (!item) return null;
    const { min, max } = CraftingRules.affixRange(affix);
    return { affix, currentRoll: getAffix(item, affix), minRoll: min, maxRoll: max, rerollCost: CraftingRules.RerollCost };
  }

  async requestReroll(instanceId: string, affix: AffixType): Promise<AffixRollResult> {
    const item = this.inventory.findInstance(instanceId);
    if (!item) return { status: 'rejected', reason: 'Unknown item.' };
    const result = await this.rolls.requestReroll(item, affix);
    if (result.status === 'ok') this.inventory.replaceInstance(result.item);
    return result;
  }
}
