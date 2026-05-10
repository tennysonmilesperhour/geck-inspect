#!/usr/bin/env node
/**
 * Google Search Console fetcher for Geck Inspect.
 *
 * Pulls Search Analytics data (queries + pages, 28-day window) via
 * the Search Console API using a service-account JWT. No SDK
 * dependency ,  signs the JWT with Node's built-in crypto.
 *
 * Usage (from scripts/growth-report.mjs):
 *
 *   import { fetchGscQueries, fetchGscPages } from './growth/gsc.mjs';
 *
 *   const token = await getAccessToken();
 *   const queries = await fetchGscQueries(token, siteUrl);
 *
 * Requires env vars:
 *   GOOGLE_SERVICE_ACCOUNT_JSON ,  full JSON key string
 *   GSC_SITE_URL                ,  "sc-domain:geckinspect.com" or
 *                                 "https://geckinspect.com/"
 *
 * Returns null from every fetcher when auth isn't configured, so
 * callers can emit a "secrets not set" placeholder instead of
 * crashing the workflow.
 */

import { createSign } from 'node:crypto';

const SCOPES = [
  'https://www.googleapis.com/auth/webmasters.readonly',
  'https://www.googleapis.com/auth/analytics.readonly',
].join(' ');

function base64url(buf) {
  return Buffer.from(buf).toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Parse the service-account JSON from env. Returns null if missing
 * or malformed ,  callers treat null as "skip gracefully".
 */
export function loadServiceAccount() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw || !raw.trim()) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed.client_email || !parsed.private_key) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Exchange the service-account JWT for an OAuth access token.
 * Returns the token string, or null if auth isn't configured.
 */
export async function getAccessToken() {
  const sa = loadServiceAccount();
  if (!sa) return null;

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    iss: sa.client_email,
    scope: SCOPES,
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claim))}`;
  const signer = createSign('RSA-SHA256');
  signer.update(signingInput);
  const signature = base64url(signer.sign(sa.private_key));
  const jwt = `${signingInput}.${signature}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Google OAuth ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = await res.json();
  return json.access_token;
}

/**
 * Run a Search Analytics query. Low-level wrapper used by the
 * per-dimension helpers below.
 */
async function searchAnalytics(token, siteUrl, body) {
  const encoded = encodeURIComponent(siteUrl);
  const url = `https://www.googleapis.com/webmasters/v3/sites/${encoded}/searchAnalytics/query`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`GSC ${res.status} ${res.statusText}: ${text.slice(0, 300)}`);
  }
  return res.json();
}

function dateNDaysAgo(n) {
  const d = new Date(Date.now() - n * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

/**
 * Top queries over the last 28 days. Each row carries:
 *   keys: [query], clicks, impressions, ctr, position
 */
export async function fetchGscQueries(token, siteUrl, { rowLimit = 500 } = {}) {
  if (!token) return null;
  const body = {
    startDate: dateNDaysAgo(28),
    endDate: dateNDaysAgo(1),
    dimensions: ['query'],
    rowLimit,
    dataState: 'final',
  };
  const json = await searchAnalytics(token, siteUrl, body);
  return json.rows || [];
}

/**
 * Top pages over the last 28 days. Keys = [pagePath].
 */
export async function fetchGscPages(token, siteUrl, { rowLimit = 500 } = {}) {
  if (!token) return null;
  const body = {
    startDate: dateNDaysAgo(28),
    endDate: dateNDaysAgo(1),
    dimensions: ['page'],
    rowLimit,
    dataState: 'final',
  };
  const json = await searchAnalytics(token, siteUrl, body);
  return json.rows || [];
}

/**
 * Query × page joint report ,  needed to find which page ranks for
 * which query. Expensive (rowLimit capped lower), used for the
 * per-page snippet-rewrite recommendations.
 */
export async function fetchGscQueryPage(token, siteUrl, { rowLimit = 1000 } = {}) {
  if (!token) return null;
  const body = {
    startDate: dateNDaysAgo(28),
    endDate: dateNDaysAgo(1),
    dimensions: ['query', 'page'],
    rowLimit,
    dataState: 'final',
  };
  const json = await searchAnalytics(token, siteUrl, body);
  return json.rows || [];
}
