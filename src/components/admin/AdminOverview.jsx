import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { fetchOverviewStats, fetchAccountDirectory, seriesPoints } from '@/lib/adminData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Users, Camera, MessageSquare, Database, Sparkles, Bell, Activity } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Area, AreaChart, ResponsiveContainer } from 'recharts';

const SPARK_COLORS = {
  emerald: '#10b981',
  blue: '#3b82f6',
  amber: '#f59e0b',
  purple: '#a855f7',
  rose: '#f43f5e',
  slate: '#94a3b8',
};

/**
 * Admin landing screen, at-a-glance KPIs and recent activity feed.
 *
 * Designed to be the first thing an admin sees: it answers "is everything
 * healthy and what's new" in one screen so they can drill into a specific
 * section from there.
 */

function StatCard({ icon: Icon, label, value, sublabel, accent = 'emerald', series }) {
  const accentMap = {
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
    blue: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
    amber: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    purple: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
    rose: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
    slate: 'text-slate-300 bg-slate-700/30 border-slate-600',
  };
  const strokeColor = SPARK_COLORS[accent] || SPARK_COLORS.emerald;
  const gradId = `spark-${accent}`;
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-5 pb-0">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</p>
            <p className="text-3xl font-bold text-white mt-1.5">{value}</p>
            {sublabel && <p className="text-xs text-slate-500 mt-1">{sublabel}</p>}
          </div>
          <div className={`rounded-lg border p-2 ${accentMap[accent]}`}>
            <Icon className="w-5 h-5" />
          </div>
        </div>
        {series && series.length > 0 ? (
          <div className="mt-3 -mx-5 h-10">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={strokeColor} stopOpacity={0.45} />
                    <stop offset="100%" stopColor={strokeColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={strokeColor}
                  strokeWidth={1.5}
                  fill={`url(#${gradId})`}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-5" />
        )}
      </CardContent>
    </Card>
  );
}

export default function AdminOverview({ onNavigate }) {
  const [stats, setStats] = useState(null);
  const [recent, setRecent] = useState({ users: [], posts: [] });
  const [isLoading, setIsLoading] = useState(true);

  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      setLoadError(null);
      try {
        // Counts and 30-day series come from one admin-only database
        // function; the two short lists ask for five rows each. Nothing
        // downloads a whole table any more.
        const [overview, directory, postsRes] = await Promise.all([
          fetchOverviewStats(),
          fetchAccountDirectory().catch(() => []),
          supabase
            .from('forum_posts')
            .select('id, title, created_by, created_date')
            .order('created_date', { ascending: false })
            .limit(5),
        ]);
        const series = overview?.series || {};
        setStats({
          totalUsers: overview.real_accounts,
          legacyProfiles: overview.legacy_profiles,
          newUsers7d: overview.new_accounts_7d,
          totalGeckos: overview.geckos,
          newGeckos7d: overview.new_geckos_7d,
          totalImages: overview.images,
          newImages7d: overview.new_images_7d,
          totalPosts: overview.forum_posts,
          newPosts7d: overview.new_forum_posts_7d,
          totalComments: overview.forum_comments,
          totalMorphs: overview.morph_guides,
          adminCount: overview.admins,
          expertCount: overview.experts,
          reviewerCount: overview.expert_reviewers,
          usersSeries: seriesPoints(series, 'accounts'),
          geckosSeries: seriesPoints(series, 'geckos'),
          imagesSeries: seriesPoints(series, 'images'),
          postsSeries: seriesPoints(series, 'posts'),
          commentsSeries: seriesPoints(series, 'comments'),
        });

        const newestAccounts = (directory || [])
          .filter((u) => u.has_login)
          .sort((a, b) => new Date(b.joined_at || 0).getTime() - new Date(a.joined_at || 0).getTime())
          .slice(0, 5)
          .map((u) => ({ ...u, created_date: u.joined_at }));
        setRecent({
          users: newestAccounts,
          posts: postsRes?.data || [],
        });
      } catch (err) {
        console.error('Admin overview load failed:', err);
        setLoadError(err?.message || 'Could not load the overview.');
      }
      setIsLoading(false);
    })();
  }, []);

  if (loadError) {
    return (
      <div className="rounded-lg border border-rose-500/40 bg-rose-950/30 p-4 text-sm text-rose-200">
        Could not load the overview: {loadError}
      </div>
    );
  }

  if (isLoading || !stats) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Users}
          label="Accounts"
          value={stats.totalUsers}
          sublabel={`+${stats.newUsers7d} this week · ${stats.legacyProfiles} legacy rows not counted`}
          accent="emerald"
          series={stats.usersSeries}
        />
        <StatCard
          icon={Database}
          label="Geckos"
          value={stats.totalGeckos}
          sublabel={`+${stats.newGeckos7d} this week`}
          accent="blue"
          series={stats.geckosSeries}
        />
        <StatCard
          icon={Camera}
          label="Images"
          value={stats.totalImages}
          sublabel={`+${stats.newImages7d} this week`}
          accent="purple"
          series={stats.imagesSeries}
        />
        <StatCard
          icon={MessageSquare}
          label="Forum Posts"
          value={stats.totalPosts}
          sublabel={`+${stats.newPosts7d} this week`}
          accent="amber"
          series={stats.postsSeries}
        />
        <StatCard
          icon={Sparkles}
          label="Morph Guides"
          value={stats.totalMorphs}
          sublabel="reference records"
          accent="emerald"
        />
        <StatCard
          icon={Activity}
          label="Comments"
          value={stats.totalComments}
          sublabel="all-time"
          accent="slate"
          series={stats.commentsSeries}
        />
        <StatCard
          icon={Users}
          label="Admins"
          value={stats.adminCount}
          sublabel="with elevated access"
          accent="rose"
        />
        <StatCard
          icon={Users}
          label="Experts"
          value={stats.expertCount}
          sublabel={`verified breeders · ${stats.reviewerCount} reviewer${stats.reviewerCount === 1 ? '' : 's'}`}
          accent="blue"
        />
      </div>

      {/* Quick links */}
      <Card>
        <CardHeader>
          <CardTitle className="text-slate-100 text-base">Quick actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { id: 'users', label: 'Manage users', icon: Users },
              { id: 'morph_guides', label: 'Edit morph guides', icon: Sparkles },
              { id: 'moderation', label: 'Moderate content', icon: MessageSquare },
              { id: 'messaging', label: 'Send announcement', icon: Bell },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => onNavigate?.(item.id)}
                className="touch:min-h-11 flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-800/60 hover:bg-slate-800 hover:border-emerald-500/40 px-4 py-3 text-left transition-colors"
              >
                <item.icon className="w-4 h-4 text-emerald-400" />
                <span className="text-sm font-medium text-slate-200">{item.label}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-slate-100 text-base flex items-center gap-2">
              <Users className="w-4 h-4" /> Newest users
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recent.users.length === 0 ? (
              <p className="text-sm text-slate-500">No users yet.</p>
            ) : (
              recent.users.map((u) => (
                <div
                  key={u.id || u.email}
                  className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-800/40 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-200 truncate">
                      {u.full_name || u.email}
                    </p>
                    <p className="text-xs text-slate-500 truncate">{u.email}</p>
                  </div>
                  {u.created_date && (
                    <span className="text-xs text-slate-500 shrink-0 ml-3">
                      {formatDistanceToNow(new Date(u.created_date), { addSuffix: true })}
                    </span>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-slate-100 text-base flex items-center gap-2">
              <MessageSquare className="w-4 h-4" /> Latest forum posts
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recent.posts.length === 0 ? (
              <p className="text-sm text-slate-500">No forum posts yet.</p>
            ) : (
              recent.posts.map((p) => (
                <div
                  key={p.id}
                  className="rounded-lg border border-slate-800 bg-slate-800/40 px-3 py-2"
                >
                  <p className="text-sm font-medium text-slate-200 truncate">
                    {p.title || '(untitled)'}
                  </p>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-xs text-slate-500 truncate">{p.created_by}</p>
                    {p.created_date && (
                      <span className="text-xs text-slate-500 shrink-0 ml-3">
                        {formatDistanceToNow(new Date(p.created_date), { addSuffix: true })}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
