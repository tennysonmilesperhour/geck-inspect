import { useEffect, useMemo, useState } from 'react';
import { Loader2, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/lib/supabaseClient';

// Plain names for the first-touch source buckets (src/lib/attribution.js).
const SOURCE_LABELS = {
  direct: 'Direct or unknown referrer',
  search: 'Search engine',
  social: 'Social media',
  ai_assistant: 'AI assistant',
  morphmarket: 'MorphMarket',
  other_site: 'Another website',
  passport: 'Gecko passport',
  waitlist: 'Breeder waitlist',
  store: 'Store',
  invite: 'Collection invite',
  claim: 'Transfer claim',
  referral: 'Referral link',
  store_grant: 'Store receipt',
  unknown: 'Not recorded',
};

function sourceLabel(source) {
  if (!source) return SOURCE_LABELS.unknown;
  if (source.startsWith('utm:')) return `Campaign: ${source.slice(4)}`;
  return SOURCE_LABELS[source] || source;
}

function weekLabel(day) {
  const [y, m, d] = String(day).split('-').map(Number);
  if (!y) return String(day);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function pct(part, whole) {
  if (!whole) return 'n/a';
  return `${Math.round((part / whole) * 100)}%`;
}

function sumRows(rows) {
  return rows.reduce(
    (acc, r) => ({
      signups: acc.signups + Number(r.signups || 0),
      first_gecko_1d: acc.first_gecko_1d + Number(r.first_gecko_1d || 0),
      d1_eligible: acc.d1_eligible + Number(r.d1_eligible || 0),
      d1_returned: acc.d1_returned + Number(r.d1_returned || 0),
      d7_eligible: acc.d7_eligible + Number(r.d7_eligible || 0),
      d7_returned: acc.d7_returned + Number(r.d7_returned || 0),
    }),
    { signups: 0, first_gecko_1d: 0, d1_eligible: 0, d1_returned: 0, d7_eligible: 0, d7_returned: 0 },
  );
}

/** Group the RPC's (week, source) rows by one key and total them. */
function groupFunnelRows(rows, key) {
  const groups = new Map();
  for (const r of rows || []) {
    const k = r[key];
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(r);
  }
  return Array.from(groups.entries()).map(([k, list]) => ({ key: k, ...sumRows(list) }));
}

function isMissingFunction(error) {
  const text = `${error?.code || ''} ${error?.message || ''}`;
  return /PGRST202|42883|could not find the function|does not exist/i.test(text);
}

/**
 * The growth funnel: weekly signups, how many added a gecko within a day,
 * and how many came back on day 1 (24 to 48 hours after signup) and in
 * week 2 (7 to 14 days after), split by first-touch source. Admin
 * accounts are left out. From public.admin_growth_funnel(), which only
 * answers admins (migration 20261005120000).
 */
export default function GrowthFunnelCard({ weeks = 12 }) {
  const [payload, setPayload] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    supabase.rpc('admin_growth_funnel', { p_weeks: weeks }).then(({ data, error: err }) => {
      if (cancelled) return;
      if (err) setError(err);
      else setPayload(data || { rows: [] });
    });
    return () => { cancelled = true; };
  }, [weeks]);

  const rows = useMemo(() => (Array.isArray(payload?.rows) ? payload.rows : []), [payload]);
  const byWeek = useMemo(
    () => groupFunnelRows(rows, 'week_start').sort((a, b) => String(b.key).localeCompare(String(a.key))),
    [rows],
  );
  const bySource = useMemo(
    () => groupFunnelRows(rows, 'source').sort((a, b) => b.signups - a.signups),
    [rows],
  );

  const header = (
    <CardHeader className="pb-2">
      <CardTitle className="text-slate-100 text-base flex items-center gap-2">
        <TrendingUp className="w-4 h-4 text-slate-400" />
        Growth funnel
      </CardTitle>
      <p className="text-xs text-slate-500">
        New accounts by signup week (Monday to Sunday, Denver time), admin accounts left out. First gecko
        means a gecko added within a day of signup. Day 1 means any visit 24 to 48 hours after signup; week 2
        means any visit 7 to 14 days after. Only accounts old enough are counted for each return column.
      </p>
    </CardHeader>
  );

  if (error) {
    return (
      <Card>
        {header}
        <CardContent>
          {isMissingFunction(error) ? (
            <p className="text-sm text-amber-200/90">
              The funnel needs the database function in migration 20261005150008_growth_funnel_admin.sql.
              It has not been applied yet, so there is nothing to show.
            </p>
          ) : (
            <p className="text-sm text-red-300">Could not load: {error.message}</p>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      {header}
      <CardContent>
        {payload === null ? (
          <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-6">No new accounts in this window.</p>
        ) : (
          <div className="space-y-5">
            <FunnelTable title="By week" rows={byWeek} label={(k) => weekLabel(k)} />
            <FunnelTable title="By first-touch source" rows={bySource} label={sourceLabel} />
            <p className="text-[11px] text-slate-500">
              Source comes from the first page a browser opened (referrer site, UTM tags, or a passport,
              waitlist, store, invite or claim link). Accounts from before 5 October 2026 show as not recorded.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function FunnelTable({ title, rows, label }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider text-slate-500 mb-1">{title}</p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-wider text-slate-500 text-left">
              <th className="py-1.5 pr-3 font-medium" />
              <th className="py-1.5 pr-3 font-medium text-right">Signups</th>
              <th className="py-1.5 pr-3 font-medium text-right">First gecko</th>
              <th className="py-1.5 pr-3 font-medium text-right">Day 1</th>
              <th className="py-1.5 font-medium text-right">Week 2</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={String(r.key)} className="border-t border-slate-800 text-slate-200">
                <td className="py-1.5 pr-3 truncate max-w-[12rem]">{label(r.key)}</td>
                <td className="py-1.5 pr-3 text-right">{r.signups}</td>
                <td className="py-1.5 pr-3 text-right">
                  {r.first_gecko_1d} <span className="text-slate-500">({pct(r.first_gecko_1d, r.signups)})</span>
                </td>
                <td className="py-1.5 pr-3 text-right">
                  {r.d1_returned}/{r.d1_eligible} <span className="text-slate-500">({pct(r.d1_returned, r.d1_eligible)})</span>
                </td>
                <td className="py-1.5 text-right">
                  {r.d7_returned}/{r.d7_eligible} <span className="text-slate-500">({pct(r.d7_returned, r.d7_eligible)})</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
