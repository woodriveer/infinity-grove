import { ConsoleLogger, FetchHttpPort, GlobContentSource, IndexedDbSaveStore, MemorySaveStore, SteppedClock, SystemClock } from '../platform/browser/BrowserPorts';
import { ElectronSaveStore, getBridge, SteamCloudStore, SteamWebApiIdentity } from '../platform/electron/ElectronPorts';
import { WebCryptoCipher } from '../platform/shared/WebCryptoCipher';
import type { Clock, PlatformPorts } from '../services/ports';
import { LocalOnlyCloudStore } from '../services/sync/LocalOnlyCloudStore';
import type { AppConfig } from './config';

export interface PlatformChoice {
  ports: PlatformPorts;
  /** Present only with ?clock=manual (dev/test): advanced by __ig.advance. */
  manualClock: SteppedClock | null;
  electron: boolean;
}

/**
 * Picks port implementations (AD-4): the Electron bridge when running in the
 * desktop shell, the browser otherwise. Steam ports only with config.identity /
 * config.cloud = 'steam' and a bridge present.
 */
export function createPlatform(config: AppConfig, opts: { seed?: number; manualClock?: boolean; ephemeralSave?: boolean }): PlatformChoice {
  const bridge = getBridge();
  const manualClock = opts.manualClock ? new SteppedClock(Date.UTC(2026, 0, 1)) : null;
  const clock: Clock = manualClock ?? new SystemClock();
  const seed = opts.seed ?? globalThis.crypto.getRandomValues(new Uint32Array(1))[0] ?? 1;
  const saveStore = opts.ephemeralSave ? new MemorySaveStore() : bridge ? new ElectronSaveStore(bridge) : new IndexedDbSaveStore();
  return {
    ports: {
      clock,
      http: new FetchHttpPort(config.requestTimeoutMs),
      saveStore,
      cloudStore: bridge && config.cloud === 'steam' ? new SteamCloudStore(bridge) : new LocalOnlyCloudStore(),
      steamIdentity: bridge ? new SteamWebApiIdentity(bridge) : null,
      cipher: new WebCryptoCipher(),
      content: new GlobContentSource(),
      logger: new ConsoleLogger(),
      rngSeed: seed,
    },
    manualClock,
    electron: bridge !== null,
  };
}
