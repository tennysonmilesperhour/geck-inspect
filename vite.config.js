import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const srcDir = path.resolve(__dirname, 'src')

// https://vite.dev/config/
export default defineConfig({
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
