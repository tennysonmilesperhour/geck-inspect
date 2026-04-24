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
  AlertTriangle,
  Trash2,
} from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { SECTIONS, SECTION_FOR_PAGE } from '@/lib/navItems';

/**
 * Page Management — controls the entire sidebar.
 *
 * Every page is assigned to one of the two top-level sections (Manage /
 * Discover) via `page_config.section`, plus a "Hidden" bucket for pages
 * the admin has toggled off. Hidden pages can be dragged back into a
 * section to re-enable them in one motion.
 *
 * Reorder writes to `order_position` (the actual DB column) and toggling
 * a page off route-redirects it to / for ALL users — including admins —
 * so the sidebar can never show a page that isn't reachable.
 */

const ACTIVE_SECTIONS = SECTIONS.map((s) => s.id);
const ALL_DROP_ZONES = [...ACTIVE_SECTIONS, 'hidden'];

const SECTION_LABEL_MAP = Object.fromEntries(SECTIONS.map((s) => [s.id, s.label]));

const SECTION_TITLES = {
  ...SECTION_LABEL_MAP,
  hidden: 'Hidden from sidebar',
};

const SECTION_DESCRIPTIONS = {
  manage: 'Personal workspace — your animals, breeding plans, and selling.',
  discover: 'Reference, community, morphs, and the public marketplace.',
  hidden: 'Pages disabled for everyone (including admins). Drag back into a section to re-enable.',
};

// Falls back to the hardcoded map when the DB row has no explicit
// section value yet — e.g. rows that predate the migration, or rows for
// pages the admin hasn't touched since the 2-section rollout.
function sectionOf(page) {
  return page?.section || SECTION_FOR_PAGE[page?.page_name] || ACTIVE_SECTIONS[0];
}

async function persistOrder(items) {
  await Promise.all(
    items.map((item, index) =>
      PageConfig.update(item.id, { order_position: index })
    )
  );
}

// Pick the "best" row when the same page_name has multiple entries:
// prefer an enabled row, then the most recently updated.
function pickCanonical(rows) {
  return rows.slice().sort((a, b) => {
    const aEnabled = a.is_enabled !== false ? 1 : 0;
    const bEnabled = b.is_enabled !== false ? 1 : 0;
    if (aEnabled !== bEnabled) return bEnabled - aEnabled;
    const aDate = new Date(a.updated_date || a.created_date || 0).getTime();
    const bDate = new Date(b.updated_date || b.created_date || 0).getTime();
    return bDate - aDate;
  })[0];
}

// Split raw page rows into the one canonical row per page_name and the
// duplicate rows that should be cleaned up. Rows with no page_name are
// treated as their own "page" so they stay visible and deletable.
function partitionDuplicates(rows) {
  const byName = new Map();
  for (const p of rows) {
    const key = p.page_name || `__noname__${p.id}`;
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key).push(p);
  }
  const canonical = [];
  const duplicateIdsByName = new Map();
  const duplicateIds = [];
  for (const [name, group] of byName.entries()) {
    if (group.length === 1) {
      canonical.push(group[0]);
      continue;
    }
    const winner = pickCanonical(group);
    canonical.push(winner);
    const losers = group.filter((r) => r.id !== winner.id).map((r) => r.id);
    duplicateIdsByName.set(name, losers);
    duplicateIds.push(...losers);
  }
  return { canonical, duplicateIds, duplicateIdsByName };
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

  // Collapse duplicate rows (same page_name) down to a single canonical
  // row for display. The admin panel used to render one row per DB row,
  // which is why "duplicates" appeared in the UI and why a toggle only
  // flipped one of several matching rows.
  const { canonical, duplicateIds, duplicateIdsByName } = useMemo(
    () => partitionDuplicates(pages),
    [pages]
  );

  // Group + sort. Disabled pages live in the "hidden" bucket regardless
  // of their stored section so the admin can see at a glance what's off.
  const grouped = useMemo(() => {
    const buckets = Object.fromEntries(ALL_DROP_ZONES.map((z) => [z, []]));
    const filterFn = (p) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        p.display_name?.toLowerCase().includes(q) ||
        p.page_name?.toLowerCase().includes(q)
      );
    };
    for (const p of canonical.filter(filterFn)) {
      if (p.is_enabled === false) {
        buckets.hidden.push(p);
      } else {
        const sec = sectionOf(p);
        const target = ACTIVE_SECTIONS.includes(sec) ? sec : ACTIVE_SECTIONS[0];
        buckets[target].push(p);
      }
    }
    for (const cat of ALL_DROP_ZONES) {
      buckets[cat].sort(
        (a, b) => (a.order_position ?? 999) - (b.order_position ?? 999)
      );
    }
    return buckets;
  }, [canonical, search]);

  // All DB ids that share a page_name with the given row (including the
  // row itself). Writes are fanned out to every matching row so state
  // stays consistent even before the admin runs cleanup.
  const siblingIdsFor = (page) => {
    if (!page?.page_name) return [page.id];
    const dups = duplicateIdsByName.get(page.page_name) || [];
    return [page.id, ...dups];
  };

  const counts = useMemo(
    () => Object.fromEntries(ALL_DROP_ZONES.map((z) => [z, grouped[z]?.length ?? 0])),
    [grouped]
  );

  const flashSaved = () => {
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 1500);
  };

  const handleToggleEnabled = async (page, newValue) => {
    const ids = siblingIdsFor(page);
    const idSet = new Set(ids);
    setPages((prev) =>
      prev.map((p) => (idSet.has(p.id) ? { ...p, is_enabled: newValue } : p))
    );
    try {
      await Promise.all(
        ids.map((id) => PageConfig.update(id, { is_enabled: newValue }))
      );
      flashSaved();
    } catch (err) {
      console.error('Toggle failed:', err);
      toast({ title: 'Error', description: 'Could not update.', variant: 'destructive' });
      loadPages();
    }
  };

  const handleSectionChange = async (page, newSection) => {
    const target = grouped[newSection] || [];
    const ids = siblingIdsFor(page);
    const idSet = new Set(ids);
    const patch = {
      section: newSection,
      order_position: target.length,
      is_enabled: true,
    };
    setPages((prev) =>
      prev.map((p) => (idSet.has(p.id) ? { ...p, ...patch } : p))
    );
    try {
      await Promise.all(ids.map((id) => PageConfig.update(id, patch)));
      flashSaved();
    } catch (err) {
      console.error('Section change failed:', err);
      toast({ title: 'Error', description: 'Could not move page.', variant: 'destructive' });
      loadPages();
    }
  };

  const handleDeleteRow = async (page) => {
    if (!confirm(`Delete "${page.display_name || page.page_name}" from page config? The sidebar will fall back to its default entry.`)) return;
    const ids = siblingIdsFor(page);
    setIsSaving(true);
    try {
      await Promise.all(ids.map((id) => PageConfig.delete(id)));
      await loadPages();
      toast({ title: 'Page removed' });
    } catch (err) {
      console.error('Delete failed:', err);
      toast({ title: 'Delete failed', description: err.message, variant: 'destructive' });
    }
    setIsSaving(false);
  };

  const handleCleanupDuplicates = async () => {
    if (duplicateIds.length === 0) return;
    if (!confirm(`Delete ${duplicateIds.length} duplicate page row${duplicateIds.length === 1 ? '' : 's'}? The canonical entry for each page is kept.`)) return;
    setIsSaving(true);
    try {
      await Promise.all(duplicateIds.map((id) => PageConfig.delete(id)));
      await loadPages();
      toast({ title: `Removed ${duplicateIds.length} duplicate row${duplicateIds.length === 1 ? '' : 's'}` });
    } catch (err) {
      console.error('Cleanup failed:', err);
      toast({ title: 'Cleanup failed', description: err.message, variant: 'destructive' });
    }
    setIsSaving(false);
  };

  const handleResetAll = async () => {
    if (!confirm('Re-enable every page? This does not change section assignments.')) return;
    setIsSaving(true);
    try {
      await Promise.all(
        canonical.map((p) => PageConfig.update(p.id, { is_enabled: true }))
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
      if (srcCat === 'hidden' || sectionOf(moved) !== destCat) {
        movePatch.section = destCat;
        moved.section = destCat;
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
      // Fan out the enable/category flip to every duplicate row for
      // this page_name. Order_position only needs to be written to the
      // canonical row; duplicates will be deleted by cleanup anyway.
      const movedIds = siblingIdsFor(moved);
      await Promise.all(movedIds.map((id) => PageConfig.update(id, movePatch)));
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
              value={sectionOf(page)}
              onValueChange={(v) => handleSectionChange(page, v)}
            >
              <SelectTrigger className="w-32 bg-slate-900 border-slate-700 text-slate-200 text-xs h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-700 text-slate-200">
                {SECTIONS.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Switch
            checked={page.is_enabled !== false}
            onCheckedChange={(v) => handleToggleEnabled(page, v)}
            aria-label={`Toggle ${page.display_name}`}
          />
          <button
            type="button"
            onClick={() => handleDeleteRow(page)}
            className="text-slate-500 hover:text-rose-400 p-1 rounded transition-colors"
            aria-label={`Delete ${page.display_name}`}
            title="Remove this page from page_config"
          >
            <Trash2 className="w-4 h-4" />
          </button>
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
          {duplicateIds.length > 0 && (
            <div className="mb-4 flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-amber-200">
                  {duplicateIds.length} duplicate row{duplicateIds.length === 1 ? '' : 's'} detected
                </p>
                <p className="text-xs text-amber-200/70 mt-0.5">
                  Multiple <code className="text-amber-100">page_config</code> rows share the same page_name.
                  Toggles and section changes are applied to every copy, but duplicates still clutter
                  the DB and can cause inconsistent sidebar rendering. Clean up to keep a single canonical row per page.
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={handleCleanupDuplicates}
                disabled={isSaving}
                className="border-amber-500/40 bg-amber-500/20 hover:bg-amber-500/30 text-amber-100 shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                Clean up {duplicateIds.length}
              </Button>
            </div>
          )}
          <div className="grid grid-cols-3 gap-2 mb-6">
            {ALL_DROP_ZONES.map((cat) => (
              <div
                key={cat}
                className="rounded-lg border border-slate-800 bg-slate-800/30 px-3 py-2 text-center"
              >
                <p className="text-[10px] uppercase tracking-wider text-slate-500">
                  {SECTION_TITLES[cat]}
                </p>
                <p className="text-xl font-bold text-slate-100">{counts[cat]}</p>
              </div>
            ))}
          </div>

          <DragDropContext onDragEnd={handleDragEnd}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {ACTIVE_SECTIONS.map((cat) => (
                <div key={cat}>
                  <h3 className="text-sm font-semibold text-slate-200 mb-1 flex items-center gap-2">
                    <Eye className="w-4 h-4 text-emerald-400" />
                    {SECTION_TITLES[cat]}
                    <span className="text-xs font-normal text-slate-500">
                      ({counts[cat]})
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 mb-2">
                    {SECTION_DESCRIPTIONS[cat]}
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
                {SECTION_TITLES.hidden}
                <span className="text-xs font-normal text-slate-500">({counts.hidden})</span>
              </h3>
              <p className="text-xs text-slate-500 mb-2">
                {SECTION_DESCRIPTIONS.hidden}
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
