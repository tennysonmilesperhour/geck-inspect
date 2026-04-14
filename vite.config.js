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
});
