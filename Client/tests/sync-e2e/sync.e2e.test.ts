/**
 * RFR-29 / G2: the client's real services against the real backend + PostgreSQL,
 * with the fake-Steam stub behind the backend's Steam Web API seam. Drives
 * auth → actions → sync → reconciliation, including one deliberately rejected event
 * (a second device spending gold the account no longer has) and the
 * single-active-session handover (AD-006): the older device is replaced, plays here, none of its events is dropped.
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

/** Fights stage 1 (the squad's kills pay gold and the first clear emits StageCleared). */
function clearStage1(app: AppContext): void {
  for (let i = 0; i < 500 && app.store.get().furthestStageCleared < 1; i++) app.combat.step(1000);
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

    // A fights stage 1 and earns kill gold; the backend replays and agrees.
    clearStage1(a);
    a.combat.addGold(100);
    await a.sync.syncNow();
    s = a.store.get();
    expect(s.eventLog.pending).toHaveLength(0);
    expect(s.canonical.furthestStageCleared).toBe(1);
    const synced = a.store.get().gold;
    expect(synced).toBeGreaterThanOrEqual(100);

    // Device B logs into the same account and adopts the canonical state.
    const b = await device(2);
    await b.sync.connect();
    expect(b.store.get().gold).toBe(synced);

    // B's login took the session over (AD-006): A is replaced, but nothing of A is lost yet.
    // B spends nearly all (accepted).
    expect(b.combat.trySpendGold(synced - 10)).toBe(true);
    await b.sync.syncNow();
    expect(b.store.get().gold).toBe(10);
    expect(b.store.get().sync.sessionReplaced).toBe(false);

    // A, still on the old balance, farms a little and spends the same gold. Its next call carries
    // events, the backend answers 401 session-replaced, and A pauses with its events kept.
    a.combat.step(10_000);
    expect(a.combat.trySpendGold(synced - 10)).toBe(true);
    const pendingBefore = a.store.get().eventLog.pending.length;
    expect(pendingBefore).toBeGreaterThan(0);
    await a.sync.syncNow();
    expect(a.store.get().sync.sessionReplaced).toBe(true);
    expect(a.store.get().eventLog.pending).toHaveLength(pendingBefore);

    // "Play here": A logs in again, rebases its events above B's and resends them. Every event is
    // applied or rejected by game rules (the double spend); none is dropped as a stale no-op (B7).
    await a.sync.playHere();
    const sa = a.store.get();
    expect(sa.sync.sessionReplaced).toBe(false);
    expect(sa.eventLog.pending).toHaveLength(0);
    expect(sa.notices.filter((n) => n.kind === 'correction').map((n) => n.message)).toEqual([
      expect.stringMatching(/^Your gold was corrected by the server: Insufficient gold: have /),
    ]);
    expect(sa.gold).toBeGreaterThanOrEqual(10);

    // B is now the replaced device; it never silently diverges.
    b.combat.step(10_000);
    await b.sync.syncNow();
    expect(b.store.get().sync.sessionReplaced).toBe(true);
  });
});
