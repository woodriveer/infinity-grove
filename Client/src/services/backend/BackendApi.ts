import type { AffixType } from '../../domain/AffixType';
import type { PlayerEventRecord } from '../../domain/PlayerEventRecord';
import type { PlayerStateSnapshot } from '../../domain/PlayerStateSnapshot';

/** One event verdict from POST /api/v1/events/batch. */
export interface EventVerdict {
  readonly clientEventId: string;
  readonly accepted: boolean;
  readonly rejectionReason: string | null;
  readonly grants?: readonly RewardGrant[];
}

/** One drop the backend decided (boss-drops DROP-05); the client only displays and stores it. */
export interface RewardGrant {
  readonly grantId: string;
  readonly kind: 'Hero' | 'Item';
  readonly sourceClientEventId: string;
  readonly heroDefinitionId?: string;
  readonly isNewHero?: boolean;
  readonly itemId?: string;
  readonly affixRolls?: Readonly<Partial<Record<AffixType, number>>>;
}

/**
 * The backend as the sync service sees it (Unity IBackendApiClient). Like Unity,
 * every call resolves (never throws to callers): null means unreachable or refused.
 */
export interface BackendApi {
  readonly isAuthenticated: boolean;
  readonly steamId64: string | null;
  /** True after a 401 `session-replaced` (the account signed in elsewhere); a successful login clears it. */
  readonly sessionReplaced: boolean;
  authenticateWithSteam(ticketHex: string | null): Promise<boolean>;
  getState(): Promise<PlayerStateSnapshot | null>;
  ingestBatch(events: readonly PlayerEventRecord[]): Promise<{ results: EventVerdict[]; state: PlayerStateSnapshot } | null>;
}
