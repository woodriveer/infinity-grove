/** SESSION-02 test seam: the dev double answers the typed 401 once armed and recovers after "Play here". */
import { describe, expect, it } from 'vitest';
import { compose } from '../../src/app/compose';
import { defaultConfig } from '../../src/app/config';
import { ReplaceableBackend } from '../../src/app/dev-backend';
import { createNodePlatform } from '../../src/platform/node/nodePlatform';

async function boot() {
  const backend = new ReplaceableBackend();
  const app = compose({ ...defaultConfig('test'), backend: 'fake://dev', devTicket: 'test-1' }, createNodePlatform({ seed: 5 }), { backend });
  await app.sync.load();
  await app.sync.connect();
  return { app, backend };
}

describe('ReplaceableBackend', () => {
  it('accepts events until armed', async () => {
    const { app, backend } = await boot();
    app.combat.addGold(10);
    await app.sync.syncNow();
    expect(backend.sessionReplaced).toBe(false);
    expect(app.store.get().eventLog.pending).toHaveLength(0);
    expect(app.store.get().sync.sessionReplaced).toBe(false);
  });

  it('answers the typed 401 on the next sync once armed, and recovers after playHere', async () => {
    const { app, backend } = await boot();
    backend.replace();
    app.combat.addGold(10);
    await app.sync.syncNow();
    expect(app.store.get().sync.sessionReplaced).toBe(true);
    expect(app.store.get().eventLog.pending.length).toBeGreaterThan(0);
    await app.sync.playHere();
    expect(app.store.get().sync.sessionReplaced).toBe(false);
    expect(app.store.get().eventLog.pending).toHaveLength(0);
  });
});
