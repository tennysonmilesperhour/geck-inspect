#!/usr/bin/env node
/**
 * Push every published URL to IndexNow.
 *
 * IndexNow is the modern replacement for the old sitemap "ping" endpoints
 * that Google (June 2023) and Bing both retired. A single POST notifies
 * Bing, Yandex, Seznam, and DuckDuckGo at once, and they re-crawl the
 * submitted URLs on their next pass instead of waiting to rediscover them.
 *
 * Source of truth is public/sitemap.xml, so this always submits exactly
 * what we publish. Run it after a deploy is live (the URLs must resolve
 * for the engines to accept them). Wired into
 * .github/workflows/indexnow-submit.yml to run automatically whenever the
 * sitemap changes on main.
 *
 * Google is deliberately NOT covered here: Google removed programmatic
 * sitemap submission and now only accepts sitemaps through Search Console.
 * That is a one-time, human, OAuth-gated step. See the PR / README for the
 * manual checklist. Google still auto-discovers the sitemap via the
 * Sitemap: line in robots.txt, so no per-deploy action is needed there.
 *
 * Usage:
 *   node scripts/submit-indexnow.mjs           # submit all sitemap URLs
 *   node scripts/submit-indexnow.mjs --dry-run # print payload, do not POST
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');

const HOST = 'geckinspect.com';
const KEY = 'c9f2d53b0ac96f2ef77485a2b5d9b280';
const KEY_LOCATION = `https://${HOST}/${KEY}.txt`;
const ENDPOINT = 'https://api.indexnow.org/indexnow';

// IndexNow caps a single bulk submission at 10,000 URLs. We are far under
// that, but chunk anyway so this keeps working as the catalogue grows.
const MAX_URLS_PER_REQUEST = 10000;

const DRY_RUN = process.argv.includes('--dry-run');

function readSitemapUrls() {
  const xml = readFileSync(resolve(REPO_ROOT, 'public/sitemap.xml'), 'utf8');
  const urls = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1].trim());
  const onHost = urls.filter((u) => u.startsWith(`https://${HOST}/`));
  if (onHost.length === 0) {
    throw new Error('submit-indexnow: no on-host URLs found in public/sitemap.xml');
  }
  return onHost;
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function submit(urlList) {
  const body = JSON.stringify({
    host: HOST,
    key: KEY,
    keyLocation: KEY_LOCATION,
    urlList,
  });

  if (DRY_RUN) {
    console.log(`[indexnow] DRY RUN, would POST ${urlList.length} URLs to ${ENDPOINT}`);
    console.log(body.slice(0, 500) + (body.length > 500 ? '...' : ''));
    return 200;
  }

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
    body,
  });

  // IndexNow returns 200 (accepted) or 202 (accepted, key validation
  // pending) on success. Anything else is an error worth surfacing.
  const text = await res.text().catch(() => '');
  if (res.status !== 200 && res.status !== 202) {
    throw new Error(
      `[indexnow] submission failed: HTTP ${res.status} ${res.statusText} ${text}`.trim(),
    );
  }
  return res.status;
}

async function main() {
  const urls = readSitemapUrls();
  const batches = chunk(urls, MAX_URLS_PER_REQUEST);
  console.log(
    `[indexnow] submitting ${urls.length} URL(s) in ${batches.length} batch(es) to Bing / Yandex / Seznam / DuckDuckGo`,
  );
  for (const [i, batch] of batches.entries()) {
    const status = await submit(batch);
    console.log(`[indexnow] batch ${i + 1}/${batches.length}: HTTP ${status} (${batch.length} URLs)`);
  }
  console.log('[indexnow] done');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
