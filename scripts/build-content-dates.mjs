/**
 * Content dates for <lastmod>.
 *
 * Writes scripts/content-dates.json: the last git commit date of every
 * file that feeds a public route. scripts/seo-routes.mjs reads that file
 * so the sitemap's <lastmod> reflects when a page's content actually
 * changed instead of the build date (which told Google every page was
 * new every deploy, and so meant nothing).
 *
 * Run it locally after editing content and commit the JSON:
 *   pnpm build:content-dates
 * It is not part of `pnpm build` on purpose: Vercel's checkout has no
 * usable git history.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const OUT = resolve(__dirname, 'content-dates.json');

// Every source file a route's <lastmod> can depend on. Keep in sync with
// the CONTENT_SOURCES map in seo-routes.mjs.
const FILES = [
  'src/pages/Home.jsx',
  'src/pages/About.jsx',
  'src/pages/Contact.jsx',
  'src/pages/Terms.jsx',
  'src/pages/PrivacyPolicy.jsx',
  'src/pages/MarketplaceVerification.jsx',
  'src/pages/CareGuide.jsx',
  'src/pages/CareGuideSeries.jsx',
  'src/pages/CareGuideTopic.jsx',
  'src/pages/MorphGuide.jsx',
  'src/pages/MorphDetail.jsx',
  'src/pages/MorphTaxonomyHub.jsx',
  'src/pages/ProjectLineDetail.jsx',
  'src/pages/QualityScale.jsx',
  'src/pages/GeneticsGuide.jsx',
  'src/pages/GeneticCalculator.jsx',
  'src/pages/GeneticCalculatorTool.jsx',
  'src/pages/ReverseCalculator.jsx',
  'src/pages/CalculatorMorph.jsx',
  'src/pages/CalculatorPairing.jsx',
  'src/pages/PedigreeTracker.jsx',
  'src/pages/BreedingRecords.jsx',
  'src/pages/CrestedGeckoPrice.jsx',
  'src/pages/MorphVisualizer.jsx',
  'src/pages/Gallery.jsx',
  'src/pages/CommunityConnect.jsx',
  'src/pages/Forum.jsx',
  'src/pages/Marketplace.jsx',
  'src/pages/MarketplaceBuy.jsx',
  'src/pages/Membership.jsx',
  'src/data/morph-guide.js',
  'src/data/care-guide.js',
  'src/data/project-lines.js',
  'src/data/keepers-guides.js',
  'src/data/keepers-guides/feeding.js',
  'src/data/keepers-guides/setup.js',
  'src/data/keepers-guides/handbook.js',
  'src/data/keepers-guides/morph.js',
  'src/data/keepers-guides/breeding.js',
  'src/data/genetics-sections.jsx',
  'src/data/genetics-glossary.js',
  'src/lib/genetics/calculatorCatalog.js',
  'src/lib/stripe-config.js',
];

function lastCommitDate(file) {
  if (!existsSync(resolve(REPO_ROOT, file))) return null;
  try {
    const out = execFileSync('git', ['log', '-1', '--format=%cs', '--', file], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    }).trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(out) ? out : null;
  } catch {
    return null;
  }
}

const previous = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : { files: {} };
const files = {};
let missing = 0;
for (const f of FILES) {
  const d = lastCommitDate(f);
  if (d) files[f] = d;
  else if (previous.files?.[f]) files[f] = previous.files[f];
  else missing += 1;
}

writeFileSync(OUT, `${JSON.stringify({ generatedAt: new Date().toISOString().slice(0, 10), files }, null, 2)}\n`);
console.log(`[content-dates] wrote ${Object.keys(files).length} dates to scripts/content-dates.json${missing ? ` (${missing} files without history)` : ''}`);
