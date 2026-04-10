import React, { useState, useCallback } from 'react';
import { createClient } from '@base44/sdk';
import * as sb from '@/api/supabaseEntities';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';

const BASE44_APP_ID = '68929cdad944c572926ab6cb';
const BASE44_SERVER = 'https://base44.app';

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

// Normalize a Base44 record for Supabase insertion
function normalizeRecord(record, tableName) {
  // Remove Base44-only fields
  const { app_id, is_sample, created_by_id, _app_role, collaborator_role,
          disabled, force_password_reset, is_service, is_verified,
          liked_by_users, ...rest } = record;

  // Handle profiles table specifically
  if (tableName === 'profiles') {
    return {
      ...rest,
      created_by: record.email,
    };
  }

  return rest;
}

async function upsertBatch(tableName, records) {
  if (records.length === 0) return 0;
  const CHUNK = 50;
  let inserted = 0;
  for (let i = 0; i < records.length; i += CHUNK) {
    const chunk = records.slice(i, i + CHUNK);
    const { error, count } = await supabase
      .from(tableName)
      .upsert(chunk, { onConflict: 'id', ignoreDuplicates: true })
      .select('id');
    if (error) throw new Error(`${tableName}: ${error.message}`);
    inserted += chunk.length;
  }
  return inserted;
}

export default function AdminMigration() {
  const { user } = useAuth();
  const [log, setLog] = useState([]);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [token, setToken] = useState('');

  const addLog = useCallback((msg, type = 'info') => {
    setLog(prev => [...prev, { msg, type, ts: new Date().toLocaleTimeString() }]);
  }, []);

  const runMigration = useCallback(async () => {
    if (!token.trim()) {
      addLog('Please paste your Base44 access token first.', 'error');
      return;
    }
    setRunning(true);
    setDone(false);
    setLog([]);
    addLog('Starting Base44 → Supabase migration...', 'info');

    // Create a dedicated Base44 client using the provided access token.
    // This bypasses the base44.entities proxy in base44Client.js which
    // otherwise redirects reads to Supabase.
    const base44Client = createClient({
      appId: BASE44_APP_ID,
      serverUrl: BASE44_SERVER,
      token: token.trim(),
      appBaseUrl: BASE44_SERVER,
      requiresAuth: false,
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

        const normalized = records.map(r => normalizeRecord(r, tableName));
        const inserted = await upsertBatch(tableName, normalized);
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
  }, [addLog, token]);

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

      {!running && !done && (
        <button
          onClick={runMigration}
          disabled={!token.trim()}
          className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-bold py-3 px-8 rounded-lg text-lg mb-6"
        >
          Start Migration
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
