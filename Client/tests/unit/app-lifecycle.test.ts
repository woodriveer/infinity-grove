import { afterEach, expect, test, vi } from 'vitest';
import type { IgPlatformBridge } from '../../desktop/bridge';
import { BrowserLifecycle } from '../../src/platform/browser/BrowserPorts';
import { ElectronLifecycle } from '../../src/platform/electron/ElectronPorts';

afterEach(() => vi.unstubAllGlobals());

test('ElectronLifecycle.quit asks the shell through the bridge', () => {
  const quit = vi.fn();
  new ElectronLifecycle({ app: { quit } } as unknown as IgPlatformBridge).quit();
  expect(quit).toHaveBeenCalledTimes(1);
});

test('BrowserLifecycle.quit closes the window', () => {
  const close = vi.fn();
  vi.stubGlobal('window', { close });
  new BrowserLifecycle().quit();
  expect(close).toHaveBeenCalledTimes(1);
});
