import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import path from 'path'
import { execSync } from 'child_process'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const srcDir = path.resolve(__dirname, 'src')

// The deploy version shown on Admin > Health. Vercel sets these during
// its build; locally we ask git, and fall back to "dev".
function gitCommit() {
  if (process.env.VERCEL_GIT_COMMIT_SHA) return process.env.VERCEL_GIT_COMMIT_SHA
  try {
    return execSync('git rev-parse HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
  } catch {
    return 'dev'
  }
}
const BUILD_INFO = {
  commit: gitCommit(),
  branch: process.env.VERCEL_GIT_COMMIT_REF || null,
  env: process.env.VERCEL_ENV || null,
  builtAt: new Date().toISOString(),
}

// https://vite.dev/config/
export default defineConfig({
  define: {
    __BUILD_INFO__: JSON.stringify(BUILD_INFO),
  },
  plugins: [
    react(),
  ],
  resolve: {
    alias: {
      // The '@/' source alias. Historically supplied by @base44/vite-plugin
      // (and then patched by a fixup plugin because it set a broken
      // absolute path); the plugin and the Base44 SDK are gone now, so
      // the alias is declared directly.
      '@/': srcDir + '/',
    },
  },
  build: {
    // dist/.vite/manifest.json maps each source page to its chunk, so
    // scripts/prerender.mjs can add a modulepreload for the page chunk to
    // each prerendered document (every page is lazy since October 2026).
    manifest: true,
    rollupOptions: {
      output: {
        // Split the three heaviest non-critical dependencies out of the
        // main index chunk. Before this, recharts + jspdf + html2canvas
        // sat at ~1.24 MB brotli inline on every landing; mobile LCP
        // took the hit even though only Dashboard and the PDF export
        // flow actually need them. Splitting pushes each into its own
        // async chunk that is fetched only when a user lands on a page
        // that imports it.
        //
        // No manualChunks. The earlier recharts/pdf split looked good on
        // paper but Rollup made every route chunk, the entry included,
        // import both vendor chunks, so anonymous visitors preloaded
        // charts and PDF code they never used. Letting Rollup split on
        // dynamic-import boundaries keeps those libraries inside the
        // routes that need them.
      },
    },
  },
});
