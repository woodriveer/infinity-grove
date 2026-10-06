import { defineConfig } from 'vitest/config';

// RFR-29: needs a running backend (IG_SYNC_E2E_BACKEND); not part of `npm test`.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/sync-e2e/**/*.test.ts'],
    testTimeout: 180000,
  },
});
