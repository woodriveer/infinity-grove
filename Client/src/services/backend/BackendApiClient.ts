import createClient from 'openapi-fetch';
import type { PlayerEventRecord } from '../../domain/PlayerEventRecord';
import type { PlayerStateSnapshot } from '../../domain/PlayerStateSnapshot';
import type { components, paths } from '../../generated/api/schema';
import type { HttpPort, Logger } from '../ports';
import type { BackendApi, EventVerdict } from './BackendApi';

type StateDto = components['schemas']['PlayerStateDto'];

/**
 * REST client for /api/v1 (AD-10; Unity BackendApiClient). Built on the client
 * generated from shared/openapi/openapi.json, over the injected HttpPort. Event
 * payloads are spliced in as the raw JSON the log stored, so the backend receives
 * exactly the bytes the event-payloads vectors verify (AD-11).
 */
export class BackendApiClient implements BackendApi {
  private readonly client;
  private sessionToken: string | null = null;
  private steamId: string | null = null;

  constructor(
    baseUrl: string,
    http: HttpPort,
    private readonly logger: Logger,
  ) {
    this.client = createClient<paths>({
      baseUrl: baseUrl.replace(/\/+$/, ''),
      fetch: (request) => http.fetch(request),
      headers: { Accept: 'application/json' },
    });
  }

  get isAuthenticated(): boolean {
    return this.sessionToken !== null;
  }

  get steamId64(): string | null {
    return this.steamId;
  }

  async authenticateWithSteam(ticketHex: string | null): Promise<boolean> {
    if (!ticketHex) return false;
    const r = await this.call('auth/steam', () => this.client.POST('/api/v1/auth/steam', { body: { ticket: ticketHex } }));
    if (!r?.sessionToken) return false;
    this.sessionToken = r.sessionToken;
    this.steamId = r.steamId64 ?? null;
    return true;
  }

  async getState(): Promise<PlayerStateSnapshot | null> {
    if (!this.isAuthenticated) return null;
    const r = await this.call('players/me/state', () => this.client.GET('/api/v1/players/me/state', { headers: this.auth() }));
    return r ? toSnapshot(r) : null;
  }

  async ingestBatch(events: readonly PlayerEventRecord[]): Promise<{ results: EventVerdict[]; state: PlayerStateSnapshot } | null> {
    if (!this.isAuthenticated) return null;
    const body = `{"events":[${events.map(wireEvent).join(',')}]}`;
    const r = await this.call('events/batch', () =>
      this.client.POST('/api/v1/events/batch', {
        headers: { ...this.auth(), 'Content-Type': 'application/json' },
        body: { events: [] },
        bodySerializer: () => body,
      }),
    );
    if (!r?.state) return null;
    const results = (r.results ?? []).map((v) => ({
      clientEventId: (v.clientEventId ?? '').toLowerCase(),
      accepted: (v.status ?? '').toLowerCase() === 'accepted',
      rejectionReason: v.rejectionReason ?? null,
    }));
    return { results, state: toSnapshot(r.state) };
  }

  private auth(): Record<string, string> {
    return this.sessionToken ? { Authorization: `Bearer ${this.sessionToken}` } : {};
  }

  private async call<T>(label: string, send: () => Promise<{ data?: T; error?: unknown; response: Response }>): Promise<T | null> {
    try {
      const { data, response } = await send();
      if (!response.ok) {
        this.logger.warn(`BackendApiClient: ${label} failed with HTTP ${response.status}.`);
        if (response.status === 401) this.sessionToken = null;
        return null;
      }
      return data ?? null;
    } catch (e) {
      this.logger.warn(`BackendApiClient: ${label} threw: ${(e as Error).message}`);
      return null;
    }
  }
}

function wireEvent(e: PlayerEventRecord): string {
  const head = JSON.stringify({
    clientEventId: e.clientEventId,
    sequenceNumber: e.sequenceNumber,
    type: e.type,
    occurredAtUtc: new Date(e.occurredAtMs).toISOString(),
  });
  return `${head.slice(0, -1)},"payload":${e.payloadJson}}`;
}

export function toSnapshot(dto: StateDto): PlayerStateSnapshot {
  return {
    goldMantissa: dto.goldMantissa ?? 0,
    goldExponent: dto.goldExponent ?? 0,
    furthestStageCleared: dto.furthestStageCleared ?? 0,
    lastAppliedSequence: dto.lastAppliedSequence ?? 0,
    roster: (dto.roster ?? []).map((r) => ({
      heroDefinitionId: (r.heroDefinitionId ?? '').toLowerCase(),
      ownedCount: r.ownedCount ?? 0,
      starTier: r.starTier ?? 0,
    })),
    activeSquadHeroIds: (dto.activeSquadHeroIds ?? []).map((g) => g.toLowerCase()),
  };
}
