/**
 * Build-time application config (AD-4, AD-14). Selects port implementations;
 * swapping dev vs. real Steam or backend vs. none is a change here only.
 */
export interface AppConfig {
  identity: 'dev' | 'steam';
  /** Ticket the dev identity hands to the backend (fake-Steam stub in CI); null = no auth. */
  devTicket: string | null;
  cloud: 'local' | 'steam';
  /** Backend base URL ending in `/api/v1/`, or 'none' for the NoBackend stub (RFR-30). */
  backend: string | 'none';
  effects: 'on' | 'off';
  devHooks: boolean;
  syncIntervalMs: number;
  requestTimeoutMs: number;
}

export function defaultConfig(mode: string, env: Record<string, string | undefined> = {}): AppConfig {
  const isProd = mode === 'production';
  return {
    identity: env['VITE_IG_IDENTITY'] === 'steam' ? 'steam' : 'dev',
    devTicket: env['VITE_IG_DEV_TICKET'] ?? null,
    cloud: env['VITE_IG_CLOUD'] === 'steam' ? 'steam' : 'local',
    backend: env['VITE_IG_BACKEND'] ?? 'none',
    effects: mode === 'test' ? 'off' : 'on',
    devHooks: !isProd,
    syncIntervalMs: 60_000,
    requestTimeoutMs: 10_000,
  };
}
