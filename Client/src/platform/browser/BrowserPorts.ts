import type { Clock, ContentEntry, ContentSource, HttpPort, Logger, SaveStore } from '../../services/ports';

/** Content bundled by Vite (AD-8). The only place import.meta.glob appears. */
export class GlobContentSource implements ContentSource {
  entries(): ContentEntry[] {
    const modules = import.meta.glob('/content/**/*.json', { eager: true, import: 'default' });
    return Object.entries(modules)
      .map(([path, json]) => ({ path: path.replace(/^\/content\//, ''), json }))
      .sort((a, b) => a.path.localeCompare(b.path));
  }
}

export class SystemClock implements Clock {
  nowMs(): number {
    return Date.now();
  }
}

/** A clock the dev hooks drive (?clock=manual), so e2e tests never wait on wall time. */
export class SteppedClock implements Clock {
  constructor(private now: number) {}
  nowMs(): number {
    return this.now;
  }
  advance(ms: number): void {
    this.now += ms;
  }
}

export class FetchHttpPort implements HttpPort {
  constructor(private readonly timeoutMs: number) {}
  fetch(request: Request): Promise<Response> {
    return fetch(request, { signal: AbortSignal.timeout(this.timeoutMs) });
  }
}

export class ConsoleLogger implements Logger {
  info(m: string): void {
    console.info(m);
  }
  warn(m: string): void {
    console.warn(m);
  }
  error(m: string): void {
    console.error(m);
  }
}

/** Browser/dev save: one IndexedDB record holding the same encrypted envelope (AD-12). */
export class IndexedDbSaveStore implements SaveStore {
  constructor(private readonly dbName = 'infinity-grove', private readonly key = 'save') {}

  private open(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(this.dbName, 1);
      req.onupgradeneeded = () => req.result.createObjectStore('saves');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async read(): Promise<Uint8Array | null> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const req = db.transaction('saves', 'readonly').objectStore('saves').get(this.key);
      req.onsuccess = () => resolve(req.result ? new Uint8Array(req.result as ArrayBuffer) : null);
      req.onerror = () => reject(req.error);
    });
  }

  /** A single put is atomic within its IndexedDB transaction. */
  async write(bytes: Uint8Array): Promise<void> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('saves', 'readwrite');
      tx.objectStore('saves').put(bytes.slice().buffer, this.key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}

/** Throwaway SaveStore (e2e with a fixture: nothing leaks between tests). */
export class MemorySaveStore implements SaveStore {
  private bytes: Uint8Array | null = null;
  async read(): Promise<Uint8Array | null> {
    return this.bytes;
  }
  async write(bytes: Uint8Array): Promise<void> {
    this.bytes = bytes;
  }
}
