import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { STALE_SEQUENCE_REASON } from '../../src/services/events/PlayerEventLog';

const REJECTIONS_CS = '../Backend/src/InfinityGrove.Backend.Application/Events/EventRejections.cs';

describe('stale sequence reason contract (SESSION-03)', () => {
  it('matches the backend EventRejections.StaleSequence constant exactly', () => {
    const source = readFileSync(REJECTIONS_CS, 'utf8');
    const match = /const string StaleSequence = "([^"]*)";/.exec(source);
    expect(match, 'StaleSequence constant not found in EventRejections.cs').not.toBeNull();
    expect(STALE_SEQUENCE_REASON).toBe(match![1]);
  });
});
