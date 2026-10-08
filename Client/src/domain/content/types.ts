import type { Archetype } from '../Archetype';
import type { EquipmentSlot } from '../EquipmentSlot';
import type { HeroType } from '../HeroType';

/**
 * Plain shapes of design-time content, formerly Unity ScriptableObjects
 * (Scripts/Game/Data/*). services/content/schema.ts validates JSON against zod
 * schemas that `satisfy` these types; domain never imports zod (AD-8).
 */

/** `#rrggbb` (validated by the content schema). */
export type HexColor = string;

/** Hero art mode (hero-art-pipeline ART-09): absent = portrait fallback. */
export interface HeroArt {
  /** `layered` = exported Aseprite layers composed at runtime; `legacy` = the fixed Unity-era sheets. */
  mode: 'layered' | 'legacy';
  /** Tint of an empty armor slot. */
  neutral?: HexColor;
}

/** How an item looks on a hero (hero-art-pipeline ART-06). */
export interface ItemVisual {
  /** Weapon slot only: `items/weapons/<id>` Aseprite key suffix. */
  weaponModel?: string;
  /** Chest/Gloves/Boots only. */
  color?: HexColor;
  /** Chest/Gloves/Boots only: the dark end of the two-color ramp (ART-10). */
  colorDark?: HexColor;
}

/** One enchant visual band, from `minLevel` up to the next band (ART-08). */
export interface EnchantBand {
  minLevel: number;
  glow: boolean;
  aura: boolean;
  /** Effect id of the particle effect. */
  particles?: string;
}

/** content/art/enchant-bands.json: sorted, non-overlapping, `minLevel` >= 1. */
export interface EnchantBandsData {
  artId: string;
  bands: EnchantBand[];
}

/** Data/HeroData.cs: a collectible hero card (PRD FR-2/FR-6). */
export interface HeroData {
  heroId: string;
  /** The backend HeroDefinitionId (GUID); empty until content-authored server side. */
  serverHeroId: string;
  displayName: string;
  heroType: HeroType;
  /** Asset key of the portrait image. */
  portrait: string;
  basePower: number;
  /** Field hit points (stage-combat; curves come with economy-tuning). */
  baseHp: number;
  /** Boss damage reduction: damage taken × (1 − def / (def + CombatEconomy.defenseK)). */
  baseDefense: number;
  /** Attack animation pacing only; damage is continuous (AD-007). */
  attackIntervalMs: number;
  /** Ability text per star tier, index 0 = 1★ .. index 11 = 12★. */
  abilityByStarTier: string[];
  /** First stage whose boss can drop this hero (boss-drops DROP-01); default 1. */
  minStage?: number;
  art?: HeroArt;
}

/** Data/MonsterData.cs */
export interface MonsterData {
  monsterId: string;
  monsterName: string;
  /** Asset key of the monster sprite (empty = none, as the Unity Slime asset). */
  sprite: string;
  /** Legacy click-combat fields, read by CombatService until the stage-combat loop replaces it (T18). */
  maxHp: number;
  goldMin: number;
  goldMax: number;
}

/** A boss stage's boss (stage-combat COMBAT-04). */
export interface StageBoss {
  monsterId: string;
  /** FR-11 Power Gate threshold that labels a boss failure. */
  powerFloor: number;
  /** Countdown; defaults to CombatEconomy.defaultBossTimerSeconds. At most 60 s. */
  timerSeconds?: number;
}

/** Data/StageData.cs: a stage's type modifier, monsters and boss (FR-10/FR-11/FR-15, AD-002). */
export interface StageData {
  stageId: string;
  /** Contiguous from 1. */
  stageNumber: number;
  displayName: string;
  favoredType: HeroType;
  /** Monster ids drawn in order (visual identity only; numbers come from CombatEconomy). */
  monsters: string[];
  /** Present iff stageNumber % CombatEconomy.bossEvery === 0. */
  boss?: StageBoss;
}

/** content/economy/combat.json: combat constants and placeholder curves (economy-tuning replaces them). */
export interface CombatEconomy {
  monstersPerStage: number;
  bossEvery: number;
  /** Multiple of 100 (one combat step), at most 500. */
  spawnDelayMs: number;
  defaultBossTimerSeconds: number;
  typeBonus: number;
  clickDpsShare: number;
  dpsPerPower: number;
  defenseK: number;
  monster: { hpBase: number; hpGrowth: number; goldBase: number; goldGrowth: number; dpsBase: number; dpsGrowth: number };
  boss: { hpMultiplier: number; dpsMultiplier: number; goldMultiplier: number };
}

/** content/economy/drops.json (boss-drops DROP-03): chances and item bands; the backend rolls, the client only displays. */
export interface DropEconomy {
  /** Chance per normal monster kill to drop an item (0..1). */
  normalChance: number;
  /** Chance per boss defeat to drop an item, independent of the hero roll (0..1). */
  bossChance: number;
  /** Client bag size; granted items beyond it wait in the grant queue. */
  bagCapacity: number;
  /** Ascending by fromStage; a stage uses the last band whose fromStage is <= the stage. */
  itemBands: DropItemBand[];
}

export interface DropItemBand {
  fromStage: number;
  itemIds: string[];
}

/** Data/EquipmentItemData.cs: a droppable/craftable gear template (FR-19). */
export interface EquipmentItemData {
  itemId: string;
  displayName: string;
  slot: EquipmentSlot;
  archetype: Archetype;
  /** Asset key of the icon (empty = none). */
  icon: string;
  visual?: ItemVisual;
}

/** Data/Equipment.cs: Krell's weapon (drives the animation variant and bonus damage). */
export interface Equipment {
  equipmentId: string;
  itemName: string;
  /** 0 = none, 1 = WCLAW01 (the Unity Animator ItemID). */
  animatorItemID: number;
  bonusDamage: number;
}

/** Data/BackendSyncSettings.cs, plus the new-game defaults that lived in GameLifetimeScope. */
export interface GameSettings {
  syncIntervalSeconds: number;
  requestTimeoutSeconds: number;
  idleGoldPerSquadPowerPerHour: number;
  offlineAccrualCapHours: number;
  saveFileName: string;
  /** RFR-14: the fixed starter hero of a new game (content data, not code). */
  starterHeroId: string;
  startingEquipmentId: string;
}
