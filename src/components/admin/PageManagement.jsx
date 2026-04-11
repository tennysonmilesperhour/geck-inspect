import React, { useEffect, useState } from 'react';
import { PageConfig } from '@/entities/all';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, GripVertical, Layout, CheckCircle2 } from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

/**
 * Page Management — reorders + toggles the sidebar navigation entries.
 *
 * Only the Collection and Tools categories are shown here because those
 * are the only two sections rendered in the sidebar (see Layout.jsx).
 *
 * Drag/drop reorders write to `order_position` (the actual DB column —
 * the prior version wrote to a nonexistent `order` field, which is why
 * reorders weren't saving).
 */

const VISIBLE_CATEGORIES = ['collection', 'tools'];
const CATEGORY_TITLES = {
  collection: 'Collection',
  tools: 'Tools',
};

// Persist order_position changes for every item in a category in parallel.
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

  // Group and sort pages for rendering. Only Collection and Tools render.
  const grouped = VISIBLE_CATEGORIES.reduce((acc, cat) => {
    acc[cat] = pages
      .filter((p) => p.category === cat)
      .sort((a, b) => (a.order_position ?? 0) - (b.order_position ?? 0));
    return acc;
  }, {});

  const flashSaved = () => {
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 1500);
  };

  const handleToggleEnabled = async (page, newValue) => {
    // Optimistic update
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
    // Optimistic: move page to end of new category list.
    setPages((prev) =>
      prev.map((p) =>
        p.id === page.id
          ? { ...p, category: newCategory, order_position: target.length }
          : p
      )
    );
    try {
      await PageConfig.update(page.id, {
        category: newCategory,
        order_position: target.length,
      });
      flashSaved();
    } catch (err) {
      console.error('Category change failed:', err);
      toast({
        title: 'Error',
        description: 'Could not move page.',
        variant: 'destructive',
      });
      loadPages();
    }
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
    if (!VISIBLE_CATEGORIES.includes(srcCat) || !VISIBLE_CATEGORIES.includes(destCat)) {
      return;
    }

    const srcList = [...grouped[srcCat]];
    const destList = srcCat === destCat ? srcList : [...grouped[destCat]];

    const [moved] = srcList.splice(source.index, 1);

    if (srcCat === destCat) {
      srcList.splice(destination.index, 0, moved);
    } else {
      moved.category = destCat;
      destList.splice(destination.index, 0, moved);
    }

    // Optimistic UI update: rebuild the flat list with new orders.
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
      const withNewOrders = VISIBLE_CATEGORIES.flatMap((cat) =>
        nextByCat[cat].map((p, i) => ({
          ...p,
          category: cat,
          order_position: i,
        }))
      );
      return [...stable, ...withNewOrders];
    });

    setIsSaving(true);
    try {
      if (srcCat === destCat) {
        await persistOrder(nextByCat[srcCat]);
      } else {
        // Write the moved item's new category first, then reorders for both.
        await PageConfig.update(moved.id, { category: destCat });
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

  return (
    <Card className="bg-slate-900 border-slate-800">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-slate-100 flex items-center gap-2">
              <Layout className="w-5 h-5" />
              Sidebar Navigation
            </CardTitle>
            <p className="text-sm text-slate-400 mt-1">
              Drag to reorder. Toggle to hide a page from the sidebar. Changes save automatically.
            </p>
          </div>
          {(isSaving || justSaved) && (
            <span className="flex items-center gap-1.5 text-xs text-emerald-400">
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" /> Saved
                </>
              )}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="space-y-8">
            {VISIBLE_CATEGORIES.map((cat) => (
              <div key={cat}>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-3">
                  {CATEGORY_TITLES[cat]}
                </h3>
                <Droppable droppableId={cat}>
                  {(provided, snapshot) => (
                    <div
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                      className={`space-y-2 rounded-lg border p-2 transition-colors ${
                        snapshot.isDraggingOver
                          ? 'border-emerald-500/40 bg-emerald-500/5'
                          : 'border-slate-800 bg-slate-800/20'
                      }`}
                    >
                      {grouped[cat].length === 0 && (
                        <p className="text-xs text-slate-500 text-center py-4">
                          No pages in this category. Move items here from the selector on the right.
                        </p>
                      )}
                      {grouped[cat].map((page, index) => (
                        <Draggable key={page.id} draggableId={page.id} index={index}>
                          {(prov, snap) => (
                            <div
                              ref={prov.innerRef}
                              {...prov.draggableProps}
                              className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors ${
                                snap.isDragging
                                  ? 'border-emerald-500/60 bg-slate-800 shadow-lg'
                                  : 'border-slate-700 bg-slate-800/60'
                              }`}
                            >
                              <div
                                {...prov.dragHandleProps}
                                className="text-slate-500 cursor-grab active:cursor-grabbing"
                              >
                                <GripVertical className="w-4 h-4" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-slate-100 truncate">
                                  {page.display_name}
                                </p>
                                <p className="text-[11px] text-slate-500 truncate">
                                  /{page.page_name}
                                  {page.requires_auth && ' · auth required'}
                                </p>
                              </div>
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
                                </SelectContent>
                              </Select>
                              <Switch
                                checked={page.is_enabled}
                                onCheckedChange={(v) => handleToggleEnabled(page, v)}
                              />
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            ))}
          </div>
        </DragDropContext>
      </CardContent>
    </Card>
  );
}
