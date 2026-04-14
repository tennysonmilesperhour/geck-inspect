import { useEffect, useMemo, useState } from 'react';
import {
  User,
  Gecko,
  GeckoImage,
  ForumPost,
  ForumComment,
  BreedingPlan,
  DirectMessage,
} from '@/entities/all';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Loader2,
  Users,
  TrendingUp,
  TrendingDown,
  Activity,
  Flame,
  GitBranch,
  Camera,
  MessageSquare,
  RefreshCw,
  Minus,
} from 'lucide-react';
import { format, subDays, startOfDay, differenceInDays } from 'date-fns';

/**
 * Analytics dashboard — focused on growth + usage, not vanity counts.
 *
 * Old version showed a lot of unhelpful slices (role breakdown pie charts,
 * top morphs, etc). This rebuild answers the three questions the user
 * actually cares about:
 *
 *   1. Is growth accelerating? (new users / week-over-week)
 *   2. Is engagement real?    (DAU-ish metrics, posts per active user)
 *   3. Where is usage coming from? (which features people actually touch)
 *
 * All data is computed client-side from a single batched fetch so there's
 * no hidden N+1 or server-side aggregation. Period selector toggles
 * 7/30/90/365 day windows.
 */

const PERIODS = [
  { value: 7, label: 'Last 7 days' },
  { value: 30, label: 'Last 30 days' },
  { value: 90, label: 'Last 90 days' },
  { value: 365, label: 'Last year' },
];

const PALETTE = {
  emerald: '#10b981',
  blue: '#3b82f6',
  amber: '#f59e0b',
  purple: '#a855f7',
  rose: '#f43f5e',
  slate: '#94a3b8',
};

function safeDate(d) {
  if (!d) return null;
  const parsed = new Date(d);
  return isNaN(parsed.getTime()) ? null : parsed;
}

function countInRange(list, fromMs, toMs, dateKey = 'created_date') {
  let n = 0;
  for (const item of list) {
    const d = safeDate(item[dateKey]);
    if (!d) continue;
    const t = d.getTime();
    if (t >= fromMs && t < toMs) n++;
  }
  return n;
}

function pctChange(current, previous) {
  if (previous === 0) return current === 0 ? 0 : 100;
  return Math.round(((current - previous) / previous) * 100);
}

function KpiCard({ label, value, delta, accent = 'emerald', sublabel }) {
  const up = delta > 0;
  const flat = delta === 0;
  const DeltaIcon = flat ? Minus : up ? TrendingUp : TrendingDown;
  const deltaColor = flat
    ? 'text-slate-500'
    : up
      ? 'text-emerald-400'
      : 'text-rose-400';
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
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          {label}
        </p>
        <p className="text-3xl font-bold text-white mt-1.5">{value.toLocaleString()}</p>
        <div className="flex items-center justify-between mt-2">
          <span className={`flex items-center gap-1 text-xs font-semibold ${deltaColor}`}>
            <DeltaIcon className="w-3 h-3" />
            {delta > 0 && '+'}
            {delta}% vs prior period
          </span>
          {sublabel && <span className="text-[10px] text-slate-500">{sublabel}</span>}
        </div>
      </CardContent>
    </Card>
  );
}

function ChartCard({ title, icon: Icon, children, subtitle }) {
  return (
    <Card className="bg-slate-900 border-slate-800">
      <CardHeader className="pb-2">
        <CardTitle className="text-slate-100 text-base flex items-center gap-2">
          {Icon && <Icon className="w-4 h-4 text-slate-400" />}
          {title}
        </CardTitle>
        {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

const CHART_TOOLTIP_STYLE = {
  backgroundColor: '#0f172a',
  border: '1px solid #334155',
  borderRadius: '8px',
  color: '#f8fafc',
  fontSize: 12,
};

export default function AnalyticsDashboard() {
  const [period, setPeriod] = useState(30);
  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState(null);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [users, geckos, images, posts, comments, plans, messages] = await Promise.all([
        User.list().catch(() => []),
        Gecko.list().catch(() => []),
        GeckoImage.list().catch(() => []),
        ForumPost.list().catch(() => []),
        ForumComment.list().catch(() => []),
        BreedingPlan.list().catch(() => []),
        DirectMessage.list().catch(() => []),
      ]);
      setData({ users, geckos, images, posts, comments, plans, messages });
    } catch (err) {
      console.error('Analytics load failed:', err);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const computed = useMemo(() => {
    if (!data) return null;
    const { users, geckos, images, posts, comments, plans, messages } = data;
    const now = Date.now();
    const periodMs = period * 24 * 60 * 60 * 1000;
    const currFrom = now - periodMs;
    const prevFrom = now - periodMs * 2;

    // KPI deltas: current period vs immediately prior period
    const kpi = (list) => {
      const curr = countInRange(list, currFrom, now);
      const prev = countInRange(list, prevFrom, currFrom);
      return { curr, prev, delta: pctChange(curr, prev) };
    };

    const kUsers = kpi(users);
    const kGeckos = kpi(geckos);
    const kImages = kpi(images);
    const kPosts = kpi(posts);
    const kComments = kpi(comments);
    const kPlans = kpi(plans);
    const kMessages = kpi(messages);

    // Daily buckets for charts
    const days = Math.min(period, 90); // don't chart 365 one-point-per-day
    const buckets = Array.from({ length: days }, (_, i) => {
      const day = startOfDay(subDays(new Date(), days - 1 - i));
      return { date: day, key: format(day, 'yyyy-MM-dd'), label: format(day, 'MMM d') };
    });
    const bucketCount = (list) => {
      const map = {};
      for (const item of list) {
        const d = safeDate(item.created_date);
        if (!d) continue;
        const k = format(startOfDay(d), 'yyyy-MM-dd');
        map[k] = (map[k] || 0) + 1;
      }
      return map;
    };
    const uMap = bucketCount(users);
    const gMap = bucketCount(geckos);
    const iMap = bucketCount(images);
    const pMap = bucketCount(posts);
    const cMap = bucketCount(comments);

    const signupsSeries = buckets.map((b) => ({
      date: b.label,
      signups: uMap[b.key] || 0,
    }));

    // Cumulative growth curve
    let cumulative = users.filter((u) => {
      const d = safeDate(u.created_date);
      return d && d.getTime() < buckets[0].date.getTime();
    }).length;
    const growthSeries = buckets.map((b) => {
      cumulative += uMap[b.key] || 0;
      return { date: b.label, users: cumulative };
    });

    // Activity stack: posts + comments + images per day
    const activitySeries = buckets.map((b) => ({
      date: b.label,
      Posts: pMap[b.key] || 0,
      Comments: cMap[b.key] || 0,
      Images: iMap[b.key] || 0,
      Geckos: gMap[b.key] || 0,
    }));

    // Activity ratio: active contributors vs total users
    const activeEmails = new Set();
    const isInWindow = (d) => {
      const dd = safeDate(d);
      return dd && dd.getTime() >= currFrom;
    };
    for (const p of posts) if (isInWindow(p.created_date) && p.created_by) activeEmails.add(p.created_by);
    for (const c of comments) if (isInWindow(c.created_date) && c.created_by) activeEmails.add(c.created_by);
    for (const g of geckos) if (isInWindow(g.created_date) && g.created_by) activeEmails.add(g.created_by);
    for (const i of images) if (isInWindow(i.created_date) && i.created_by) activeEmails.add(i.created_by);
    const activeCount = activeEmails.size;
    const activeRatio = users.length > 0 ? Math.round((activeCount / users.length) * 100) : 0;

    // Cohort: how many users who signed up in the period have a gecko
    const cohortUsers = users.filter((u) => {
      const d = safeDate(u.created_date);
      return d && d.getTime() >= currFrom;
    });
    const cohortEmails = new Set(cohortUsers.map((u) => u.email));
    const cohortActivated = geckos.filter((g) => cohortEmails.has(g.created_by)).length > 0
      ? new Set(geckos.filter((g) => cohortEmails.has(g.created_by)).map((g) => g.created_by)).size
      : 0;
    const activationRate =
      cohortUsers.length > 0 ? Math.round((cohortActivated / cohortUsers.length) * 100) : 0;

    // Power users: top gecko counts (only shows signal when there's >1 user)
    const perUserGeckos = {};
    for (const g of geckos) {
      if (!g.created_by) continue;
      perUserGeckos[g.created_by] = (perUserGeckos[g.created_by] || 0) + 1;
    }
    const topUsers = Object.entries(perUserGeckos)
      .map(([email, count]) => {
        const u = users.find((x) => x.email === email);
        return {
          email,
          name: u?.full_name || u?.breeder_name || email.split('@')[0],
          geckos: count,
          posts: posts.filter((p) => p.created_by === email).length,
          images: images.filter((i) => i.created_by === email).length,
        };
      })
      .sort((a, b) => b.geckos - a.geckos)
      .slice(0, 8);

    // Feature usage: what data types are being created in this period
    const featureUsage = [
      { name: 'Geckos', count: kGeckos.curr },
      { name: 'Images', count: kImages.curr },
      { name: 'Posts', count: kPosts.curr },
      { name: 'Comments', count: kComments.curr },
      { name: 'Breeding', count: kPlans.curr },
      { name: 'Messages', count: kMessages.curr },
    ]
      .sort((a, b) => b.count - a.count);

    // Retention-ish: users from "last-period" who are active "this period"
    const lastPeriodUserEmails = new Set(
      users
        .filter((u) => {
          const d = safeDate(u.created_date);
          return d && d.getTime() >= prevFrom && d.getTime() < currFrom;
        })
        .map((u) => u.email)
    );
    let returningCount = 0;
    for (const email of lastPeriodUserEmails) {
      if (activeEmails.has(email)) returningCount++;
    }
    const retentionRate =
      lastPeriodUserEmails.size > 0
        ? Math.round((returningCount / lastPeriodUserEmails.size) * 100)
        : 0;

    // Oldest user tenure (sanity anchor)
    const oldestUser = users
      .filter((u) => u.created_date)
      .sort((a, b) => new Date(a.created_date).getTime() - new Date(b.created_date).getTime())[0];
    const appAgeDays = oldestUser
      ? differenceInDays(new Date(), new Date(oldestUser.created_date))
      : 0;

    return {
      kpi: {
        users: kUsers,
        geckos: kGeckos,
        images: kImages,
        posts: kPosts,
        comments: kComments,
        plans: kPlans,
        messages: kMessages,
      },
      signupsSeries,
      growthSeries,
      activitySeries,
      activeCount,
      activeRatio,
      cohortUsers: cohortUsers.length,
      cohortActivated,
      activationRate,
      topUsers,
      featureUsage,
      retentionRate,
      lastPeriodUsers: lastPeriodUserEmails.size,
      totalUsers: users.length,
      appAgeDays,
    };
  }, [data, period]);

  if (isLoading || !computed) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  const {
    kpi,
    signupsSeries,
    growthSeries,
    activitySeries,
    activeCount,
    activeRatio,
    cohortUsers,
    activationRate,
    topUsers,
    featureUsage,
    retentionRate,
    lastPeriodUsers,
    totalUsers,
    appAgeDays,
  } = computed;

  return (
    <div className="space-y-6">
      {/* Header + controls */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">Growth & Usage</h2>
          <p className="text-xs text-slate-500">
            {totalUsers.toLocaleString()} total users · oldest account {appAgeDays} days old
          </p>
        </div>
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

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KpiCard
          label="New signups"
          value={kpi.users.curr}
          delta={kpi.users.delta}
          accent="emerald"
          sublabel={`${kpi.users.prev} prior`}
        />
        <KpiCard
          label="New geckos"
          value={kpi.geckos.curr}
          delta={kpi.geckos.delta}
          accent="blue"
          sublabel={`${kpi.geckos.prev} prior`}
        />
        <KpiCard
          label="New images"
          value={kpi.images.curr}
          delta={kpi.images.delta}
          accent="purple"
          sublabel={`${kpi.images.prev} prior`}
        />
        <KpiCard
          label="Forum posts"
          value={kpi.posts.curr}
          delta={kpi.posts.delta}
          accent="amber"
          sublabel={`${kpi.posts.prev} prior`}
        />
        <KpiCard
          label="Comments"
          value={kpi.comments.curr}
          delta={kpi.comments.delta}
          accent="emerald"
          sublabel={`${kpi.comments.prev} prior`}
        />
        <KpiCard
          label="Breeding plans"
          value={kpi.plans.curr}
          delta={kpi.plans.delta}
          accent="rose"
          sublabel={`${kpi.plans.prev} prior`}
        />
      </div>

      {/* Engagement strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Active users this period
            </p>
            <p className="text-3xl font-bold text-white mt-1.5">{activeCount.toLocaleString()}</p>
            <p className="text-xs text-slate-500 mt-1">
              {activeRatio}% of total · created at least one gecko, image, post, or comment
            </p>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Cohort activation
            </p>
            <p className="text-3xl font-bold text-white mt-1.5">{activationRate}%</p>
            <p className="text-xs text-slate-500 mt-1">
              {cohortUsers.toLocaleString()} new signups · %  that added at least one gecko
            </p>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Return rate
            </p>
            <p className="text-3xl font-bold text-white mt-1.5">{retentionRate}%</p>
            <p className="text-xs text-slate-500 mt-1">
              {lastPeriodUsers.toLocaleString()} signed up last period · came back this period
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Growth curve + signups */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard
          title="User growth"
          icon={TrendingUp}
          subtitle="Cumulative registered users"
        >
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={growthSeries}>
              <defs>
                <linearGradient id="growthGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={PALETTE.emerald} stopOpacity={0.6} />
                  <stop offset="100%" stopColor={PALETTE.emerald} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="date" stroke="#64748b" fontSize={10} tickLine={false} />
              <YAxis stroke="#64748b" fontSize={10} tickLine={false} />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
              <Area
                type="monotone"
                dataKey="users"
                stroke={PALETTE.emerald}
                strokeWidth={2}
                fill="url(#growthGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Daily signups" icon={Users} subtitle="Net new accounts per day">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={signupsSeries}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="date" stroke="#64748b" fontSize={10} tickLine={false} />
              <YAxis stroke="#64748b" fontSize={10} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
              <Bar dataKey="signups" fill={PALETTE.blue} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Activity mix + feature usage */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard
          title="Daily activity mix"
          icon={Activity}
          subtitle="Content creation by type, per day"
        >
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={activitySeries}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="date" stroke="#64748b" fontSize={10} tickLine={false} />
              <YAxis stroke="#64748b" fontSize={10} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
              <Line type="monotone" dataKey="Geckos" stroke={PALETTE.emerald} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Images" stroke={PALETTE.purple} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Posts" stroke={PALETTE.amber} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Comments" stroke={PALETTE.blue} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Feature usage"
          icon={GitBranch}
          subtitle={`Records created in the last ${period} days`}
        >
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={featureUsage} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
              <XAxis type="number" stroke="#64748b" fontSize={10} tickLine={false} />
              <YAxis
                type="category"
                dataKey="name"
                stroke="#94a3b8"
                fontSize={11}
                tickLine={false}
                width={80}
              />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
              <Bar dataKey="count" fill={PALETTE.emerald} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Power users */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-slate-100 text-base flex items-center gap-2">
            <Flame className="w-4 h-4 text-amber-400" />
            Power users
          </CardTitle>
          <p className="text-xs text-slate-500">
            Top breeders by gecko count — who's leaning on the app hardest
          </p>
        </CardHeader>
        <CardContent>
          {topUsers.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-6">
              Not enough data yet.
            </p>
          ) : (
            <div className="space-y-2">
              {topUsers.map((u, i) => (
                <div
                  key={u.email}
                  className="flex items-center gap-4 rounded-lg border border-slate-800 bg-slate-800/40 px-4 py-2.5"
                >
                  <span className="text-xs font-bold text-slate-500 w-5">#{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-100 truncate">{u.name}</p>
                    <p className="text-xs text-slate-500 truncate">{u.email}</p>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-slate-400 shrink-0">
                    <span className="flex items-center gap-1">
                      <GitBranch className="w-3 h-3 text-emerald-400" />
                      {u.geckos}
                    </span>
                    <span className="flex items-center gap-1">
                      <Camera className="w-3 h-3 text-purple-400" />
                      {u.images}
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageSquare className="w-3 h-3 text-amber-400" />
                      {u.posts}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
