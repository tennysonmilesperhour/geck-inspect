#!/usr/bin/env node
/**
 * Static SEO audit for Geck Inspect.
 *
 * Runs after `vite build && scripts/prerender.mjs` as the final build
 * step. Walks every prerendered HTML file in dist/ and validates:
 *
 *   1. `<title>` present, non-empty, under 70 chars
 *   2. `<meta name="description">` present, 60-300 chars
 *   3. `<link rel="canonical">` present and points to SITE_URL/path
 *   4. `<meta name="robots">` does NOT contain noindex (unless the
 *      route is explicitly marked noindex)
 *   5. At least one `<script type="application/ld+json">` block
 *      (static org schema counts; route-specific schema is preferred)
 *   6. For /blog/<slug> and /CareGuide/<id> and /MorphGuide/<slug>:
 *      the prerendered `<noscript>` shell contains the route heading
 *      (substantive body text for non-JS crawlers)
 *   7. Internal links in the prerendered nav + noscript resolve to
 *      other prerendered files (no 404s)
 *
 * Also detects:
 *   - Stale content: any `dateModified` field in editorial.js older
 *     than STALE_THRESHOLD_DAYS (default 60) for non-dated pages.
 *   - Orphan routes: routes in the sitemap that no other prerendered
 *     page links to (hurts crawl discoverability).
 *   - Schema duplication: multiple JSON-LD blocks emitting the same
 *     `@id` (confuses search engines).
 *
 * Emits:
 *   dist/seo-audit.json            ,  machine-readable, used by the
 *                                    GitHub Actions workflow
 *   docs/seo-audits/<YYYY-MM-DD>.md ,  human-readable report with two
 *                                    sections: "Audit findings" +
 *                                    "Content changes since last audit"
 *
 * Exit code is 0 even when findings exist ,  the report is the
 * deliverable, not a CI gate. Use --strict to exit non-zero on any
 * error-level finding.
 */

import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const DIST = resolve(REPO_ROOT, 'dist');
const REPORTS_DIR = resolve(REPO_ROOT, 'docs/seo-audits');
const SITE_URL = 'https://geckinspect.com';
const STALE_THRESHOLD_DAYS = 60;
const STRICT = process.argv.includes('--strict');

if (!existsSync(DIST)) {
  console.error('[seo-audit] dist/ does not exist ,  run `pnpm build` first.');
  process.exit(1);
}

// ---------- walk dist/ -----------------------------------------------------

function* walkHtml(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      yield* walkHtml(full);
    } else if (name.endsWith('.html')) {
      yield full;
    }
  }
}

function pathFromFile(file) {
  const rel = relative(DIST, file);
  if (rel === 'index.html') return '/';
  if (rel.endsWith('/index.html')) return '/' + rel.slice(0, -'/index.html'.length);
  return '/' + rel.replace(/\.html$/, '');
}

// ---------- per-file checks ------------------------------------------------

function extract(html, re) {
  const m = html.match(re);
  return m ? m[1] : null;
}

function findings(file, html) {
  const out = [];
  const route = pathFromFile(file);

  const add = (level, code, message, context) =>
    out.push({ level, code, route, message, context });

  const title = extract(html, /<title>([^<]*)<\/title>/);
  if (!title || !title.trim()) {
    add('error', 'missing-title', `No <title> on ${route}`);
  } else {
    // Google truncates at ~60 chars on mobile, ~70 on desktop. The
    // " ,  Geck Inspect" suffix is appended by Seo.jsx for brand
    // consistency; don't penalize the raw headline for carrying it.
    const raw = title.replace(/ [, -] Geck Inspect$/, '').trim();
    if (raw.length > 65) {
      add('warn', 'long-title', `Title is ${raw.length} chars without suffix (target ≤65)`, raw);
    }
  }

  const desc = extract(html, /<meta name="description" content="([^"]*)"/);
  if (!desc || !desc.trim()) {
    add('error', 'missing-description', `No <meta name="description"> on ${route}`);
  } else if (desc.length < 60) {
    add('warn', 'short-description', `Description is ${desc.length} chars (target ≥60)`, desc);
  } else if (desc.length > 320) {
    add('warn', 'long-description', `Description is ${desc.length} chars (target ≤320)`, desc);
  }

  const canonical = extract(html, /<link rel="canonical" href="([^"]*)"/);
  const expectedCanonical = `${SITE_URL}${route === '/' ? '' : route}`;
  if (!canonical) {
    add('error', 'missing-canonical', `No <link rel="canonical"> on ${route}`);
  } else if (canonical !== expectedCanonical && canonical !== `${expectedCanonical}/`) {
    add('warn', 'wrong-canonical', `Canonical ${canonical} does not match route`, expectedCanonical);
  }

  const robots = extract(html, /<meta name="robots" content="([^"]*)"/);
  if (robots && /noindex/i.test(robots) && !route.startsWith('/Admin') && route !== '/AuthPortal') {
    add('warn', 'unexpected-noindex', `Route ${route} carries noindex but is not an admin path`, robots);
  }

  const jsonLdBlocks = [...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  if (jsonLdBlocks.length === 0) {
    add('error', 'missing-jsonld', `No JSON-LD on ${route}`);
  } else {
    // Validate each block parses. Detect duplicate entity definitions , 
    // nodes that supply BOTH @id and @type with the same @id across
    // blocks (two independent definitions of the same entity). A bare
    // `{ "@id": "...#organization" }` reference is a legal Schema.org
    // link, not a duplicate, and must not trigger a warning.
    const entityDefs = new Map(); // @id → count of definitions
    for (const raw of jsonLdBlocks) {
      try {
        const parsed = JSON.parse(raw);
        collectEntityIds(parsed, entityDefs);
      } catch (e) {
        add('error', 'invalid-jsonld', `JSON-LD did not parse on ${route}: ${e.message}`);
      }
    }
    for (const [id, count] of entityDefs) {
      if (count > 1) {
        add('warn', 'duplicate-jsonld-entity', `Entity ${id} defined ${count} times on ${route}`);
      }
    }
  }

  // Noscript body should contain an h1 for content routes. Pages have
  // multiple <noscript> blocks (font-loading + main body shell) ,  check
  // whether any of them carry a heading.
  const isContentRoute = /^\/(blog|CareGuide|MorphGuide|GeneticsGuide|GeneticCalculatorTool|calculator|About)(\/|$)/.test(route);
  if (isContentRoute) {
    const anyH1 = [...html.matchAll(/<noscript>([\s\S]*?)<\/noscript>/g)]
      .some((m) => /<h1[^>]*>/.test(m[1]));
    if (!anyH1) {
      add('warn', 'missing-noscript-h1', `No noscript <h1> on content route ${route}`);
    }
  }

  return out;
}

function collectEntityIds(node, counts) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const item of node) collectEntityIds(item, counts);
    return;
  }
  // Only count as an entity definition when BOTH @id and @type are
  // present ,  otherwise it's a reference, which is a legal duplicate.
  if (typeof node['@id'] === 'string' && node['@type']) {
    counts.set(node['@id'], (counts.get(node['@id']) || 0) + 1);
  }
  for (const v of Object.values(node)) collectEntityIds(v, counts);
}

// ---------- internal link check -------------------------------------------

function extractInternalLinks(html) {
  const out = [];
  const re = /href="(\/[^"#?]*)(?:[?#][^"]*)?"/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const href = m[1];
    if (href.startsWith('//')) continue;
    if (href.startsWith('/assets/') || /\.(xml|txt|png|jpg|jpeg|gif|svg|webp|ico|webmanifest|json|css|js|woff2?)$/i.test(href)) continue;
    out.push(href);
  }
  return out;
}

// ---------- stale content detection ---------------------------------------

function loadEditorialDates() {
  // Editorial lives in src/lib/editorial.js; we just regex out PER_PATH
  // entries for date-stale checks.
  const src = readFileSync(resolve(REPO_ROOT, 'src/lib/editorial.js'), 'utf8');
  const m = src.match(/const PER_PATH\s*=\s*\{([\s\S]*?)\n\};/);
  if (!m) return {};
  const out = {};
  const re = /'([^']+)':\s*\{\s*published:\s*'([^']+)',\s*modified:\s*'([^']+)'/g;
  let hit;
  while ((hit = re.exec(m[1])) !== null) {
    out[hit[1]] = { published: hit[2], modified: hit[3] };
  }
  return out;
}

function loadBlogPostDates() {
  const src = readFileSync(resolve(REPO_ROOT, 'src/data/blog-posts.js'), 'utf8');
  const m = src.match(/export const BLOG_POSTS\s*=\s*\[([\s\S]*?)\n\];/);
  if (!m) return [];
  const body = m[1];
  const out = [];
  const re = /slug:\s*'([a-z0-9-]+)'[\s\S]*?datePublished:\s*'([0-9-]+)'(?:[\s\S]*?dateModified:\s*'([0-9-]+)')?/g;
  let hit;
  while ((hit = re.exec(body)) !== null) {
    out.push({
      path: `/blog/${hit[1]}`,
      published: hit[2],
      modified: hit[3] || hit[2],
    });
  }
  return out;
}

function daysAgo(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
}

// ---------- git-based content diff ----------------------------------------

function lastAuditDate() {
  if (!existsSync(REPORTS_DIR)) return null;
  const files = readdirSync(REPORTS_DIR)
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.md$/.test(f))
    .sort();
  return files.length ? files[files.length - 1].slice(0, -3) : null;
}

function contentChangesSince(sinceDate) {
  // Fall back to 14 days if no prior audit exists ,  matches the
  // biweekly cadence the GH Actions workflow runs on.
  const since = sinceDate || new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  try {
    const log = execSync(
      `git log --since="${since}" --name-only --pretty=format:"%h|%ad|%s" --date=short -- src/data/ src/lib/editorial.js src/pages/ scripts/ public/llms.txt`,
      { cwd: REPO_ROOT, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    return parseGitLog(log, since);
  } catch (e) {
    return { since, commits: [], error: e.message };
  }
}

function parseGitLog(log, since) {
  const commits = [];
  let current = null;
  for (const line of log.split('\n')) {
    if (!line.trim()) {
      if (current && current.files.length) commits.push(current);
      current = null;
      continue;
    }
    if (line.includes('|')) {
      if (current && current.files.length) commits.push(current);
      const [hash, date, ...subjectParts] = line.split('|');
      current = { hash, date, subject: subjectParts.join('|'), files: [] };
    } else if (current) {
      current.files.push(line.trim());
    }
  }
  if (current && current.files.length) commits.push(current);
  return { since, commits };
}

// ---------- run -----------------------------------------------------------

console.log('[seo-audit] walking dist/ …');
const htmlFiles = [...walkHtml(DIST)];

const allFindings = [];
const inboundLinks = new Map(); // target path → count
const outboundLinks = new Map(); // source path → [target paths]

for (const file of htmlFiles) {
  const html = readFileSync(file, 'utf8');
  const route = pathFromFile(file);
  allFindings.push(...findings(file, html));

  const links = extractInternalLinks(html);
  outboundLinks.set(route, [...new Set(links)]);
  for (const target of links) {
    const norm = target === '/' ? '/' : target.replace(/\/$/, '');
    inboundLinks.set(norm, (inboundLinks.get(norm) || 0) + 1);
  }
}

// Broken internal links ,  link target does not exist as a prerendered file
const knownRoutes = new Set(htmlFiles.map(pathFromFile).map((r) => (r === '/' ? '/' : r.replace(/\/$/, ''))));
for (const [source, targets] of outboundLinks) {
  for (const target of targets) {
    const norm = target === '/' ? '/' : target.replace(/\/$/, '');
    if (!knownRoutes.has(norm) && !isKnownSpaOnlyRoute(norm)) {
      allFindings.push({
        level: 'warn',
        code: 'broken-internal-link',
        route: source,
        message: `Link to ${target} does not resolve to a prerendered page`,
        context: target,
      });
    }
  }
}

function isKnownSpaOnlyRoute(p) {
  // Routes that render through the SPA but are intentionally not
  // prerendered (auth-gated, dynamic params, etc.). These are fine to
  // link to ,  Googlebot will hydrate them.
  const allowlist = [
    '/Dashboard', '/MyGeckos', '/Gallery', '/Marketplace', '/MarketplaceBuy',
    '/MarketplaceSell', '/Forum', '/CommunityConnect', '/AuthPortal',
    '/Membership', '/Settings', '/Notifications', '/Messages', '/Shipping',
    '/Giveaways', '/AdminPanel', '/MorphVisualizer', '/GeckAnswers',
    '/Home',
  ];
  if (allowlist.includes(p)) return true;
  if (p.startsWith('/passport/') || p.startsWith('/claim/') || p.startsWith('/Breeder/')) return true;
  return false;
}

// Orphan detection ,  prerendered routes no other prerendered page links to
const orphans = [];
for (const route of knownRoutes) {
  if (route === '/' || route === '/AuthPortal') continue;
  if (!inboundLinks.has(route) && !inboundLinks.has(route + '/')) {
    orphans.push(route);
  }
}

// Stale content detection
const editorial = loadEditorialDates();
const stalePages = [];
for (const [path, dates] of Object.entries(editorial)) {
  const age = daysAgo(dates.modified);
  if (age !== null && age > STALE_THRESHOLD_DAYS) {
    stalePages.push({ path, modified: dates.modified, ageDays: age });
  }
}
const blogPosts = loadBlogPostDates();
const staleBlogPosts = [];
for (const p of blogPosts) {
  const age = daysAgo(p.modified);
  if (age !== null && age > STALE_THRESHOLD_DAYS) {
    staleBlogPosts.push({ path: p.path, modified: p.modified, ageDays: age });
  }
}

// Content diff since last audit
const sinceDate = lastAuditDate();
const contentDiff = contentChangesSince(sinceDate);

// ---------- report --------------------------------------------------------

const today = new Date().toISOString().slice(0, 10);
const summary = {
  generatedAt: new Date().toISOString(),
  siteUrl: SITE_URL,
  routesAudited: htmlFiles.length,
  findings: {
    errors: allFindings.filter((f) => f.level === 'error').length,
    warnings: allFindings.filter((f) => f.level === 'warn').length,
    infos: allFindings.filter((f) => f.level === 'info').length,
  },
  orphanRoutes: orphans,
  stalePages,
  staleBlogPosts,
  contentDiffSince: contentDiff.since,
  contentDiffCommits: contentDiff.commits.length,
};

const report = {
  ...summary,
  findings: allFindings,
  contentDiff,
};

writeFileSync(resolve(DIST, 'seo-audit.json'), JSON.stringify(report, null, 2));

// Human-readable markdown
mkdirSync(REPORTS_DIR, { recursive: true });
const md = renderMarkdown(report);
const mdPath = join(REPORTS_DIR, `${today}.md`);
writeFileSync(mdPath, md);

console.log(`[seo-audit] ${htmlFiles.length} routes · ${summary.findings.errors} errors · ${summary.findings.warnings} warnings · ${orphans.length} orphans`);
console.log(`[seo-audit] report → ${relative(REPO_ROOT, mdPath)}`);

if (STRICT && summary.findings.errors > 0) {
  console.error('[seo-audit] --strict: exiting 1 due to errors');
  process.exit(1);
}

// ---------- markdown rendering --------------------------------------------

function renderMarkdown(report) {
  const lines = [];
  lines.push(`# Geck Inspect SEO audit ,  ${today}`);
  lines.push('');
  lines.push(`Generated ${report.generatedAt} against \`${report.siteUrl}\`.`);
  lines.push('');
  lines.push(`**${report.routesAudited} routes audited** · ${report.findings.length} total findings (${summary.findings.errors} error, ${summary.findings.warnings} warn).`);
  lines.push('');

  lines.push('## Audit findings');
  lines.push('');
  if (report.findings.length === 0) {
    lines.push('No issues detected.');
  } else {
    const byCode = new Map();
    for (const f of report.findings) {
      if (!byCode.has(f.code)) byCode.set(f.code, []);
      byCode.get(f.code).push(f);
    }
    for (const [code, items] of byCode) {
      lines.push(`### ${code} (${items.length})`);
      for (const it of items.slice(0, 20)) {
        lines.push(`- [${it.level}] \`${it.route}\` ,  ${it.message}`);
      }
      if (items.length > 20) {
        lines.push(`- … and ${items.length - 20} more`);
      }
      lines.push('');
    }
  }

  lines.push('## Stale content (>' + STALE_THRESHOLD_DAYS + ' days)');
  lines.push('');
  const stales = [...report.stalePages, ...report.staleBlogPosts];
  if (stales.length === 0) {
    lines.push('None. All tracked content was updated within the threshold.');
  } else {
    for (const s of stales) {
      lines.push(`- \`${s.path}\` ,  last modified ${s.modified} (${s.ageDays} days ago)`);
    }
  }
  lines.push('');

  lines.push('## Orphan routes');
  lines.push('');
  if (report.orphanRoutes.length === 0) {
    lines.push('None. Every prerendered page has at least one inbound internal link.');
  } else {
    lines.push('Routes in the sitemap that no other prerendered page links to:');
    for (const r of report.orphanRoutes) lines.push(`- \`${r}\``);
  }
  lines.push('');

  lines.push('## Content changes since last audit');
  lines.push('');
  lines.push(`Comparing against \`${report.contentDiff.since}\`.`);
  lines.push('');
  if (report.contentDiff.commits.length === 0) {
    lines.push('No content commits in this window.');
  } else {
    for (const c of report.contentDiff.commits) {
      lines.push(`- **${c.hash}** (${c.date}) ,  ${c.subject}`);
      for (const f of c.files) lines.push(`  - ${f}`);
    }
  }
  lines.push('');

  lines.push('---');
  lines.push('');
  lines.push('_Generated by `scripts/seo-audit.mjs`. Bump `dateModified` in `src/lib/editorial.js` or the blog post entry to resolve stale-content findings._');

  return lines.join('\n');
}
