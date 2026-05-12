import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/components/ui/use-toast';
import {
  Search, Loader2, Plus, Edit, Copy, Archive, CalendarClock, Send, ExternalLink,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { BlogPost } from '@/entities/all';
import {
  publishBlogPostNow,
  archiveBlogPost,
  duplicateBlogPost,
} from '@/lib/blog-api';
import { StatusBadge } from './BlogDashboard';

const STATUS_FILTERS = [
  { value: 'all',       label: 'All' },
  { value: 'draft',     label: 'Drafts' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'published', label: 'Published' },
  { value: 'archived',  label: 'Archived' },
];

/**
 * Posts list ,  search by title/keyword, filter by status, then click to
 * edit. Bulk actions live inline per row (publish, archive, duplicate).
 */
export default function BlogPostsList({ onCreatePost, onEditPost }) {
  const { toast } = useToast();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [confirmArchive, setConfirmArchive] = useState(null);

  const reload = async () => {
    setLoading(true);
    try {
      const all = await BlogPost.list('-updated_date');
      setPosts(Array.isArray(all) ? all : []);
    } catch (err) {
      console.error(err);
      toast({ title: 'Could not load posts', description: err.message, variant: 'destructive' });
    }
    setLoading(false);
  };

  useEffect(() => { reload(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return posts.filter((p) => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (!q) return true;
      const hay = [p.title, p.slug, p.target_keyword, p.excerpt]
        .filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [posts, search, statusFilter]);

  const onPublish = async (post) => {
    setBusyId(post.id);
    try {
      await publishBlogPostNow(post.id);
      toast({ title: 'Published', description: post.title || '(untitled)' });
      await reload();
    } catch (err) {
      toast({ title: 'Publish failed', description: err.message, variant: 'destructive' });
    }
    setBusyId(null);
  };

  const onDuplicate = async (post) => {
    setBusyId(post.id);
    try {
      const copy = await duplicateBlogPost(post);
      toast({ title: 'Duplicated', description: copy.title });
      await reload();
    } catch (err) {
      toast({ title: 'Duplicate failed', description: err.message, variant: 'destructive' });
    }
    setBusyId(null);
  };

  const onArchive = async (post) => {
    setBusyId(post.id);
    try {
      await archiveBlogPost(post.id);
      toast({ title: 'Archived', description: post.title || '(untitled)' });
      await reload();
    } catch (err) {
      toast({ title: 'Archive failed', description: err.message, variant: 'destructive' });
    }
    setBusyId(null);
    setConfirmArchive(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
        <div className="flex flex-col md:flex-row gap-2 md:items-center flex-1 min-w-0">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title, slug, or keyword…"
              className="pl-9 bg-slate-800 border-slate-700 text-slate-100"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full md:w-44 bg-slate-800 border-slate-700 text-slate-100">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_FILTERS.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={onCreatePost} className="bg-emerald-600 hover:bg-emerald-500 text-white">
          <Plus className="w-4 h-4 mr-1.5" /> New post
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 text-slate-500 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-slate-800 rounded-xl text-slate-500">
          {posts.length === 0
            ? 'No posts yet ,  start by creating one or generating with AI.'
            : 'No posts match the current filter.'}
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((post) => (
            <li key={post.id}>
              <Card className="bg-slate-900 border-slate-800 hover:border-slate-700 transition-colors">
                <CardContent className="p-4">
                  <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <button
                          onClick={() => onEditPost?.(post)}
                          className="text-sm md:text-base font-semibold text-slate-100 hover:text-emerald-300 truncate text-left"
                        >
                          {post.title || '(untitled)'}
                        </button>
                        <StatusBadge status={post.status} />
                      </div>
                      <p className="text-xs text-slate-500 truncate">
                        /{post.slug || '—'}
                        {post.target_keyword && <> · keyword: {post.target_keyword}</>}
                        {post.published_at && post.status === 'published' && (
                          <> · published {formatDistanceToNow(new Date(post.published_at))} ago</>
                        )}
                        {post.scheduled_at && post.status === 'scheduled' && (
                          <> · scheduled for {format(new Date(post.scheduled_at), 'PP p')}</>
                        )}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onEditPost?.(post)}
                        className="border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700"
                      >
                        <Edit className="w-3.5 h-3.5 mr-1" /> Edit
                      </Button>
                      {post.status === 'published' && (
                        <a
                          href={`/blog/${post.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center text-xs px-2.5 py-1.5 rounded-md border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700"
                        >
                          <ExternalLink className="w-3.5 h-3.5 mr-1" /> View
                        </a>
                      )}
                      {post.status !== 'published' && (
                        <Button
                          size="sm"
                          onClick={() => onPublish(post)}
                          disabled={busyId === post.id}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white"
                        >
                          {busyId === post.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <><Send className="w-3.5 h-3.5 mr-1" /> Publish</>
                          )}
                        </Button>
                      )}
                      {post.status === 'scheduled' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onEditPost?.(post)}
                          className="border-amber-500/40 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20"
                        >
                          <CalendarClock className="w-3.5 h-3.5 mr-1" /> Reschedule
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onDuplicate(post)}
                        disabled={busyId === post.id}
                        className="border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700"
                      >
                        <Copy className="w-3.5 h-3.5 mr-1" /> Duplicate
                      </Button>
                      {post.status !== 'archived' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setConfirmArchive(post)}
                          disabled={busyId === post.id}
                          className="border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700"
                        >
                          <Archive className="w-3.5 h-3.5 mr-1" /> Archive
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <AlertDialog open={!!confirmArchive} onOpenChange={(open) => !open && setConfirmArchive(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive this post?</AlertDialogTitle>
            <AlertDialogDescription>
              "{confirmArchive?.title || ''}" will be hidden from the public blog. You can
              edit it back to draft or republish it later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-amber-600 hover:bg-amber-500 text-white"
              onClick={() => confirmArchive && onArchive(confirmArchive)}
            >
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
