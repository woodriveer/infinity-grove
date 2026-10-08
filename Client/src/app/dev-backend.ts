/**
 * Dev/test-only in-memory backend (SESSION-02 test seam). Logs in and accepts events
 * through the real replay rules; `replace()` makes every call but a login answer like a
 * 401 `session-replaced` until the next login (the "Play here" path). Boot URL: `&backend=fake`.
 */
import { PlayerProgressReplay, type ProgressLedger } from '../domain/PlayerProgressReplay';
import type { PlayerEventRecord } from '../domain/PlayerEventRecord';
import type { BackendApi, EventVerdict } from '../services/backend/BackendApi';

export class ReplaceableBackend implements BackendApi {
  isAuthenticated = false;
  steamId64: string | null = null;
  sessionReplaced = false;
  private replaced = false;
  private ledger: ProgressLedger = PlayerProgressReplay.newLedger();

  /** Another device "logged in": the next call that carries the token gets the typed 401. */
  replace(): void {
    this.replaced = true;
  }

  async authenticateWithSteam(): Promise<boolean> {
    this.replaced = false;
    this.sessionReplaced = false;
    this.isAuthenticated = true;
    this.steamId64 = '76561198000000001';
    return true;
  }

  async getState() {
    return this.replaced ? this.reject() : this.ledger.state;
  }

  async ingestBatch(events: readonly PlayerEventRecord[]) {
    if (this.replaced) return this.reject();
    const out = PlayerProgressReplay.ingestBatch(
      this.ledger,
      events.map((e) => ({ clientEventId: e.clientEventId, sequenceNumber: e.sequenceNumber, type: e.type, payload: JSON.parse(e.payloadJson) })),
    );
    this.ledger = out.ledger;
    const results: EventVerdict[] = out.results.map((r) => ({
      clientEventId: r.clientEventId,
      accepted: r.status === 'Accepted',
      rejectionReason: r.rejectionReason,
    }));
    return { results, state: this.ledger.state };
  }

  private reject(): null {
    this.isAuthenticated = false;
    this.sessionReplaced = true;
    return null;
  }
}
