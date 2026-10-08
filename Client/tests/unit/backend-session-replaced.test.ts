import { describe, expect, it } from 'vitest';
import { BackendApiClient } from '../../src/services/backend/BackendApiClient';
import { NoBackend } from '../../src/services/backend/NoBackend';
import { createNodePlatform } from '../../src/platform/node/nodePlatform';

type Reply = { status: number; body: string };

/** An HttpPort that answers by path from a mutable table. */
function client(replies: Record<string, Reply>) {
  const http = {
    async fetch(request: Request): Promise<Response> {
      const reply = replies[new URL(request.url).pathname] ?? { status: 404, body: '' };
      return new Response(reply.body, { status: reply.status, headers: { 'Content-Type': 'application/json' } });
    },
  };
  return new BackendApiClient('http://backend.test', http, createNodePlatform().logger);
}

const login: Reply = { status: 200, body: JSON.stringify({ sessionToken: 'tok', steamId64: '76561198000000001' }) };
const replaced: Reply = { status: 401, body: JSON.stringify({ type: 'session-replaced', title: 'Session replaced', status: 401 }) };

describe('BackendApiClient session-replaced (SESSION-02)', () => {
  it('a typed 401 sets the flag and drops the token', async () => {
    const replies: Record<string, Reply> = { '/api/v1/auth/steam': login, '/api/v1/players/me/state': replaced };
    const api = client(replies);
    expect(await api.authenticateWithSteam('ticket')).toBe(true);
    expect(api.sessionReplaced).toBe(false);
    expect(await api.getState()).toBeNull();
    expect(api.sessionReplaced).toBe(true);
    expect(api.isAuthenticated).toBe(false);
  });

  it('a plain 401 drops the token only', async () => {
    const api = client({ '/api/v1/auth/steam': login, '/api/v1/players/me/state': { status: 401, body: '' } });
    await api.authenticateWithSteam('ticket');
    expect(await api.getState()).toBeNull();
    expect(api.sessionReplaced).toBe(false);
    expect(api.isAuthenticated).toBe(false);
  });

  it('an unparsable or other typed 401 body is treated as plain', async () => {
    for (const body of ['<html>nope</html>', JSON.stringify({ type: 'something-else' }), 'null']) {
      const api = client({ '/api/v1/auth/steam': login, '/api/v1/players/me/state': { status: 401, body } });
      await api.authenticateWithSteam('ticket');
      await api.getState();
      expect(api.sessionReplaced).toBe(false);
      expect(api.isAuthenticated).toBe(false);
    }
  });

  it('a later successful login clears the flag', async () => {
    const api = client({ '/api/v1/auth/steam': login, '/api/v1/players/me/state': replaced });
    await api.authenticateWithSteam('ticket');
    await api.getState();
    expect(api.sessionReplaced).toBe(true);
    expect(await api.authenticateWithSteam('ticket')).toBe(true);
    expect(api.sessionReplaced).toBe(false);
  });

  it('a failed login keeps the flag; no flag is set without a typed 401', async () => {
    const api = client({ '/api/v1/auth/steam': login, '/api/v1/players/me/state': replaced });
    expect(api.sessionReplaced).toBe(false);
    await api.authenticateWithSteam('ticket');
    await api.getState();
    expect(await api.authenticateWithSteam(null)).toBe(false);
    expect(api.sessionReplaced).toBe(true);
  });

  it('NoBackend never reports a replaced session', () => {
    expect(new NoBackend().sessionReplaced).toBe(false);
  });
});
