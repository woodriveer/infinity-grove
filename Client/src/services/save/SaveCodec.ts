import { z } from 'zod';
import { AFFIX_TYPES } from '../../domain/AffixType';
import { ARCHETYPES } from '../../domain/Archetype';
import { EQUIPMENT_SLOTS } from '../../domain/EquipmentSlot';
import { PLAYER_EVENT_SYNC_STATUSES } from '../../domain/PlayerEventSyncStatus';
import { PLAYER_EVENT_TYPES } from '../../domain/PlayerEventType';
import { SaveGameData } from '../../domain/SaveGameData';
import type { Cipher, Logger } from '../ports';
import { migrate } from './migrations';

/**
 * The save envelope on disk (AD-12): versioned JSON, AES-GCM obfuscated by the
 * Cipher port. Fixtures (fixtures/saves/*.json) are the same envelope unencrypted.
 * A corrupt or unreadable save never crashes the game (NFR-2): it decodes to null.
 */

const instance = z
  .object({
    instanceId: z.string().min(1),
    itemId: z.string().min(1),
    affixRolls: z.partialRecord(z.enum(AFFIX_TYPES), z.number()),
  })
  .strict();

const snapshot = z
  .object({
    goldMantissa: z.number(),
    goldExponent: z.number().int(),
    furthestStageCleared: z.number().int().nonnegative(),
    lastAppliedSequence: z.number().int().nonnegative(),
    roster: z.array(z.object({ heroDefinitionId: z.string(), ownedCount: z.number().int(), starTier: z.number().int() }).strict()),
    activeSquadHeroIds: z.array(z.string()),
  })
  .strict();

export const saveSchema = z
  .object({
    formatVersion: z.literal(SaveGameData.CurrentFormatVersion),
    steamId64: z.string(),
    lastReconciledAtMs: z.number().nonnegative(),
    lastSeenAtMs: z.number().nonnegative(),
    lastReconciledState: snapshot,
    unsyncedEvents: z.array(
      z
        .object({
          clientEventId: z.string().uuid(),
          sequenceNumber: z.number().int().positive(),
          type: z.enum(PLAYER_EVENT_TYPES),
          occurredAtMs: z.number(),
          payloadJson: z.string(),
          syncStatus: z.enum(PLAYER_EVENT_SYNC_STATUSES),
          rejectionReason: z.string().nullable(),
        })
        .strict(),
    ),
    nextSequenceNumber: z.number().int().positive(),
    local: z
      .object({
        equipmentBag: z.array(instance),
        equippedByHero: z.record(z.string(), z.partialRecord(z.enum(EQUIPMENT_SLOTS), instance)),
        presets: z.array(
          z
            .object({
              archetype: z.enum(ARCHETYPES),
              heroId: z.string(),
              instanceIdBySlot: z.partialRecord(z.enum(EQUIPMENT_SLOTS), z.string()),
            })
            .strict(),
        ),
        krellEquipmentId: z.string().nullable(),
      })
      .strict(),
  })
  .strict() satisfies z.ZodType<SaveGameData>;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export class SaveCodec {
  constructor(
    private readonly cipher: Cipher,
    private readonly logger: Logger,
  ) {}

  /** Plain envelope JSON (fixtures, tests). Throws with field paths on an invalid envelope. */
  static parsePlain(json: unknown): SaveGameData {
    return saveSchema.parse(migrate(json)) as SaveGameData;
  }

  static toPlainJson(save: SaveGameData): string {
    return `${JSON.stringify(save, null, 2)}\n`;
  }

  async encode(save: SaveGameData): Promise<Uint8Array> {
    return this.cipher.encrypt(encoder.encode(JSON.stringify(save)));
  }

  async decode(bytes: Uint8Array | null): Promise<SaveGameData | null> {
    if (!bytes || bytes.length === 0) return null;
    try {
      const plain = await this.cipher.decrypt(bytes);
      return SaveCodec.parsePlain(JSON.parse(decoder.decode(plain)));
    } catch (e) {
      this.logger.warn(`SaveCodec: save is unreadable, starting fresh. ${(e as Error).message}`);
      return null;
    }
  }
}
