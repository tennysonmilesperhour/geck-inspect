import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  FileText, Edit3, Calendar, CheckCircle2, Sparkles, FolderTree,
  Settings as SettingsIcon, Loader2, ArrowRight,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { BlogPost } from '@/entities/all';

/**
 * Blog dashboard — at-a-glance counts plus the most-recent posts and
 * quick-action buttons. Fetches posts once on mount and bins them by
 * status; everything else (filtering, editing) lives in BlogPostsList.
 */
export default function BlogDashboard({ onNavigate, onCreatePost, onGenerate }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const all = await BlogPost.list('-updated_date');
        if (!cancelled) setPosts(Array.isArray(all) ? all : []);
      } catch (err) {
        console.error('[BlogDashboard] load failed:', err);
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const total = posts.length;
  const drafts = posts.filter((p) => p.status === 'draft').length;
  const scheduled = posts.filter((p) => p.status === 'scheduled').length;
  const published = posts.filter((p) => p.status === 'published').length;

  const recent = posts.slice(0, 6);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatTile label="Total posts"     value={total}     icon={FileText}     accent="emerald" />
        <StatTile label="Drafts"          value={drafts}    icon={Edit3}        accent="slate"   />
        <StatTile label="Scheduled"       value={scheduled} icon={Calendar}     accent="amber"   />
        <StatTile label="Published"       value={published} icon={CheckCircle2} accent="blue"    />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <ActionTile icon={FileText}     label="Create post"        onClick={onCreatePost} />
        <ActionTile icon={Sparkles}     label="Generate with AI"   onClick={onGenerate} />
        <ActionTile icon={FolderTree}   label="Manage taxonomy"    onClick={() => onNavigate?.('taxonomy')} />
        <ActionTile icon={SettingsIcon} label="Blog settings"      onClick={() => onNavigate?.('settings')} />
      </div>

      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-slate-100">Recent posts</h3>
            <Button
              variant="link"
              className="text-emerald-300 hover:text-emerald-200 px-0"
              onClick={() => onNavigate?.('posts')}
            >
              View all <ArrowRight className="ml-1 w-3.5 h-3.5" />
            </Button>
          </div>
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-5 h-5 text-slate-500 animate-spin" />
            </div>
          ) : recent.length === 0 ? (
            <p className="text-slate-500 text-sm py-6 text-center">
              No posts yet — create your first one above.
            </p>
          ) : (
            <ul className="divide-y divide-slate-800">
              {recent.map((post) => (
                <li key={post.id} className="py-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-100 truncate">
                      {post.title || '(untitled)'}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {post.updated_date ? `Updated ${formatDistanceToNow(new Date(post.updated_date))} ago` : '—'}
                      {post.scheduled_at && post.status === 'scheduled' && (
                        <> · scheduled for {format(new Date(post.scheduled_at), 'PP p')}</>
                      )}
                    </p>
                  </div>
                  <StatusBadge status={post.status} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatTile({ label, value, icon: Icon, accent = 'emerald' }) {
  const map = {
    emerald: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30',
    slate:   'text-slate-200 bg-slate-700/30 border-slate-700',
    amber:   'text-amber-300 bg-amber-500/10 border-amber-500/30',
    blue:    'text-blue-300 bg-blue-500/10 border-blue-500/30',
  };
  return (
    <Card className="bg-slate-900 border-slate-800">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</p>
            <p className="text-3xl font-bold text-white mt-1.5">{value}</p>
          </div>
          <div className={`rounded-lg border p-2 ${map[accent]}`}>
            <Icon className="w-5 h-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ActionTile({ icon: Icon, label, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/60 hover:border-emerald-500/40 hover:bg-slate-900 px-4 py-3 text-left transition-colors"
    >
      <span className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-emerald-300" />
      </span>
      <span className="text-sm font-medium text-slate-100">{label}</span>
    </button>
  );
}

export function StatusBadge({ status }) {
  const map = {
    draft:     { label: 'Draft',     cls: 'bg-slate-700 text-slate-200' },
    scheduled: { label: 'Scheduled', cls: 'bg-amber-500/20 text-amber-200 border border-amber-500/30' },
    published: { label: 'Published', cls: 'bg-emerald-600 text-white' },
    archived:  { label: 'Archived',  cls: 'bg-slate-800 text-slate-400 border border-slate-700' },
  };
  const m = map[status] || map.draft;
  return <Badge className={`text-xs ${m.cls}`}>{m.label}</Badge>;
}
