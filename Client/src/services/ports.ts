/**
 * Every I/O seam of the game (ARCHITECTURE AD-1/AD-4/AD-6). services/ defines them;
 * platform/{browser,electron,node} implement them; app/compose.ts wires them.
 * Domain and services never reach the clock, randomness, network, disk or Steam
 * any other way (RFR-5/RFR-7, enforced by lint).
 */

/** Injected time (RFR-7). Epoch milliseconds. */
export interface Clock {
  nowMs(): number;
}

/**
 * The network seam (AD-10). Shaped like fetch so the generated openapi-fetch client
 * can use it directly. Implementations own timeouts and reject on network failure.
 */
export interface HttpPort {
  fetch(request: Request): Promise<Response>;
}

/** Atomic local persistence of the encrypted save envelope (AD-12, NFR-2). */
export interface SaveStore {
  read(): Promise<Uint8Array | null>;
  /** Atomic: after a crash mid-write, read() still returns the previous bytes. */
  write(bytes: Uint8Array): Promise<void>;
}

/** Steam Cloud, or a local no-op (AD-20; Unity ISteamCloudStore). */
export interface CloudStore {
  readonly isAvailable: boolean;
  read(name: string): Promise<Uint8Array | null>;
  write(name: string, bytes: Uint8Array): Promise<boolean>;
}

/** Steam identity: a Web API auth ticket, hex encoded (Unity ISteamIdentityProvider). */
export interface SteamIdentity {
  getAuthTicketHex(): Promise<string | null>;
}

/** Obfuscation of the save envelope; AES-GCM with an app-embedded key (AD-12). */
export interface Cipher {
  encrypt(plain: Uint8Array): Promise<Uint8Array>;
  decrypt(data: Uint8Array): Promise<Uint8Array>;
}

/** Raw content files, e.g. { path: 'heroes/ranger.json', json } (AD-8). */
export interface ContentEntry {
  readonly path: string;
  readonly json: unknown;
}

export interface ContentSource {
  entries(): readonly ContentEntry[];
}

export interface Logger {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

/** Everything compose() needs from the platform (AD-4). */
export interface PlatformPorts {
  readonly clock: Clock;
  readonly http: HttpPort;
  readonly saveStore: SaveStore;
  readonly cloudStore: CloudStore;
  readonly steamIdentity: SteamIdentity | null;
  readonly cipher: Cipher;
  readonly content: ContentSource;
  readonly logger: Logger;
  /** Seed for the game's Rng (platform picks it at boot; tests and sim fix it). */
  readonly rngSeed: number;
}
