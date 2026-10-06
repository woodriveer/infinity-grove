/**
 * The single Steam adapter (AD-13): steamworks.js lives only here, in the main
 * process. Every call degrades to "unavailable" when Steam is not running (dev
 * builds, CI), so the game stays playable offline (RFR-30).
 *
 * Upstream steamworks.js@0.4.0 (PORT_MAP amendment A4) provides the Web API auth
 * ticket and the MicroTxnAuthorizationResponse callback. It has no
 * GameOverlayActivated callback, so onOverlayActivated never fires until the
 * project fork adds it (G0 spike, criterion 3).
 */
import type * as Steamworks from 'steamworks.js';

type SteamClient = Omit<Steamworks.Client, 'init' | 'runCallbacks'>;

/**
 * Loaded lazily: the native module may be missing or fail to load (unsupported OS,
 * stripped package), and that must leave the game running without Steam.
 */
function loadSteamworks(): typeof Steamworks {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('steamworks.js') as typeof Steamworks;
}

export interface SteamConfig {
  appId: number;
  webApiIdentity: string;
}

export class SteamAdapter {
  private client: SteamClient | null = null;
  private initError: string | null = null;

  /** Must run before app 'ready' so the overlay flags take effect (AD-13). */
  static enableOverlay(): void {
    try {
      loadSteamworks().electronEnableSteamOverlay();
    } catch {
      /* native module unavailable on this platform; overlay stays off */
    }
  }

  init(config: SteamConfig): void {
    try {
      this.client = loadSteamworks().init(config.appId);
    } catch (e) {
      this.client = null;
      this.initError = (e as Error).message;
    }
  }

  get available(): boolean {
    return this.client !== null;
  }

  get status(): string {
    return this.client ? 'steam: connected' : `steam: unavailable (${this.initError ?? 'not initialized'})`;
  }

  async getAuthTicketHex(identity: string): Promise<string | null> {
    if (!this.client) return null;
    try {
      const ticket = await this.client.auth.getAuthTicketForWebApi(identity);
      return ticket.getBytes().toString('hex').toUpperCase();
    } catch {
      return null;
    }
  }

  /** Steam Cloud stores strings in steamworks.js; the envelope bytes travel as base64. */
  cloudRead(name: string): Uint8Array | null {
    if (!this.client) return null;
    try {
      if (!this.client.cloud.isEnabledForApp() || !this.client.cloud.fileExists(name)) return null;
      return new Uint8Array(Buffer.from(this.client.cloud.readFile(name), 'base64'));
    } catch {
      return null;
    }
  }

  cloudWrite(name: string, bytes: Uint8Array): boolean {
    if (!this.client) return false;
    try {
      return this.client.cloud.isEnabledForApp() && this.client.cloud.writeFile(name, Buffer.from(bytes).toString('base64'));
    } catch {
      return false;
    }
  }

  openOverlayUrl(url: string): void {
    this.client?.overlay.activateToWebPage(url);
  }

  /** RFR-34: the authorization response reaches the client; the client never mutates MicroTxn state itself. */
  onMicroTxnAuthorization(cb: (r: { appId: number; orderId: string; authorized: boolean }) => void): void {
    if (!this.client) return;
    const steam = loadSteamworks();
    this.client.callback.register(steam.SteamCallback.MicroTxnAuthorizationResponse, (v) =>
      cb({ appId: v.app_id, orderId: String(v.order_id), authorized: v.authorized }),
    );
  }
}
