/** Services parity (P2–P13) through compose(), with node ports and a manual clock. */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { compose, type AppContext } from '../../src/app/compose';
import { defaultConfig } from '../../src/app/config';
import { PlayerProgressReplay, type ProgressLedger } from '../../src/domain/PlayerProgressReplay';
import type { PlayerEventRecord } from '../../src/domain/PlayerEventRecord';
import { SaveGameData } from '../../src/domain/SaveGameData';
import { createNodePlatform } from '../../src/platform/node/nodePlatform';
import { FsSaveStore, MemorySaveStore } from '../../src/platform/node/NodePorts';
import { WebCryptoCipher } from '../../src/platform/shared/WebCryptoCipher';
import type { BackendApi, EventVerdict } from '../../src/services/backend/BackendApi';
import { SaveCodec } from '../../src/services/save/SaveCodec';
import { SteamCloudSync } from '../../src/services/sync/SteamCloudSync';
import { BackendAffixRollSource } from '../../src/services/crafting/BackendAffixRollSource';
import type { CloudStore } from '../../src/services/ports';

async function newGame(seed = 42, saveStore = new MemorySaveStore()): Promise<{ app: AppContext; platform: ReturnType<typeof createNodePlatform> }> {
  const platform = createNodePlatform({ seed, saveStore });
  const app = compose(defaultConfig('test'), platform);
  await app.sync.load();
  return { app, platform };
}

const types = (app: AppContext) => app.store.get().eventLog.pending.map((e) => e.type);

describe('new game (RFR-14)', () => {
  it('starts with the content-defined starter hero in the Active Squad and Krell armed', async () => {
    const { app } = await newGame();
    const s = app.store.get();
    expect(s.heroes.map((h) => h.heroId)).toEqual(['ranger']);
    expect(s.activeSquad).toEqual(['ranger']);
    expect(s.krellEquipmentId).toBe('wclaw01');
    expect(types(app)).toEqual(['HeroAcquired', 'ActiveSquadChanged']);
  });
});

describe('combat loop (P2, P3)', () => {
  it('walks 2 s, spawns a monster, clicks kill it, gold is awarded and the walk restarts', async () => {
    const { app } = await newGame();
    app.combat.begin();
    app.tick.advance(1900);
    expect(app.store.get().combat.state).toBe('Walking');
    app.tick.advance(100);
    const fighting = app.store.get().combat;
    expect(fighting.state).toBe('Fighting');
    expect(fighting.monster?.name).toBe('Slime');
    const damage = app.playerCombat.calculateAttackDamage();
    expect(damage).toBe(15); // level 1 * 5 per level + WCLAW01's 10 (P3)
    while (app.store.get().combat.state === 'Fighting') app.combat.playerAttack(damage);
    const s = app.store.get();
    expect(s.combat.kills).toBe(1);
    expect(s.gold).toBe(fighting.monster?.goldReward);
    expect(s.gold).toBeGreaterThanOrEqual(3);
    expect(s.gold).toBeLessThanOrEqual(8);
    expect(types(app).at(-1)).toBe('GoldEarned');
  });

  it('a click while walking does nothing', async () => {
    const { app } = await newGame();
    app.combat.begin();
    app.combat.playerAttack(15);
    expect(app.store.get().gold).toBe(0);
  });

  it('equipment bonus follows Krell weapon changes', async () => {
    const { app } = await newGame();
    app.equipment.unequip();
    expect(app.playerCombat.calculateAttackDamage()).toBe(5);
  });
});

describe('roster and fusion (P4, P5)', () => {
  it('caps the Active Squad at 5 and benches heroes beyond it', async () => {
    const { app } = await newGame();
    for (const id of ['druid', 'ember-warden', 'dawn-cleric', 'shade-stalker', 'tide-caller']) app.roster.addHeroCard(id);
    for (const id of ['druid', 'ember-warden', 'dawn-cleric', 'shade-stalker']) expect(app.roster.tryActivate(id)).toBe(true);
    expect(app.roster.tryActivate('tide-caller')).toBe(false);
    expect(app.roster.activeSquad()).toHaveLength(5);
    expect(app.roster.bench().map((h) => h.heroId)).toEqual(['tide-caller']);
    expect(app.roster.swap('druid', 'tide-caller')).toBe(true);
    expect(app.store.get().activeSquad[1]).toBe('tide-caller');
  });

  it('fuses with enough duplicates and consumes them', async () => {
    const { app } = await newGame();
    app.roster.addHeroCard('ranger');
    expect(app.fusion.getPreview('ranger')).toMatchObject({ currentStarTier: 1, duplicatesOwned: 1, duplicatesRequired: 2, canFuse: false });
    app.roster.addHeroCard('ranger');
    expect(app.fusion.tryFuse('ranger')).toBe(true);
    expect(app.roster.findByHeroId('ranger')).toMatchObject({ starTier: 2, duplicatesOwned: 0 });
  });
});

describe('equipment, presets and crafting (P6, P7, P8)', () => {
  it('equips from the shared bag, swaps the previous item back, and applies presets', async () => {
    const { app } = await newGame();
    const blade = app.inventory.addNewToBag('bark-blade');
    const staff = app.inventory.addNewToBag('sage-staff');
    expect(app.inventory.tryEquip('ranger', blade.instanceId)).toBe(true);
    app.presets.savePreset('Strength', 'ranger');
    expect(app.inventory.tryEquip('ranger', staff.instanceId)).toBe(true);
    expect(app.inventory.bag().map((i) => i.itemId)).toEqual(['bark-blade']);
    expect(app.presets.tryApplyPreset('Strength', 'ranger')).toBe(true);
    expect(app.inventory.getEquipped('ranger').Weapon?.itemId).toBe('bark-blade');
    app.inventory.unequip('ranger', 'Weapon');
    expect(app.inventory.bag()).toHaveLength(2);
  });

  it('shows the crafting preview but never rolls locally (RFR-41 AC)', async () => {
    const { app } = await newGame();
    const blade = app.inventory.addNewToBag('bark-blade');
    expect(app.crafting.getPreview(blade.instanceId, 'CritChance')).toEqual({ affix: 'CritChance', currentRoll: 0, minRoll: 1, maxRoll: 25, rerollCost: 50 });
    const before = app.store.get();
    const r = await app.crafting.requestReroll(blade.instanceId, 'CritChance');
    expect(r).toEqual({ status: 'unavailable', reason: BackendAffixRollSource.UNAVAILABLE });
    expect(app.store.get()).toBe(before);
  });
});

describe('stage select (P9)', () => {
  it('predicts Power Gate vs Composition Mismatch and only Success advances', async () => {
    const { app } = await newGame();
    expect(app.stages.getPreview('mossy-hollow')).toMatchObject({ squadPower: 12, predictedOutcome: 'Success' });
    expect(app.stages.getPreview('ember-ridge').predictedOutcome).toBe('PowerGate');
    expect(app.stages.attemptStage('ember-ridge')).toBe('PowerGate');
    expect(app.store.get().furthestStageCleared).toBe(0);
    expect(app.stages.attemptStage('mossy-hollow')).toBe('Success');
    expect(app.store.get().furthestStageCleared).toBe(1);
    expect(types(app).at(-1)).toBe('StageCleared');
  });
});

describe('save (P11, RFR-24)', () => {
  let dir = '';
  afterEach(() => dir && rmSync(dir, { recursive: true, force: true }));

  it('round-trips the encrypted envelope and restores progress, projecting unsynced events (B4)', async () => {
    const store = new MemorySaveStore();
    const { app } = await newGame(1, store);
    app.combat.addGold(120);
    await app.sync.persist();
    const { app: again } = await newGame(2, store);
    expect(again.store.get().gold).toBe(120);
    expect(again.store.get().activeSquad).toEqual(['ranger']);
    expect(again.store.get().eventLog.pending).toHaveLength(3);
  });

  it('a write killed before the rename leaves the previous save loadable (NFR-2)', async () => {
    dir = mkdtempSync(join(tmpdir(), 'ig-save-'));
    const store = new FsSaveStore(join(dir, 'save.bin'));
    const { app } = await newGame(1, store as unknown as MemorySaveStore);
    app.combat.addGold(10);
    await app.sync.persist();
    store.faultBeforeRename = () => {
      throw new Error('killed mid-write');
    };
    app.combat.addGold(990);
    await app.sync.persist();
    store.faultBeforeRename = null;
    const { app: again } = await newGame(2, store as unknown as MemorySaveStore);
    expect(again.store.get().gold).toBe(10);
  });

  it('treats an unreadable save as no save', async () => {
    const store = new MemorySaveStore();
    store.bytes = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17]);
    const { app } = await newGame(1, store);
    expect(app.store.get().heroes.map((h) => h.heroId)).toEqual(['ranger']);
  });
});

describe('Steam Cloud resolution (RFR-33 AC)', () => {
  const save = (lastReconciledAtMs: number, unsynced = 0): SaveGameData => ({
    ...SaveGameData.createNew(0, null),
    lastReconciledAtMs,
    unsyncedEvents: Array.from({ length: unsynced }, (_, i) => ({
      clientEventId: `00000000-0000-4000-8000-00000000000${i}`, sequenceNumber: i + 1, type: 'GoldEarned', occurredAtMs: 0,
      payloadJson: '{"goldMantissa":1,"goldExponent":0}', syncStatus: 'Pending', rejectionReason: null,
    })),
  });

  it('no local save → the cloud copy is used', () => expect(SteamCloudSync.resolve(null, save(5))).toBe('cloud'));
  it('cloud newer and no unsynced local events → cloud wins', () => expect(SteamCloudSync.resolve(save(1), save(5))).toBe('cloud'));
  it('cloud newer but local has unsynced events → local kept', () => expect(SteamCloudSync.resolve(save(1, 2), save(5))).toBe('local'));
  it('local newer → local kept', () => expect(SteamCloudSync.resolve(save(9), save(5))).toBe('local'));

  it('reads the cloud file on boot and writes it after a sync', async () => {
    const files = new Map<string, Uint8Array>();
    const cloud: CloudStore = {
      isAvailable: true,
      read: async (n) => files.get(n) ?? null,
      write: async (n, b) => (files.set(n, b), true),
    };
    const codec = new SaveCodec(new WebCryptoCipher(), createNodePlatform().logger);
    files.set('save.bin', await codec.encode({ ...save(5), local: { ...save(5).local, krellEquipmentId: 'wclaw01' } }));
    const sync = new SteamCloudSync(cloud, codec, createNodePlatform().logger);
    const chosen = await sync.chooseOnBoot(null);
    expect(chosen.source).toBe('cloud');
    expect(chosen.save?.lastReconciledAtMs).toBe(5);
  });
});

/** A backend double that runs the backend's own rules (PlayerProgressReplay), for P12 without a network. */
class ReplayBackend implements BackendApi {
  ledger: ProgressLedger = PlayerProgressReplay.newLedger();
  isAuthenticated = false;
  steamId64: string | null = null;
  received: PlayerEventRecord[][] = [];
  async authenticateWithSteam(ticket: string | null): Promise<boolean> {
    this.isAuthenticated = ticket === 'test-76561198000000001';
    this.steamId64 = this.isAuthenticated ? '76561198000000001' : null;
    return this.isAuthenticated;
  }
  async getState() {
    return this.ledger.state;
  }
  async ingestBatch(events: readonly PlayerEventRecord[]) {
    this.received.push([...events]);
    const r = PlayerProgressReplay.ingestBatch(
      this.ledger,
      events.map((e) => ({ clientEventId: e.clientEventId, sequenceNumber: e.sequenceNumber, type: e.type, payload: JSON.parse(e.payloadJson) })),
    );
    this.ledger = r.ledger;
    const results: EventVerdict[] = r.results.map((v) => ({ clientEventId: v.clientEventId, accepted: v.status === 'Accepted', rejectionReason: v.rejectionReason }));
    return { results, state: this.ledger.state };
  }
}

describe('sync and reconciliation (P12, RFR-27)', () => {
  it('flushes events, adopts the canonical state, and surfaces a rejected event as a correction notice', async () => {
    const platform = createNodePlatform({ seed: 3 });
    const backend = new ReplayBackend();
    const app = compose({ ...defaultConfig('test'), backend: 'http://unused.invalid', devTicket: 'test-76561198000000001' }, platform);
    // Swap the HTTP client for the replay double (same BackendApi seam the sync service uses).
    (app.sync as unknown as { backend: BackendApi }).backend = backend;
    await app.sync.load();
    app.combat.addGold(40);
    await app.sync.connect();
    let s = app.store.get();
    expect(s.sync.authenticated).toBe(true);
    expect(s.steamId64).toBe('76561198000000001');
    expect(s.eventLog.pending).toHaveLength(0);
    expect(s.canonical.goldMantissa).toBe(4);
    expect(s.canonical.activeSquadHeroIds).toEqual(['1f6e0000-0000-4000-8000-000000000001']);
    expect(s.lastReconciledAtMs).toBe(platform.clock.nowMs());

    // A deliberately rejected event: the server says the gold was never earned.
    backend.ledger = { ...backend.ledger, state: { ...backend.ledger.state, goldMantissa: 0, goldExponent: 0 } };
    app.combat.trySpendGold(30);
    await app.sync.syncNow();
    s = app.store.get();
    expect(s.notices.map((n) => n.kind)).toEqual(['correction']);
    expect(s.notices[0]?.message).toBe('Your gold was corrected by the server: Insufficient gold: have 0, need 30.00.');
    expect(s.gold).toBe(0);
    expect(s.eventLog.pending).toHaveLength(0);
  });

  it('stays fully playable and keeps events queued with no backend (RFR-30)', async () => {
    const { app } = await newGame();
    await app.sync.connect();
    expect(app.store.get().sync.authenticated).toBe(false);
    expect(app.store.get().eventLog.pending.length).toBeGreaterThan(0);
  });
});

describe('offline accrual (P10, RFR-28)', () => {
  it('credits time away from the save timestamp, capped, with a welcome-back notice', async () => {
    const store = new MemorySaveStore();
    const { app, platform } = await newGame(1, store);
    await app.sync.persist();
    const later = createNodePlatform({ seed: 2, saveStore: store, nowMs: platform.clock.nowMs() + 20 * 3_600_000 });
    const again = compose(defaultConfig('test'), later);
    const { accrual } = await again.sync.load();
    expect(accrual?.wasCapped).toBe(true);
    expect(again.store.get().gold).toBe(144); // ranger 12 power * 1 gold/power/h * 12 h cap
    expect(again.store.get().notices[0]).toMatchObject({ kind: 'offline-accrual', message: 'Welcome back! Your Active Squad earned 144.00 gold over 12h offline (capped).' });
  });
});

describe('TickDriver (RFR-8)', () => {
  it('a long gap delays combat but never loses it; beyond the 60 s cap time goes through accrual', async () => {
    const a = await newGame(9);
    const b = await newGame(9);
    a.app.combat.begin();
    b.app.combat.begin();
    for (let i = 0; i < 50; i++) a.app.tick.advance(100);
    b.app.tick.advance(5000);
    expect(b.app.store.get().combat).toEqual(a.app.store.get().combat);

    const c = await newGame(9);
    c.app.combat.begin();
    c.platform.clock.advance(10 * 60_000);
    c.app.tick.advance(10 * 60_000);
    expect(c.app.store.get().combat.state).toBe('Fighting');
    // 540 s beyond the cap credited through offline accrual: 12 power * 0.15 h = 1.8 → 2 gold.
    expect(c.app.store.get().gold).toBe(2);
  });
});
