/** SESSION-02/04: a replaced session pauses sync and combat; "Play here" takes it back; Quit saves then asks the shell. */
import { describe, expect, it } from 'vitest';
import { compose, type AppContext } from '../../src/app/compose';
import { defaultConfig } from '../../src/app/config';
import type { PlayerEventRecord } from '../../src/domain/PlayerEventRecord';
import { PlayerProgressReplay } from '../../src/domain/PlayerProgressReplay';
import { createNodePlatform } from '../../src/platform/node/nodePlatform';
import type { BackendApi, EventVerdict } from '../../src/services/backend/BackendApi';

/** Answers like the real backend: while `replaced` is armed, every call but a login gets the typed 401. */
class SessionBackend implements BackendApi {
  isAuthenticated = false;
  steamId64: string | null = null;
  sessionReplaced = false;
  armed = false;
  offline = false;
  logins = 0;
  batches: PlayerEventRecord[][] = [];
  async authenticateWithSteam(): Promise<boolean> {
    if (this.offline) return false;
    this.logins += 1;
    this.armed = false;
    this.sessionReplaced = false;
    this.isAuthenticated = true;
    this.steamId64 = '76561198000000001';
    return true;
  }
  async getState() {
    if (this.armed) return this.reject();
    return PlayerProgressReplay.newLedger().state;
  }
  async ingestBatch(events: readonly PlayerEventRecord[]) {
    if (this.armed) return this.reject();
    this.batches.push([...events]);
    const results: EventVerdict[] = events.map((e) => ({ clientEventId: e.clientEventId, accepted: true, rejectionReason: null }));
    return { results, state: PlayerProgressReplay.newLedger().state };
  }
  private reject(): null {
    this.isAuthenticated = false;
    this.sessionReplaced = true;
    return null;
  }
}

async function boot(): Promise<{ app: AppContext; backend: SessionBackend; platform: ReturnType<typeof createNodePlatform> }> {
  const backend = new SessionBackend();
  const platform = createNodePlatform({ seed: 5 });
  const app = compose({ ...defaultConfig('test'), backend: 'fake://session', devTicket: 'test-1' }, platform, { backend });
  await app.sync.load();
  await app.sync.connect();
  return { app, backend, platform };
}

describe('session replaced (SESSION-02)', () => {
  it('sets the flag only once a call returns the typed 401, not before', async () => {
    const { app, backend } = await boot();
    expect(app.store.get().sync.sessionReplaced).toBe(false);
    backend.offline = true;
    backend.isAuthenticated = false;
    app.combat.addGold(10);
    await app.sync.syncNow();
    expect(app.store.get().sync.sessionReplaced).toBe(false);
    backend.offline = false;
    backend.armed = true;
    backend.isAuthenticated = true;
    await app.sync.syncNow();
    expect(app.store.get().sync.sessionReplaced).toBe(true);
  });

  it('stops authenticating and flushing while replaced, but keeps saving locally', async () => {
    const { app, backend } = await boot();
    app.combat.addGold(10);
    backend.armed = true;
    await app.sync.syncNow();
    const logins = backend.logins;
    const batches = backend.batches.length;
    await app.sync.syncNow();
    await app.sync.connect();
    expect(backend.logins).toBe(logins);
    expect(backend.batches).toHaveLength(batches);
    expect(app.store.get().eventLog.pending.length).toBeGreaterThan(0);
  });

  it('TickDriver does not step while replaced and resumes after Play here', async () => {
    const { app, backend } = await boot();
    app.combat.addGold(10);
    backend.armed = true;
    await app.sync.syncNow();
    const before = app.store.get().stageCombat;
    app.tick.advance(5_000);
    expect(app.store.get().stageCombat).toEqual(before);
    await app.sync.playHere();
    expect(app.store.get().sync.sessionReplaced).toBe(false);
    app.tick.advance(5_000);
    expect(app.store.get().stageCombat).not.toEqual(before);
  });

  it('Play here logs in, clears the flag and resends the pending events', async () => {
    const { app, backend } = await boot();
    app.combat.addGold(10);
    backend.armed = true;
    await app.sync.syncNow();
    const logins = backend.logins;
    const pending = app.store.get().eventLog.pending.map((e) => e.clientEventId);
    expect(pending.length).toBeGreaterThan(0);
    await app.sync.playHere();
    expect(backend.logins).toBe(logins + 1);
    expect(app.store.get().sync.sessionReplaced).toBe(false);
    expect(backend.batches.at(-1)?.map((e) => e.clientEventId)).toEqual(pending);
    expect(app.store.get().eventLog.pending).toHaveLength(0);
  });

  it('Play here while offline keeps the flag', async () => {
    const { app, backend } = await boot();
    backend.armed = true;
    app.combat.addGold(10);
    await app.sync.syncNow();
    backend.offline = true;
    await app.sync.playHere();
    expect(app.store.get().sync.sessionReplaced).toBe(true);
  });

  it('Quit persists, then calls the lifecycle port', async () => {
    const { app, platform } = await boot();
    let writes = 0;
    const write = platform.saveStore.write.bind(platform.saveStore);
    platform.saveStore.write = async (b: Uint8Array) => {
      writes += 1;
      return write(b);
    };
    await app.sync.quitGame();
    expect(writes).toBeGreaterThan(0);
    expect(platform.lifecycle.quits).toBe(1);
  });
});
