import type { PlayerEventRecord } from '../../domain/PlayerEventRecord';
import type { PlayerEventSyncStatus } from '../../domain/PlayerEventSyncStatus';
import type { PlayerEventType } from '../../domain/PlayerEventType';
import type { EventLogState } from '../state/types';
import { serializePayload, type PayloadOf } from './payloads';

/**
 * Append-only local event log (Unity PlayerEventLog, AD-6). Pure functions over
 * EventLogState; services call append() inside the command that changed state (AD-5).
 */
export const PlayerEventLog = {
  empty(): EventLogState {
    return { pending: [], nextSequenceNumber: 1 };
  },

  /** Raises the next sequence number, never lowers it. */
  seedSequence(log: EventLogState, nextSequenceNumber: number): EventLogState {
    return nextSequenceNumber > log.nextSequenceNumber ? { ...log, nextSequenceNumber } : log;
  },

  loadPending(log: EventLogState, pending: readonly PlayerEventRecord[]): EventLogState {
    let next: EventLogState = { ...log, pending: [...pending] };
    for (const record of pending) next = PlayerEventLog.seedSequence(next, record.sequenceNumber + 1);
    return next;
  },

  append<T extends PlayerEventType>(
    log: EventLogState,
    type: T,
    payload: PayloadOf<T>,
    clientEventId: string,
    nowMs: number,
  ): { log: EventLogState; record: PlayerEventRecord } {
    const record: PlayerEventRecord = {
      clientEventId,
      sequenceNumber: log.nextSequenceNumber,
      type,
      occurredAtMs: nowMs,
      payloadJson: serializePayload(type, payload),
      syncStatus: 'Pending',
      rejectionReason: null,
    };
    return { log: { pending: [...log.pending, record], nextSequenceNumber: log.nextSequenceNumber + 1 }, record };
  },

  /** Records the backend's verdict: the event leaves the pending list either way. */
  applyResult(log: EventLogState, clientEventId: string, _status: PlayerEventSyncStatus): EventLogState {
    const id = clientEventId.toLowerCase();
    if (!log.pending.some((e) => e.clientEventId === id)) return log;
    return { ...log, pending: log.pending.filter((e) => e.clientEventId !== id) };
  },
} as const;
