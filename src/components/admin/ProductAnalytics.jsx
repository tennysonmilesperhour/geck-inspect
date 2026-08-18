import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { User, UserEvent } from '@/entities/all';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ExternalLink,
  Plus,
  Trash2,
  Save,
  Activity,
  Filter as Funnel,
  Users,
  Repeat,
  Loader2,
  ArrowUpRight,
  Info,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Minus,
  MousePointerClick,
  Link2,
  Zap,
} from 'lucide-react';
import { format, subDays, startOfDay } from 'date-fns';

/**
 * Product Analytics, the admin command center for product usage.
 *
 * Two layers:
 *
 *   1. "Live metrics" charts first-party telemetry straight from the
 *      `user_events` table (active users, funnels, feature events, top
 *      pages). captureEvent() mirrors every product event into that table
 *      (see src/lib/posthog.js), so this tab needs zero external setup.
 *
 *   2. "PostHog" holds the embedded-dashboard config: admins paste PostHog
 *      "shared dashboard" embed URLs and we render each as an iframe.
 *      Entries are `{ id, name, url, caption, order }`, persisted in the
 *      `app_settings` row keyed by `posthog_dashboards`.
 *
 * Funnels are computed as progressive set intersections: a user counts in
 * stage N only if they also hit every earlier stage inside the selected
 * window. Signed-in users are identified by email; anonymous visitors fall
 * back to their browser session id.
 */

const PERIODS = [
  { value: 7, label: 'Last 7 days' },
  { value: 30, label: 'Last 30 days' },
  { value: 90, label: 'Last 90 days' },
];

// Fetch horizon: 2x the longest period so every window has a
// prior-period comparison, plus rolling-average lookback.
const FETCH_DAYS = 187;
const FETCH_LIMIT = 20000;

const PALETTE = {
  emerald: '#10b981',
  blue: '#3b82f6',
  amber: '#f59e0b',
  purple: '#a855f7',
  rose: '#f43f5e',
};

const CHART_TOOLTIP_STYLE = {
  backgroundColor: '#0f172a',
  border: '1px solid #334155',
  borderRadius: '8px',
  color: '#f8fafc',
  fontSize: 12,
};

// The product funnels we chart. Each stage matches one or more event
// names; multiple names mean "either counts" (e.g. guest OR login both
// mean the visitor entered the app).
const FUNNELS = [
  {
    key: 'acquisition',
    title: 'Acquisition funnel',
    caption:
      'Landing CTA to entering the app to adding a first gecko. Measures whether the landing page converts visitors into activated users.',
    stages: [
      { label: 'Landing CTA clicked', events: ['landing_cta_clicked'] },
      { label: 'Entered the app', events: ['guest_mode_entered', 'login_completed'] },
      { label: 'First gecko added', events: ['first_gecko_added'] },
    ],
  },
  {
    key: 'upgrade',
    title: 'Paid conversion funnel',
    caption:
      'Upgrade prompt to completed checkout. Shows where paying intent leaks out of the membership flow.',
    stages: [
      { label: 'Upgrade prompt shown', events: ['upgrade_prompt_shown'] },
      { label: 'Prompt clicked', events: ['upgrade_prompt_clicked'] },
      { label: 'Membership viewed', events: ['membership_viewed'] },
      { label: 'Plan selected', events: ['plan_selected'] },
      { label: 'Checkout started', events: ['checkout_started'] },
      { label: 'Checkout completed', events: ['checkout_completed'] },
    ],
  },
  {
    key: 'store',
    title: 'Store funnel',
    caption:
      'Product page to purchase for the supplies store. Affiliate clicks are tracked separately as store_affiliate_click.',
    stages: [
      { label: 'Product viewed', events: ['store_pdp_viewed'] },
      { label: 'Added to cart', events: ['store_add_to_cart'] },
      { label: 'Checkout started', events: ['store_checkout_started'] },
      { label: 'Purchase completed', events: ['store_purchase_completed_view'] },
    ],
  },
];

// Every custom event the app fires, grouped for the reference card on the
// PostHog tab. Keep in sync with captureEvent() calls in the codebase.
const EVENT_REFERENCE = [
  {
    category: 'Acquisition & auth',
    events: [
      { name: 'landing_cta_clicked', what: 'Landing page CTA clicked (hero, nav, or guest).' },
      { name: 'guest_mode_entered', what: 'Visitor entered guest mode.' },
      { name: 'login_completed', what: 'User finished signing in.' },
      { name: 'onboarding_role_selected', what: 'New user picked keeper or breeder during onboarding.' },
    ],
  },
  {
    category: 'Collection',
    events: [
      { name: 'gecko_added', what: 'New gecko inserted into a collection.' },
      { name: 'first_gecko_added', what: 'A user added their very first gecko (activation moment).' },
      { name: 'gecko_updated', what: 'Existing gecko edited.' },
      { name: 'roster_exported', what: 'Roster exported (CSV or PDF).' },
      { name: 'morph_id_gecko_prefilled', what: 'Morph ID result used to prefill a new gecko form.' },
      { name: 'morph_id_add_to_collection_clicked', what: 'Add-to-collection clicked from a Morph ID result.' },
    ],
  },
  {
    category: 'Monetization',
    events: [
      { name: 'upgrade_prompt_shown', what: 'Plan-limit upgrade prompt rendered.' },
      { name: 'upgrade_prompt_clicked', what: 'Upgrade prompt CTA clicked.' },
      { name: 'membership_viewed', what: 'Membership page rendered.' },
      { name: 'plan_selected', what: 'A paid tier selected on the membership page.' },
      { name: 'checkout_started', what: 'Stripe checkout opened.' },
      { name: 'checkout_completed', what: 'Checkout returned with success.' },
      { name: 'checkout_cancelled', what: 'Checkout returned cancelled.' },
    ],
  },
  {
    category: 'Store',
    events: [
      { name: 'store_pdp_viewed', what: 'Product detail page rendered.' },
      { name: 'store_add_to_cart', what: 'Item added to cart.' },
      { name: 'store_affiliate_click', what: 'Outbound affiliate link clicked.' },
      { name: 'store_checkout_started', what: 'Store checkout clicked.' },
      { name: 'store_purchase_completed_view', what: 'Checkout success page viewed.' },
      { name: 'store_signup_grant_redeemed', what: 'Guest accepted the 3-month Keeper trial.' },
    ],
  },
  {
    category: 'Community',
    events: [
      { name: 'giveaway_created', what: 'A creator launched a new giveaway.' },
      { name: 'giveaway_entered', what: 'A user entered an existing giveaway.' },
    ],
  },
  {
    category: 'Automatic',
    events: [
      { name: 'page_view', what: 'First-party SPA pageview, one user_events row per navigation.' },
      { name: '$pageview / $pageleave / $autocapture', what: 'PostHog-only automatic events, not mirrored first-party.' },
    ],
  },
];

// Suggested starter dashboards an admin can build in PostHog and then
// paste back here.
const STARTER_SUGGESTIONS = [
  {
    title: 'Daily / weekly / monthly active users',
    why: 'The single most important habit metric. If DAU is flat or down for two weeks, something is wrong.',
    insight_url_hint: 'Insights → New insight → Trends → unique users',
  },
  {
    title: 'Acquisition funnel',
    why: 'Landing CTA to guest or sign-in to activation. Measures if the landing page converts.',
    insight_url_hint: 'Funnel → landing_cta_clicked → guest_mode_entered OR login_completed → first_gecko_added',
  },
  {
    title: 'Day-7 / Day-30 retention',
    why: 'How many users come back. The leading indicator of long-term growth.',
    insight_url_hint: 'Insights → New insight → Retention → first activity = $pageview',
  },
  {
    title: 'Paid conversion funnel',
    why: 'Pricing view to plan select to checkout complete. Upgrade prompts feed the top.',
    insight_url_hint: 'Funnel → upgrade_prompt_shown → upgrade_prompt_clicked → membership_viewed → plan_selected → checkout_started → checkout_completed',
  },
  {
    title: 'Top events (last 30 days)',
    why: 'Frequency table of every event. Surfaces dead features and unexpected hits.',
    insight_url_hint: 'Insights → New insight → Trends → Total count, breakdown by event',
  },
  {
    title: 'Store conversion funnel',
    why: 'PDP view to add-to-cart to checkout to purchase.',
    insight_url_hint: 'Funnel → store_pdp_viewed → store_add_to_cart → store_checkout_started → store_purchase_completed_view',
  },
];

function emptyDashboard() {
  return {
    id: crypto.randomUUID ? crypto.randomUUID() : `dash-${Date.now()}`,
    name: '',
    url: '',
    caption: '',
    order: 0,
  };
}

function isLikelyShareUrl(url) {
  if (!url) return false;
  try {
    const u = new URL(url);
    // PostHog share embeds: /embedded/<token> or /shared/<token>
    return /posthog\.com$/.test(u.hostname) || /posthog\./i.test(u.hostname);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Live metrics helpers
// ---------------------------------------------------------------------------

function safeDate(d) {
  if (!d) return null;
  const parsed = new Date(d);
  return isNaN(parsed.getTime()) ? null : parsed;
}

// Signed-in users are one identity per account; anonymous visitors fall
// back to the per-tab session id so they still register as "someone."
function identityOf(event) {
  return event.user_email || (event.session_id ? `s:${event.session_id}` : null);
}

function pctChange(current, previous) {
  if (previous === 0) return current === 0 ? 0 : 100;
  return Math.round(((current - previous) / previous) * 100);
}

function KpiCard({ label, value, delta, accent = 'emerald', sublabel }) {
  const hasDelta = typeof delta === 'number';
  const up = delta > 0;
  const flat = delta === 0;
  const DeltaIcon = flat ? Minus : up ? TrendingUp : TrendingDown;
  const deltaColor = flat ? 'text-slate-500' : up ? 'text-emerald-400' : 'text-rose-400';
  const accentBar = {
    emerald: 'bg-emerald-500',
    blue: 'bg-blue-500',
    amber: 'bg-amber-500',
    purple: 'bg-purple-500',
    rose: 'bg-rose-500',
  }[accent];

  return (
    <Card className="bg-slate-900 border-slate-800 relative overflow-hidden">
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${accentBar}`} />
      <CardContent className="p-5 pl-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</p>
        <p className="text-3xl font-bold text-white mt-1.5">{value.toLocaleString()}</p>
        <div className="flex items-center justify-between mt-2 gap-2">
          {hasDelta ? (
            <span className={`flex items-center gap-1 text-xs font-semibold ${deltaColor}`}>
              <DeltaIcon className="w-3 h-3" />
              {delta > 0 && '+'}
              {delta}%
            </span>
          ) : <span />}
          {sublabel && <span className="text-[10px] text-slate-500 text-right">{sublabel}</span>}
        </div>
      </CardContent>
    </Card>
  );
}

function FunnelCard({ funnel, computed }) {
  const stages = computed?.stages || [];
  const top = stages[0]?.count || 0;
  return (
    <Card className="bg-slate-900 border-slate-800">
      <CardHeader className="pb-3">
        <CardTitle className="text-slate-100 text-base flex items-center gap-2">
          <Funnel className="w-4 h-4 text-emerald-400" />
          {funnel.title}
        </CardTitle>
        <p className="text-xs text-slate-500 leading-relaxed">{funnel.caption}</p>
      </CardHeader>
      <CardContent>
        {top === 0 ? (
          <p className="text-sm text-slate-500 text-center py-6">
            No {funnel.stages[0].events.join(' / ')} events in this window yet.
          </p>
        ) : (
          <div className="space-y-2.5">
            {stages.map((s, i) => {
              const widthPct = top > 0 ? Math.max(2, Math.round((s.count / top) * 100)) : 0;
              const stepPct = i === 0
                ? 100
                : stages[i - 1].count > 0
                  ? Math.round((s.count / stages[i - 1].count) * 100)
                  : 0;
              const overallPct = top > 0 ? Math.round((s.count / top) * 100) : 0;
              return (
                <div key={s.label}>
                  <div className="flex items-baseline justify-between gap-2 mb-1">
                    <span className="text-xs font-medium text-slate-300 truncate">{s.label}</span>
                    <span className="text-xs text-slate-400 shrink-0">
                      {s.count.toLocaleString()}
                      {i > 0 && (
                        <span className="text-slate-500"> · {stepPct}% of prior · {overallPct}% overall</span>
                      )}
                    </span>
                  </div>
                  <div className="h-5 rounded bg-slate-800/70 overflow-hidden">
                    <div
                      className="h-full rounded bg-gradient-to-r from-emerald-600 to-emerald-400"
                      style={{ width: `${widthPct}%`, opacity: 0.45 + 0.55 * (widthPct / 100) }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Live metrics tab
// ---------------------------------------------------------------------------

function LiveMetrics() {
  const [period, setPeriod] = useState(30);
  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState(null);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const sinceIso = subDays(new Date(), FETCH_DAYS).toISOString();
      const [users, events] = await Promise.all([
        User.list().catch(() => []),
        UserEvent.filter({ created_date: { $gte: sinceIso } }, '-created_date', FETCH_LIMIT).catch(() => []),
      ]);
      setData({ users, events });
    } catch (err) {
      console.error('Product analytics load failed:', err);
      setData({ users: [], events: [] });
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const computed = useMemo(() => {
    if (!data) return null;
    const { users, events } = data;
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const currFrom = now - period * dayMs;
    const prevFrom = now - period * 2 * dayMs;

    // Daily identity sets across the whole fetch horizon (needed for
    // rolling averages that look back past the window start).
    const identitiesByDay = new Map();
    const tsOf = new Map();
    for (const e of events) {
      const d = safeDate(e.created_date);
      const id = identityOf(e);
      if (!d || !id) continue;
      tsOf.set(e, d.getTime());
      const key = format(startOfDay(d), 'yyyy-MM-dd');
      let set = identitiesByDay.get(key);
      if (!set) {
        set = new Set();
        identitiesByDay.set(key, set);
      }
      set.add(id);
    }

    // Distinct identities inside an arbitrary ms range.
    const activeBetween = (fromMs, toMs) => {
      const set = new Set();
      for (const e of events) {
        const t = tsOf.get(e);
        if (t === undefined || t < fromMs || t >= toMs) continue;
        const id = identityOf(e);
        if (id) set.add(id);
      }
      return set.size;
    };

    const todayStart = startOfDay(new Date()).getTime();
    const dauToday = activeBetween(todayStart, now);
    const dauYesterday = activeBetween(todayStart - dayMs, todayStart);
    const wau = activeBetween(now - 7 * dayMs, now);
    const wauPrev = activeBetween(now - 14 * dayMs, now - 7 * dayMs);
    const mau = activeBetween(now - 30 * dayMs, now);
    const mauPrev = activeBetween(now - 60 * dayMs, now - 30 * dayMs);

    // Stickiness: average DAU over the last 7 days vs MAU.
    let dauSum = 0;
    for (let i = 0; i < 7; i++) {
      const key = format(startOfDay(subDays(new Date(), i)), 'yyyy-MM-dd');
      dauSum += identitiesByDay.get(key)?.size || 0;
    }
    const stickiness = mau > 0 ? Math.round(((dauSum / 7) / mau) * 100) : 0;

    // Product events (everything except page_view) in window vs prior.
    const inRange = (e, fromMs, toMs) => {
      const t = tsOf.get(e);
      return t !== undefined && t >= fromMs && t < toMs;
    };
    const productEvents = events.filter((e) => e.event_name && e.event_name !== 'page_view');
    const productCurr = productEvents.filter((e) => inRange(e, currFrom, now));
    const productPrev = productEvents.filter((e) => inRange(e, prevFrom, currFrom));

    // Signups from profiles.
    const signupCount = (fromMs, toMs) => {
      let n = 0;
      for (const u of users) {
        const d = safeDate(u.created_date);
        if (d && d.getTime() >= fromMs && d.getTime() < toMs) n++;
      }
      return n;
    };
    const signupsCurr = signupCount(currFrom, now);
    const signupsPrev = signupCount(prevFrom, currFrom);

    // DAU series + rolling 7-day average line over the window.
    const dauSeries = [];
    for (let i = period - 1; i >= 0; i--) {
      const day = startOfDay(subDays(new Date(), i));
      const key = format(day, 'yyyy-MM-dd');
      let rollSum = 0;
      for (let j = 0; j < 7; j++) {
        const rk = format(startOfDay(subDays(day, j)), 'yyyy-MM-dd');
        rollSum += identitiesByDay.get(rk)?.size || 0;
      }
      dauSeries.push({
        date: format(day, 'MMM d'),
        active: identitiesByDay.get(key)?.size || 0,
        rolling: Math.round((rollSum / 7) * 10) / 10,
      });
    }

    // Funnels: progressive intersection inside the window.
    const funnelResults = {};
    for (const f of FUNNELS) {
      let carried = null;
      const stages = f.stages.map((stage) => {
        const stageSet = new Set();
        for (const e of productCurr) {
          if (!stage.events.includes(e.event_name)) continue;
          const id = identityOf(e);
          if (!id) continue;
          if (carried === null || carried.has(id)) stageSet.add(id);
        }
        carried = stageSet;
        return { label: stage.label, count: stageSet.size };
      });
      funnelResults[f.key] = { stages };
    }

    // Top product events in the window.
    const eventAgg = new Map();
    for (const e of productCurr) {
      let row = eventAgg.get(e.event_name);
      if (!row) {
        row = { name: e.event_name, count: 0, users: new Set(), lastSeen: 0 };
        eventAgg.set(e.event_name, row);
      }
      row.count += 1;
      const id = identityOf(e);
      if (id) row.users.add(id);
      const t = tsOf.get(e) || 0;
      if (t > row.lastSeen) row.lastSeen = t;
    }
    const topEvents = Array.from(eventAgg.values())
      .map((r) => ({ name: r.name, count: r.count, users: r.users.size, lastSeen: r.lastSeen }))
      .sort((a, b) => b.count - a.count);

    // Top pages by first-party pageviews in the window.
    const pageAgg = new Map();
    for (const e of events) {
      if (e.event_name !== 'page_view' || !inRange(e, currFrom, now)) continue;
      const p = e.page || '(unknown)';
      let row = pageAgg.get(p);
      if (!row) {
        row = { page: p, views: 0, sessions: new Set() };
        pageAgg.set(p, row);
      }
      row.views += 1;
      if (e.session_id) row.sessions.add(e.session_id);
    }
    const topPages = Array.from(pageAgg.values())
      .map((r) => ({ page: r.page, views: r.views, sessions: r.sessions.size }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 10);

    return {
      dauToday,
      dauDelta: pctChange(dauToday, dauYesterday),
      wau,
      wauDelta: pctChange(wau, wauPrev),
      mau,
      mauDelta: pctChange(mau, mauPrev),
      stickiness,
      productCurrCount: productCurr.length,
      productDelta: pctChange(productCurr.length, productPrev.length),
      signupsCurr,
      signupsDelta: pctChange(signupsCurr, signupsPrev),
      dauSeries,
      funnelResults,
      topEvents,
      topPages,
      totalProductEventsEver: productEvents.length,
    };
  }, [data, period]);

  if (isLoading || !computed) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-slate-400 max-w-2xl">
          First-party telemetry from the <code className="text-slate-300 text-xs">user_events</code> table.
          Signed-in users are counted by account; anonymous visitors by browser session.
        </p>
        <div className="flex items-center gap-2">
          <Select value={String(period)} onValueChange={(v) => setPeriod(Number(v))}>
            <SelectTrigger className="w-40 bg-slate-900 border-slate-700 text-slate-200">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-slate-700 text-slate-200">
              {PERIODS.map((p) => (
                <SelectItem key={p.value} value={String(p.value)}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant="outline"
            onClick={fetchData}
            className="border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Refresh
          </Button>
        </div>
      </div>

      {computed.totalProductEventsEver === 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-blue-500/30 bg-blue-500/10 p-4">
          <Zap className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
          <div className="text-sm text-blue-100/90 leading-relaxed">
            <p className="font-semibold text-blue-100">Product events are warming up.</p>
            <p className="text-blue-200/70 text-xs mt-1">
              Every captureEvent call now writes to the first-party user_events table as well
              as PostHog, so funnels and feature events below will start filling in as users
              hit instrumented flows. Pageview-based metrics (active users, top pages) are
              already live.
            </p>
          </div>
        </div>
      )}

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KpiCard label="Active today" value={computed.dauToday} delta={computed.dauDelta} accent="emerald" sublabel="vs yesterday" />
        <KpiCard label="Weekly active" value={computed.wau} delta={computed.wauDelta} accent="blue" sublabel="last 7 days" />
        <KpiCard label="Monthly active" value={computed.mau} delta={computed.mauDelta} accent="purple" sublabel="last 30 days" />
        <KpiCard label="Stickiness" value={computed.stickiness} accent="amber" sublabel="avg daily / monthly, %" />
        <KpiCard label="Product events" value={computed.productCurrCount} delta={computed.productDelta} accent="rose" sublabel={`last ${period} days`} />
        <KpiCard label="New signups" value={computed.signupsCurr} delta={computed.signupsDelta} accent="emerald" sublabel={`last ${period} days`} />
      </div>

      {/* Active users chart + top pages */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-slate-100 text-base flex items-center gap-2">
              <MousePointerClick className="w-4 h-4 text-slate-400" />
              Active users per day
            </CardTitle>
            <p className="text-xs text-slate-500">Bars are daily actives; the line is the 7-day rolling average.</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={computed.dauSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="date" stroke="#64748b" fontSize={10} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={10} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                <Bar dataKey="active" name="Active users" fill={PALETTE.blue} radius={[3, 3, 0, 0]} fillOpacity={0.75} />
                <Line type="monotone" dataKey="rolling" name="7-day avg" stroke={PALETTE.emerald} strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-slate-100 text-base flex items-center gap-2">
              <Link2 className="w-4 h-4 text-slate-400" />
              Top pages
            </CardTitle>
            <p className="text-xs text-slate-500">Most-viewed routes in the last {period} days.</p>
          </CardHeader>
          <CardContent>
            {computed.topPages.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-6">No pageviews in this window.</p>
            ) : (
              <div className="space-y-1.5">
                {computed.topPages.map((p, i) => (
                  <div
                    key={p.page}
                    className="flex items-center gap-4 rounded-lg border border-slate-800 bg-slate-800/40 px-4 py-2"
                  >
                    <span className="text-xs font-bold text-slate-500 w-5">#{i + 1}</span>
                    <p className="flex-1 min-w-0 text-sm font-medium text-slate-200 truncate">/{p.page}</p>
                    <span className="text-xs text-slate-400 shrink-0">{p.views.toLocaleString()} views</span>
                    <span className="text-xs text-slate-500 shrink-0">{p.sessions.toLocaleString()} sessions</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Funnels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {FUNNELS.map((f) => (
          <FunnelCard key={f.key} funnel={f} computed={computed.funnelResults[f.key]} />
        ))}
      </div>

      {/* Product event breakdown */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-slate-100 text-base flex items-center gap-2">
            <Activity className="w-4 h-4 text-slate-400" />
            Product events
          </CardTitle>
          <p className="text-xs text-slate-500">
            Every custom event captured in the last {period} days, with unique-user reach.
          </p>
        </CardHeader>
        <CardContent>
          {computed.topEvents.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-6">
              No product events in this window yet. They start flowing as users hit
              instrumented actions like adding a gecko or opening the membership page.
            </p>
          ) : (
            <div className="space-y-1.5 max-h-[380px] overflow-y-auto pr-1">
              {computed.topEvents.map((r, i) => (
                <div
                  key={r.name}
                  className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-800/40 px-4 py-2"
                >
                  <span className="text-xs font-bold text-slate-500 w-5">#{i + 1}</span>
                  <code className="flex-1 min-w-0 text-[12px] font-mono text-emerald-300 truncate">{r.name}</code>
                  <span className="text-xs text-slate-400 shrink-0">{r.count.toLocaleString()} events</span>
                  <span className="text-xs text-slate-500 shrink-0">{r.users.toLocaleString()} users</span>
                  <span className="text-[10px] text-slate-600 shrink-0 hidden md:inline">
                    last {format(new Date(r.lastSeen), 'MMM d')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PostHog embeds tab (config + iframes + reference)
// ---------------------------------------------------------------------------

function PostHogEmbeds() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dashboards, setDashboards] = useState([]);
  const [project, setProject] = useState({ host: '', project_id: '' });
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState(null);
  const [savedFlash, setSavedFlash] = useState(false);

  const sortedDashboards = useMemo(
    () => [...dashboards].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [dashboards]
  );

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('app_settings')
          .select('key, value')
          .in('key', ['posthog_dashboards', 'posthog_project']);
        if (error) throw error;
        if (cancelled) return;
        const dashRow = data?.find((r) => r.key === 'posthog_dashboards');
        const projRow = data?.find((r) => r.key === 'posthog_project');
        const list = Array.isArray(dashRow?.value) ? dashRow.value : [];
        setDashboards(list.map((d, i) => ({ order: i, ...d, id: d.id || `dash-${i}` })));
        if (projRow?.value && typeof projRow.value === 'object') {
          setProject({
            host: projRow.value.host || '',
            project_id: projRow.value.project_id || '',
          });
        }
      } catch (e) {
        if (!cancelled) setError(e.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function persist(nextDashboards, nextProject) {
    setSaving(true);
    setError(null);
    try {
      const cleaned = nextDashboards.map(({ id, name, url, caption, order }) => ({
        id, name, url, caption, order,
      }));
      const { error: e1 } = await supabase
        .from('app_settings')
        .upsert(
          { key: 'posthog_dashboards', value: cleaned, is_public: false, description:
            'Array of PostHog shared-dashboard embed configs rendered in the Product Analytics admin tab.' },
          { onConflict: 'key' }
        );
      if (e1) throw e1;
      const { error: e2 } = await supabase
        .from('app_settings')
        .upsert(
          { key: 'posthog_project', value: nextProject, is_public: false, description:
            'PostHog project metadata used for deep links from the admin Product Analytics tab.' },
          { onConflict: 'key' }
        );
      if (e2) throw e2;
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1500);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setSaving(false);
    }
  }

  function addDashboard() {
    const next = [...dashboards, { ...emptyDashboard(), order: dashboards.length }];
    setDashboards(next);
    setEditing(true);
  }

  function updateDashboard(id, patch) {
    setDashboards((prev) =>
      prev.map((d) => (d.id === id ? { ...d, ...patch } : d))
    );
  }

  function removeDashboard(id) {
    setDashboards((prev) => prev.filter((d) => d.id !== id));
  }

  const projectHomeUrl = project.host
    ? `${project.host.replace(/\/$/, '')}/project/${project.project_id || ''}`
    : 'https://us.posthog.com/';

  return (
    <div className="space-y-6">
      {/* Header / project deep links */}
      <Card className="bg-slate-900/50 border-slate-800">
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle className="text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-emerald-400" /> PostHog dashboards
            </CardTitle>
            <p className="text-sm text-slate-400 mt-1 max-w-2xl">
              Embed PostHog dashboards for the metrics the live tab can't compute
              (autocapture heatmaps, session-level analysis). Pick a dashboard in
              PostHog, choose Share then Embed, paste the URL below, and it renders
              inline. Captions explain what the metric means and what to do if it moves.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="text-slate-300 border-slate-700 hover:bg-slate-800"
              onClick={() => window.open(projectHomeUrl, '_blank', 'noopener,noreferrer')}
            >
              Open in PostHog <ArrowUpRight className="w-3.5 h-3.5 ml-1" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-slate-300 border-slate-700 hover:bg-slate-800"
              onClick={() => setEditing((v) => !v)}
            >
              {editing ? 'Done' : 'Configure'}
            </Button>
          </div>
        </CardHeader>
      </Card>

      {error && (
        <div className="rounded-md border border-rose-700/50 bg-rose-950/40 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-slate-400 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading saved dashboards…
        </div>
      )}

      {/* Configure mode: edit project + dashboards inline */}
      {editing && !loading && (
        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader>
            <CardTitle className="text-base text-white">Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="block">
                <span className="text-xs uppercase tracking-wider text-slate-400">
                  PostHog host
                </span>
                <Input
                  value={project.host}
                  onChange={(e) => setProject((p) => ({ ...p, host: e.target.value }))}
                  placeholder="https://us.posthog.com"
                  className="mt-1 bg-slate-950 border-slate-700 text-slate-100"
                />
              </label>
              <label className="block">
                <span className="text-xs uppercase tracking-wider text-slate-400">
                  Project ID
                </span>
                <Input
                  value={project.project_id}
                  onChange={(e) => setProject((p) => ({ ...p, project_id: e.target.value }))}
                  placeholder="12345"
                  className="mt-1 bg-slate-950 border-slate-700 text-slate-100"
                />
              </label>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-slate-200">Dashboards</h4>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-emerald-300 border-emerald-700/50 hover:bg-emerald-500/10"
                  onClick={addDashboard}
                >
                  <Plus className="w-4 h-4 mr-1" /> Add dashboard
                </Button>
              </div>

              {dashboards.length === 0 && (
                <div className="rounded-md border border-dashed border-slate-700 bg-slate-950/40 p-6 text-center text-sm text-slate-400">
                  No dashboards yet. In PostHog, open Insights or Dashboards, choose
                  Share then Embed, copy the iframe URL and paste it here. See the
                  suggested starter set below.
                </div>
              )}

              {dashboards.map((d, idx) => (
                <div
                  key={d.id}
                  className="rounded-md border border-slate-800 bg-slate-950/40 p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">Dashboard #{idx + 1}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-rose-300 hover:bg-rose-500/10"
                      onClick={() => removeDashboard(d.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1" /> Remove
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Input
                      value={d.name}
                      onChange={(e) => updateDashboard(d.id, { name: e.target.value })}
                      placeholder="Dashboard name (e.g. Signup funnel)"
                      className="bg-slate-950 border-slate-700 text-slate-100"
                    />
                    <Input
                      value={d.url}
                      onChange={(e) => updateDashboard(d.id, { url: e.target.value })}
                      placeholder="https://us.posthog.com/embedded/..."
                      className="bg-slate-950 border-slate-700 text-slate-100"
                    />
                  </div>
                  <Textarea
                    value={d.caption}
                    onChange={(e) => updateDashboard(d.id, { caption: e.target.value })}
                    placeholder="What this metric tells us and what to do if it moves."
                    rows={2}
                    className="bg-slate-950 border-slate-700 text-slate-100"
                  />
                  {d.url && !isLikelyShareUrl(d.url) && (
                    <p className="text-xs text-amber-300/80 flex items-center gap-1.5">
                      <Info className="w-3.5 h-3.5" />
                      That doesn't look like a PostHog share URL, embeds may not render.
                    </p>
                  )}
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              {savedFlash && (
                <span className="text-xs text-emerald-300">Saved.</span>
              )}
              <Button
                size="sm"
                onClick={() => persist(dashboards, project)}
                disabled={saving}
                className="bg-emerald-600 hover:bg-emerald-500 text-white"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" /> Saving…
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-1" /> Save
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Render mode: dashboards as iframes */}
      {!loading &&
        sortedDashboards.map((d) => (
          <Card key={d.id} className="bg-slate-900/50 border-slate-800">
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <div>
                <CardTitle className="text-white text-lg">
                  {d.name || 'Untitled dashboard'}
                </CardTitle>
                {d.caption && (
                  <p className="text-sm text-slate-400 mt-1 max-w-3xl leading-relaxed">
                    {d.caption}
                  </p>
                )}
              </div>
              {d.url && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-slate-300 hover:bg-slate-800"
                  onClick={() => window.open(d.url, '_blank', 'noopener,noreferrer')}
                >
                  <ExternalLink className="w-3.5 h-3.5 mr-1" /> Open
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-0">
              {d.url ? (
                <div className="aspect-[16/10] w-full bg-slate-950 border-t border-slate-800">
                  <iframe
                    title={d.name || 'PostHog dashboard'}
                    src={d.url}
                    className="w-full h-full"
                    referrerPolicy="no-referrer"
                    sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
                  />
                </div>
              ) : (
                <p className="px-6 py-4 text-sm text-amber-300/80">
                  No URL set. Configure this dashboard to render the embed.
                </p>
              )}
            </CardContent>
          </Card>
        ))}

      {/* Starter suggestions reference */}
      <Card className="bg-slate-900/50 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white text-base flex items-center gap-2">
            <Funnel className="w-4 h-4 text-emerald-400" />
            Suggested starter dashboards
          </CardTitle>
          <p className="text-sm text-slate-400 mt-1">
            Build these in PostHog (Insights, Save, Add to dashboard, Share, Embed),
            paste the embed URL above, and you'll have a working command center in
            an afternoon.
          </p>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {STARTER_SUGGESTIONS.map((s, i) => (
            <div
              key={i}
              className="rounded-md border border-slate-800 bg-slate-950/40 p-4"
            >
              <h4 className="text-sm font-semibold text-slate-100">{s.title}</h4>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">{s.why}</p>
              <p className="text-[11px] text-slate-500 mt-2 font-mono">
                {s.insight_url_hint}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Event reference */}
      <Card className="bg-slate-900/50 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white text-base flex items-center gap-2">
            <Repeat className="w-4 h-4 text-emerald-400" />
            Events being captured
          </CardTitle>
          <p className="text-sm text-slate-400 mt-1">
            Every custom event the app fires today, mirrored to both PostHog and the
            first-party user_events table. Update this list when adding new
            captureEvent() calls.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {EVENT_REFERENCE.map((group) => (
            <div key={group.category}>
              <h4 className="text-xs uppercase tracking-wider text-slate-500 mb-2">
                {group.category}
              </h4>
              <div className="space-y-1.5">
                {group.events.map((e) => (
                  <div
                    key={e.name}
                    className="grid grid-cols-[220px_1fr] gap-3 text-sm items-baseline"
                  >
                    <code className="text-emerald-300 font-mono text-[12px]">
                      {e.name}
                    </code>
                    <span className="text-slate-400">{e.what}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Identify-users note */}
      <Card className="bg-slate-900/50 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white text-base flex items-center gap-2">
            <Users className="w-4 h-4 text-emerald-400" />
            User identification
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-slate-400 leading-relaxed">
          Logged-in users are identified by email in PostHog (see
          <code className="mx-1 text-slate-300 font-mono text-xs">src/lib/posthog.js</code>).
          Properties: <code className="text-slate-300 font-mono text-xs">membership_tier</code>,{' '}
          <code className="text-slate-300 font-mono text-xs">role</code>,{' '}
          <code className="text-slate-300 font-mono text-xs">name</code>. PII (bios,
          messages, addresses) is masked at the SDK level, you'll see structural
          data but never actual content. Session replay is off by default.
        </CardContent>
      </Card>
    </div>
  );
}

export default function ProductAnalytics() {
  return (
    <Tabs defaultValue="live" className="w-full">
      <TabsList className="bg-slate-900 border border-slate-800">
        <TabsTrigger
          value="live"
          className="data-[state=active]:bg-slate-800 data-[state=active]:text-white text-slate-400"
        >
          Live metrics
        </TabsTrigger>
        <TabsTrigger
          value="posthog"
          className="data-[state=active]:bg-slate-800 data-[state=active]:text-white text-slate-400"
        >
          PostHog
        </TabsTrigger>
      </TabsList>
      <TabsContent value="live" className="mt-4">
        <LiveMetrics />
      </TabsContent>
      <TabsContent value="posthog" className="mt-4">
        <PostHogEmbeds />
      </TabsContent>
    </Tabs>
  );
}
