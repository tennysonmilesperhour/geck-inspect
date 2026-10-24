/**
 * Content dates for <lastmod> and dateModified.
 *
 * Writes scripts/content-dates.json:
 *   files     the last git commit date of every file that feeds a public
 *             route. scripts/seo-routes.mjs (sitemap <lastmod>),
 *             scripts/prerender.mjs and src/lib/editorial.js (JSON-LD
 *             dateModified) all read it, so the three agree.
 *   declared  dates a page states itself (`const LAST_UPDATED = '...'` in
 *             the Terms and the Privacy Policy). Those are legal
 *             statements, so the sitemap and the structured data use the
 *             date the page shows, not the date of the last code edit.
 *
 * It runs at the start of `pnpm build` (since 16 Oct 2026), so a deploy
 * never ships a date older than the content. Before that it was run by
 * hand and the dates went stale: the Genetics Guide changed on 14 and 15
 * October while its dateModified still said 6 October.
 *
 * Shallow clones. Vercel and GitHub Actions check out only the newest
 * commits. In a shallow clone the oldest commit has no parent, so git
 * reports every file as changed in it, which would stamp the whole site
 * with that commit's date. A date that comes from a shallow boundary
 * commit is therefore not trusted: the committed date in the JSON is kept
 * instead. A date from any newer commit is real (the file did change
 * there), so edits that are inside the checkout still update.
 *
 * Run it by hand after editing content if you want the JSON in git to
 * match: pnpm build:content-dates
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const OUT = resolve(__dirname, 'content-dates.json');

// Every source file a route's <lastmod> or dateModified can depend on.
// seo-routes.mjs (dateOf) and src/lib/editorial.js (contentDate) look
// files up by these exact paths; a test checks that every path they name
// is listed here.
export const FILES = [
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
  'src/pages/GeneticCalculatorTool.jsx',
  'src/components/breeding/GeneticCalculator.jsx',
  'src/pages/ReverseCalculator.jsx',
  'src/pages/CalculatorMorph.jsx',
  'src/pages/CalculatorPairing.jsx',
  'src/pages/PedigreeTracker.jsx',
  'src/pages/BreedingRecords.jsx',
  'src/pages/CrestedGeckoPrice.jsx',
  'src/pages/OpenData.jsx',
  'src/pages/Compare.jsx',
  'src/data/comparisons.js',
  'src/pages/Recognition.jsx',
  'src/pages/Gallery.jsx',
  'src/pages/Forum.jsx',
  'src/pages/Marketplace.jsx',
  'src/pages/MarketplaceBuy.jsx',
  'src/pages/Membership.jsx',
  'src/lib/membershipSeo.js',
  'src/lib/morphMeta.js',
  'src/data/morph-guide.js',
  'src/data/morph-seo-descriptions.js',
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
  'src/data/genetics-jsonld.js',
  'src/lib/genetics/calculatorCatalog.js',
  'src/lib/genetics/pairingPageSummary.js',
  'src/lib/stripe-config.js',
];

// Pages whose visible "Last updated" date is a statement, not a commit.
export const DECLARED = ['src/pages/Terms.jsx', 'src/pages/PrivacyPolicy.jsx'];

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

function git(args) {
  return execFileSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
}

/** Hashes of the shallow boundary commits (empty for a full clone or no git). */
export function shallowBoundaries(run = git) {
  try {
    if (run(['rev-parse', '--is-shallow-repository']) !== 'true') return new Set();
    const file = run(['rev-parse', '--git-path', 'shallow']);
    const path = resolve(REPO_ROOT, file);
    if (!existsSync(path)) return new Set();
    return new Set(readFileSync(path, 'utf8').split('\n').map((l) => l.trim()).filter(Boolean));
  } catch {
    return new Set();
  }
}

/**
 * { hash, date } of the last commit that touched a file, or null.
 * `run` is injectable so tests can fake git.
 */
export function lastCommit(file, run = git) {
  try {
    const out = run(['log', '-1', '--format=%H %cs', '--', file]);
    const [hash, date] = out.split(' ');
    return hash && ISO_DAY.test(date || '') ? { hash, date } : null;
  } catch {
    return null;
  }
}

/** The date a page states in `const LAST_UPDATED = 'YYYY-MM-DD'`, or null. */
export function declaredDate(source) {
  const m = String(source || '').match(/const LAST_UPDATED\s*=\s*['"](\d{4}-\d{2}-\d{2})['"]/);
  return m ? m[1] : null;
}

/**
 * Pure merge step: the new `files` map from what git says and what was
 * committed before. A date from a shallow boundary commit (or no date at
 * all) keeps the committed one.
 */
export function resolveDates({ files, previous = {}, commits = {}, boundaries = new Set() }) {
  const out = {};
  let kept = 0;
  for (const f of files) {
    const c = commits[f];
    if (c && !boundaries.has(c.hash)) {
      out[f] = c.date;
    } else if (previous[f]) {
      out[f] = previous[f];
      kept += 1;
    }
  }
  return { files: out, kept };
}

/** A repo file's text, or null when it does not exist. */
function readRepoFile(file) {
  const path = resolve(REPO_ROOT, file);
  return existsSync(path) ? readFileSync(path, 'utf8') : null;
}

/**
 * The `declared` map: each legal page's LAST_UPDATED, read from the page
 * source when the build runs. A page without one keeps the committed date.
 * `read` is injectable so tests can check this step without depending on
 * whether the committed JSON was regenerated after the page changed.
 */
export function readDeclaredDates({ read = readRepoFile, previous = {} } = {}) {
  const declared = {};
  for (const f of DECLARED) {
    const d = declaredDate(read(f));
    if (d) declared[f] = d;
    else if (previous[f]) declared[f] = previous[f];
  }
  return declared;
}

export function buildContentDates({ run = git, today = new Date().toISOString().slice(0, 10) } = {}) {
  const previousFile = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : {};
  const boundaries = shallowBoundaries(run);
  const commits = {};
  for (const f of FILES) {
    if (!existsSync(resolve(REPO_ROOT, f))) continue;
    const c = lastCommit(f, run);
    if (c) commits[f] = c;
  }
  const { files, kept } = resolveDates({ files: FILES, previous: previousFile.files || {}, commits, boundaries });
  const declared = readDeclaredDates({ previous: previousFile.declared || {} });
  // Keep generatedAt unchanged when nothing moved, so a build does not
  // leave a one-line diff in the working tree every day.
  const unchanged =
    JSON.stringify(files) === JSON.stringify(previousFile.files || {}) &&
    JSON.stringify(declared) === JSON.stringify(previousFile.declared || {});
  const body = {
    generatedAt: unchanged && previousFile.generatedAt ? previousFile.generatedAt : today,
    files,
    declared,
  };
  writeFileSync(OUT, `${JSON.stringify(body, null, 2)}\n`);
  const missing = FILES.length - Object.keys(files).length;
  console.log(
    `[content-dates] ${Object.keys(files).length} dates${kept ? `, ${kept} kept from the committed file (shallow or missing history)` : ''}${missing ? `, ${missing} files without a date` : ''}`,
  );
  return body;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  buildContentDates();
}
