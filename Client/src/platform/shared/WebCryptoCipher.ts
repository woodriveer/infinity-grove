import type { Cipher } from '../../services/ports';

/**
 * AES-256-GCM with an app-embedded key (AD-12). Obfuscation, not a security
 * boundary (parent AD-9): the backend is the authority. The key is derived with
 * PBKDF2 like the Unity EncryptedSaveFileStore did, so it is not tied to the OS
 * user and Steam Cloud restores work across devices. Layout: [12-byte IV][ciphertext+tag].
 */
const PASSPHRASE = 'InfinityGrove.LocalSaveCache.v2';
const SALT = 'IG-SaveSalt-2026';
const ITERATIONS = 10_000;

export class WebCryptoCipher implements Cipher {
  private key: Promise<CryptoKey> | null = null;

  constructor(private readonly subtle: SubtleCrypto = globalThis.crypto.subtle) {}

  private getKey(): Promise<CryptoKey> {
    this.key ??= (async () => {
      const enc = new TextEncoder();
      const base = await this.subtle.importKey('raw', enc.encode(PASSPHRASE), 'PBKDF2', false, ['deriveKey']);
      return this.subtle.deriveKey(
        { name: 'PBKDF2', salt: enc.encode(SALT), iterations: ITERATIONS, hash: 'SHA-256' },
        base,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt'],
      );
    })();
    return this.key;
  }

  async encrypt(plain: Uint8Array): Promise<Uint8Array> {
    const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
    const cipher = new Uint8Array(await this.subtle.encrypt({ name: 'AES-GCM', iv }, await this.getKey(), new Uint8Array(plain)));
    const out = new Uint8Array(iv.length + cipher.length);
    out.set(iv, 0);
    out.set(cipher, iv.length);
    return out;
  }

  async decrypt(data: Uint8Array): Promise<Uint8Array> {
    const iv = data.slice(0, 12);
    return new Uint8Array(await this.subtle.decrypt({ name: 'AES-GCM', iv }, await this.getKey(), data.slice(12)));
  }
}
