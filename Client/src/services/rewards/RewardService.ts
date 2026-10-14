import { AFFIX_TYPES, type AffixType } from '../../domain/AffixType';
import type { EquipmentInstance } from '../../domain/EquipmentInstance';
import type { RewardGrant } from '../backend/BackendApi';
import type { ServiceDeps } from '../core';
import type { Notice } from '../state/types';

/** Ids remembered for idempotence (boss-drops DROP-05). */
export const APPLIED_GRANT_MEMORY = 500;
export const BAG_FULL_MESSAGE = 'Bag full: sell items to make room.';

/**
 * Applies what the backend granted (AD-001): the only place that adds a dropped item
 * to the bag, called from SaveSyncService once a batch answered. A hero grant adds no
 * card (the canonical roster brings it); it only raises the notice. Idempotent by
 * grantId, so a resent batch shows its rewards once.
 */
export class RewardService {
  constructor(private readonly deps: ServiceDeps) {}

  applyGrants(grants: readonly RewardGrant[]): void {
    for (const grant of grants) {
      if (this.deps.store.get().appliedGrantIds.includes(grant.grantId)) continue;
      this.markApplied(grant.grantId);
      if (grant.kind === 'Hero') this.applyHero(grant);
      else this.applyItem(grant);
    }
  }

  private applyHero(grant: RewardGrant): void {
    const hero = grant.heroDefinitionId ? this.deps.content.heroByServerId(grant.heroDefinitionId) : null;
    if (!hero) {
      this.deps.logger.warn(`RewardService: hero grant ${grant.grantId} names unknown hero '${grant.heroDefinitionId}'.`);
      this.notice('New hero (update the game to see it)');
      return;
    }
    this.notice(grant.isNewHero ? `New hero: ${hero.displayName}!` : `Duplicate: ${hero.displayName} +1`);
  }

  private applyItem(grant: RewardGrant): void {
    const data = grant.itemId ? this.deps.content.items.find((i) => i.itemId === grant.itemId) : undefined;
    if (!grant.itemId || !data) {
      this.deps.logger.warn(`RewardService: item grant ${grant.grantId} names unknown item '${grant.itemId}'.`);
      return;
    }
    const item: EquipmentInstance = { instanceId: grant.grantId, itemId: grant.itemId, affixRolls: onlyAffixes(grant.affixRolls) };
    const s = this.deps.store.get();
    if (s.equipment.bag.length < this.deps.content.drops.bagCapacity && s.grantQueue.length === 0) {
      this.deps.store.commit({ ...s, equipment: { ...s.equipment, bag: [...s.equipment.bag, item] } });
      this.notice(`Item: ${data.displayName}`);
      return;
    }
    this.deps.store.commit({ ...s, grantQueue: [...s.grantQueue, item] });
    if (s.grantQueue.length === 0) this.notice(BAG_FULL_MESSAGE);
  }

  private markApplied(grantId: string): void {
    const s = this.deps.store.get();
    this.deps.store.commit({ ...s, appliedGrantIds: [...s.appliedGrantIds, grantId].slice(-APPLIED_GRANT_MEMORY) });
  }

  private notice(message: string): void {
    const s = this.deps.store.get();
    const id = s.notices.reduce((max, n) => Math.max(max, n.id), 0) + 1;
    this.deps.store.commit({ ...s, notices: [...s.notices, { id, kind: 'reward', message } as Notice] });
  }
}

function onlyAffixes(rolls: RewardGrant['affixRolls']): Partial<Record<AffixType, number>> {
  const out: Partial<Record<AffixType, number>> = {};
  for (const a of AFFIX_TYPES) if (rolls?.[a] !== undefined) out[a] = rolls[a];
  return out;
}
