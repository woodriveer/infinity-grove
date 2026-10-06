import type { CombatService } from './combat/CombatService';
import type { PlayerCombatService } from './combat/PlayerCombatService';
import type { ContentCatalog } from './content/ContentLoader';
import type { CraftingService } from './crafting/CraftingService';
import type { EquipmentInventoryService } from './equipment/EquipmentInventoryService';
import type { EquipmentService } from './equipment/EquipmentService';
import type { LoadoutPresetService } from './equipment/LoadoutPresetService';
import type { NoticeService } from './notices/NoticeService';
import type { FusionService } from './roster/FusionService';
import type { RosterService } from './roster/RosterService';
import type { StageService } from './stages/StageService';
import type { ReadonlyStore } from './state/types';
import type { SaveSyncService } from './sync/SaveSyncService';
import type { TickDriver } from './tick/TickDriver';

/**
 * What presentation receives from the composition root (AD-4): read-only state plus
 * the service commands. Scenes and controllers get this injected; they never
 * construct services or look them up globally.
 */
export interface AppServices {
  readonly content: ContentCatalog;
  readonly store: ReadonlyStore;
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
