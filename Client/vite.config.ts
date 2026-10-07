import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import { TEST_ASSET_KEYS } from './src/generated/assets.gen';

/** The production bundle leaves out code-generated test art (hero-art-pipeline T15). */
function dropTestArt(outDir: string): Plugin {
  return {
    name: 'drop-test-art',
    apply: 'build',
    closeBundle() {
      for (const key of TEST_ASSET_KEYS) {
        for (const ext of ['png', 'json']) rmSync(join(outDir, `${key}.${ext}`), { force: true });
      }
    },
  };
}

// Three modes (AD-14): development, test, production. Dev hooks are imported
// only when MODE !== 'production' and tree-shaken otherwise.
export default defineConfig(({ mode }) => ({
  base: './',
  // Runtime assets are served from the root under their manifest paths (AD-9).
  publicDir: 'assets',
  plugins: mode === 'production' ? [dropTestArt('dist')] : [],
  build: {
    target: 'es2023',
    sourcemap: mode !== 'production',
    chunkSizeWarningLimit: 2000,
  },
  esbuild: { jsx: 'automatic', jsxImportSource: 'preact' },
  server: { port: 5173 },
}));
