import type { BackendApi } from './BackendApi';

/** Offline/dev stub (RFR-30, AD-4): never authenticates, so events stay queued locally. */
export class NoBackend implements BackendApi {
  readonly isAuthenticated = false;
  readonly steamId64 = null;

  async authenticateWithSteam(): Promise<boolean> {
    return false;
  }

  async getState(): Promise<null> {
    return null;
  }

  async ingestBatch(): Promise<null> {
    return null;
  }
}
