import { describe, expect, it } from 'vitest';
import { defaultConfig } from '../../src/app/config';

describe('app config', () => {
  it('defaults to an offline, dev-identity game outside production (RFR-30)', () => {
    const c = defaultConfig('development');
    expect(c.backend).toBe('none');
    expect(c.identity).toBe('dev');
    expect(c.devHooks).toBe(true);
    expect(defaultConfig('production').devHooks).toBe(false);
  });
});
