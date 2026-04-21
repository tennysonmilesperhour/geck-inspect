#!/usr/bin/env node
/**
 * PageSpeed Insights Lighthouse runner for Geck Inspect.
 *
 * Calls the public Google PageSpeed Insights v5 API for a curated
 * list of high-value URLs and appends a "Core Web Vitals" section
 * to the most recent audit markdown report (and the JSON sidecar).
 *
 * The PSI API:
 *   - Free, no key required (rate-limited to ~25k/day shared)
 *   - With PAGESPEED_API_KEY: 25k/day per key
 *   - Returns full Lighthouse audit JSON for mobile + desktop
 *
 * Strategy: we fetch mobile scores only (Google uses mobile-first
 * ranking), pick Performance / SEO / Accessibility scores + the
 * three Core Web Vitals (LCP, CLS, INP), and write them to today's
 * report. Running time: ~5-10s per URL × 6 URLs = ~60s total.
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const REPORTS_DIR = resolve(REPO_ROOT, 'docs/seo-audits');
const DIST = resolve(REPO_ROOT, 'dist');
const SITE_URL = 'https://geckinspect.com';
const API_KEY = process.env.PAGESPEED_API_KEY || '';

// URLs to audit. Curated for highest-value + category coverage so the
// six calls we make per run cover hub pages, spoke pages, and the
// interactive tool separately.
const TARGETS = [
  { path: '/', label: 'Home' },
  { path: '/MorphGuide', label: 'Morph Guide hub' },
  { path: '/CareGuide', label: 'Care Guide hub' },
  { path: '/GeneticsGuide', label: 'Genetics Guide' },
  { path: '/GeneticCalculatorTool', label: 'Genetics Calculator' },
  { path: '/blog', label: 'Blog index' },
];

async function runOne(url) {
  const endpoint = new URL('https://www.googleapis.com/pagespeedonline/v5/runPagespeed');
  endpoint.searchParams.set('url', url);
  endpoint.searchParams.set('strategy', 'mobile');
  // Request all five categories — lightweight additions and the summary
  // only reports the ones we emit.
  for (const cat of ['performance', 'accessibility', 'seo', 'best-practices']) {
    endpoint.searchParams.append('category', cat);
  }
  if (API_KEY) endpoint.searchParams.set('key', API_KEY);

  const res = await fetch(endpoint.toString(), { redirect: 'follow' });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`PSI ${res.status} ${res.statusText} for ${url}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

function extract(psi, url) {
  const lh = psi.lighthouseResult || {};
  const cats = lh.categories || {};
  const score = (k) => {
    const s = cats[k]?.score;
    return typeof s === 'number' ? Math.round(s * 100) : null;
  };
  const audits = lh.audits || {};
  const metric = (k) => audits[k]?.displayValue || null;
  // Lab metrics from the Lighthouse run. Field data (real-user CrUX)
  // lives in psi.loadingExperience / psi.originLoadingExperience.
  const field = psi.loadingExperience?.metrics || {};
  return {
    url,
    performance: score('performance'),
    accessibility: score('accessibility'),
    seo: score('seo'),
    bestPractices: score('best-practices'),
    lab: {
      lcp: metric('largest-contentful-paint'),
      cls: metric('cumulative-layout-shift'),
      tbt: metric('total-blocking-time'),
      fcp: metric('first-contentful-paint'),
      speedIndex: metric('speed-index'),
    },
    field: {
      lcp: field.LARGEST_CONTENTFUL_PAINT_MS?.percentile
        ? `${field.LARGEST_CONTENTFUL_PAINT_MS.percentile} ms`
        : null,
      cls: field.CUMULATIVE_LAYOUT_SHIFT_SCORE?.percentile
        ? (field.CUMULATIVE_LAYOUT_SHIFT_SCORE.percentile / 100).toFixed(3)
        : null,
      inp: field.INTERACTION_TO_NEXT_PAINT?.percentile
        ? `${field.INTERACTION_TO_NEXT_PAINT.percentile} ms`
        : null,
    },
  };
}

function emoji(score) {
  if (score == null) return '—';
  if (score >= 90) return '🟢';
  if (score >= 50) return '🟡';
  return '🔴';
}

async function main() {
  const results = [];
  for (const target of TARGETS) {
    const url = `${SITE_URL}${target.path}`;
    try {
      console.log(`[seo-lighthouse] ${url}`);
      const psi = await runOne(url);
      const data = extract(psi, url);
      results.push({ target, data });
    } catch (e) {
      console.error(`[seo-lighthouse] ${url} failed: ${e.message}`);
      results.push({ target, error: e.message });
    }
  }

  // Locate most recent audit report to append into.
  if (!existsSync(REPORTS_DIR)) {
    console.error('[seo-lighthouse] docs/seo-audits/ missing — run seo-audit.mjs first.');
    process.exit(1);
  }
  const files = readdirSync(REPORTS_DIR)
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.md$/.test(f))
    .sort();
  if (files.length === 0) {
    console.error('[seo-lighthouse] no audit report found; run seo-audit.mjs first.');
    process.exit(1);
  }
  const target = join(REPORTS_DIR, files[files.length - 1]);

  // Append Core Web Vitals section.
  const md = [];
  md.push('');
  md.push('## Lighthouse + Core Web Vitals (PageSpeed Insights, mobile)');
  md.push('');
  md.push('| URL | Perf | A11y | SEO | BP | Lab LCP | Lab CLS | Field LCP | Field CLS | Field INP |');
  md.push('|-----|------|------|-----|----|---------|---------|-----------|-----------|-----------|');
  for (const { target: t, data, error } of results) {
    if (error) {
      md.push(`| \`${t.path}\` | error: ${error.slice(0, 80)} | | | | | | | | |`);
      continue;
    }
    md.push(
      `| [\`${t.path}\`](${data.url}) | ${emoji(data.performance)} ${data.performance ?? '—'} | ${emoji(data.accessibility)} ${data.accessibility ?? '—'} | ${emoji(data.seo)} ${data.seo ?? '—'} | ${emoji(data.bestPractices)} ${data.bestPractices ?? '—'} | ${data.lab.lcp ?? '—'} | ${data.lab.cls ?? '—'} | ${data.field.lcp ?? '—'} | ${data.field.cls ?? '—'} | ${data.field.inp ?? '—'} |`,
    );
  }
  md.push('');
  md.push('_Lab metrics are from a single Lighthouse run. Field metrics come from CrUX over the last 28 days and only populate for URLs with enough real-user traffic._');
  md.push('');

  const original = readFileSync(target, 'utf8');
  writeFileSync(target, original + md.join('\n'));
  console.log(`[seo-lighthouse] appended ${results.length} results → ${target}`);

  // Also drop a JSON sidecar for tooling.
  const sidecarPath = join(DIST, 'seo-lighthouse.json');
  if (existsSync(DIST)) {
    writeFileSync(sidecarPath, JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2));
    console.log(`[seo-lighthouse] wrote ${sidecarPath}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
