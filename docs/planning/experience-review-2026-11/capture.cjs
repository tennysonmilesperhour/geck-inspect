// Screenshot pass used by docs/planning/experience-review-2026-11-11.md.
// Re-run it before and after each work package to compare screens.
//
// It drives the guest demo (sample data, no account) and the public pages
// in a phone-size and a laptop-size browser. Supabase is answered with
// empty results inside the browser, so no keys or network are needed.
//
// 1. Start the app in another terminal:
//      VITE_SUPABASE_URL=https://e2e.supabase.test VITE_SUPABASE_ANON_KEY=e2e-anon-key \
//      VITE_REVENUECAT_WEB_API_KEY=test_e2e_placeholder pnpm exec vite --port 5199 --strictPort --host 127.0.0.1
// 2. Run:
//      node docs/planning/experience-review-2026-11/capture.cjs /path/to/output-folder
//
// What the sandbox cannot show: real member photos, live community counts
// (the Dashboard reads "0 keepers" here), the logo served from
// geckinspect.com, live Morph ID and anything that needs a real phone.
const { chromium } = require('playwright');
const fs = require('fs');

const OUT = process.argv[2] || './experience-shots';
const BASE = process.env.BASE_URL || 'http://127.0.0.1:5199';

const guestPages = [
  'Today', 'Dashboard', 'MyGeckos', 'Breeding', 'Lineage', 'MarketplaceSalesStats',
  'Recognition', 'Market', 'MorphGuide', 'CareGuide', 'GeneticsGuide', 'Forum',
  'Settings', 'FieldMode', 'log', 'Portfolio', 'BreedingSeason', 'PairingPlanner',
  'ProjectManager', 'BatchHusbandry', 'calculator', 'Membership', 'Notifications',
  'Messages', 'MyProfile', 'Gallery', 'PrintableWorksheets', 'MarketPricing',
  'ClutchLab', 'Pedigree',
];
const publicPages = [
  ['home-control', '/?homepage_preview=control'],
  ['home-business', '/?homepage_preview=business'],
  ['signup', '/AuthPortal?mode=signup'],
  ['membership', '/Membership'],
  ['morph-guide', '/MorphGuide'],
  ['morph-lilly-white', '/MorphGuide/lilly-white'],
  ['calculator', '/calculator'],
  ['price', '/crested-gecko-price'],
  ['not-found', '/nope'],
];
const sizes = [
  ['phone', { width: 390, height: 844, isMobile: true, hasTouch: true }],
  ['laptop', { width: 1440, height: 900 }],
];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const report = [];
  for (const [sizeName, size] of sizes) {
    for (const mode of ['public', 'guest']) {
      const context = await browser.newContext({
        viewport: { width: size.width, height: size.height },
        isMobile: Boolean(size.isMobile),
        hasTouch: Boolean(size.hasTouch),
        serviceWorkers: 'block',
      });
      await context.route((url) => !url.href.startsWith(BASE), (route) => {
        const url = route.request().url();
        if (url.includes('supabase.test')) {
          return route.fulfill({ status: 200, contentType: 'application/json', body: url.includes('/auth/') ? '{}' : '[]' });
        }
        return route.abort();
      });
      if (mode === 'guest') {
        await context.addInitScript(() => {
          try { sessionStorage.setItem('geck_inspect_guest_mode', '1'); } catch { /* private mode */ }
        });
      }
      const list = mode === 'guest' ? guestPages.map((p) => [p, `/${p}`]) : publicPages;
      for (const [name, path] of list) {
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));
        try {
          await page.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 45000 });
          await page.waitForTimeout(3500);
          await page.screenshot({ path: `${OUT}/${sizeName}-${mode}-${name}.png` });
          const facts = await page.evaluate(() => {
            const visible = (el) => {
              const r = el.getBoundingClientRect();
              return r.width > 0 && r.height > 0 && r.top < innerHeight && r.bottom > 0;
            };
            const controls = [...document.querySelectorAll('button,a[href],[role=tab],[role=button]')].filter(visible);
            return {
              h1: [...document.querySelectorAll('h1')].map((h) => h.textContent.trim().slice(0, 60)),
              controlsOnFirstScreen: controls.length,
              controlsUnder40px: controls.filter((c) => {
                const r = c.getBoundingClientRect();
                return r.width < 40 || r.height < 40;
              }).length,
            };
          });
          report.push({ size: sizeName, mode, name, ...facts, errors });
        } catch (e) {
          report.push({ size: sizeName, mode, name, failed: String(e).slice(0, 200) });
        }
        await page.close();
      }
      await context.close();
    }
  }
  fs.writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 1));
  await browser.close();
  console.log(`Wrote ${report.length} screens to ${OUT}`);
})();
