import React, { useEffect, useState } from 'react';
import { ForumPost, ForumComment, Gecko, MorphGuideComment } from '@/entities/all';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/components/ui/use-toast';
import {
  Loader2,
  Trash2,
  Search,
  MessageSquare,
  ShoppingBag,
  MessageCircle,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

/**
 * Content moderation surface — browse and delete user-generated content
 * across forum posts, forum comments, marketplace listings, and morph guide
 * comments. Each tab is a simple list with search + delete confirmation.
 */

function timeAgo(date) {
  if (!date) return '';
  try {
    return formatDistanceToNow(new Date(date), { addSuffix: true });
  } catch {
    return '';
  }
}

function ModerationList({
  entity,
  loadFn,
  renderItem,
  emptyText,
  searchKeys,
  onDeleted,
}) {
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();

  const load = async () => {
    setIsLoading(true);
    try {
      const data = await loadFn();
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Moderation load failed:', err);
      toast({ title: 'Error', description: 'Could not load content.', variant: 'destructive' });
    }
    setIsLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = search
    ? items.filter((it) =>
        searchKeys.some((k) => String(it[k] || '').toLowerCase().includes(search.toLowerCase()))
      )
    : items;

  const handleDelete = async () => {
    if (!deleteTarget?.id) return;
    setIsDeleting(true);
    try {
      await entity.delete(deleteTarget.id);
      toast({ title: 'Deleted', description: 'Content removed.' });
      setDeleteTarget(null);
      onDeleted?.();
      await load();
    } catch (err) {
      console.error('Delete failed:', err);
      toast({ title: 'Error', description: err.message || 'Delete failed.', variant: 'destructive' });
    }
    setIsDeleting(false);
  };

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <Input
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 bg-slate-950 border-slate-700 text-slate-200"
        />
      </div>
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-center text-slate-500 py-12 text-sm">{emptyText}</p>
      ) : (
        <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="flex items-start gap-3 rounded-lg border border-slate-800 bg-slate-800/40 p-3"
            >
              <div className="flex-1 min-w-0">{renderItem(item)}</div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setDeleteTarget(item)}
                className="border-rose-900/50 bg-rose-950/30 hover:bg-rose-950/50 text-rose-300 shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="bg-slate-900 border-slate-700 text-slate-100">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete content?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              This permanently removes the item. Replies, likes, or attached records may be
              orphaned.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={isDeleting}
              className="border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-rose-600 hover:bg-rose-500 text-white"
            >
              {isDeleting && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function ContentModeration() {
  return (
    <Card className="bg-slate-900 border-slate-800">
      <CardHeader>
        <CardTitle className="text-slate-100">Content Moderation</CardTitle>
        <p className="text-sm text-slate-400">
          Browse and remove user-generated content. Deletes are permanent.
        </p>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="posts">
          <TabsList className="bg-slate-800 border border-slate-700">
            <TabsTrigger value="posts" className="data-[state=active]:bg-slate-700">
              <MessageSquare className="w-4 h-4 mr-1.5" /> Forum Posts
            </TabsTrigger>
            <TabsTrigger value="comments" className="data-[state=active]:bg-slate-700">
              <MessageCircle className="w-4 h-4 mr-1.5" /> Comments
            </TabsTrigger>
            <TabsTrigger value="marketplace" className="data-[state=active]:bg-slate-700">
              <ShoppingBag className="w-4 h-4 mr-1.5" /> Marketplace
            </TabsTrigger>
            <TabsTrigger value="morph_comments" className="data-[state=active]:bg-slate-700">
              <MessageCircle className="w-4 h-4 mr-1.5" /> Morph Comments
            </TabsTrigger>
          </TabsList>

          <TabsContent value="posts" className="mt-5">
            <ModerationList
              entity={ForumPost}
              loadFn={() => ForumPost.list('-created_date')}
              searchKeys={['title', 'content', 'created_by']}
              emptyText="No forum posts."
              renderItem={(p) => (
                <>
                  <p className="text-sm font-semibold text-slate-100 truncate">
                    {p.title || '(untitled)'}
                  </p>
                  <p className="text-xs text-slate-400 line-clamp-2 mt-0.5">{p.content}</p>
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="text-[11px] text-slate-500">{p.created_by}</span>
                    <span className="text-[11px] text-slate-600">·</span>
                    <span className="text-[11px] text-slate-500">{timeAgo(p.created_date)}</span>
                  </div>
                </>
              )}
            />
          </TabsContent>

          <TabsContent value="comments" className="mt-5">
            <ModerationList
              entity={ForumComment}
              loadFn={() => ForumComment.list('-created_date')}
              searchKeys={['content', 'created_by']}
              emptyText="No comments."
              renderItem={(c) => (
                <>
                  <p className="text-sm text-slate-200 line-clamp-3">{c.content}</p>
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="text-[11px] text-slate-500">{c.created_by}</span>
                    <span className="text-[11px] text-slate-600">·</span>
                    <span className="text-[11px] text-slate-500">{timeAgo(c.created_date)}</span>
                  </div>
                </>
              )}
            />
          </TabsContent>

          <TabsContent value="marketplace" className="mt-5">
            <ModerationList
              entity={Gecko}
              loadFn={() =>
                Gecko.filter({ for_sale: true }, '-created_date').catch(() => Gecko.list('-created_date'))
              }
              searchKeys={['name', 'gecko_id_code', 'created_by', 'sale_description']}
              emptyText="No marketplace listings."
              renderItem={(g) => (
                <>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-slate-100">
                      {g.name || g.gecko_id_code || '(unnamed)'}
                    </p>
                    {g.sale_price != null && (
                      <span className="text-xs text-emerald-400 font-medium">${g.sale_price}</span>
                    )}
                    {g.for_sale === false && (
                      <span className="text-[10px] text-slate-500 uppercase">not listed</span>
                    )}
                  </div>
                  {g.sale_description && (
                    <p className="text-xs text-slate-400 line-clamp-2 mt-0.5">
                      {g.sale_description}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="text-[11px] text-slate-500">{g.created_by}</span>
                    <span className="text-[11px] text-slate-600">·</span>
                    <span className="text-[11px] text-slate-500">{timeAgo(g.created_date)}</span>
                  </div>
                </>
              )}
            />
          </TabsContent>

          <TabsContent value="morph_comments" className="mt-5">
            <ModerationList
              entity={MorphGuideComment}
              loadFn={() => MorphGuideComment.list('-created_date')}
              searchKeys={['content', 'created_by']}
              emptyText="No morph guide comments."
              renderItem={(c) => (
                <>
                  <p className="text-sm text-slate-200 line-clamp-3">{c.content}</p>
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="text-[11px] text-slate-500">{c.created_by}</span>
                    <span className="text-[11px] text-slate-600">·</span>
                    <span className="text-[11px] text-slate-500">{timeAgo(c.created_date)}</span>
                  </div>
                </>
              )}
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
