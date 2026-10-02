// Builds the Market Analytics design demo as one self-contained HTML file
// (see scripts/build-analytics-demo.mjs). It renders the real v2
// components from src/, so what the demo shows is what the tab ships.
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.resolve(here, '../../src');

export default defineConfig({
  root: here,
  base: './',
  plugins: [react()],
  resolve: {
    alias: [
      { find: '@/lib/supabaseClient', replacement: path.resolve(here, 'supabaseStub.js') },
      { find: '@/', replacement: srcDir + '/' },
    ],
  },
  build: {
    outDir: path.resolve(here, 'dist'),
    emptyOutDir: true,
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
});
