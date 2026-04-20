#!/usr/bin/env node
/**
 * Geck Inspect weekly growth report.
 *
 * Pulls Search Console + GA4 data via scripts/growth/{gsc,ga4}.mjs,
 * runs four pattern detectors over the merged dataset, and emits
 * docs/growth-reports/YYYY-MM-DD.md with:
 *
 *   1. At-a-glance: sessions, users, pageviews, top source mix
 *   2. Opportunities — each finding ships a "Claude prompt" the
 *      user can copy-paste to initiate the fix
 *   3. Top queries (last 28d)
 *   4. Top pages by engagement (last 7d)
 *
 * Detectors:
 *
 *   - page-2 queries   (position 11–20, impressions ≥ 10) → ranking
 *                        lift opportunities
 *   - low-CTR pages    (impressions ≥ 100, CTR ≤ 1.5%) → snippet
 *                        rewrite targets
 *   - query gaps       (query impressions ≥ 20, no matching /blog/*
 *                        or /MorphGuide/* slug) → blog topic
 *                        candidates (also fed into blog-queue.json
 *                        via scripts/growth/blog-queue-feed.mjs in
 *                        step G5)
 *   - engagement laggs (GA4 engagementRate < 50% on pages with
 *                        ≥ 25 pageviews) → UX/content fix targets
 *
 * Graceful no-op path: when any required secret is missing, the
 * script still writes a placeholder report explaining how to
 * complete setup. This keeps the weekly workflow green while the
 * user works through the one-time Google Cloud / GSC config.
 */

import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getAccessToken,
  fetchGscQueries,
  fetchGscPages,
  fetchGscQueryPage,
  loadServiceAccount,
} from './growth/gsc.mjs';
import {
  fetchGa4PageEngagement,
  fetchGa4TrafficSources,
  fetchGa4Summary,
} from './growth/ga4.mjs';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const REPORTS_DIR = resolve(REPO_ROOT, 'docs/growth-reports');
const SITE_URL_CONST = 'https://geckinspect.com';

// ---------- detectors ----------------------------------------------------

function detectPage2Queries(queryPageRows) {
  if (!queryPageRows) return [];
  return queryPageRows
    .filter((r) => r.position > 10 && r.position <= 20 && r.impressions >= 10)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 25)
    .map((r) => ({
      query: r.keys[0],
      page: r.keys[1],
      position: Number(r.position.toFixed(1)),
      impressions: r.impressions,
      ctr: Number((r.ctr * 100).toFixed(2)),
      clicks: r.clicks,
    }));
}

function detectLowCtrPages(pageRows) {
  if (!pageRows) return [];
  return pageRows
    .filter((r) => r.impressions >= 100 && r.ctr <= 0.015)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 15)
    .map((r) => ({
      page: r.keys[0],
      impressions: r.impressions,
      ctr: Number((r.ctr * 100).toFixed(2)),
      clicks: r.clicks,
      position: Number(r.position.toFixed(1)),
    }));
}

function detectQueryGaps(queryRows, knownSlugs) {
  if (!queryRows) return [];
  const queries = queryRows
    .filter((r) => r.impressions >= 20)
    .map((r) => ({
      query: r.keys[0],
      impressions: r.impressions,
      clicks: r.clicks,
      position: Number(r.position.toFixed(1)),
      ctr: Number((r.ctr * 100).toFixed(2)),
    }));
  return queries
    .filter((q) => !slugMatchesQuery(q.query, knownSlugs))
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 20);
}

function detectEngagementLaggards(engagementRows) {
  if (!engagementRows) return [];
  return engagementRows
    .filter((r) => r.screenPageViews >= 25 && r.engagementRate < 0.5)
    .sort((a, b) => b.screenPageViews - a.screenPageViews)
    .slice(0, 15)
    .map((r) => ({
      page: r.pagePath,
      pageViews: r.screenPageViews,
      engagementRate: Number((r.engagementRate * 100).toFixed(1)),
      sessions: r.sessions,
    }));
}

// Slug matcher — cheap token overlap against known content paths.
// If ≥ 2 non-trivial query tokens appear in any known slug, we treat
// the query as already served by that page.
function slugMatchesQuery(query, knownSlugs) {
  const q = query.toLowerCase();
  const toks = q.split(/\s+/).filter((t) => t.length > 3 && !STOP_WORDS.has(t));
  if (toks.length === 0) return true; // too short to be a gap
  for (const slug of knownSlugs) {
    const s = slug.toLowerCase();
    let hits = 0;
    for (const t of toks) if (s.includes(t)) hits++;
    if (hits >= 2 || (toks.length === 1 && hits >= 1)) return true;
  }
  return false;
}

const STOP_WORDS = new Set([
  'crested', 'gecko', 'geckos', 'crestie', 'cresties',
  'what', 'how', 'why', 'when', 'the', 'and', 'for', 'with', 'from',
  'your', 'their', 'that', 'this', 'does', 'vs',
]);

// ---------- known slug discovery ----------------------------------------
// Parse morph + care + blog slugs out of the data files so gap
// detection knows which queries are already covered.

import { readFileSync } from 'node:fs';

function loadKnownSlugs() {
  const out = new Set();
  const push = (p) => { if (p) out.add(p); };
  const read = (rel) => {
    try { return readFileSync(resolve(REPO_ROOT, rel), 'utf8'); }
    catch { return ''; }
  };

  const morphSrc = read('src/data/morph-guide.js');
  for (const m of morphSrc.matchAll(/slug:\s*'([a-z0-9-]+)'/g)) push(`morph/${m[1]}`);

  const careSrc = read('src/data/care-guide.js');
  const careRe = /id:\s*'([a-z0-9-]+)',\s*\n\s*title:/g;
  for (const m of careSrc.matchAll(careRe)) push(`care/${m[1]}`);

  const blogSrc = read('src/data/blog-posts.js');
  for (const m of blogSrc.matchAll(/slug:\s*'([a-z0-9-]+)'/g)) push(`blog/${m[1]}`);

  return [...out];
}

// ---------- Claude-prompt templates --------------------------------------

function promptForPage2Query(finding) {
  return `Look at ${finding.page} on geckinspect.com. Search Console reports position ${finding.position} for the query "${finding.query}" with ${finding.impressions} impressions over the last 28 days. Goal: push this to page 1 (top 10). Audit the page's title, H1, first-paragraph keyword usage, internal link count to this page, and FAQ coverage for this query. Recommend 3–5 concrete changes that would ship in a single commit to main. If a new FAQ entry would capture this, draft it verbatim.`;
}

function promptForLowCtr(finding) {
  return `Rewrite the <title> and <meta name="description"> for ${finding.page} on geckinspect.com. Current CTR is ${finding.ctr}% on ${finding.impressions} impressions (avg position ${finding.position}), well below the 2%+ target. Read the current values in the relevant data file (src/data/morph-guide.js, care-guide.js, or blog-posts.js) and propose a new title ≤ 60 chars and description 140–155 chars that would earn higher CTR. Commit the change to main.`;
}

function promptForQueryGap(finding) {
  return `Search Console shows "${finding.query}" drove ${finding.impressions} impressions over the last 28 days (position ${finding.position}, ${finding.clicks} clicks) but there's no page on geckinspect.com explicitly targeting this query. Draft a new blog post entry for src/data/blog-posts.js following the existing Cappuccino post shape: slug, keyphrase = "${finding.query}", TL;DR callout, 3–5 body sections with table + callout, 4–6 FAQ pairs, 3+ internal links to relevant /MorphGuide or /CareGuide pages, 2+ external citations. Commit to main.`;
}

function promptForEngagementLag(finding) {
  return `${finding.page} on geckinspect.com has ${finding.pageViews} pageviews over the last 7 days but only ${finding.engagementRate}% engagement rate (target: ≥ 55%). Audit the page for UX issues: LCP/CLS issues on mobile, above-the-fold content density, CTA placement, and whether the page delivers on the title promise. Recommend 3 concrete fixes rank-ordered by expected lift.`;
}

// ---------- markdown rendering -------------------------------------------

function today() { return new Date().toISOString().slice(0, 10); }

function renderPlaceholder(missing) {
  const lines = [];
  lines.push(`# Geck Inspect growth report — ${today()}`);
  lines.push('');
  lines.push('> **Setup incomplete.** Secrets needed before this report populates with real data:');
  lines.push('');
  for (const m of missing) lines.push(`- \`${m}\``);
  lines.push('');
  lines.push('Once all three secrets are configured in the repo Settings → Secrets and variables → Actions, the next Monday 11:00 UTC run will produce a full report with pulled Search Console and Google Analytics data.');
  lines.push('');
  lines.push('See [the setup walkthrough in the Claude session](#) for step-by-step instructions, or run `node scripts/growth-report.mjs` locally with the same env vars exported to verify end-to-end.');
  lines.push('');
  return lines.join('\n');
}

function renderReport({ summary, trafficSources, topQueries, topPages, findings }) {
  const lines = [];
  lines.push(`# Geck Inspect growth report — ${today()}`);
  lines.push('');
  lines.push('_Generated from the Google Search Console + Google Analytics 4 data streams. Each recommendation ships a Claude prompt you can copy straight into a session to initiate the fix._');
  lines.push('');

  // At-a-glance
  lines.push('## At a glance (last 7 days)');
  lines.push('');
  if (summary) {
    lines.push(`- **Sessions:** ${summary.sessions ?? '—'}`);
    lines.push(`- **Users:** ${summary.totalUsers ?? '—'}`);
    lines.push(`- **Pageviews:** ${summary.screenPageViews ?? '—'}`);
    lines.push(`- **Engagement rate:** ${summary.engagementRate != null ? (summary.engagementRate * 100).toFixed(1) + '%' : '—'}`);
    lines.push(`- **Avg session duration:** ${summary.averageSessionDuration != null ? summary.averageSessionDuration.toFixed(0) + 's' : '—'}`);
  } else {
    lines.push('_GA4 summary unavailable (data not yet flowing or GA4_PROPERTY_ID missing)._');
  }
  lines.push('');

  if (trafficSources && trafficSources.length) {
    lines.push('### Top traffic sources');
    lines.push('');
    lines.push('| Source | Medium | Sessions | Engaged |');
    lines.push('|--------|--------|---------:|--------:|');
    for (const r of trafficSources.slice(0, 8)) {
      lines.push(`| ${r.sessionSource} | ${r.sessionMedium} | ${r.sessions} | ${r.engagedSessions} |`);
    }
    lines.push('');
  }

  // Opportunities
  lines.push('## Opportunities this week');
  lines.push('');

  renderFindingsSection(lines, 'Page-2 rankings (push to page 1)', findings.page2Queries, promptForPage2Query,
    (f) => `**${f.query}** → \`${f.page}\` · position ${f.position} · ${f.impressions} impressions · ${f.ctr}% CTR`);

  renderFindingsSection(lines, 'Low-CTR pages (snippet rewrite targets)', findings.lowCtr, promptForLowCtr,
    (f) => `\`${f.page}\` · ${f.ctr}% CTR on ${f.impressions} impressions · avg position ${f.position}`);

  renderFindingsSection(lines, 'Query gaps (write a new post)', findings.queryGaps, promptForQueryGap,
    (f) => `**${f.query}** · ${f.impressions} impressions · position ${f.position} · ${f.ctr}% CTR`);

  renderFindingsSection(lines, 'Engagement laggards (content/UX fix)', findings.engagementLag, promptForEngagementLag,
    (f) => `\`${f.page}\` · ${f.pageViews} views · ${f.engagementRate}% engagement`);

  // Top queries reference
  if (topQueries && topQueries.length) {
    lines.push('## Top queries (last 28 days)');
    lines.push('');
    lines.push('| Query | Clicks | Impressions | CTR | Position |');
    lines.push('|-------|-------:|------------:|----:|---------:|');
    for (const r of topQueries.slice(0, 20)) {
      lines.push(`| ${r.keys[0]} | ${r.clicks} | ${r.impressions} | ${(r.ctr * 100).toFixed(2)}% | ${r.position.toFixed(1)} |`);
    }
    lines.push('');
  }

  // Top pages reference
  if (topPages && topPages.length) {
    lines.push('## Top pages by engagement (last 7 days)');
    lines.push('');
    lines.push('| Page | Views | Engagement | Sessions |');
    lines.push('|------|------:|-----------:|---------:|');
    for (const r of topPages.slice(0, 20)) {
      lines.push(`| \`${r.pagePath}\` | ${r.screenPageViews} | ${(r.engagementRate * 100).toFixed(1)}% | ${r.sessions} |`);
    }
    lines.push('');
  }

  lines.push('---');
  lines.push('');
  lines.push('_Generated by `scripts/growth-report.mjs`. Complementary to `docs/seo-audits/` (technical site health) and the content pipeline in `docs/blog-reports/`._');
  return lines.join('\n');
}

function renderFindingsSection(lines, title, findings, prompter, summariser) {
  lines.push(`### ${title} (${findings.length})`);
  lines.push('');
  if (findings.length === 0) {
    lines.push('_No findings in this category this week._');
    lines.push('');
    return;
  }
  for (const f of findings) {
    lines.push(`- ${summariser(f)}`);
    lines.push('');
    lines.push('  <details><summary>Claude prompt</summary>');
    lines.push('');
    lines.push('  ```');
    lines.push('  ' + prompter(f));
    lines.push('  ```');
    lines.push('');
    lines.push('  </details>');
    lines.push('');
  }
}

// ---------- run ----------------------------------------------------------

async function main() {
  mkdirSync(REPORTS_DIR, { recursive: true });
  const outFile = join(REPORTS_DIR, `${today()}.md`);

  const sa = loadServiceAccount();
  const ga4Id = process.env.GA4_PROPERTY_ID;
  const siteUrl = process.env.GSC_SITE_URL;

  const missing = [];
  if (!sa) missing.push('GOOGLE_SERVICE_ACCOUNT_JSON');
  if (!ga4Id) missing.push('GA4_PROPERTY_ID');
  if (!siteUrl) missing.push('GSC_SITE_URL');

  if (missing.length) {
    writeFileSync(outFile, renderPlaceholder(missing));
    console.log(`[growth-report] wrote placeholder → ${outFile} (missing: ${missing.join(', ')})`);
    return;
  }

  console.log('[growth-report] authenticating with Google …');
  const token = await getAccessToken();
  if (!token) {
    writeFileSync(outFile, renderPlaceholder(['GOOGLE_SERVICE_ACCOUNT_JSON (auth failed)']));
    return;
  }

  console.log('[growth-report] fetching GSC …');
  const [queries, pages, queryPage] = await Promise.all([
    fetchGscQueries(token, siteUrl),
    fetchGscPages(token, siteUrl),
    fetchGscQueryPage(token, siteUrl),
  ]);

  console.log('[growth-report] fetching GA4 …');
  const [summary, trafficSources, engagement] = await Promise.all([
    fetchGa4Summary(token),
    fetchGa4TrafficSources(token),
    fetchGa4PageEngagement(token),
  ]);

  const knownSlugs = loadKnownSlugs();

  const findings = {
    page2Queries: detectPage2Queries(queryPage),
    lowCtr: detectLowCtrPages(pages),
    queryGaps: detectQueryGaps(queries, knownSlugs),
    engagementLag: detectEngagementLaggards(engagement),
  };

  const md = renderReport({
    summary,
    trafficSources,
    topQueries: queries,
    topPages: engagement,
    findings,
  });
  writeFileSync(outFile, md);
  console.log(`[growth-report] wrote ${outFile} · ${findings.page2Queries.length + findings.lowCtr.length + findings.queryGaps.length + findings.engagementLag.length} findings`);
}

main().catch((e) => {
  console.error('[growth-report] failed:', e);
  process.exit(1);
});
