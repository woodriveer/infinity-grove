/**
 * Headless scenario runner behind `npm run sim` (RFR-13, AD-17): domain + services
 * through the real compose(), node ports, a manual clock and a fixed seed. A scenario
 * is a list of player actions and elapsed time; the output is the resulting state and
 * every event emitted, as plain JSON. Same scenario + seed → byte-identical output.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { compose, type AppContext } from '../../src/app/compose';
import { defaultConfig } from '../../src/app/config';
import type { AffixType } from '../../src/domain/AffixType';
import type { Archetype } from '../../src/domain/Archetype';
import type { EquipmentSlot } from '../../src/domain/EquipmentSlot';
import type { PlayerEventRecord } from '../../src/domain/PlayerEventRecord';
import type { SaveGameData } from '../../src/domain/SaveGameData';
import { createNodePlatform, DEFAULT_EPOCH_MS } from '../../src/platform/node/nodePlatform';
import { MemorySaveStore } from '../../src/platform/node/NodePorts';
import { SaveCodec } from '../../src/services/save/SaveCodec';
import { ReplayBackend, TEST_TICKET } from './replayBackend';

export type Step =
  | { do: 'begin' }
  | { do: 'advance'; ms: number; frameMs?: number }
  | { do: 'attack'; times?: number }
  | { do: 'attackUntilKill'; kills?: number }
  | { do: 'addHero'; heroId: string; copies?: number }
  | { do: 'activate'; heroId: string }
  | { do: 'bench'; heroId: string }
  | { do: 'swap'; activeHeroId: string; benchedHeroId: string }
  | { do: 'fuse'; heroId: string }
  | { do: 'addItem'; itemId: string }
  | { do: 'equip'; heroId: string; itemId: string }
  | { do: 'unequip'; heroId: string; slot: EquipmentSlot }
  | { do: 'savePreset'; archetype: Archetype; heroId: string }
  | { do: 'applyPreset'; archetype: Archetype; heroId: string }
  | { do: 'reroll'; itemId: string; affix: AffixType }
  | { do: 'attemptStage'; stageId: string }
  | { do: 'equipKrell'; equipmentId: string }
  | { do: 'unequipKrell' }
  | { do: 'addGold'; amount: number }
  | { do: 'spendGold'; amount: number }
  | { do: 'connect' }
  | { do: 'sync' }
  | { do: 'persist' }
  | { do: 'reload'; awayMs?: number }
  | { do: 'serverSetGold'; mantissa: number; exponent: number }
  | { do: 'dismissNotices' };

export interface Scenario {
  description: string;
  /** Save fixture name under fixtures/saves, or null for a brand-new game. */
  save?: string | null;
  seed?: number;
  /** 'replay': an in-process backend running the backend's rules, seeded with the save's reconciled state. */
  backend?: 'none' | 'replay';
  steps: Step[];
  /** Partial output the sim tests assert (toMatchObject). */
  expect?: Record<string, unknown>;
}

export interface SimOutput {
  scenario: string;
  seed: number;
  save: string | null;
  backend: 'none' | 'replay';
  results: Array<{ step: number; do: string; result: unknown }>;
  final: ReturnType<typeof summarize>;
  events: Array<{ seq: number; type: string; payload: unknown }>;
  log: string[];
}

const ROOT = resolve(import.meta.dirname, '../..');

export function loadFixture(name: string): SaveGameData {
  return SaveCodec.parsePlain(JSON.parse(readFileSync(resolve(ROOT, 'fixtures/saves', `${name}.json`), 'utf8')));
}

export function loadScenario(path: string): Scenario {
  return JSON.parse(readFileSync(path, 'utf8')) as Scenario;
}

interface Session {
  app: AppContext;
  platform: ReturnType<typeof createNodePlatform>;
}

export async function runScenario(scenario: Scenario, opts: { seed?: number; save?: string | null; name?: string } = {}): Promise<SimOutput> {
  const seed = opts.seed ?? scenario.seed ?? 42;
  const saveName = opts.save !== undefined ? opts.save : (scenario.save ?? null);
  const backendKind = scenario.backend ?? 'none';
  const fixture = saveName ? loadFixture(saveName) : null;
  const backend = backendKind === 'replay' ? new ReplayBackend(fixture?.lastReconciledState) : undefined;
  const saveStore = new MemorySaveStore();
  const config = { ...defaultConfig('test'), devTicket: backend ? TEST_TICKET : null, backend: backend ? 'replay://in-process' : 'none' };
  let seedCounter = seed;

  const boot = async (nowMs: number, save: SaveGameData | null | 'from-store'): Promise<Session> => {
    const platform = createNodePlatform({ seed: seedCounter++, nowMs, saveStore });
    const app = compose(config, platform, backend ? { backend } : {});
    if (save === 'from-store') await app.sync.load();
    else app.sync.loadFrom(save);
    return { app, platform };
  };

  let session = await boot(DEFAULT_EPOCH_MS, fixture);
  const seen = new Set<string>();
  const events: SimOutput['events'] = [];
  const collect = () => {
    for (const e of session.app.store.get().eventLog.pending) record(e);
  };
  const record = (e: PlayerEventRecord) => {
    if (seen.has(e.clientEventId)) return;
    seen.add(e.clientEventId);
    events.push({ seq: e.sequenceNumber, type: e.type, payload: JSON.parse(e.payloadJson) });
  };
  collect();

  const results: SimOutput['results'] = [];
  for (const [i, step] of scenario.steps.entries()) {
    const { app, platform } = session;
    let result: unknown = null;
    switch (step.do) {
      case 'begin':
        app.combat.begin();
        break;
      case 'advance': {
        const frame = step.frameMs ?? 100;
        let left = step.ms;
        while (left > 0) {
          const dt = Math.min(frame, left);
          platform.clock.advance(dt);
          app.tick.advance(dt);
          collect();
          left -= dt;
        }
        await flushAsync();
        break;
      }
      case 'attack':
        for (let n = 0; n < (step.times ?? 1); n++) {
          app.combat.playerAttack(app.playerCombat.calculateAttackDamage());
          collect();
        }
        break;
      case 'attackUntilKill': {
        const target = app.store.get().combat.kills + (step.kills ?? 1);
        let guard = 0;
        while (app.store.get().combat.kills < target && guard++ < 100_000) {
          if (app.store.get().combat.state === 'Fighting') app.combat.playerAttack(app.playerCombat.calculateAttackDamage());
          else {
            platform.clock.advance(100);
            app.tick.advance(100);
          }
          collect();
        }
        result = { kills: app.store.get().combat.kills };
        break;
      }
      case 'addHero':
        for (let n = 0; n < (step.copies ?? 1); n++) app.roster.addHeroCard(step.heroId);
        break;
      case 'activate':
        result = app.roster.tryActivate(step.heroId);
        break;
      case 'bench':
        app.roster.benchHero(step.heroId);
        break;
      case 'swap':
        result = app.roster.swap(step.activeHeroId, step.benchedHeroId);
        break;
      case 'fuse':
        result = app.fusion.tryFuse(step.heroId);
        break;
      case 'addItem':
        app.inventory.addNewToBag(step.itemId);
        break;
      case 'equip': {
        const item = app.inventory.bag().find((x) => x.itemId === step.itemId);
        result = item ? app.inventory.tryEquip(step.heroId, item.instanceId) : false;
        break;
      }
      case 'unequip':
        app.inventory.unequip(step.heroId, step.slot);
        break;
      case 'savePreset':
        app.presets.savePreset(step.archetype, step.heroId);
        break;
      case 'applyPreset':
        result = app.presets.tryApplyPreset(step.archetype, step.heroId);
        break;
      case 'reroll': {
        const item = findItem(app, step.itemId);
        result = item ? await app.crafting.requestReroll(item, step.affix) : { status: 'rejected', reason: 'no such item' };
        break;
      }
      case 'attemptStage':
        result = app.stages.attemptStage(step.stageId);
        break;
      case 'equipKrell':
        app.equipment.equip(step.equipmentId);
        break;
      case 'unequipKrell':
        app.equipment.unequip();
        break;
      case 'addGold':
        app.combat.addGold(step.amount);
        break;
      case 'spendGold':
        result = app.combat.trySpendGold(step.amount);
        break;
      case 'connect':
        await app.sync.connect();
        break;
      case 'sync':
        await app.sync.syncNow();
        break;
      case 'persist':
        await app.sync.persist();
        break;
      case 'reload': {
        await app.sync.persist();
        session = await boot(platform.clock.nowMs() + (step.awayMs ?? 0), 'from-store');
        break;
      }
      case 'serverSetGold':
        if (!backend) throw new Error(`step ${i}: serverSetGold needs "backend": "replay"`);
        backend.setServerGold(step.mantissa, step.exponent);
        break;
      case 'dismissNotices':
        for (const n of app.store.get().notices) app.notices.dismiss(n.id);
        break;
      default: {
        const never: never = step;
        throw new Error(`step ${i}: unknown action ${JSON.stringify(never)}`);
      }
    }
    collect();
    if (result !== null) results.push({ step: i, do: step.do, result });
  }

  return {
    scenario: opts.name ?? scenario.description,
    seed,
    save: saveName,
    backend: backendKind,
    results,
    final: summarize(session.app),
    events,
    log: session.platform.logger.lines,
  };
}

function findItem(app: AppContext, itemId: string): string | null {
  const s = app.store.get();
  const inBag = s.equipment.bag.find((i) => i.itemId === itemId);
  if (inBag) return inBag.instanceId;
  for (const slots of Object.values(s.equipment.equippedByHero)) {
    for (const i of Object.values(slots)) if (i?.itemId === itemId) return i.instanceId;
  }
  return null;
}

export function summarize(app: AppContext) {
  const s = app.store.get();
  return {
    gold: s.gold,
    furthestStageCleared: s.furthestStageCleared,
    heroes: s.heroes.map((h) => ({ heroId: h.heroId, starTier: h.starTier, duplicatesOwned: h.duplicatesOwned, active: h.isInActiveSquad })),
    activeSquad: s.activeSquad,
    combat: {
      state: s.combat.state,
      kills: s.combat.kills,
      monster: s.combat.monster ? { name: s.combat.monster.name, currentHp: s.combat.monster.currentHp, maxHp: s.combat.monster.maxHp } : null,
    },
    krellEquipmentId: s.krellEquipmentId,
    attackDamage: app.playerCombat.calculateAttackDamage(),
    equipment: {
      bag: s.equipment.bag.map((i) => i.itemId),
      equipped: Object.fromEntries(
        Object.entries(s.equipment.equippedByHero).map(([hero, slots]) => [hero, Object.fromEntries(Object.entries(slots).map(([slot, i]) => [slot, i?.itemId]))]),
      ),
    },
    presets: s.presets.map((p) => ({ archetype: p.archetype, heroId: p.heroId, slots: Object.keys(p.instanceIdBySlot) })),
    lastStageAttempt: s.lastStageAttempt,
    notices: s.notices.map((n) => ({ kind: n.kind, message: n.message })),
    sync: { authenticated: s.sync.authenticated, pendingEvents: s.eventLog.pending.length },
    canonical: {
      gold: { m: s.canonical.goldMantissa, e: s.canonical.goldExponent },
      furthestStageCleared: s.canonical.furthestStageCleared,
      lastAppliedSequence: s.canonical.lastAppliedSequence,
    },
  };
}

/** Lets queued promise work (syncs, persists) finish without waiting on wall time. */
export async function flushAsync(): Promise<void> {
  for (let i = 0; i < 5; i++) await new Promise((r) => setImmediate(r));
}
