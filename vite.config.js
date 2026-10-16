import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import path from 'path'
import { execSync } from 'child_process'
import { fileURLToPath } from 'url'
import directBarrelImports from './scripts/vite-plugins/direct-barrel-imports.mjs'

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

// Why a deploy used to invalidate almost every file: each file's name
// carries a hash of its contents, and the contents include the names of
// the files it imports. The main script holds the route map (every
// page's hashed file name) and also the shared code (React, the router,
// the sign-in state) that every page imports. So changing one word on
// one page renamed that page, which changed the route map, which renamed
// the main script, which renamed every page that imports shared code
// from it: 409 of 473 scripts after a one-word change to the privacy
// policy, all downloaded again by returning members.
//
// stableChunks() moves the shared code the main script loads anyway into
// two files of its own, "vendor" (libraries) and "core" (our shared
// modules), and leaves only the route map (main.jsx, App.jsx,
// pages.config.js) in the main script. Pages import vendor and core, not
// the main script, so a page edit renames that page and the main script
// only: measured, 4 of 419 scripts (the page, the main script, the
// signed-out fallback that reads the page list, and the admin page,
// which carries the build time). Only modules the main script already
// loads up front are moved, so no page downloads anything it did not
// before (the trap that sank an earlier vendor split, which pulled chart
// and PDF code into every page). A change to a shared module still
// renames core and the pages that use it; that is rarer than page edits.
const ROUTE_MAP_MODULES = [/\/src\/main\.jsx$/, /\/src\/App\.jsx$/, /\/src\/pages\.config\.js$/]
// Packages imported through one index file that re-exports hundreds of
// modules (every icon, every date function). Walking their imports would
// mark all of them as up-front. They are left out; Rollup itself moves
// the few pieces the shared code really uses into its chunk.
const BARREL_PACKAGES = /\/node_modules\/(\.pnpm\/[^/]+\/node_modules\/)?(lucide-react|date-fns|framer-motion|motion-dom|motion-utils)\//
const LUCIDE_ICON = /\/lucide-react\/dist\/esm\/icons\/[a-z0-9-]+\.js$/
function stableChunks() {
  let upFront = null
  return (id, { getModuleIds, getModuleInfo }) => {
    if (!upFront) {
      // Every module the main script imports statically, directly or not.
      upFront = new Set()
      const queue = [...getModuleIds()].filter((m) => getModuleInfo(m)?.isEntry)
      while (queue.length) {
        const m = queue.pop()
        if (upFront.has(m) || BARREL_PACKAGES.test(m)) continue
        upFront.add(m)
        for (const next of getModuleInfo(m)?.importedIds || []) queue.push(next)
      }
    }
    // Icons that many pages share became a file each (162 of the 230
    // files under 1 KB). Those used by eight or more modules go in one
    // "icons" file instead, unless the shared code already carries them.
    if (LUCIDE_ICON.test(id)) {
      const importers = getModuleInfo(id)?.importers || []
      if (importers.length >= 8 && !importers.some((m) => upFront.has(m))) return 'icons'
      return undefined
    }
    if (!upFront.has(id) || getModuleInfo(id)?.isEntry || ROUTE_MAP_MODULES.some((re) => re.test(id))) return undefined
    // Rollup and Vite helpers (the preload helper every lazy import uses).
    if (id.startsWith('\0')) return 'vendor'
    if (/\.(css|svg|png|jpe?g|webp|json|html)(\?|$)/.test(id)) return undefined
    return id.includes('/node_modules/') ? 'vendor' : 'core'
  }
}

// https://vite.dev/config/
export default defineConfig({
  // Vitest settings. Claude Code puts agent worktrees under .claude/worktrees
  // inside the repo; without this exclude, `pnpm test` (and so `pnpm build`)
  // also runs every worktree's copy of the tests.
  test: {
    exclude: ['**/node_modules/**', '**/.git/**', '.claude/**'],
  },
  define: {
    __BUILD_INFO__: JSON.stringify(BUILD_INFO),
  },
  plugins: [
    react(),
    // One import per icon and date function in the build, so the shared
    // chunks below hold only what the shared code uses (see the plugin).
    directBarrelImports({ root: __dirname }),
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
        // Heavy libraries (charts, PDF, canvas) stay inside the routes
        // that import them: Rollup splits on dynamic-import boundaries.
        // The one manual grouping is the shared code the main script
        // loads anyway; see stableChunks() above for why.
        manualChunks: stableChunks(),
        // Not experimentalMinChunkSize: tried at 1 KB and 4 KB in October
        // 2026, it folded small files into bigger ones that load in more
        // situations, and the landing page's code grew from 35 to 65 KB
        // compressed. The "icons" grouping above removes most of the tiny
        // files without that cost.
      },
    },
  },
});
