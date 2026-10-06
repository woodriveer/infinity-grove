/**
 * The `window.igPlatform` bridge contract (AD-13). This list is the complete
 * allowlist: preload exposes exactly these keys and nothing else, and the shell
 * smoke test asserts it. Shared by desktop/preload (implementation) and
 * src/platform/electron (consumer).
 */
export interface IgPlatformBridge {
  steam: {
    /** Hex-encoded Web API auth ticket, or null when Steam is unavailable. */
    getAuthTicket(): Promise<string | null>;
    cloud: {
      read(name: string): Promise<Uint8Array | null>;
      write(name: string, bytes: Uint8Array): Promise<boolean>;
    };
    overlay: { openUrl(url: string): Promise<void> };
    onOverlayActivated(cb: (active: boolean) => void): () => void;
    onMicroTxnAuthorization(cb: (r: { appId: number; orderId: string; authorized: boolean }) => void): () => void;
  };
  save: {
    read(): Promise<Uint8Array | null>;
    write(bytes: Uint8Array): Promise<boolean>;
  };
  app: {
    onSuspend(cb: () => void): () => void;
    onResume(cb: () => void): () => void;
    /** cb may return a promise; the shell waits at most timeoutMs before quitting. */
    onBeforeQuit(cb: () => Promise<void> | void, timeoutMs: number): () => void;
  };
  log: { write(entry: { level: 'info' | 'warn' | 'error'; message: string }): void };
}

/** Top-level and nested keys, for the shell smoke test (AD-13 Impact). */
export const BRIDGE_ALLOWLIST = {
  steam: ['getAuthTicket', 'cloud', 'overlay', 'onOverlayActivated', 'onMicroTxnAuthorization'],
  save: ['read', 'write'],
  app: ['onSuspend', 'onResume', 'onBeforeQuit'],
  log: ['write'],
} as const;

/** IPC channel names used between preload and main. */
export const IPC = {
  steamAuthTicket: 'ig:steam:auth-ticket',
  steamCloudRead: 'ig:steam:cloud-read',
  steamCloudWrite: 'ig:steam:cloud-write',
  steamOverlayOpenUrl: 'ig:steam:overlay-open-url',
  steamOverlayActivated: 'ig:steam:overlay-activated',
  steamMicroTxn: 'ig:steam:microtxn',
  saveRead: 'ig:save:read',
  saveWrite: 'ig:save:write',
  appSuspend: 'ig:app:suspend',
  appResume: 'ig:app:resume',
  appBeforeQuit: 'ig:app:before-quit',
  appQuitReady: 'ig:app:quit-ready',
  logWrite: 'ig:log:write',
} as const;
