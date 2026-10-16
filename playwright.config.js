// Playwright runs the member flow in e2e/ (plan item E3 30) against the
// app in a real Chromium, with Supabase answered inside the browser by
// e2e/support/fake-supabase.js. No project, keys or network are needed,
// so it runs the same on a laptop and in GitHub Actions.
//
//   pnpm test:e2e              dev server (fast, for local runs)
//   E2E_SERVER=preview pnpm test:e2e
//                              a production `vite build` served by
//                              `vite preview` (what CI runs)
//
// Test files end in .e2e.js so Vitest (which picks up *.test.* and
// *.spec.*) never tries to run them.
import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT || 5183);
const BASE_URL = `http://127.0.0.1:${PORT}`;
const usePreview = process.env.E2E_SERVER === 'preview';

// The app refuses to start without these. They point at the fake, which
// the tests intercept, so nothing real is ever called.
const env = {
  VITE_SUPABASE_URL: 'https://e2e.supabase.test',
  VITE_SUPABASE_ANON_KEY: 'e2e-anon-key',
  VITE_REVENUECAT_WEB_API_KEY: 'test_e2e_placeholder',
};

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.js',
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  forbidOnly: Boolean(process.env.CI),
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  // A desktop and a phone, so CI also walks the phone home (Today, the Log tab).
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } } },
    { name: 'phone', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: usePreview
      ? `pnpm exec vite build && pnpm exec vite preview --port ${PORT} --strictPort --host 127.0.0.1`
      : `pnpm exec vite --port ${PORT} --strictPort --host 127.0.0.1`,
    url: BASE_URL,
    env,
    timeout: 300_000,
    reuseExistingServer: !process.env.CI,
  },
});
