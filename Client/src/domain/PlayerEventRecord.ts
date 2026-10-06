import type { PlayerEventSyncStatus } from './PlayerEventSyncStatus';
import type { PlayerEventType } from './PlayerEventType';

/**
 * One entry in the append-only local event log (AD-6). The payload travels
 * pre-serialized as JSON text, byte-identical to what the backend would produce
 * for the same record (AD-11).
 */
export interface PlayerEventRecord {
  readonly clientEventId: string;
  readonly sequenceNumber: number;
  readonly type: PlayerEventType;
  readonly occurredAtMs: number;
  readonly payloadJson: string;
  readonly syncStatus: PlayerEventSyncStatus;
  readonly rejectionReason: string | null;
}
