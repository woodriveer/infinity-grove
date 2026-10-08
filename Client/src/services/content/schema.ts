import { z } from 'zod';
import { ARCHETYPES } from '../../domain/Archetype';
import type {
  CombatEconomy,
  DropEconomy,
  Equipment,
  EnchantBandsData,
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
const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'must be a #rrggbb color');

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
    minStage: z.number().int().positive().optional(),
    art: z.object({ mode: z.enum(['layered', 'legacy']), neutral: hexColor.optional() }).strict().optional(),
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

/** content/economy/drops.json (boss-drops design, Data Models). */
export const dropEconomySchema = z
  .object({
    normalChance: z.number().min(0).max(1),
    bossChance: z.number().min(0).max(1),
    bagCapacity: z.number().int().positive(),
    itemBands: z
      .array(z.object({ fromStage: z.number().int().positive(), itemIds: z.array(id).min(1) }).strict())
      .min(1)
      .refine((bands) => bands.every((b, i) => i === 0 || b.fromStage > bands[i - 1]!.fromStage), 'fromStage must be strictly ascending'),
  })
  .strict() satisfies z.ZodType<DropEconomy>;

const ARMOR_SLOTS: readonly string[] = ['Chest', 'Gloves', 'Boots'];

export const itemSchema = z
  .object({
    itemId: id,
    displayName: z.string().min(1),
    slot: z.enum(EQUIPMENT_SLOTS),
    archetype: z.enum(ARCHETYPES),
    icon: z.string(),
    visual: z
      .object({ weaponModel: id.optional(), color: hexColor.optional(), colorDark: hexColor.optional() })
      .strict()
      .optional(),
  })
  .strict()
  .superRefine((item, ctx) => {
    const v = item.visual;
    if (!v) return;
    if (v.weaponModel !== undefined && item.slot !== 'Weapon') {
      ctx.addIssue({ code: 'custom', path: ['visual', 'weaponModel'], message: `is only allowed on Weapon items (slot is ${item.slot})` });
    }
    for (const field of ['color', 'colorDark'] as const) {
      if (v[field] !== undefined && !ARMOR_SLOTS.includes(item.slot)) {
        ctx.addIssue({ code: 'custom', path: ['visual', field], message: `is only allowed on Chest, Gloves and Boots items (slot is ${item.slot})` });
      }
    }
  }) satisfies z.ZodType<EquipmentItemData>;

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

/** content/art/enchant-bands.json (hero-art-pipeline ART-08): sorted, non-overlapping, minLevel >= 1. */
export const enchantBandsSchema = z
  .object({
    artId: id,
    bands: z.array(
      z.object({ minLevel: z.number().int().min(1), glow: z.boolean(), aura: z.boolean(), particles: id.optional() }).strict(),
    ),
  })
  .strict()
  .superRefine((data, ctx) => {
    data.bands.forEach((band, i) => {
      const prev = data.bands[i - 1];
      if (prev && band.minLevel <= prev.minLevel) {
        ctx.addIssue({
          code: 'custom',
          path: ['bands', i, 'minLevel'],
          message: `must be greater than the previous band's minLevel ${prev.minLevel} (bands are sorted and must not overlap)`,
        });
      }
    });
  }) satisfies z.ZodType<EnchantBandsData>;

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
  art: { schema: enchantBandsSchema, idField: 'artId' },
} as const;

export type ContentKind = keyof typeof CONTENT_KINDS;
