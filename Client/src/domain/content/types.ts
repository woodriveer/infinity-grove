import type { Archetype } from '../Archetype';
import type { EquipmentSlot } from '../EquipmentSlot';
import type { HeroType } from '../HeroType';

/**
 * Plain shapes of design-time content, formerly Unity ScriptableObjects
 * (Scripts/Game/Data/*). services/content/schema.ts validates JSON against zod
 * schemas that `satisfy` these types; domain never imports zod (AD-8).
 */

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
  /** Ability text per star tier, index 0 = 1★ .. index 11 = 12★. */
  abilityByStarTier: string[];
}

/** Data/MonsterData.cs */
export interface MonsterData {
  monsterId: string;
  monsterName: string;
  /** Asset key of the monster sprite (empty = none, as the Unity Slime asset). */
  sprite: string;
  maxHp: number;
  goldMin: number;
  goldMax: number;
}

/** Data/StageData.cs: a stage's type modifier and power requirement (FR-10/FR-11/FR-15). */
export interface StageData {
  stageId: string;
  stageNumber: number;
  displayName: string;
  favoredType: HeroType;
  powerFloor: number;
}

/** Data/EquipmentItemData.cs: a droppable/craftable gear template (FR-19). */
export interface EquipmentItemData {
  itemId: string;
  displayName: string;
  slot: EquipmentSlot;
  archetype: Archetype;
  /** Asset key of the icon (empty = none). */
  icon: string;
}

/** Data/Equipment.cs: Krell's weapon (drives the animation variant and bonus damage). */
export interface Equipment {
  equipmentId: string;
  itemName: string;
  /** 0 = none, 1 = WCLAW01 (the Unity Animator ItemID). */
  animatorItemID: number;
  bonusDamage: number;
}

/** Data/PlayerStats.cs */
export interface PlayerStats {
  level: number;
  damagePerLevel: number;
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
  monsterPool: string[];
  playerStats: PlayerStats;
}
