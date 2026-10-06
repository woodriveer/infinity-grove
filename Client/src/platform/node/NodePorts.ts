import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readdirSync, readFileSync, renameSync, statSync, writeSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import type { Clock, ContentEntry, ContentSource, HttpPort, Logger, SaveStore } from '../../services/ports';

/** Reads Client/content/** from disk (sim, soak, validate:content, Vitest). AD-8. */
export class FsContentSource implements ContentSource {
  constructor(private readonly root: string) {}

  entries(): ContentEntry[] {
    const walk = (dir: string): string[] =>
      readdirSync(dir)
        .sort()
        .flatMap((name) => {
          const p = join(dir, name);
          return statSync(p).isDirectory() ? walk(p) : p.endsWith('.json') ? [p] : [];
        });
    return walk(this.root).map((file) => {
      const path = relative(this.root, file).split('\\').join('/');
      let json: unknown;
      try {
        json = JSON.parse(readFileSync(file, 'utf8'));
      } catch (e) {
        json = { __parseError: `${path}: invalid JSON: ${(e as Error).message}` };
      }
      return { path, json };
    });
  }
}

/**
 * Atomic file save (AD-12, NFR-2): temp file → fsync → rename. `faultBeforeRename`
 * lets tests kill the write mid-way and prove the previous save stays loadable.
 */
export class FsSaveStore implements SaveStore {
  faultBeforeRename: (() => void) | null = null;

  constructor(private readonly file: string) {}

  async read(): Promise<Uint8Array | null> {
    return existsSync(this.file) ? new Uint8Array(readFileSync(this.file)) : null;
  }

  async write(bytes: Uint8Array): Promise<void> {
    mkdirSync(dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    const fd = openSync(tmp, 'w');
    try {
      writeSync(fd, bytes);
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    this.faultBeforeRename?.();
    renameSync(tmp, this.file);
  }
}

/** In-memory SaveStore for tests and the sim. */
export class MemorySaveStore implements SaveStore {
  bytes: Uint8Array | null = null;
  async read(): Promise<Uint8Array | null> {
    return this.bytes;
  }
  async write(bytes: Uint8Array): Promise<void> {
    this.bytes = bytes;
  }
}

/** A clock that only moves when told to (RNFR-1). */
export class ManualClock implements Clock {
  constructor(private now: number) {}
  nowMs(): number {
    return this.now;
  }
  advance(ms: number): void {
    this.now += ms;
  }
  set(ms: number): void {
    this.now = ms;
  }
}

/** fetch with a timeout (Node 18+). Only platform code touches fetch. */
export class NodeHttpPort implements HttpPort {
  constructor(private readonly timeoutMs: number) {}
  fetch(request: Request): Promise<Response> {
    return fetch(request, { signal: AbortSignal.timeout(this.timeoutMs) });
  }
}

/** Collects log lines (sim output) and optionally echoes them to stderr. */
export class MemoryLogger implements Logger {
  readonly lines: string[] = [];
  constructor(private readonly echo = false) {}
  info(m: string): void {
    this.push('info', m);
  }
  warn(m: string): void {
    this.push('warn', m);
  }
  error(m: string): void {
    this.push('error', m);
  }
  private push(level: string, m: string): void {
    this.lines.push(`${level}: ${m}`);
    if (this.echo) process.stderr.write(`${level}: ${m}\n`);
  }
}
