/**
 * `npm run soak [-- --hours 24 --seed 7]` (RNFR-3, AD-17): simulates long play at
 * accelerated speed through the real compose() with a reachable backend (the
 * in-process ReplayBackend) and an auto-clicker, then fails, naming the bound, if:
 *  - retained heap grew by 50 MB or more between the end of warm-up (1 simulated
 *    hour) and the end of the run (measured after forced GC: needs --expose-gc);
 *  - the unsynced event log holds more events than were produced in 2 sync intervals.
 * Prints a JSON report on stdout.
 */
import { compose } from '../src/app/compose';
import { defaultConfig } from '../src/app/config';
import { createNodePlatform } from '../src/platform/node/nodePlatform';
import { flushAsync } from './lib/simRunner';
import { ReplayBackend, TEST_TICKET } from './lib/replayBackend';

const HEAP_BOUND_BYTES = 50 * 1024 * 1024;
const FRAME_MS = 250;
const CLICK_EVERY_MS = 250;

function arg(name: string, fallback: number): number {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? Number(process.argv[i + 1]) : fallback;
}

const gc = (globalThis as { gc?: () => void }).gc;
if (!gc) {
  console.error('soak: run with --expose-gc (npm run soak does).');
  process.exit(1);
}

const hours = arg('hours', 24);
const seed = arg('seed', 7);
const backend = new ReplayBackend();
const platform = createNodePlatform({ seed });
const app = compose({ ...defaultConfig('test'), backend: 'replay://in-process', devTicket: TEST_TICKET }, platform, { backend });
app.sync.loadFrom(null);
await app.sync.connect();
app.combat.begin();

const syncIntervalMs = app.content.settings.syncIntervalSeconds * 1000;
const totalMs = hours * 3_600_000;
let produced = 0;
let lastSeq = app.store.get().eventLog.nextSequenceNumber;
let windowEvents = 0;
let maxEventsPerInterval = 0;
let sinceWindow = 0;
let sinceClick = 0;
let warmHeap = 0;
let maxPending = 0;
const started = performance.now();

for (let t = 0; t < totalMs; t += FRAME_MS) {
  platform.clock.advance(FRAME_MS);
  app.tick.advance(FRAME_MS);
  sinceClick += FRAME_MS;
  if (sinceClick >= CLICK_EVERY_MS) {
    sinceClick = 0;
    if (app.store.get().combat.state === 'Fighting') app.combat.playerAttack(app.playerCombat.calculateAttackDamage());
  }
  const next = app.store.get().eventLog.nextSequenceNumber;
  windowEvents += next - lastSeq;
  produced += next - lastSeq;
  lastSeq = next;
  sinceWindow += FRAME_MS;
  if (sinceWindow >= syncIntervalMs) {
    maxEventsPerInterval = Math.max(maxEventsPerInterval, windowEvents);
    windowEvents = 0;
    sinceWindow = 0;
    await flushAsync(); // let the interval's sync and persist complete (no wall-clock waits)
    maxPending = Math.max(maxPending, app.store.get().eventLog.pending.length);
  }
  if (t + FRAME_MS === 3_600_000) {
    gc();
    warmHeap = process.memoryUsage().heapUsed;
  }
}
await flushAsync();
gc();
const endHeap = process.memoryUsage().heapUsed;
const pending = app.store.get().eventLog.pending.length;
const s = app.store.get();

const report = {
  simulatedHours: hours,
  seed,
  wallSeconds: Math.round((performance.now() - started) / 100) / 10,
  kills: s.combat.kills,
  gold: s.gold,
  eventsProduced: produced,
  syncBatches: backend.batches,
  maxEventsPerSyncInterval: maxEventsPerInterval,
  pendingAtEnd: pending,
  maxPendingAfterSync: maxPending,
  heapAfterWarmupMB: Math.round(warmHeap / 1048576),
  heapAtEndMB: Math.round(endHeap / 1048576),
  heapGrowthMB: Math.round(((endHeap - warmHeap) / 1048576) * 10) / 10,
};
console.log(JSON.stringify(report, null, 2));

const failures: string[] = [];
if (hours >= 1 && endHeap - warmHeap >= HEAP_BOUND_BYTES) {
  failures.push(`retained heap grew ${report.heapGrowthMB} MB after warm-up (bound: < 50 MB)`);
}
if (pending > 2 * maxEventsPerInterval) {
  failures.push(`unsynced log holds ${pending} events, more than 2 sync intervals' worth (${2 * maxEventsPerInterval})`);
}
if (failures.length > 0) {
  console.error(`soak: FAILED\n${failures.map((f) => `  - ${f}`).join('\n')}`);
  process.exit(1);
}
console.error('soak: OK (RNFR-3 bounds held)');
