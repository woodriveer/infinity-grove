/** AD-11 / RFR-26: TS payload serialization is byte-identical to the backend's System.Text.Json. */
import { describe, expect, it } from 'vitest';
import type { PlayerEventType } from '../../src/domain/PlayerEventType';
import { payloadSchemas, serializePayload, type PayloadOf } from '../../src/services/events/payloads';
import { loadVectors } from './vectorFile';

describe('event-payloads (backend)', () => {
  const file = loadVectors<{ type: PlayerEventType; json: string }>('event-payloads');

  it('covers every event type the client emits', () => {
    expect(new Set(file.cases.map((c) => c.type))).toEqual(new Set(Object.keys(payloadSchemas)));
  });

  it.each(file.cases.map((c, i) => [i, c] as const))('case %i parses and re-serializes byte for byte', (_i, c) => {
    const parsed = payloadSchemas[c.type].parse(JSON.parse(c.json)) as PayloadOf<typeof c.type>;
    expect(serializePayload(c.type, parsed)).toBe(c.json);
  });
});
