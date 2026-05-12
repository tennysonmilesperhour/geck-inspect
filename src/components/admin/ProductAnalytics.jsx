import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  ExternalLink,
  Plus,
  Trash2,
  Save,
  Activity,
  Filter as Funnel,
  Users,
  Repeat,
  Eye,
  Loader2,
  ArrowUpRight,
  Info,
} from 'lucide-react';

/**
 * Product Analytics ,  admin tab that surfaces PostHog data inside the app.
 *
 * Scrappy v1: admins paste PostHog "shared dashboard" embed URLs into the
 * settings panel; we render each as an iframe with an explanatory caption.
 * Each entry is `{ id, name, url, caption, order }`, persisted in the
 * `app_settings` row keyed by `posthog_dashboards`.
 *
 * The "Events" reference card lists every captureEvent name we've wired
 * into the codebase so admins know what's being collected before they
 * build dashboards. Keep EVENT_REFERENCE in sync with calls to
 * captureEvent() across the app.
 */

// Static reference: every custom PostHog event name we capture in code.
// Source of truth for "what data exists to chart." Update when adding
// captureEvent() calls in the codebase.
const EVENT_REFERENCE = [
  {
    category: 'Geckos',
    events: [
      { name: 'gecko_added', what: 'New gecko inserted into a user\'s collection.' },
      { name: 'gecko_updated', what: 'Existing gecko edited.' },
      { name: 'roster_exported', what: 'User exported their roster (CSV/PDF).' },
    ],
  },
  {
    category: 'Giveaways',
    events: [
      { name: 'giveaway_created', what: 'A creator launched a new giveaway.' },
      { name: 'giveaway_entered', what: 'A user entered an existing giveaway.' },
    ],
  },
  {
    category: 'Auth',
    events: [
      { name: '$pageview', what: 'SPA pageview (auto from PostHogPageTracker).' },
      { name: '$pageleave', what: 'SPA page-leave (auto, time-on-page math).' },
      { name: '$autocapture', what: 'Clicks, form submits, etc. (PostHog autocapture).' },
    ],
  },
  {
    category: 'Store (planned, not yet wired)',
    events: [
      { name: 'store_pdp_viewed', what: 'Product detail page rendered.' },
      { name: 'store_add_to_cart', what: 'Item added to cart.' },
      { name: 'store_affiliate_click', what: 'Outbound affiliate link clicked.' },
      { name: 'store_checkout_started', what: 'User clicked Checkout.' },
      { name: 'store_purchase_completed', what: 'Stripe webhook confirmed payment.' },
      { name: 'store_signup_grant_redeemed', what: 'Guest accepted the 3-month Keeper trial.' },
    ],
  },
];

// Suggested starter dashboards an admin can build in PostHog and then
// paste back here. Captions are pre-written so we have something to
// say underneath each iframe.
const STARTER_SUGGESTIONS = [
  {
    title: 'Daily / weekly / monthly active users',
    why: 'The single most important habit metric. If DAU is flat or down for two weeks, something is wrong.',
    insight_url_hint: 'Insights → New insight → Trends → unique users',
  },
  {
    title: 'Signup funnel',
    why: 'Landing page → AuthPortal → first action. Tells you where new visitors drop off.',
    insight_url_hint: 'Insights → New insight → Funnel → $pageview (Home) → $pageview (AuthPortal) → gecko_added',
  },
  {
    title: 'Day-7 / Day-30 retention',
    why: 'How many users come back. The leading indicator of long-term growth.',
    insight_url_hint: 'Insights → New insight → Retention → first activity = $pageview',
  },
  {
    title: 'Top events (last 30 days)',
    why: 'Frequency table of every event. Surfaces dead features and unexpected hits.',
    insight_url_hint: 'Insights → New insight → Trends → Total count, breakdown by event',
  },
  {
    title: 'Paid conversion funnel',
    why: 'Free users → /Membership pageview → checkout. Measures if pricing pages convert.',
    insight_url_hint: 'Insights → New insight → Funnel → $pageview (anywhere) → $pageview (Membership) → check Stripe',
  },
  {
    title: 'Store conversion funnel (Phase 1)',
    why: 'PDP view → add-to-cart → checkout → purchase. Builds once Store ships.',
    insight_url_hint: 'Funnel → store_pdp_viewed → store_add_to_cart → store_checkout_started → store_purchase_completed',
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

export default function ProductAnalytics() {
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
              <Activity className="w-5 h-5 text-emerald-400" /> Product analytics
            </CardTitle>
            <p className="text-sm text-slate-400 mt-1 max-w-2xl">
              PostHog dashboards embedded right here so we can see what's actually
              happening in the app. Pick dashboards in PostHog → Share → Embed,
              paste the URL below, and they'll render inline. The captions are
              for context ,  what the metric means and what to do if it moves.
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
                  No dashboards yet. In PostHog → Insights or Dashboards →
                  Share → Embed, copy the iframe URL and paste it here. See
                  the suggested starter set below.
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
                      That doesn't look like a PostHog share URL ,  embeds may not render.
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
      {!loading && sortedDashboards.length === 0 && !editing && (
        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="p-8 text-center space-y-4">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <Eye className="w-7 h-7 text-emerald-400" />
            </div>
            <h3 className="text-xl font-bold text-white">
              No dashboards configured yet
            </h3>
            <p className="text-sm text-slate-400 max-w-lg mx-auto leading-relaxed">
              PostHog is collecting data, but we haven't pinned any dashboards
              here yet. Click <span className="text-emerald-300">Configure</span> to add
              your first one. Suggested starter dashboards are listed below ,  build
              them in PostHog, share the embed link, and paste it back.
            </p>
          </CardContent>
        </Card>
      )}

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
            Build these in PostHog (Insights → Save → Add to dashboard → Share → Embed),
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
            Every custom event the app fires today. Use these as building blocks
            in PostHog. Update this list when adding new captureEvent() calls.
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
                    className="grid grid-cols-[180px_1fr] gap-3 text-sm items-baseline"
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
          messages, addresses) is masked at the SDK level ,  you'll see structural
          data but never actual content. Session replay is off by default.
        </CardContent>
      </Card>
    </div>
  );
}
