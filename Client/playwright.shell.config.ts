import { defineConfig } from '@playwright/test';

// Shell smoke (AD-13, AD-17): the real Electron shell, without Steam.
export default defineConfig({
  testDir: 'tests/shell',
  reporter: [['list']],
  timeout: 60_000,
  workers: 1,
});
