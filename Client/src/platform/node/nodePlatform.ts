import { resolve } from 'node:path';
import type { CloudStore, HttpPort, PlatformPorts, SaveStore } from '../../services/ports';
import { LocalOnlyCloudStore } from '../../services/sync/LocalOnlyCloudStore';
import { WebCryptoCipher } from '../shared/WebCryptoCipher';
import { FsContentSource, ManualClock, MemoryLogger, MemorySaveStore, NodeHttpPort } from './NodePorts';

export interface NodePlatformOptions {
  seed?: number;
  /** Epoch ms the manual clock starts at. Default: 2026-01-01T00:00:00Z. */
  nowMs?: number;
  contentRoot?: string;
  saveStore?: SaveStore;
  cloudStore?: CloudStore;
  http?: HttpPort;
  echoLogs?: boolean;
}

export const DEFAULT_EPOCH_MS = Date.UTC(2026, 0, 1);

/** PlatformPorts for Vitest, the sim and soak: manual clock, fixed seed, disk content (AD-17). */
export function createNodePlatform(options: NodePlatformOptions = {}): PlatformPorts & { clock: ManualClock; logger: MemoryLogger } {
  return {
    clock: new ManualClock(options.nowMs ?? DEFAULT_EPOCH_MS),
    http: options.http ?? new NodeHttpPort(10_000),
    saveStore: options.saveStore ?? new MemorySaveStore(),
    cloudStore: options.cloudStore ?? new LocalOnlyCloudStore(),
    steamIdentity: null,
    cipher: new WebCryptoCipher(),
    content: new FsContentSource(options.contentRoot ?? resolve(import.meta.dirname, '../../../content')),
    logger: new MemoryLogger(options.echoLogs ?? false),
    rngSeed: options.seed ?? 42,
  };
}
