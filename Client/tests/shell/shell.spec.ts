/**
 * Desktop shell smoke (AD-13 Impact, RNFR-9): the sandboxed renderer sees exactly
 * the igPlatform allowlist and no Node. Also records idle RAM/CPU for the G0 report
 * (RFR-31 criterion 6) into artifacts/shell-metrics.json.
 */
import { _electron as electron, expect, test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { BRIDGE_ALLOWLIST } from '../../desktop/bridge';

test('the renderer is sandboxed and the bridge is exactly the allowlist', async () => {
  const app = await electron.launch({ args: ['.'], env: { ...process.env, ELECTRON_ENABLE_LOGGING: '0' } });
  try {
    const page = await app.firstWindow();
    await page.waitForLoadState('domcontentloaded');

    const shape = await page.evaluate(() => {
      const bridge = (window as unknown as { igPlatform: Record<string, Record<string, unknown>> }).igPlatform;
      return {
        top: Object.keys(bridge).sort(),
        nested: Object.fromEntries(Object.entries(bridge).map(([k, v]) => [k, Object.keys(v).sort()])),
        cloud: Object.keys((bridge['steam'] as Record<string, Record<string, unknown>>)['cloud'] ?? {}).sort(),
        overlay: Object.keys((bridge['steam'] as Record<string, Record<string, unknown>>)['overlay'] ?? {}).sort(),
        hasRequire: typeof (window as unknown as { require?: unknown }).require !== 'undefined',
        hasProcess: typeof (window as unknown as { process?: unknown }).process !== 'undefined',
        protocol: location.protocol,
      };
    });

    expect(shape.top).toEqual(Object.keys(BRIDGE_ALLOWLIST).sort());
    for (const [key, members] of Object.entries(BRIDGE_ALLOWLIST)) expect(shape.nested[key]).toEqual([...members].sort());
    expect(shape.cloud).toEqual(['read', 'write']);
    expect(shape.overlay).toEqual(['openUrl']);
    expect(shape.hasRequire).toBe(false);
    expect(shape.hasProcess).toBe(false);
    expect(shape.protocol).toBe('app:');

    // Save round trip through main's atomic writer.
    const roundTrip = await page.evaluate(async () => {
      const b = (window as unknown as { igPlatform: { save: { write(x: Uint8Array): Promise<boolean>; read(): Promise<Uint8Array | null> } } }).igPlatform;
      const before = await b.save.read();
      await b.save.write(new Uint8Array([1, 2, 3]));
      const after = await b.save.read();
      if (before) await b.save.write(before);
      return after ? Array.from(after) : null;
    });
    expect(roundTrip).toEqual([1, 2, 3]);

    // Idle footprint after 5 s (G0 criterion 6; recorded, not gated).
    await page.waitForTimeout(5000);
    const metrics = await app.evaluate(({ app: a }) =>
      a.getAppMetrics().map((m) => ({ type: m.type, cpuPercent: m.cpu.percentCPUUsage, workingSetMB: Math.round(m.memory.workingSetSize / 1024) })),
    );
    mkdirSync('artifacts', { recursive: true });
    writeFileSync('artifacts/shell-metrics.json', `${JSON.stringify({ platform: process.platform, metrics }, null, 2)}\n`);
  } finally {
    await app.close();
  }
});
