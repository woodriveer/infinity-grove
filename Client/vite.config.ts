import { defineConfig } from 'vite';

// Three modes (AD-14): development, test, production. Dev hooks are imported
// only when MODE !== 'production' and tree-shaken otherwise.
export default defineConfig(({ mode }) => ({
  base: './',
  build: {
    target: 'es2023',
    sourcemap: mode !== 'production',
    chunkSizeWarningLimit: 2000,
  },
  esbuild: { jsx: 'automatic', jsxImportSource: 'preact' },
  server: { port: 5173 },
}));
