/**
 * RFR-29 / G2: the client's real services against the real backend + PostgreSQL,
 * with the fake-Steam stub behind the backend's Steam Web API seam. Drives
 * auth → actions → sync → reconciliation, including one deliberately rejected event
 * (a second device spending gold the account no longer has).
 *
 * Needs a running backend: IG_SYNC_E2E_BACKEND=http://localhost:8080 npm run test:sync-e2e
 */
import { describe, expect, it } from 'vitest';
import { compose, type AppContext } from '../../src/app/compose';
import { defaultConfig } from '../../src/app/config';
import { createNodePlatform } from '../../src/platform/node/nodePlatform';
import { NodeHttpPort } from '../../src/platform/node/NodePorts';

const BACKEND = process.env['IG_SYNC_E2E_BACKEND'];
const STEAM_ID = `7656119${String(Date.now() % 1e10).padStart(10, '0')}`;

async function waitForBackend(url: string): Promise<void> {
  for (let i = 0; i < 90; i++) {
    try {
      if ((await fetch(`${url}/health`)).ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Backend at ${url} did not become healthy in 90 s.`);
}

async function device(seed: number): Promise<AppContext> {
  const platform = createNodePlatform({ seed, http: new NodeHttpPort(10_000), nowMs: Date.UTC(2026, 5, 1) });
  const app = compose({ ...defaultConfig('test'), backend: BACKEND as string, devTicket: `test-${STEAM_ID}` }, platform);
  await app.sync.load();
  return app;
}

describe.skipIf(!BACKEND)('sync end-to-end against the real backend (RFR-29)', () => {
  it('authenticates, syncs, reconciles and surfaces a rejected event', { timeout: 180_000 }, async () => {
    await waitForBackend(BACKEND as string);

    // Device A: new game → auth → its starter-hero events are accepted.
    const a = await device(1);
    await a.sync.connect();
    let s = a.store.get();
    expect(s.sync.authenticated).toBe(true);
    expect(s.steamId64).toBe(STEAM_ID);
    expect(s.eventLog.pending).toHaveLength(0);
    expect(s.canonical.roster).toHaveLength(1);
    expect(s.canonical.activeSquadHeroIds).toHaveLength(1);

    // A earns 40 gold and stage 1; the backend replays and agrees.
    a.combat.addGold(40);
    expect(a.stages.attemptStage('mossy-hollow')).toBe('Success');
    await a.sync.syncNow();
    s = a.store.get();
    expect(s.eventLog.pending).toHaveLength(0);
    expect([s.canonical.goldMantissa, s.canonical.goldExponent]).toEqual([4, 1]);
    expect(s.canonical.furthestStageCleared).toBe(1);

    // Device B logs into the same account and adopts the canonical state.
    const b = await device(2);
    await b.sync.connect();
    expect(b.store.get().gold).toBe(40);

    // B spends 30 (accepted: 40 → 10). A is now stale and still shows 40.
    expect(b.combat.trySpendGold(30)).toBe(true);
    await b.sync.syncNow();
    expect(b.store.get().canonical.goldExponent).toBe(1);

    // Both devices number events from the same server cursor, so A's next event
    // reuses B's sequence number and the backend accepts it as a stale no-op
    // (PORT_MAP B7). A replays stage 1 first, so its spend gets a fresh sequence
    // number and is actually validated — and rejected.
    expect(a.stages.attemptStage('mossy-hollow')).toBe('Success');
    expect(a.combat.trySpendGold(30)).toBe(true);
    await a.sync.syncNow();
    const sa = a.store.get();
    expect(sa.notices.filter((n) => n.kind === 'correction').map((n) => n.message)).toEqual([
      'Your gold was corrected by the server: Insufficient gold: have 10.00, need 30.00.',
    ]);
    expect(sa.gold).toBe(10);
    expect(sa.eventLog.pending).toHaveLength(0);
  });
});
