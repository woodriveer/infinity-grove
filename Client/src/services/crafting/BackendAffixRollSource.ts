import type { AffixType } from '../../domain/AffixType';
import type { EquipmentInstance } from '../../domain/EquipmentInstance';
import type { AffixRollResult, AffixRollSource } from './AffixRollSource';

/**
 * The only AffixRollSource (AD-22). The backend crafting endpoint does not exist yet
 * (it is a separate game-PRD change), so every request is "unavailable" and changes
 * no state. When the endpoint lands in shared/openapi/openapi.json, this calls it via
 * BackendApi and applies the returned roll and gold through reconciliation.
 */
export class BackendAffixRollSource implements AffixRollSource {
  static readonly UNAVAILABLE = 'Crafting is not available yet: the server crafting endpoint has not shipped.';

  async requestReroll(_item: EquipmentInstance, _affix: AffixType): Promise<AffixRollResult> {
    return { status: 'unavailable', reason: BackendAffixRollSource.UNAVAILABLE };
  }
}
