/**
 * `npm run fixtures:gen` (RFR-14): rebuilds fixtures/saves/*.json by playing each
 * state through the real services (so fixtures can never drift from the save
 * schema), then reconciling with the in-process backend where the fixture says so.
 * Output is the plain (unencrypted) envelope; deterministic.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { compose, type AppContext } from '../src/app/compose';
import { defaultConfig } from '../src/app/config';
import type { SaveGameData } from '../src/domain/SaveGameData';
import { createNodePlatform, DEFAULT_EPOCH_MS } from '../src/platform/node/nodePlatform';
import { MemorySaveStore } from '../src/platform/node/NodePorts';
import { WebCryptoCipher } from '../src/platform/shared/WebCryptoCipher';
import { SaveCodec } from '../src/services/save/SaveCodec';
import { ReplayBackend, TEST_TICKET } from './lib/replayBackend';

const HOUR = 3_600_000;

async function build(name: string, play: (app: AppContext) => Promise<void> | void, opts: { reconcile?: boolean; lastSeenOffsetMs?: number } = {}): Promise<void> {
  const store = new MemorySaveStore();
  const backend = new ReplayBackend();
  const platform = createNodePlatform({ seed: 1000 + name.length, saveStore: store });
  const app = compose({ ...defaultConfig('test'), backend: 'replay://in-process', devTicket: TEST_TICKET }, platform, { backend });
  app.sync.loadFrom(null);
  if (opts.reconcile) await app.sync.connect();
  await play(app);
  if (opts.reconcile) await app.sync.syncNow();
  await app.sync.persist();
  const save = (await new SaveCodec(new WebCryptoCipher(), platform.logger).decode(store.bytes)) as SaveGameData;
  const out: SaveGameData = { ...save, lastSeenAtMs: DEFAULT_EPOCH_MS + (opts.lastSeenOffsetMs ?? 0) };
  writeFileSync(`fixtures/saves/${name}.json`, SaveCodec.toPlainJson(out));
  console.log(`fixtures:gen: ${name} (gold ${app.store.get().gold}, ${app.store.get().heroes.length} heroes, ${out.unsyncedEvents.length} unsynced events)`);
}

mkdirSync('fixtures/saves', { recursive: true });

const midGame = (app: AppContext) => {
  app.roster.addHeroCard('druid');
  app.roster.addHeroCard('ember-warden');
  app.roster.tryActivate('druid');
  app.combat.addGold(250);
  app.stages.attemptStage('mossy-hollow');
};

// The default new-game state: starter in the squad, its two events not yet synced.
await build('new-player', () => undefined);
await build('mid-game', midGame, { reconcile: true });
await build(
  'fusion-ready',
  (app) => {
    app.roster.addHeroCard('ranger');
    app.roster.addHeroCard('ranger');
  },
  { reconcile: true },
);
await build(
  'full-squad-plus-bench',
  (app) => {
    for (const id of ['druid', 'ember-warden', 'dawn-cleric', 'shade-stalker', 'tide-caller']) app.roster.addHeroCard(id);
    for (const id of ['druid', 'ember-warden', 'dawn-cleric', 'shade-stalker']) app.roster.tryActivate(id);
  },
  { reconcile: true },
);
await build(
  'crafting-ready',
  (app) => {
    app.combat.addGold(500);
    for (const id of ['bark-blade', 'sage-staff', 'leaf-mail', 'wind-boots', 'thorn-gloves']) app.inventory.addNewToBag(id);
    const mail = app.inventory.bag().find((i) => i.itemId === 'leaf-mail');
    if (mail) app.inventory.tryEquip('ranger', mail.instanceId);
    app.presets.savePreset('Strength', 'ranger');
  },
  { reconcile: true },
);
await build(
  'pending-reconciliation',
  async (app) => {
    midGame(app);
    await app.sync.syncNow();
    // Progress made offline since the last sync: still in unsyncedEvents.
    (app.sync as unknown as { backend: { isAuthenticated: boolean } }).backend.isAuthenticated = false;
    app.combat.addGold(30);
    app.combat.trySpendGold(50);
    app.roster.addHeroCard('tide-caller');
  },
  { reconcile: false },
);
await build('offline-8h', midGame, { reconcile: true, lastSeenOffsetMs: -8 * HOUR });
