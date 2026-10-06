import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/{unit,vectors,sim}/**/*.test.ts'],
    testTimeout: 20000,
  },
});
