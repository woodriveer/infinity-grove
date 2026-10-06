import type { SaveGameData } from '../../domain/SaveGameData';
import type { CloudStore, Logger } from '../ports';
import type { SaveCodec } from '../save/SaveCodec';

export const CLOUD_FILE = 'save.bin';

export type CloudResolution = 'local' | 'cloud' | 'none';

/**
 * Steam Cloud ordering (AD-20, RFR-33). On boot the cloud copy is compared with
 * the local save by lastReconciledAtMs; a local save holding unsynced events is
 * never replaced. Writes happen after every successful sync and on quit.
 */
export class SteamCloudSync {
  constructor(
    private readonly cloud: CloudStore,
    private readonly codec: SaveCodec,
    private readonly logger: Logger,
  ) {}

  static resolve(local: SaveGameData | null, cloud: SaveGameData | null): CloudResolution {
    if (!local) return cloud ? 'cloud' : 'none';
    if (!cloud) return 'local';
    if (cloud.lastReconciledAtMs > local.lastReconciledAtMs && local.unsyncedEvents.length === 0) return 'cloud';
    return 'local';
  }

  /** Returns the save to boot from, given the local one. */
  async chooseOnBoot(local: SaveGameData | null): Promise<{ save: SaveGameData | null; source: CloudResolution }> {
    if (!this.cloud.isAvailable) return { save: local, source: local ? 'local' : 'none' };
    let cloud: SaveGameData | null = null;
    try {
      cloud = await this.codec.decode(await this.cloud.read(CLOUD_FILE));
    } catch (e) {
      this.logger.warn(`SteamCloudSync: cloud read failed, keeping local. ${(e as Error).message}`);
    }
    const source = SteamCloudSync.resolve(local, cloud);
    return { save: source === 'cloud' ? cloud : local, source };
  }

  async write(bytes: Uint8Array): Promise<void> {
    if (!this.cloud.isAvailable) return;
    const ok = await this.cloud.write(CLOUD_FILE, bytes).catch(() => false);
    if (!ok) this.logger.warn('SteamCloudSync: cloud write failed; the local save is still current.');
  }
}
