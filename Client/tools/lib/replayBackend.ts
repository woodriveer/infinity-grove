import { PlayerProgressReplay, type ProgressLedger } from '../../src/domain/PlayerProgressReplay';
import type { PlayerEventRecord } from '../../src/domain/PlayerEventRecord';
import { PlayerStateSnapshot } from '../../src/domain/PlayerStateSnapshot';
import type { BackendApi, EventVerdict } from '../../src/services/backend/BackendApi';

export const TEST_STEAM_ID = '76561198000000001';
export const TEST_TICKET = `test-${TEST_STEAM_ID}`;

/**
 * In-process stand-in for the backend that runs the backend's own replay rules
 * (PlayerProgressReplay, proven against the event-validation vectors). Used by the
 * sim, soak and unit tests; the real backend is exercised by tests/sync-e2e (RFR-29).
 */
export class ReplayBackend implements BackendApi {
  ledger: ProgressLedger;
  isAuthenticated = false;
  steamId64: string | null = null;
  batches = 0;

  constructor(initial: PlayerStateSnapshot = PlayerStateSnapshot.empty()) {
    this.ledger = PlayerProgressReplay.newLedger(initial);
  }

  async authenticateWithSteam(ticket: string | null): Promise<boolean> {
    this.isAuthenticated = ticket === TEST_TICKET;
    this.steamId64 = this.isAuthenticated ? TEST_STEAM_ID : null;
    return this.isAuthenticated;
  }

  async getState(): Promise<PlayerStateSnapshot | null> {
    return this.isAuthenticated ? this.ledger.state : null;
  }

  async ingestBatch(events: readonly PlayerEventRecord[]): Promise<{ results: EventVerdict[]; state: PlayerStateSnapshot } | null> {
    if (!this.isAuthenticated) return null;
    this.batches += 1;
    const r = PlayerProgressReplay.ingestBatch(
      this.ledger,
      events.map((e) => ({ clientEventId: e.clientEventId, sequenceNumber: e.sequenceNumber, type: e.type, payload: JSON.parse(e.payloadJson) })),
    );
    this.ledger = r.ledger;
    return {
      results: r.results.map((v) => ({ clientEventId: v.clientEventId, accepted: v.status === 'Accepted', rejectionReason: v.rejectionReason })),
      state: this.ledger.state,
    };
  }

  /** Simulates another device changing the account (e.g. spending gold elsewhere). */
  setServerGold(mantissa: number, exponent: number): void {
    this.ledger = { ...this.ledger, state: { ...this.ledger.state, goldMantissa: mantissa, goldExponent: exponent } };
  }
}
