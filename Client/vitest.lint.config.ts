import { defineConfig } from 'vitest/config';

// Negative fixtures: each layer/global rule must fire on a deliberately bad file (RFR-5).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/lint/**/*.test.ts'],
    testTimeout: 60000,
  },
});
