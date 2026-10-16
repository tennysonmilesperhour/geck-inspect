/**
 * Import an app module that uses the "@/" alias from a Node script.
 *
 * Most data the prerender needs is in dependency-free files it imports
 * directly. The genetics code is not: it imports through "@/", which only
 * Vite understands. This builds one entry with Vite's SSR build (the same
 * way scripts/build-mcp.mjs bundles the MCP tools) into
 * node_modules/.cache/geck-prerender/, then imports the result. npm
 * packages such as the genetics engine stay ordinary imports.
 *
 * Used by scripts/prerender.mjs for the calculator pairing pages, so their
 * server HTML carries the same odds the live calculator computes.
 */
import { build } from 'vite';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');
const OUT_DIR = resolve(ROOT, 'node_modules/.cache/geck-prerender');

/**
 * @param {string} entry   repo-relative path, e.g. 'src/lib/genetics/pairingPageSummary.js'
 * @param {string} outName output file name, e.g. 'pairing-summary.mjs'
 */
export async function loadAppModule(entry, outName) {
  mkdirSync(OUT_DIR, { recursive: true });
  await build({
    configFile: false,
    root: ROOT,
    logLevel: 'warn',
    publicDir: false,
    resolve: { alias: { '@': resolve(ROOT, 'src') } },
    build: {
      ssr: resolve(ROOT, entry),
      outDir: OUT_DIR,
      emptyOutDir: false,
      minify: false,
      target: 'node20',
      rollupOptions: { output: { entryFileNames: outName, format: 'es' } },
    },
  });
  // A query string defeats Node's module cache if the same file is
  // rebuilt twice in one process (tests do that).
  return import(`${pathToFileURL(resolve(OUT_DIR, outName)).href}?t=${Date.now()}`);
}
