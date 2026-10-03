// Admin panel data access (feature-completeness audit, step 22).
//
// Each Admin tile asks the database for exactly what it shows, through
// admin-only functions (see supabase/migrations/20261003022847_admin_panel_rpcs.sql),
// instead of downloading whole tables into the browser. Downloading
// gecko_images pulled every image embedding and still stopped at the
// API's row limit, so the counts were wrong as well as slow.
//
// "Real accounts" are profiles with a login. Legacy rows imported from
// the old platform have no login and cannot read a message, so they are
// left out of the counts and out of mass messages.
import { supabase } from '@/lib/supabaseClient';

async function rpc(name) {
  const { data, error } = await supabase.rpc(name);
  if (error) throw error;
  return data;
}

export const fetchOverviewStats = () => rpc('admin_overview_stats');
export const fetchAccountDirectory = async () => (await rpc('admin_account_directory')) || [];
export const fetchHealthStatus = () => rpc('admin_health_status');

// Turn the RPC's parallel arrays into the { key, value } points the
// sparklines read.
export function seriesPoints(series, key) {
  const labels = series?.labels || [];
  const values = series?.[key] || [];
  return labels.map((label, i) => ({ key: label, value: Number(values[i] || 0) }));
}

export const BROADCAST_GROUPS = ['all', 'experts', 'reviewers', 'admins', 'non_experts'];

// Who a mass message would reach: real accounts only, never the sender.
export function broadcastRecipients(directory, group, senderEmail) {
  const sender = String(senderEmail || '').toLowerCase();
  const base = (directory || []).filter(
    (u) => u.has_login && u.email && u.email.toLowerCase() !== sender,
  );
  switch (group) {
    case 'experts':
      return base.filter((u) => u.is_expert === true);
    case 'reviewers':
      return base.filter((u) => u.role === 'expert_reviewer' || u.role === 'admin');
    case 'admins':
      return base.filter((u) => u.role === 'admin');
    case 'non_experts':
      return base.filter((u) => !u.is_expert && u.role !== 'admin');
    default:
      return base;
  }
}

// The deploy this browser is running, stamped at build time by
// vite.config.js. Falls back to "dev" in local runs and tests.
export function buildInfo() {
  /* global __BUILD_INFO__ */
  const info = typeof __BUILD_INFO__ !== 'undefined' ? __BUILD_INFO__ : null;
  return {
    commit: info?.commit || 'dev',
    shortCommit: (info?.commit || 'dev').slice(0, 7),
    branch: info?.branch || null,
    builtAt: info?.builtAt || null,
    deployEnv: info?.env || null,
  };
}

// A scheduled job needs attention when it is switched on and its last run
// failed, or it has failed in the last week.
export function jobNeedsAttention(job) {
  if (!job || job.error) return true;
  if (!job.active) return false;
  return job.last_status === 'failed' || Number(job.failures_7d || 0) > 0;
}
