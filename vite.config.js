import base44 from "@base44/vite-plugin"
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const srcDir = path.resolve(__dirname, 'src')

// The base44 plugin sets "@/": "/src/" which Rollup treats as an absolute
// filesystem path, breaking production builds outside Base44's environment.
// This plugin's config hook runs after base44's (it appears later in the
// plugins array) and returns an override that corrects the alias.
const fixAtAliasPlugin = {
  name: 'fix-at-alias',
  config() {
    return {
      resolve: {
        alias: {
          '@/': srcDir + '/',
        }
      }
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    base44({
      // Support for legacy code that imports the base44 SDK with @/integrations, @/entities, etc.
      // can be removed if the code has been updated to use the new SDK imports from @base44/sdk
      legacySDKImports: process.env.BASE44_LEGACY_SDK_IMPORTS === 'true'
    }),
    fixAtAliasPlugin,
    react(),
  ],
  build: {
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
        // `manualChunks` receives the resolved module id; match on the
        // package path so transitive imports (e.g. jspdf pulls in
        // fflate) land in the expected chunk rather than fragmenting
        // across a dozen tiny files.
        manualChunks(id) {
          if (id.includes('node_modules/recharts')) return 'vendor-recharts';
          if (id.includes('node_modules/html2canvas')) return 'vendor-pdf';
          if (id.includes('node_modules/jspdf')) return 'vendor-pdf';
          return undefined;
        },
      },
    },
  },
});
