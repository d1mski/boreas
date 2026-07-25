import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';
import path from 'node:path';

export default defineConfig({
  base: '/experiments/settl/',
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
  test: {
    environment: 'node',
    // .tsx tests opt into jsdom per-file via `// @vitest-environment jsdom`.
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
