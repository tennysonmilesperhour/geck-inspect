import { useEffect, useMemo, useState } from 'react';
import { PageConfig } from '@/entities/all';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Loader2,
  GripVertical,
  Layout,
  CheckCircle2,
  EyeOff,
  Eye,
  Search,
  RotateCcw,
} from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

/**
 * Page Management — controls the entire sidebar.
 *
 * Three real categories (Collection / Tools / Public) plus a "Hidden"
 * bucket for pages the admin has toggled off. Hidden pages can be
 * dragged back into a category to re-enable them in one motion.
 *
 * Reorder writes to `order_position` (the actual DB column) and toggling
 * a page off route-redirects it to / for ALL users — including admins —
 * so the sidebar can never show a page that isn't reachable.
 */

const ACTIVE_CATEGORIES = ['collection', 'tools', 'public'];
const ALL_DROP_ZONES = [...ACTIVE_CATEGORIES, 'hidden'];

const CATEGORY_TITLES = {
  collection: 'Collection',
  tools: 'Tools',
  public: 'Public / Discovery',
  hidden: 'Hidden from sidebar',
};

const CATEGORY_DESCRIPTIONS = {
  collection: 'Pages that manage a logged-in user’s own animals.',
  tools: 'Utility tools — recognition, calculators, planners, AI consultant.',
  public: 'Discovery pages visible to anonymous visitors as well as members.',
  hidden: 'Pages disabled for everyone (including admins). Drag back into a section to re-enable.',
};

async function persistOrder(items) {
  await Promise.all(
    items.map((item, index) =>
      PageConfig.update(item.id, { order_position: index })
    )
  );
}

export default function PageManagement() {
  const [pages, setPages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [search, setSearch] = useState('');
  const { toast } = useToast();

  const loadPages = async () => {
    setIsLoading(true);
    try {
      const all = await PageConfig.list();
      setPages(Array.isArray(all) ? all : []);
    } catch (err) {
      console.error('Failed to load pages:', err);
      toast({
        title: 'Error',
        description: 'Could not load page config.',
        variant: 'destructive',
      });
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadPages();
  }, []);

  // Group + sort. Disabled pages live in the "hidden" bucket regardless
  // of their stored category so the admin can see at a glance what's off.
  const grouped = useMemo(() => {
    const buckets = { collection: [], tools: [], public: [], hidden: [] };
    const filterFn = (p) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        p.display_name?.toLowerCase().includes(q) ||
        p.page_name?.toLowerCase().includes(q)
      );
    };
    for (const p of pages.filter(filterFn)) {
      if (p.is_enabled === false) {
        buckets.hidden.push(p);
      } else if (ACTIVE_CATEGORIES.includes(p.category)) {
        buckets[p.category].push(p);
      } else {
        // Unknown category — show in Public so the admin can move it.
        buckets.public.push(p);
      }
    }
    for (const cat of ALL_DROP_ZONES) {
      buckets[cat].sort(
        (a, b) => (a.order_position ?? 999) - (b.order_position ?? 999)
      );
    }
    return buckets;
  }, [pages, search]);

  const counts = useMemo(() => ({
    collection: grouped.collection.length,
    tools: grouped.tools.length,
    public: grouped.public.length,
    hidden: grouped.hidden.length,
  }), [grouped]);

  const flashSaved = () => {
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 1500);
  };

  const handleToggleEnabled = async (page, newValue) => {
    setPages((prev) =>
      prev.map((p) => (p.id === page.id ? { ...p, is_enabled: newValue } : p))
    );
    try {
      await PageConfig.update(page.id, { is_enabled: newValue });
      flashSaved();
    } catch (err) {
      console.error('Toggle failed:', err);
      toast({ title: 'Error', description: 'Could not update.', variant: 'destructive' });
      loadPages();
    }
  };

  const handleCategoryChange = async (page, newCategory) => {
    const target = grouped[newCategory] || [];
    setPages((prev) =>
      prev.map((p) =>
        p.id === page.id
          ? { ...p, category: newCategory, order_position: target.length, is_enabled: true }
          : p
      )
    );
    try {
      await PageConfig.update(page.id, {
        category: newCategory,
        order_position: target.length,
        is_enabled: true,
      });
      flashSaved();
    } catch (err) {
      console.error('Category change failed:', err);
      toast({ title: 'Error', description: 'Could not move page.', variant: 'destructive' });
      loadPages();
    }
  };

  const handleResetAll = async () => {
    if (!confirm('Re-enable every page and reset categories to default? This cannot be undone.')) return;
    setIsSaving(true);
    try {
      await Promise.all(
        pages.map((p) => PageConfig.update(p.id, { is_enabled: true }))
      );
      await loadPages();
      toast({ title: 'All pages re-enabled' });
    } catch (err) {
      toast({ title: 'Reset failed', description: err.message, variant: 'destructive' });
    }
    setIsSaving(false);
  };

  const handleDragEnd = async (result) => {
    const { source, destination } = result;
    if (!destination) return;
    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    ) {
      return;
    }

    const srcCat = source.droppableId;
    const destCat = destination.droppableId;
    if (!ALL_DROP_ZONES.includes(srcCat) || !ALL_DROP_ZONES.includes(destCat)) {
      return;
    }

    const srcList = [...grouped[srcCat]];
    const destList = srcCat === destCat ? srcList : [...grouped[destCat]];
    const [moved] = srcList.splice(source.index, 1);

    // Compute the patch for the moved item.
    const movePatch = {};
    if (destCat === 'hidden') {
      movePatch.is_enabled = false;
    } else {
      movePatch.is_enabled = true;
      if (srcCat === 'hidden' || moved.category !== destCat) {
        movePatch.category = destCat;
        moved.category = destCat;
      }
    }

    if (srcCat === destCat) {
      srcList.splice(destination.index, 0, moved);
    } else {
      destList.splice(destination.index, 0, moved);
    }

    const nextByCat = {
      ...grouped,
      [srcCat]: srcList,
      [destCat]: srcCat === destCat ? srcList : destList,
    };
    const reorderedIds = new Set([
      ...nextByCat[srcCat].map((p) => p.id),
      ...nextByCat[destCat].map((p) => p.id),
    ]);

    setPages((prev) => {
      const stable = prev.filter((p) => !reorderedIds.has(p.id));
      const withNewOrders = ALL_DROP_ZONES.flatMap((cat) =>
        nextByCat[cat].map((p, i) => ({
          ...p,
          ...(p.id === moved.id ? movePatch : {}),
          order_position: i,
        }))
      );
      return [...stable, ...withNewOrders];
    });

    setIsSaving(true);
    try {
      await PageConfig.update(moved.id, movePatch);
      if (srcCat === destCat) {
        await persistOrder(nextByCat[srcCat]);
      } else {
        await Promise.all([
          persistOrder(nextByCat[srcCat]),
          persistOrder(nextByCat[destCat]),
        ]);
      }
      flashSaved();
    } catch (err) {
      console.error('Reorder save failed:', err);
      toast({ title: 'Error', description: 'Order could not be saved.', variant: 'destructive' });
      await loadPages();
    }
    setIsSaving(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  const renderItem = (page, index, inHidden) => (
    <Draggable key={page.id} draggableId={page.id} index={index}>
      {(prov, snap) => (
        <div
          ref={prov.innerRef}
          {...prov.draggableProps}
          className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors ${
            snap.isDragging
              ? 'border-emerald-500/60 bg-slate-800 shadow-lg'
              : inHidden
                ? 'border-slate-800 bg-slate-900/60 opacity-70'
                : 'border-slate-700 bg-slate-800/60'
          }`}
        >
          <div
            {...prov.dragHandleProps}
            className="text-slate-500 cursor-grab active:cursor-grabbing"
            aria-label="Drag handle"
          >
            <GripVertical className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-100 truncate flex items-center gap-1.5">
              {page.display_name}
              {inHidden && (
                <EyeOff className="w-3 h-3 text-slate-500" aria-label="Hidden" />
              )}
            </p>
            <p className="text-[11px] text-slate-500 truncate">
              /{page.page_name}
              {page.requires_auth && ' · auth required'}
            </p>
          </div>
          {!inHidden && (
            <Select
              value={page.category}
              onValueChange={(v) => handleCategoryChange(page, v)}
            >
              <SelectTrigger className="w-32 bg-slate-900 border-slate-700 text-slate-200 text-xs h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-700 text-slate-200">
                <SelectItem value="collection">Collection</SelectItem>
                <SelectItem value="tools">Tools</SelectItem>
                <SelectItem value="public">Public</SelectItem>
              </SelectContent>
            </Select>
          )}
          <Switch
            checked={page.is_enabled !== false}
            onCheckedChange={(v) => handleToggleEnabled(page, v)}
            aria-label={`Toggle ${page.display_name}`}
          />
        </div>
      )}
    </Draggable>
  );

  return (
    <div className="space-y-4">
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="text-slate-100 flex items-center gap-2">
                <Layout className="w-5 h-5" />
                Sidebar Navigation
              </CardTitle>
              <p className="text-sm text-slate-400 mt-1 max-w-xl">
                Drag rows to reorder, between sections to recategorize, or into{' '}
                <span className="text-slate-300">Hidden</span> to disable. Toggling a page off
                takes effect for every user — including admins — and the route redirects to home.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {(isSaving || justSaved) && (
                <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                  {isSaving ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" /> Saved
                    </>
                  )}
                </span>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={handleResetAll}
                className="border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200"
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                Re-enable all
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search pages by name…"
              className="pl-10 bg-slate-950 border-slate-700 text-slate-200"
            />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-6">
            {ALL_DROP_ZONES.map((cat) => (
              <div
                key={cat}
                className="rounded-lg border border-slate-800 bg-slate-800/30 px-3 py-2 text-center"
              >
                <p className="text-[10px] uppercase tracking-wider text-slate-500">
                  {CATEGORY_TITLES[cat]}
                </p>
                <p className="text-xl font-bold text-slate-100">{counts[cat]}</p>
              </div>
            ))}
          </div>

          <DragDropContext onDragEnd={handleDragEnd}>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {ACTIVE_CATEGORIES.map((cat) => (
                <div key={cat}>
                  <h3 className="text-sm font-semibold text-slate-200 mb-1 flex items-center gap-2">
                    <Eye className="w-4 h-4 text-emerald-400" />
                    {CATEGORY_TITLES[cat]}
                    <span className="text-xs font-normal text-slate-500">
                      ({counts[cat]})
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 mb-2">
                    {CATEGORY_DESCRIPTIONS[cat]}
                  </p>
                  <Droppable droppableId={cat}>
                    {(provided, snapshot) => (
                      <div
                        {...provided.droppableProps}
                        ref={provided.innerRef}
                        className={`min-h-32 space-y-2 rounded-lg border p-2 transition-colors ${
                          snapshot.isDraggingOver
                            ? 'border-emerald-500/40 bg-emerald-500/5'
                            : 'border-slate-800 bg-slate-800/20'
                        }`}
                      >
                        {grouped[cat].length === 0 && (
                          <p className="text-xs text-slate-500 text-center py-6">
                            Drop a page here.
                          </p>
                        )}
                        {grouped[cat].map((page, index) => renderItem(page, index, false))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </div>
              ))}
            </div>

            <div className="mt-6">
              <h3 className="text-sm font-semibold text-slate-200 mb-1 flex items-center gap-2">
                <EyeOff className="w-4 h-4 text-rose-400" />
                {CATEGORY_TITLES.hidden}
                <span className="text-xs font-normal text-slate-500">({counts.hidden})</span>
              </h3>
              <p className="text-xs text-slate-500 mb-2">
                {CATEGORY_DESCRIPTIONS.hidden}
              </p>
              <Droppable droppableId="hidden">
                {(provided, snapshot) => (
                  <div
                    {...provided.droppableProps}
                    ref={provided.innerRef}
                    className={`min-h-20 space-y-2 rounded-lg border p-2 transition-colors ${
                      snapshot.isDraggingOver
                        ? 'border-rose-500/40 bg-rose-500/5'
                        : 'border-slate-800 bg-slate-800/20'
                    }`}
                  >
                    {grouped.hidden.length === 0 && (
                      <p className="text-xs text-slate-500 text-center py-4">
                        No hidden pages — every page is currently visible to its target audience.
                      </p>
                    )}
                    {grouped.hidden.map((page, index) => renderItem(page, index, true))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          </DragDropContext>
        </CardContent>
      </Card>
    </div>
  );
}
