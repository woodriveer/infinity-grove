import type { PlayerEventRecord } from '../../domain/PlayerEventRecord';
import type { PlayerStateSnapshot } from '../../domain/PlayerStateSnapshot';

/** One event verdict from POST /api/v1/events/batch. */
export interface EventVerdict {
  readonly clientEventId: string;
  readonly accepted: boolean;
  readonly rejectionReason: string | null;
}

/**
 * The backend as the sync service sees it (Unity IBackendApiClient). Like Unity,
 * every call resolves (never throws to callers): null means unreachable or refused.
 */
export interface BackendApi {
  readonly isAuthenticated: boolean;
  readonly steamId64: string | null;
  authenticateWithSteam(ticketHex: string | null): Promise<boolean>;
  getState(): Promise<PlayerStateSnapshot | null>;
  ingestBatch(events: readonly PlayerEventRecord[]): Promise<{ results: EventVerdict[]; state: PlayerStateSnapshot } | null>;
}
