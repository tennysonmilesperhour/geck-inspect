import React, { useState, useCallback } from 'react';
import { createClient } from '@base44/sdk';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import * as sb from '@/api/supabaseEntities';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';

const BASE44_APP_ID = '68929cdad944c572926ab6cb';
const BASE44_SERVER = 'https://base44.app';
const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ||
  'https://mmuglfphhwlaluyfyxsp.supabase.co';

// Base44 stores its images in a public bucket on their own Supabase project.
// The exact host wasn't known up front, so we scan for any HTTP(S) URL that
// looks like an image and is NOT already on our own Supabase project.
const MEDIA_BUCKET = 'geck-inspect-media';
const URL_RE = /https?:\/\/[^\s"'<>)\]}]+/g;
const IMAGE_EXT_RE = /\.(jpe?g|png|gif|webp|avif|svg|bmp|heic|heif)(\?|#|$)/i;

function looksLikeImageUrl(url) {
  return (
    url.includes('/storage/v1/object/public/') ||
    IMAGE_EXT_RE.test(url)
  );
}

// Entity definitions: [Base44EntityName, SupabaseTableName, label]
const ENTITY_DEFS = [
  ['User',                   'profiles',                    'User Profiles',            true],
  ['Gecko',                  'geckos',                      'Geckos',                   false],
  ['BreedingPlan',           'breeding_plans',              'Breeding Plans',           false],
  ['Egg',                    'eggs',                        'Eggs',                     false],
  ['WeightRecord',           'weight_records',              'Weight Records',           false],
  ['GeckoImage',             'gecko_images',                'Gecko Images',             false],
  ['GeckoEvent',             'gecko_events',                'Gecko Events',             false],
  ['FeedingGroup',           'feeding_groups',              'Feeding Groups',           false],
  ['ForumCategory',          'forum_categories',            'Forum Categories',         false],
  ['ForumPost',              'forum_posts',                 'Forum Posts',              false],
  ['ForumComment',           'forum_comments',              'Forum Comments',           false],
  ['ForumLike',              'forum_likes',                 'Forum Likes',              false],
  ['MorphGuide',             'morph_guides',                'Morph Guides',             false],
  ['MorphGuideComment',      'morph_guide_comments',        'Morph Guide Comments',     false],
  ['MorphReferenceImage',    'morph_reference_images',      'Morph Reference Images',   false],
  ['MorphTrait',             'morph_traits',                'Morph Traits',             false],
  ['MorphPriceCache',        'morph_price_cache',           'Morph Price Cache',        false],
  ['CareGuideSection',       'care_guide_sections',         'Care Guide Sections',      false],
  ['GeckoOfTheDay',          'gecko_of_the_day',            'Gecko of the Day',         false],
  ['GeckoLike',              'gecko_likes',                 'Gecko Likes',              false],
  ['ClassificationVote',     'classification_votes',        'Classification Votes',     false],
  ['ExpertAction',           'expert_actions',              'Expert Actions',           false],
  ['ExpertVerificationRequest','expert_verification_requests','Expert Verification Requests',false],
  ['DirectMessage',          'direct_messages',             'Direct Messages',          false],
  ['Notification',           'notifications',               'Notifications',            false],
  ['UserBadge',              'user_badges',                 'User Badges',              false],
  ['UserActivity',           'user_activity',               'User Activity',            false],
  ['UserFollow',             'user_follows',                'User Follows',             false],
  ['LineagePlaceholder',     'lineage_placeholders',        'Lineage Placeholders',     false],
  ['OtherReptile',           'other_reptiles',              'Other Reptiles',           false],
  ['ReptileEvent',           'reptile_events',              'Reptile Events',           false],
  ['MarketplaceLike',        'marketplace_likes',           'Marketplace Likes',        false],
  ['MarketplaceCost',        'marketplace_costs',           'Marketplace Costs',        false],
  ['Project',                'projects',                    'Projects',                 false],
  ['Task',                   'tasks',                       'Tasks',                    false],
  ['ChangeLog',              'change_logs',                 'Change Logs',              false],
  ['PageConfig',             'page_config',                 'Page Config',              false],
  ['AppSettings',            'app_settings',                'App Settings',             false],
  ['ScrapedTrainingData',    'scraped_training_data',       'Scraped Training Data',    false],
  ['PaymentEvent',           'payment_events',              'Payment Events',           false],
  ['StripeWebhookLog',       'stripe_webhook_logs',         'Stripe Webhook Logs',      false],
];

async function fetchAllFromBase44(base44Client, entityName) {
  const entity = base44Client.entities[entityName];
  if (!entity) return [];
  let all = [];
  let skip = 0;
  const limit = 200;
  while (true) {
    const batch = await entity.filter({}, null, limit, skip);
    if (!batch || batch.length === 0) break;
    all = all.concat(batch);
    if (batch.length < limit) break;
    skip += limit;
  }
  return all;
}

// Normalize a Base44 record for Supabase insertion.
// Returns null if the record should be skipped entirely.
function normalizeRecord(record, tableName) {
  // Remove Base44-only fields
  const { app_id, is_sample, created_by_id, _app_role, collaborator_role,
          disabled, force_password_reset, is_service, is_verified,
          liked_by_users, ...rest } = record;

  // Convert empty strings to null so PostgreSQL doesn't reject them
  // when the column is a date, timestamp, or other non-text type.
  const cleaned = {};
  for (const [k, v] of Object.entries(rest)) {
    cleaned[k] = v === '' ? null : v;
  }

  // Per-table fixups for NOT NULL columns and special cases
  if (tableName === 'profiles') {
    return {
      ...cleaned,
      created_by: record.email,
    };
  }
  if (tableName === 'geckos') {
    if (!cleaned.name) cleaned.name = 'Unnamed Gecko';
    return cleaned;
  }
  if (tableName === 'app_settings') {
    // setting_key is NOT NULL; skip rows without one
    if (!cleaned.setting_key) return null;
    return cleaned;
  }

  return cleaned;
}

// Per-table override for which column to use as the upsert conflict target.
// Default is 'id'. profiles needs 'email' because we may already have an
// admin row with the same email but a different id.
const CONFLICT_COLUMN = {
  profiles: 'email',
};

// Upsert a batch of records, automatically retrying after stripping any
// columns that Supabase doesn't know about (schema mismatch with Base44).
async function upsertBatch(sbAdmin, tableName, records, addLog) {
  if (records.length === 0) return 0;
  const CHUNK = 50;
  const conflictColumn = CONFLICT_COLUMN[tableName] || 'id';
  const droppedColumns = new Set();
  let inserted = 0;

  for (let i = 0; i < records.length; i += CHUNK) {
    let chunk = records.slice(i, i + CHUNK).map((r) => {
      const copy = { ...r };
      for (const col of droppedColumns) delete copy[col];
      return copy;
    });

    let attempts = 0;
    while (true) {
      const { error } = await sbAdmin
        .from(tableName)
        .upsert(chunk, { onConflict: conflictColumn, ignoreDuplicates: true });
      if (!error) {
        inserted += chunk.length;
        break;
      }
      const match = error.message.match(/Could not find the '([^']+)' column/);
      if (match && attempts < 20) {
        const badCol = match[1];
        droppedColumns.add(badCol);
        addLog(`  ! Stripping unknown column '${badCol}' and retrying`, 'dim');
        chunk = chunk.map((r) => {
          const copy = { ...r };
          delete copy[badCol];
          return copy;
        });
        attempts++;
        continue;
      }
      throw new Error(`${tableName}: ${error.message}`);
    }
  }
  return inserted;
}

// ---------------------------------------------------------------------------
// Photo migration
// ---------------------------------------------------------------------------

// Recursively find every image URL in a value (including inside arrays and
// nested objects). Skips URLs already hosted on our own Supabase project so
// re-runs are idempotent.
function collectImageUrls(value, set, ourHost) {
  if (typeof value === 'string') {
    const matches = value.match(URL_RE);
    if (matches) {
      for (const url of matches) {
        if (!looksLikeImageUrl(url)) continue;
        if (url.includes(ourHost)) continue;
        set.add(url);
      }
    }
  } else if (Array.isArray(value)) {
    for (const v of value) collectImageUrls(v, set, ourHost);
  } else if (value && typeof value === 'object') {
    for (const v of Object.values(value)) collectImageUrls(v, set, ourHost);
  }
}

// Recursively rewrite every string in a value using a URL -> URL map.
function rewriteUrls(value, map) {
  if (typeof value === 'string') {
    return map.get(value) || value;
  }
  if (Array.isArray(value)) {
    return value.map((v) => rewriteUrls(v, map));
  }
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = rewriteUrls(v, map);
    }
    return out;
  }
  return value;
}

// Build a deterministic storage path for a given source URL.
// Uses hostname + pathname so the same URL always maps to the same file,
// and so filenames from the origin are preserved where possible.
function storagePathForUrl(url) {
  let u;
  try { u = new URL(url); } catch { return null; }
  let path = u.hostname + u.pathname;
  // Strip the leading / after hostname is already avoided; collapse any //
  path = path.replace(/\/+/g, '/');
  try { path = decodeURIComponent(path); } catch { /* keep */ }
  // Supabase Storage paths can't start with a slash
  if (path.startsWith('/')) path = path.slice(1);
  return path;
}

// Download one image, upload it to our own Supabase bucket, and return the
// new public URL. Idempotent: upsert is used on upload.
async function migrateOneImage(sbAdmin, url) {
  const path = storagePathForUrl(url);
  if (!path) throw new Error('could not parse URL');

  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();

  const { error: upErr } = await sbAdmin.storage
    .from(MEDIA_BUCKET)
    .upload(path, blob, {
      upsert: true,
      contentType: blob.type || 'application/octet-stream',
    });
  if (upErr) throw upErr;

  const { data } = sbAdmin.storage.from(MEDIA_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export default function AdminMigration() {
  const { user } = useAuth();
  const [log, setLog] = useState([]);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [token, setToken] = useState('');
  const [serviceKey, setServiceKey] = useState('');

  const addLog = useCallback((msg, type = 'info') => {
    setLog(prev => [...prev, { msg, type, ts: new Date().toLocaleTimeString() }]);
  }, []);

  const runMigration = useCallback(async () => {
    if (!token.trim()) {
      addLog('Please paste your Base44 access token first.', 'error');
      return;
    }
    if (!serviceKey.trim()) {
      addLog('Please paste your Supabase service role key first.', 'error');
      return;
    }
    setRunning(true);
    setDone(false);
    setLog([]);
    addLog('Starting Base44 → Supabase migration...', 'info');

    // Aggressively sanitize pasted credentials: strip every character
    // outside printable ASCII. This catches stray newlines, zero-width
    // spaces, smart quotes, or non-breaking spaces that sneak in during
    // copy-paste and break XMLHttpRequest.setRequestHeader.
    const sanitize = (s) => s.replace(/[^\x20-\x7E]/g, '');
    const cleanToken = sanitize(token);
    const cleanServiceKey = sanitize(serviceKey);

    if (cleanToken.length !== token.trim().length) {
      addLog(
        `  ! Stripped ${token.trim().length - cleanToken.length} invalid character(s) from Base44 token`,
        'dim'
      );
    }
    if (cleanServiceKey.length !== serviceKey.trim().length) {
      addLog(
        `  ! Stripped ${serviceKey.trim().length - cleanServiceKey.length} invalid character(s) from Supabase key`,
        'dim'
      );
    }
    if (!cleanToken) {
      addLog('Base44 token is empty after sanitization.', 'error');
      setRunning(false);
      return;
    }
    if (!cleanServiceKey) {
      addLog('Supabase service role key is empty after sanitization.', 'error');
      setRunning(false);
      return;
    }

    // Create a dedicated Base44 client using the provided access token.
    // This bypasses the base44.entities proxy in base44Client.js which
    // otherwise redirects reads to Supabase.
    const base44Client = createClient({
      appId: BASE44_APP_ID,
      serverUrl: BASE44_SERVER,
      token: cleanToken,
      appBaseUrl: BASE44_SERVER,
      requiresAuth: false,
    });

    // Create a Supabase admin client using the service role key.
    // This bypasses row-level security so we can insert into all tables.
    const sbAdmin = createSupabaseClient(SUPABASE_URL, cleanServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    let totalRecords = 0;
    for (const [entityName, tableName, label] of ENTITY_DEFS) {
      try {
        addLog(`Fetching ${label} from Base44...`, 'info');
        const records = await fetchAllFromBase44(base44Client, entityName);
        addLog(`  Found ${records.length} records`, 'info');

        if (records.length === 0) {
          addLog(`  Skipping (no records)`, 'dim');
          continue;
        }

        const normalized = records
          .map(r => normalizeRecord(r, tableName))
          .filter(r => r !== null);
        const skipped = records.length - normalized.length;
        if (skipped > 0) {
          addLog(`  ! Skipped ${skipped} record(s) missing required fields`, 'dim');
        }
        const inserted = await upsertBatch(sbAdmin, tableName, normalized, addLog);
        addLog(`  ✓ Inserted/updated ${inserted} records into ${tableName}`, 'success');
        totalRecords += inserted;
      } catch (err) {
        addLog(`  ✗ Error migrating ${label}: ${err.message}`, 'error');
      }
    }

    addLog(``, 'info');
    addLog(`Migration complete! Total records: ${totalRecords}`, 'success');
    setDone(true);
    setRunning(false);
  }, [addLog, token, serviceKey]);

  const runPhotoMigration = useCallback(async () => {
    if (!serviceKey.trim()) {
      addLog('Please paste your Supabase service role key first.', 'error');
      return;
    }
    setRunning(true);
    setDone(false);
    setLog([]);
    addLog('Starting photo migration (Base44 → Supabase Storage)...', 'info');

    const sanitize = (s) => s.replace(/[^\x20-\x7E]/g, '');
    const cleanServiceKey = sanitize(serviceKey);
    if (!cleanServiceKey) {
      addLog('Supabase service role key is empty after sanitization.', 'error');
      setRunning(false);
      return;
    }

    const sbAdmin = createSupabaseClient(SUPABASE_URL, cleanServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Verify the bucket exists so we fail fast with a clear message.
    const { data: buckets, error: bucketErr } = await sbAdmin.storage.listBuckets();
    if (bucketErr) {
      addLog(`Could not list buckets: ${bucketErr.message}`, 'error');
      setRunning(false);
      return;
    }
    if (!buckets.find((b) => b.name === MEDIA_BUCKET)) {
      addLog(
        `Bucket '${MEDIA_BUCKET}' does not exist. Create it in Supabase → Storage (set to Public) and try again.`,
        'error'
      );
      setRunning(false);
      return;
    }
    addLog(`Found bucket '${MEDIA_BUCKET}'.`, 'dim');

    // Our own Supabase host (to skip URLs already migrated)
    const ourHost = new URL(SUPABASE_URL).hostname;

    // Phase 1: discovery — scan every row and collect all distinct image URLs
    // and the hostnames they live on. This lets us see exactly what's out
    // there before we start downloading anything.
    addLog('Phase 1: discovering image URLs...', 'info');
    const allUrls = new Set();
    const hostCounts = new Map();
    const allRows = []; // { tableName, row, urls }

    for (const [, tableName, label] of ENTITY_DEFS) {
      const { data: rows, error: selectErr } = await sbAdmin
        .from(tableName)
        .select('*');
      if (selectErr) {
        addLog(`  ✗ ${label}: ${selectErr.message}`, 'error');
        continue;
      }
      if (!rows || rows.length === 0) continue;

      for (const row of rows) {
        const urls = new Set();
        collectImageUrls(row, urls, ourHost);
        if (urls.size === 0) continue;
        for (const u of urls) {
          allUrls.add(u);
          try {
            const h = new URL(u).hostname;
            hostCounts.set(h, (hostCounts.get(h) || 0) + 1);
          } catch {}
        }
        allRows.push({ tableName, row, urls });
      }
    }

    addLog(
      `  Found ${allUrls.size} distinct image URLs across ${allRows.length} rows`,
      'info'
    );
    if (hostCounts.size === 0) {
      addLog(
        '  No image URLs found. Either there are no images, or the URL format is something the scanner doesn\'t recognize.',
        'dim'
      );
      setDone(true);
      setRunning(false);
      return;
    }
    for (const [host, count] of [...hostCounts.entries()].sort((a, b) => b[1] - a[1])) {
      addLog(`    ${host}: ${count} occurrence(s)`, 'dim');
    }

    // Phase 2: download + upload + rewrite
    addLog('Phase 2: downloading and uploading...', 'info');
    const urlMap = new Map();
    let uploaded = 0;
    let failed = 0;
    let rowsUpdated = 0;

    // Upload every unique URL first so the rewrite phase is quick
    let urlIdx = 0;
    for (const url of allUrls) {
      urlIdx++;
      try {
        const newUrl = await migrateOneImage(sbAdmin, url);
        urlMap.set(url, newUrl);
        uploaded++;
        if (urlIdx % 10 === 0 || urlIdx === allUrls.size) {
          addLog(`  ${urlIdx}/${allUrls.size} uploaded`, 'dim');
        }
      } catch (err) {
        addLog(`  ! ${url.slice(-70)}: ${err.message}`, 'error');
        urlMap.set(url, url);
        failed++;
      }
    }

    // Phase 3: rewrite rows with the new URLs
    addLog('Phase 3: rewriting rows...', 'info');
    for (const { tableName, row } of allRows) {
      const patch = {};
      let changed = false;
      for (const [col, val] of Object.entries(row)) {
        if (col === 'id') continue;
        const newVal = rewriteUrls(val, urlMap);
        if (typeof val === 'object' && val !== null) {
          if (JSON.stringify(newVal) !== JSON.stringify(val)) {
            patch[col] = newVal;
            changed = true;
          }
        } else if (newVal !== val) {
          patch[col] = newVal;
          changed = true;
        }
      }
      if (!changed) continue;
      const { error: updErr } = await sbAdmin
        .from(tableName)
        .update(patch)
        .eq('id', row.id);
      if (updErr) {
        addLog(
          `  ! ${tableName} ${String(row.id).slice(0, 8)}: ${updErr.message}`,
          'error'
        );
      } else {
        rowsUpdated++;
      }
    }

    addLog(``, 'info');
    addLog(
      `Photo migration complete! ${uploaded} uploaded, ${failed} failed, ${rowsUpdated} rows updated`,
      'success'
    );
    setDone(true);
    setRunning(false);
  }, [addLog, serviceKey]);

  // Only admin can access this page
  if (!user || user.role !== 'admin') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-slate-400 text-lg">Admin access required.</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-white mb-2">Base44 → Supabase Migration</h1>
      <p className="text-slate-400 mb-6">
        This tool migrates all existing data from Base44 to the Supabase database.
        Run this once. Existing records are skipped (upsert by ID).
      </p>

      <div className="bg-slate-900 border border-slate-700 rounded-lg p-4 mb-6">
        <label className="block text-slate-300 text-sm font-semibold mb-2">
          Base44 Access Token
        </label>
        <p className="text-slate-500 text-xs mb-3">
          Open the old Base44 app in another tab, log in, then open DevTools
          (F12) → Application → Local Storage → copy the value of the
          <code className="text-emerald-400 mx-1">base44_access_token</code>
          key and paste it below.
        </p>
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Paste Base44 access token here..."
          className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-200 font-mono text-xs"
          disabled={running}
        />
      </div>

      <div className="bg-slate-900 border border-slate-700 rounded-lg p-4 mb-6">
        <label className="block text-slate-300 text-sm font-semibold mb-2">
          Supabase Service Role Key
        </label>
        <p className="text-slate-500 text-xs mb-3">
          Needed to bypass row-level security during the migration. Get it
          from your Supabase dashboard → Project Settings → API → copy the
          <code className="text-emerald-400 mx-1">service_role</code>
          key (not the anon key). This is never stored or sent anywhere
          except directly to your Supabase project.
        </p>
        <input
          type="password"
          value={serviceKey}
          onChange={(e) => setServiceKey(e.target.value)}
          placeholder="Paste Supabase service role key here..."
          className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-200 font-mono text-xs"
          disabled={running}
        />
      </div>

      {!running && !done && (
        <button
          onClick={runMigration}
          disabled={!token.trim() || !serviceKey.trim()}
          className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-bold py-3 px-8 rounded-lg text-lg mb-3 mr-3"
        >
          Start Migration
        </button>
      )}

      {!running && (
        <button
          onClick={runPhotoMigration}
          disabled={!serviceKey.trim()}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-bold py-3 px-8 rounded-lg text-lg mb-6"
          title="Copies images from Base44's public bucket into your own Supabase Storage bucket and rewrites the URLs. Needs only the Supabase service role key."
        >
          Migrate Photos
        </button>
      )}

      {running && (
        <div className="flex items-center gap-3 mb-6">
          <div className="w-5 h-5 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
          <span className="text-emerald-400 font-medium">Migration running...</span>
        </div>
      )}

      {done && (
        <div className="bg-emerald-900/30 border border-emerald-600 rounded-lg p-4 mb-6">
          <p className="text-emerald-400 font-bold text-lg">Migration complete!</p>
          <p className="text-slate-300 text-sm mt-1">
            All data has been copied to Supabase. The app is now running entirely on Supabase.
          </p>
        </div>
      )}

      {log.length > 0 && (
        <div className="bg-slate-900 border border-slate-700 rounded-lg p-4 font-mono text-sm max-h-[60vh] overflow-y-auto">
          {log.map((entry, i) => (
            <div key={i} className={
              entry.type === 'error' ? 'text-red-400' :
              entry.type === 'success' ? 'text-emerald-400' :
              entry.type === 'dim' ? 'text-slate-500' :
              'text-slate-300'
            }>
              <span className="text-slate-600 mr-2">{entry.ts}</span>
              {entry.msg}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
