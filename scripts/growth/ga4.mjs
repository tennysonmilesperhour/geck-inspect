#!/usr/bin/env node
/**
 * Google Analytics 4 Data API fetcher for Geck Inspect.
 *
 * Pulls page-level engagement over a 7-day window via the GA4 Data
 * API v1beta. Reuses the service-account token minted by
 * ./gsc.mjs — pass an access token in, get rows out.
 *
 * Env vars:
 *   GA4_PROPERTY_ID — numeric property id (e.g. "346789123"), NOT
 *                     the G-WLGHJ7KC2N measurement id
 *
 * Returns null from every fetcher when GA4_PROPERTY_ID is missing
 * or the token is falsy, so callers can emit "secrets not set"
 * placeholders without crashing.
 */

function propertyId() {
  const id = process.env.GA4_PROPERTY_ID;
  if (!id || !/^\d+$/.test(id.trim())) return null;
  return id.trim();
}

function dateNDaysAgo(n) {
  const d = new Date(Date.now() - n * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

async function runReport(token, body) {
  const id = propertyId();
  if (!id || !token) return null;
  const url = `https://analyticsdata.googleapis.com/v1beta/properties/${id}:runReport`;
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
    throw new Error(`GA4 ${res.status} ${res.statusText}: ${text.slice(0, 300)}`);
  }
  return res.json();
}

/**
 * Rows shape returned by GA4 runReport:
 *   { dimensionValues: [{value}], metricValues: [{value}] }
 * We flatten to a friendlier { <dim>: v, <metric>: number } map.
 */
function flatten(json) {
  if (!json || !json.rows) return [];
  const dimNames = (json.dimensionHeaders || []).map((h) => h.name);
  const metNames = (json.metricHeaders || []).map((h) => h.name);
  return json.rows.map((row) => {
    const out = {};
    (row.dimensionValues || []).forEach((v, i) => { out[dimNames[i]] = v.value; });
    (row.metricValues || []).forEach((v, i) => {
      const n = Number(v.value);
      out[metNames[i]] = Number.isFinite(n) ? n : v.value;
    });
    return out;
  });
}

/**
 * Per-page engagement over 7 days. Dimensions: pagePath.
 * Metrics: screenPageViews, engagementRate, averageSessionDuration,
 * userEngagementDuration.
 */
export async function fetchGa4PageEngagement(token, { days = 7, limit = 100 } = {}) {
  if (!token || !propertyId()) return null;
  const body = {
    dateRanges: [{ startDate: dateNDaysAgo(days), endDate: 'today' }],
    dimensions: [{ name: 'pagePath' }],
    metrics: [
      { name: 'screenPageViews' },
      { name: 'engagementRate' },
      { name: 'userEngagementDuration' },
      { name: 'sessions' },
    ],
    orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
    limit,
  };
  const json = await runReport(token, body);
  return flatten(json);
}

/**
 * Traffic-source mix over 7 days. Dimensions: sessionSource,
 * sessionMedium. Metrics: sessions, engagedSessions.
 */
export async function fetchGa4TrafficSources(token, { days = 7, limit = 50 } = {}) {
  if (!token || !propertyId()) return null;
  const body = {
    dateRanges: [{ startDate: dateNDaysAgo(days), endDate: 'today' }],
    dimensions: [{ name: 'sessionSource' }, { name: 'sessionMedium' }],
    metrics: [{ name: 'sessions' }, { name: 'engagedSessions' }],
    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
    limit,
  };
  const json = await runReport(token, body);
  return flatten(json);
}

/**
 * Totals summary: sessions, users, pageviews, engagement rate for
 * the report window. Used for the "this week at a glance" block.
 */
export async function fetchGa4Summary(token, { days = 7 } = {}) {
  if (!token || !propertyId()) return null;
  const body = {
    dateRanges: [{ startDate: dateNDaysAgo(days), endDate: 'today' }],
    metrics: [
      { name: 'sessions' },
      { name: 'totalUsers' },
      { name: 'screenPageViews' },
      { name: 'engagementRate' },
      { name: 'averageSessionDuration' },
    ],
  };
  const json = await runReport(token, body);
  const rows = flatten(json);
  return rows[0] || null;
}
