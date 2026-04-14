import { useEffect, useState } from 'react';
import {
  User,
  Gecko,
  GeckoImage,
  ForumPost,
  ForumComment,
  MorphGuide,
} from '@/entities/all';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Users, Camera, MessageSquare, Database, Sparkles, Bell, Activity } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

/**
 * Admin landing screen — at-a-glance KPIs and recent activity feed.
 *
 * Designed to be the first thing an admin sees: it answers "is everything
 * healthy and what's new" in one screen so they can drill into a specific
 * section from there.
 */

function StatCard({ icon: Icon, label, value, sublabel, accent = 'emerald' }) {
  const accentMap = {
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
    blue: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
    amber: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    purple: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
    rose: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
    slate: 'text-slate-300 bg-slate-700/30 border-slate-600',
  };
  return (
    <Card className="bg-slate-900 border-slate-800">
      <CardContent className="p-5">
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
      </CardContent>
    </Card>
  );
}

export default function AdminOverview({ onNavigate }) {
  const [stats, setStats] = useState(null);
  const [recent, setRecent] = useState({ users: [], posts: [] });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      try {
        const [users, geckos, images, posts, comments, morphs] = await Promise.all([
          User.list().catch(() => []),
          Gecko.list().catch(() => []),
          GeckoImage.list().catch(() => []),
          ForumPost.list().catch(() => []),
          ForumComment.list().catch(() => []),
          MorphGuide.list().catch(() => []),
        ]);

        const now = Date.now();
        const sevenDays = 7 * 24 * 60 * 60 * 1000;
        const newUsers7d = users.filter(
          (u) => u.created_date && now - new Date(u.created_date).getTime() < sevenDays
        ).length;
        const newPosts7d = posts.filter(
          (p) => p.created_date && now - new Date(p.created_date).getTime() < sevenDays
        ).length;
        const newGeckos7d = geckos.filter(
          (g) => g.created_date && now - new Date(g.created_date).getTime() < sevenDays
        ).length;
        const newImages7d = images.filter(
          (i) => i.created_date && now - new Date(i.created_date).getTime() < sevenDays
        ).length;

        setStats({
          totalUsers: users.length,
          newUsers7d,
          totalGeckos: geckos.length,
          newGeckos7d,
          totalImages: images.length,
          newImages7d,
          totalPosts: posts.length,
          newPosts7d,
          totalComments: comments.length,
          totalMorphs: morphs.length,
          adminCount: users.filter((u) => u.role === 'admin').length,
          expertCount: users.filter((u) => u.is_expert).length,
        });

        const sortByDateDesc = (a, b) =>
          new Date(b.created_date || 0).getTime() - new Date(a.created_date || 0).getTime();
        setRecent({
          users: [...users].sort(sortByDateDesc).slice(0, 5),
          posts: [...posts].sort(sortByDateDesc).slice(0, 5),
        });
      } catch (err) {
        console.error('Admin overview load failed:', err);
      }
      setIsLoading(false);
    })();
  }, []);

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
          label="Users"
          value={stats.totalUsers}
          sublabel={`+${stats.newUsers7d} this week`}
          accent="emerald"
        />
        <StatCard
          icon={Database}
          label="Geckos"
          value={stats.totalGeckos}
          sublabel={`+${stats.newGeckos7d} this week`}
          accent="blue"
        />
        <StatCard
          icon={Camera}
          label="Images"
          value={stats.totalImages}
          sublabel={`+${stats.newImages7d} this week`}
          accent="purple"
        />
        <StatCard
          icon={MessageSquare}
          label="Forum Posts"
          value={stats.totalPosts}
          sublabel={`+${stats.newPosts7d} this week`}
          accent="amber"
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
          sublabel="verified breeders"
          accent="blue"
        />
      </div>

      {/* Quick links */}
      <Card className="bg-slate-900 border-slate-800">
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
                className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-800/60 hover:bg-slate-800 hover:border-emerald-500/40 px-4 py-3 text-left transition-colors"
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
        <Card className="bg-slate-900 border-slate-800">
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

        <Card className="bg-slate-900 border-slate-800">
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
