import type { IgPlatformBridge } from '../../../desktop/bridge';
import type { CloudStore, SaveStore, SteamIdentity } from '../../services/ports';

/** The preload bridge, when running inside the desktop shell (AD-13). */
export function getBridge(): IgPlatformBridge | null {
  return (globalThis as { igPlatform?: IgPlatformBridge }).igPlatform ?? null;
}

/** Save through the main process (atomic temp + fsync + rename in userData/save). */
export class ElectronSaveStore implements SaveStore {
  constructor(private readonly bridge: IgPlatformBridge) {}
  read(): Promise<Uint8Array | null> {
    return this.bridge.save.read();
  }
  async write(bytes: Uint8Array): Promise<void> {
    await this.bridge.save.write(bytes);
  }
}

/** Steam Cloud through the steamworks.js adapter in main (Unity FacepunchSteamCloudStore). */
export class SteamCloudStore implements CloudStore {
  readonly isAvailable = true;
  constructor(private readonly bridge: IgPlatformBridge) {}
  read(name: string): Promise<Uint8Array | null> {
    return this.bridge.steam.cloud.read(name);
  }
  write(name: string, bytes: Uint8Array): Promise<boolean> {
    return this.bridge.steam.cloud.write(name, bytes);
  }
}

/** Steam Web API auth ticket (Unity FacepunchSteamIdentityProvider). */
export class SteamWebApiIdentity implements SteamIdentity {
  constructor(private readonly bridge: IgPlatformBridge) {}
  getAuthTicketHex(): Promise<string | null> {
    return this.bridge.steam.getAuthTicket();
  }
}
