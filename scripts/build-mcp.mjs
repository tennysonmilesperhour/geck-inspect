#!/usr/bin/env node
/**
 * Bundle scripts/mcp/core.js into api/_lib/mcp-core.js for the MCP
 * function (api/mcp.js).
 *
 * Why a bundle: the genetics code imports through the app's "@/" alias,
 * which only Vite understands. Vercel's function builder does not, so we
 * resolve it here with Vite's own SSR build. npm packages (the genetics
 * engine, zod) stay as imports and Vercel traces them as usual.
 *
 * The output is committed so the function deploys even if Vercel builds
 * functions before running `pnpm build`; the build regenerates it.
 */
import { build } from 'vite';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');

await build({
  configFile: false,
  root: ROOT,
  logLevel: 'warn',
  publicDir: false,
  resolve: { alias: { '@': resolve(ROOT, 'src') } },
  build: {
    ssr: resolve(ROOT, 'scripts/mcp/core.js'),
    outDir: resolve(ROOT, 'api/_lib'),
    emptyOutDir: false,
    minify: false,
    target: 'node20',
    rollupOptions: { output: { entryFileNames: 'mcp-core.js', format: 'es' } },
  },
});
console.log('[build-mcp] wrote api/_lib/mcp-core.js');
