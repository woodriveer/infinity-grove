import type { PlayerEventType } from './PlayerEventType';

/**
 * Surfaced to the player exactly when the backend rejects one of their
 * locally-applied actions (AD-6). Everything else about reconciliation is silent.
 */
export interface ReconciliationCorrection {
  readonly eventType: PlayerEventType;
  readonly reason: string;
  readonly occurredAtMs: number;
}

export function toPlayerMessage(c: ReconciliationCorrection): string {
  switch (c.eventType) {
    case 'GoldEarned':
    case 'GoldSpent':
      return `Your gold was corrected by the server: ${c.reason}`;
    case 'StageCleared':
      return `Your stage progress was corrected by the server: ${c.reason}`;
    case 'HeroAcquired':
      return `A hero acquisition was rejected by the server: ${c.reason}`;
    case 'ActiveSquadChanged':
      return `Your Active Squad was corrected by the server: ${c.reason}`;
    default:
      return `An action was corrected by the server: ${c.reason}`;
  }
}
