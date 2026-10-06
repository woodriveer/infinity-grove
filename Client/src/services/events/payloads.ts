import { z } from 'zod';
import type { PlayerEventType } from '../../domain/PlayerEventType';

/**
 * Event payload contract (AD-11). One zod schema per PlayerEventType, mirroring
 * Backend Application/Events/EventPayloads.cs. Serialization reproduces System.Text.Json
 * with the backend's web defaults byte for byte (member order = record parameter order,
 * camelCase, shortest round-trip numbers); shared/test-vectors/event-payloads.json proves it.
 */

const guid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/, 'must be a lower-case GUID');

export const payloadSchemas = {
  GoldEarned: z.object({ goldMantissa: z.number(), goldExponent: z.number().int() }).strict(),
  GoldSpent: z.object({ goldMantissa: z.number(), goldExponent: z.number().int() }).strict(),
  StageCleared: z.object({ stageNumber: z.number().int() }).strict(),
  HeroAcquired: z.object({ heroDefinitionId: guid }).strict(),
  ActiveSquadChanged: z.object({ heroDefinitionIds: z.array(guid) }).strict(),
} as const satisfies Record<PlayerEventType, z.ZodType>;

export type PayloadOf<T extends PlayerEventType> = z.infer<(typeof payloadSchemas)[T]>;

/** Member order per type, as the backend records declare them. */
const MEMBER_ORDER: Record<PlayerEventType, readonly string[]> = {
  GoldEarned: ['goldMantissa', 'goldExponent'],
  GoldSpent: ['goldMantissa', 'goldExponent'],
  StageCleared: ['stageNumber'],
  HeroAcquired: ['heroDefinitionId'],
  ActiveSquadChanged: ['heroDefinitionIds'],
};

/** Validates and serializes a payload exactly as the backend would. */
export function serializePayload<T extends PlayerEventType>(type: T, payload: PayloadOf<T>): string {
  const parsed = payloadSchemas[type].parse(payload) as Record<string, unknown>;
  const ordered: Record<string, unknown> = {};
  for (const key of MEMBER_ORDER[type]) ordered[key] = parsed[key];
  return JSON.stringify(ordered);
}

export function parsePayload<T extends PlayerEventType>(type: T, json: string): PayloadOf<T> {
  return payloadSchemas[type].parse(JSON.parse(json)) as PayloadOf<T>;
}
