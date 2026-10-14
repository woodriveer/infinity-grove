/** boss-drops T11 (DROP-02, 03, 05): backend grants reach the bag, the queue and the notices exactly once. */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { compose, type AppContext } from '../../src/app/compose';
import { defaultConfig } from '../../src/app/config';
import type { PlayerEventRecord } from '../../src/domain/PlayerEventRecord';
import { PlayerProgressReplay } from '../../src/domain/PlayerProgressReplay';
import { SaveGameData } from '../../src/domain/SaveGameData';
import { createNodePlatform } from '../../src/platform/node/nodePlatform';
import type { BackendApi, EventVerdict, RewardGrant } from '../../src/services/backend/BackendApi';
import { BAG_FULL_MESSAGE } from '../../src/services/rewards/RewardService';
import { SaveCodec } from '../../src/services/save/SaveCodec';

/** Accepts every event and attaches the queued grants to the first result of the next batch. */
class GrantBackend implements BackendApi {
  isAuthenticated = false;
  steamId64: string | null = null;
  sessionReplaced = false;
  offline = false;
  next: RewardGrant[] = [];
  async authenticateWithSteam(): Promise<boolean> {
    if (this.offline) return false;
    this.isAuthenticated = true;
    this.steamId64 = '76561198000000001';
    return true;
  }
  async getState() {
    return PlayerProgressReplay.newLedger().state;
  }
  async ingestBatch(events: readonly PlayerEventRecord[]) {
    const results: EventVerdict[] = events.map((e, i) => ({
      clientEventId: e.clientEventId,
      accepted: true,
      rejectionReason: null,
      grants: i === 0 ? this.next : [],
    }));
    return { results, state: PlayerProgressReplay.newLedger().state };
  }
}

async function boot(): Promise<{ app: AppContext; backend: GrantBackend }> {
  const backend = new GrantBackend();
  const app = compose({ ...defaultConfig('test'), backend: 'fake://grants', devTicket: 'test-1' }, createNodePlatform({ seed: 9 }), { backend });
  app.sync.loadFrom(null);
  await app.sync.connect();
  return { app, backend };
}

let counter = 0;
const itemGrant = (itemId: string, rolls: RewardGrant['affixRolls'] = {}): RewardGrant => ({
  grantId: `00000000-0000-4000-8000-${String(++counter).padStart(12, '0')}`,
  kind: 'Item',
  sourceClientEventId: 'e',
  itemId,
  affixRolls: rolls,
});
const heroGrant = (heroDefinitionId: string, isNewHero: boolean): RewardGrant => ({
  grantId: `00000000-0000-4000-9000-${String(++counter).padStart(12, '0')}`,
  kind: 'Hero',
  sourceClientEventId: 'e',
  heroDefinitionId,
  isNewHero,
});
const messages = (app: AppContext) => app.store.get().notices.map((n) => n.message);
/** Any pending event makes the next sync carry the queued grants. */
const pushEvent = (app: AppContext) => app.combat.addGold(1);

describe('RewardService via sync', () => {
  it('applies the same grant twice as one item with its affix rolls', async () => {
    const { app, backend } = await boot();
    const itemId = app.content.items[0]!.itemId;
    const grant = itemGrant(itemId, { Defense: 7 });
    backend.next = [grant];
    pushEvent(app);
    await app.sync.syncNow();
    pushEvent(app);
    await app.sync.syncNow();
    expect(app.store.get().equipment.bag).toEqual([{ instanceId: grant.grantId, itemId, affixRolls: { Defense: 7 } }]);
    expect(app.store.get().grantQueue).toEqual([]);
  });

  it('a full bag sends the item to the queue, shows the notice once, and a sale drains the queue in order', async () => {
    const { app, backend } = await boot();
    const itemId = app.content.items[0]!.itemId;
    const capacity = app.content.drops.bagCapacity;
    for (let i = 0; i < capacity; i++) app.inventory.addNewToBag(itemId);
    const a = itemGrant(itemId);
    const b = itemGrant(itemId);
    backend.next = [a, b];
    pushEvent(app);
    await app.sync.syncNow();
    expect(app.store.get().equipment.bag).toHaveLength(capacity);
    expect(app.store.get().grantQueue.map((i) => i.instanceId)).toEqual([a.grantId, b.grantId]);
    expect(messages(app).filter((m) => m === BAG_FULL_MESSAGE)).toHaveLength(1);

    app.inventory.removeFromBag(app.store.get().equipment.bag[0]!.instanceId);
    expect(app.store.get().equipment.bag).toHaveLength(capacity);
    expect(app.store.get().equipment.bag.at(-1)!.instanceId).toBe(a.grantId);
    expect(app.store.get().grantQueue.map((i) => i.instanceId)).toEqual([b.grantId]);
    app.inventory.removeFromBag(app.store.get().equipment.bag[0]!.instanceId);
    expect(app.store.get().equipment.bag.at(-1)!.instanceId).toBe(b.grantId);
    expect(app.store.get().grantQueue).toEqual([]);
  });

  it('hero grants raise New hero, Duplicate and unknown-hero notices and add no card themselves', async () => {
    const { app, backend } = await boot();
    const druid = app.content.hero('druid');
    const heroesBefore = app.store.get().heroes.length;
    backend.next = [heroGrant(druid.serverHeroId, true), heroGrant(druid.serverHeroId, false), heroGrant('11111111-2222-4333-8444-555555555555', true)];
    pushEvent(app);
    await app.sync.syncNow();
    expect(messages(app)).toEqual([`New hero: ${druid.displayName}!`, `Duplicate: ${druid.displayName} +1`, 'New hero (update the game to see it)']);
    expect(app.store.get().heroes).toHaveLength(heroesBefore);
  });

  it('remembers only the last 500 grant ids', async () => {
    const { app, backend } = await boot();
    const itemId = app.content.items[0]!.itemId;
    backend.next = Array.from({ length: 510 }, () => itemGrant(itemId));
    pushEvent(app);
    await app.sync.syncNow();
    expect(app.store.get().appliedGrantIds).toHaveLength(500);
    expect(app.store.get().appliedGrantIds.at(-1)).toBe(backend.next.at(-1)!.grantId);
  });

  it('offline with kill or boss events pending shows "Rewards pending sync" once per session', async () => {
    // Never connected: the fake backend's empty canonical state would drop the starter hero, and with it every kill.
    const backend = new GrantBackend();
    backend.offline = true;
    const app = compose({ ...defaultConfig('test'), backend: 'fake://grants', devTicket: 'test-1' }, createNodePlatform({ seed: 9 }), { backend });
    app.sync.loadFrom(null);
    for (let i = 0; i < 30 && !app.store.get().eventLog.pending.some((e) => e.type === 'MonsterKillsBatch'); i++) {
      app.combat.step(10_000);
      app.combat.flushIncome();
    }
    expect(app.store.get().eventLog.pending.some((e) => e.type === 'MonsterKillsBatch')).toBe(true);
    await app.sync.syncNow();
    await app.sync.syncNow();
    expect(messages(app).filter((m) => m === 'Rewards pending sync')).toHaveLength(1);
  });

  it('offline with only gold events pending shows no rewards notice', async () => {
    const { app, backend } = await boot();
    backend.offline = true;
    backend.isAuthenticated = false;
    pushEvent(app);
    await app.sync.syncNow();
    expect(messages(app)).not.toContain('Rewards pending sync');
  });
});

describe('save v3', () => {
  it('migrates a v2 save with an empty grant queue and no applied grants', () => {
    const v3 = JSON.parse(readFileSync('fixtures/saves/mid-game.json', 'utf8')) as { local: Record<string, unknown> };
    const { grantQueue: _q, appliedGrantIds: _a, ...localV2 } = v3.local;
    const save = SaveCodec.parsePlain({ ...v3, formatVersion: 2, local: localV2 });
    expect(save.formatVersion).toBe(SaveGameData.CurrentFormatVersion);
    expect(save.local.grantQueue).toEqual([]);
    expect(save.local.appliedGrantIds).toEqual([]);
  });
});
