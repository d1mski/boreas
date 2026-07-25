import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';
import path from 'node:path';
import { createRequire } from 'node:module';

// The footer version was a hand-typed literal and drifted to 0.1.0 while
// package.json said 1.1.0. Injecting it here makes package.json the only
// place a release number is written.
const { version } = createRequire(import.meta.url)('./package.json') as { version: string };

export default defineConfig({
  base: '/experiments/boreas/',
  define: { __APP_VERSION__: JSON.stringify(version) },
  plugins: [
    react(),
    visualizer({
      filename: 'dist/stats.html',
      gzipSize: true,
      brotliSize: true,
    }),
  ],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  server: { port: 5173 },
  build: {
    rollupOptions: {
      output: {
        // @sentry/react's entry is index.js, so its lazy chunk was emitted as
        // another index-*.js — indistinguishable from the app entry in the
        // bundle report. Naming it keeps the dynamic import lazy.
        manualChunks: (id) => (id.includes('@sentry') ? 'sentry' : undefined),
      },
    },
  },
  test: {
    environment: 'node',
    // .tsx tests opt into jsdom per-file via `// @vitest-environment jsdom`.
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
