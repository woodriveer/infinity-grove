import { createRng, type Rng } from '../domain/rng';
import { ALL_ASSET_KEYS } from '../generated/assets.gen';
import type { BackendApi } from '../services/backend/BackendApi';
import { BackendApiClient } from '../services/backend/BackendApiClient';
import { NoBackend } from '../services/backend/NoBackend';
import { CombatService } from '../services/combat/CombatService';
import { PlayerCombatService } from '../services/combat/PlayerCombatService';
import { loadContent, type ContentCatalog } from '../services/content/ContentLoader';
import { rngIdGenerator, type ServiceDeps } from '../services/core';
import { BackendAffixRollSource } from '../services/crafting/BackendAffixRollSource';
import { CraftingService } from '../services/crafting/CraftingService';
import { EquipmentInventoryService } from '../services/equipment/EquipmentInventoryService';
import { EquipmentService } from '../services/equipment/EquipmentService';
import { LoadoutPresetService } from '../services/equipment/LoadoutPresetService';
import { DevSteamIdentity } from '../services/identity/DevSteamIdentity';
import { NoticeService } from '../services/notices/NoticeService';
import type { PlatformPorts } from '../services/ports';
import { FusionService } from '../services/roster/FusionService';
import { RosterService } from '../services/roster/RosterService';
import { SaveCodec } from '../services/save/SaveCodec';
import { GameStore } from '../services/state/GameStore';
import { emptyGameState } from '../services/state/projection';
import type { ReadonlyStore } from '../services/state/types';
import { StageService } from '../services/stages/StageService';
import { SaveSyncService } from '../services/sync/SaveSyncService';
import { SteamCloudSync } from '../services/sync/SteamCloudSync';
import { TickDriver } from '../services/tick/TickDriver';
import type { AppConfig } from './config';

/** Everything the game needs, built once (AD-4). Presentation receives this; never globals. */
export interface AppContext {
  readonly config: AppConfig;
  readonly content: ContentCatalog;
  readonly store: ReadonlyStore;
  readonly rng: Rng;
  readonly platform: PlatformPorts;
  readonly tick: TickDriver;
  readonly combat: CombatService;
  readonly playerCombat: PlayerCombatService;
  readonly equipment: EquipmentService;
  readonly roster: RosterService;
  readonly fusion: FusionService;
  readonly inventory: EquipmentInventoryService;
  readonly presets: LoadoutPresetService;
  readonly crafting: CraftingService;
  readonly stages: StageService;
  readonly sync: SaveSyncService;
  readonly notices: NoticeService;
}

/** Test/harness seams: swap one implementation without touching wiring elsewhere (RFR-6). */
export interface ComposeOverrides {
  readonly backend?: BackendApi;
}

/** The single composition root (AD-4). The browser, Electron, sim and soak all call this. */
export function compose(config: AppConfig, platform: PlatformPorts, overrides: ComposeOverrides = {}): AppContext {
  const content = loadContent(platform.content.entries(), ALL_ASSET_KEYS);
  const store = new GameStore(emptyGameState());
  const rng = createRng(platform.rngSeed);
  const deps: ServiceDeps = { store, clock: platform.clock, rng, ids: rngIdGenerator(rng), content, logger: platform.logger };

  const backend: BackendApi =
    overrides.backend ??
    (config.backend === 'none' ? new NoBackend() : new BackendApiClient(config.backend, platform.http, platform.logger));
  const identity = config.identity === 'dev' ? new DevSteamIdentity(config.devTicket) : platform.steamIdentity;

  const combat = new CombatService(deps);
  const equipment = new EquipmentService(deps);
  const playerCombat = new PlayerCombatService(deps, equipment);
  const roster = new RosterService(deps);
  const fusion = new FusionService(deps);
  const inventory = new EquipmentInventoryService(deps);
  const presets = new LoadoutPresetService(deps, inventory);
  const crafting = new CraftingService(deps, inventory, new BackendAffixRollSource());
  const stages = new StageService(deps);
  const codec = new SaveCodec(platform.cipher, platform.logger);
  const cloudSync = new SteamCloudSync(platform.cloudStore, codec, platform.logger);
  const sync = new SaveSyncService(deps, platform.saveStore, codec, cloudSync, identity, backend, combat, roster);
  const tick = new TickDriver(deps, combat, sync, content.settings.syncIntervalSeconds * 1000);
  const notices = new NoticeService(deps);

  return {
    config,
    content,
    store: store.readonly(),
    rng,
    platform,
    tick,
    combat,
    playerCombat,
    equipment,
    roster,
    fusion,
    inventory,
    presets,
    crafting,
    stages,
    sync,
    notices,
  };
}
