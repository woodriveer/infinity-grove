import { z } from 'zod';
import { ARCHETYPES } from '../../domain/Archetype';
import type {
  CombatEconomy,
  Equipment,
  EquipmentItemData,
  GameSettings,
  HeroData,
  MonsterData,
  StageData,
} from '../../domain/content/types';
import { EQUIPMENT_SLOTS } from '../../domain/EquipmentSlot';
import { HERO_TYPES } from '../../domain/HeroType';

/**
 * Content schemas (AD-8, RFR-9). One JSON file per entity under Client/content/<kind>/,
 * with a stable kebab-case id equal to the file name. Each schema `satisfies` the
 * domain shape, so a field drift between them is a compile error.
 */

const id = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'must be a kebab-case id');
const guidOrEmpty = z.union([z.literal(''), z.string().uuid('must be a GUID or empty')]);
const nonNegInt = z.number().int().nonnegative();

/** A boss fight lasts at most 60 s (AD-002, COMBAT-04 AC 2). */
export const MAX_BOSS_TIMER_SECONDS = 60;
/** Combat advances in 100 ms steps (AD-007). */
const COMBAT_STEP_MS = 100;

export const heroSchema = z
  .object({
    heroId: id,
    serverHeroId: guidOrEmpty,
    displayName: z.string().min(1),
    heroType: z.enum(HERO_TYPES),
    portrait: z.string(),
    basePower: z.number().int().positive(),
    baseHp: z.number().int().positive(),
    baseDefense: nonNegInt,
    attackIntervalMs: z.number().int().positive(),
    abilityByStarTier: z.array(z.string()).length(12, 'must list 12 star tiers'),
  })
  .strict() satisfies z.ZodType<HeroData>;

export const monsterSchema = z
  .object({
    monsterId: id,
    monsterName: z.string().min(1),
    sprite: z.string(),
    maxHp: z.number().int().positive(),
    goldMin: nonNegInt,
    goldMax: nonNegInt,
  })
  .strict()
  .refine((m) => m.goldMax >= m.goldMin, { message: 'goldMax must be >= goldMin', path: ['goldMax'] }) satisfies z.ZodType<MonsterData>;

export const stageSchema = z
  .object({
    stageId: id,
    stageNumber: z.number().int().positive(),
    displayName: z.string().min(1),
    favoredType: z.enum(HERO_TYPES),
    powerFloor: nonNegInt,
    monsters: z.array(id).min(1),
    boss: z
      .object({
        monsterId: id,
        powerFloor: nonNegInt,
        timerSeconds: z.number().int().positive().max(MAX_BOSS_TIMER_SECONDS, `must be at most ${MAX_BOSS_TIMER_SECONDS} s`).optional(),
      })
      .strict()
      .optional(),
  })
  .strict() satisfies z.ZodType<StageData>;

/** content/economy/combat.json (stage-combat design, Data Models). */
export const combatEconomySchema = z
  .object({
    monstersPerStage: z.number().int().positive(),
    bossEvery: z.number().int().positive(),
    spawnDelayMs: nonNegInt
      .max(500, 'must be at most 500 ms')
      .refine((ms) => ms % COMBAT_STEP_MS === 0, `must be a multiple of ${COMBAT_STEP_MS} ms (one combat step)`),
    defaultBossTimerSeconds: z.number().int().positive().max(MAX_BOSS_TIMER_SECONDS, `must be at most ${MAX_BOSS_TIMER_SECONDS} s`),
    typeBonus: z.number().positive(),
    clickDpsShare: z.number().nonnegative(),
    dpsPerPower: z.number().positive(),
    defenseK: z.number().positive(),
    monster: z
      .object({
        hpBase: z.number().positive(),
        hpGrowth: z.number().positive(),
        goldBase: z.number().nonnegative(),
        goldGrowth: z.number().positive(),
        dpsBase: z.number().nonnegative(),
        dpsGrowth: z.number().positive(),
      })
      .strict(),
    boss: z
      .object({ hpMultiplier: z.number().positive(), dpsMultiplier: z.number().nonnegative(), goldMultiplier: z.number().nonnegative() })
      .strict(),
  })
  .strict() satisfies z.ZodType<CombatEconomy>;

export const itemSchema = z
  .object({
    itemId: id,
    displayName: z.string().min(1),
    slot: z.enum(EQUIPMENT_SLOTS),
    archetype: z.enum(ARCHETYPES),
    icon: z.string(),
  })
  .strict() satisfies z.ZodType<EquipmentItemData>;

export const equipmentSchema = z
  .object({
    equipmentId: id,
    itemName: z.string().min(1),
    animatorItemID: nonNegInt,
    bonusDamage: z.number().int(),
  })
  .strict() satisfies z.ZodType<Equipment>;

export const settingsSchema = z
  .object({
    syncIntervalSeconds: z.number().positive(),
    requestTimeoutSeconds: z.number().int().positive(),
    idleGoldPerSquadPowerPerHour: z.number().nonnegative(),
    offlineAccrualCapHours: z.number().nonnegative(),
    saveFileName: z.string().min(1),
    starterHeroId: id,
    startingEquipmentId: id,
    monsterPool: z.array(id).min(1),
    playerStats: z.object({ level: z.number().int(), damagePerLevel: z.number().int() }).strict(),
  })
  .strict() satisfies z.ZodType<GameSettings>;

/** Animation state → Aseprite frame tag mapping per character (AD-9). */
export const animationSchema = z
  .object({
    characterId: id,
    variants: z.record(
      z.string(),
      z
        .object({
          sheet: z.string().min(1),
          states: z.record(z.string(), z.object({ tag: z.string().min(1), repeat: z.number().int() }).strict()),
        })
        .strict(),
    ),
    /** Equipment animatorItemID → variant name (0 = no weapon). */
    variantByItemId: z.record(z.string(), z.string()),
  })
  .strict();

/** Effect parameters in data (RFR-46). */
export const effectSchema = z
  .object({
    effectId: id,
    texture: z.string().min(1),
    count: z.number().int().nonnegative(),
    lifespanMs: z.tuple([z.number().positive(), z.number().positive()]),
    speed: z.tuple([z.number().nonnegative(), z.number().nonnegative()]),
    scale: z.tuple([z.number().nonnegative(), z.number().nonnegative()]),
    alpha: z.tuple([z.number().min(0).max(1), z.number().min(0).max(1)]),
    tint: z.enum(['accentGlow', 'accentGold', 'ink']),
    reducedMotionCount: z.number().int().nonnegative(),
  })
  .strict();

/** Nine-slice frame insets shared by DOM and Phaser views (DESIGN.md Shapes). */
export const frameSchema = z
  .object({
    frameId: id,
    image: z.string().min(1),
    frame: z.object({ x: nonNegInt, y: nonNegInt, w: z.number().int().positive(), h: z.number().int().positive() }).strict(),
    insets: z.object({ left: nonNegInt, right: nonNegInt, top: nonNegInt, bottom: nonNegInt }).strict(),
  })
  .strict();

export type AnimationData = z.infer<typeof animationSchema>;
export type EffectData = z.infer<typeof effectSchema>;
export type FrameData = z.infer<typeof frameSchema>;

/** Content kind → schema and id field. Folder name = kind. */
export const CONTENT_KINDS = {
  heroes: { schema: heroSchema, idField: 'heroId' },
  monsters: { schema: monsterSchema, idField: 'monsterId' },
  stages: { schema: stageSchema, idField: 'stageId' },
  items: { schema: itemSchema, idField: 'itemId' },
  equipment: { schema: equipmentSchema, idField: 'equipmentId' },
  animations: { schema: animationSchema, idField: 'characterId' },
  effects: { schema: effectSchema, idField: 'effectId' },
  frames: { schema: frameSchema, idField: 'frameId' },
} as const;

export type ContentKind = keyof typeof CONTENT_KINDS;
