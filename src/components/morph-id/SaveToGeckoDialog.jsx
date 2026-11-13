import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Loader2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/use-toast';
import { CollectionMember, Gecko } from '@/entities/all';
import { canWriteGecko, getVisibleGeckos } from '@/lib/geckoAccess';
import { mergeMorphTags, morphNeedsChecking, suggestedTagsFromAnalysis } from '@/lib/morphIdDraft';
import { captureEvent } from '@/lib/posthog';
import { queryClientInstance } from '@/lib/query-client';
import { VISIBLE_NOT_PROVEN } from './MorphIdLimitsCard';

// A search box is only worth its row once the list is longer than a screen.
const SEARCH_FROM = 8;

const nameOf = (gecko) => gecko?.name || 'this gecko';
const lower = (value) => String(value ?? '').trim().toLowerCase();

/**
 * The live geckos this member may change: their own, and the ones in a
 * collection they own or edit (canWriteGecko mirrors the database rule),
 * by name. A read-only viewer's shared geckos are left out, since the save
 * would be refused.
 */
export async function loadEditableGeckos(user) {
  const [geckos, memberships] = await Promise.all([
    getVisibleGeckos(user, { $or: [{ archived: null }, { archived: false }] }),
    CollectionMember.filter({ status: 'accepted' }).catch(() => []),
  ]);
  return (geckos || [])
    .filter((gecko) => canWriteGecko(gecko, user, memberships))
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), undefined, { sensitivity: 'base' }));
}

const morphLine = (gecko) => {
  if (gecko.morphs_traits) return gecko.morphs_traits;
  const tags = Array.isArray(gecko.morph_tags) ? gecko.morph_tags : [];
  return tags.length ? tags.join(', ') : 'No morph recorded yet';
};

/**
 * Morph ID's "Save to a gecko you already have" (12 Nov 2026). A result
 * could only start a new gecko before; this puts it on one already in the
 * collection, in two short steps:
 *
 *   1. pick the gecko (skipped when the member came from that gecko's
 *      record, `target`);
 *   2. tick the suggested traits that are right. Nothing is ticked to
 *      start with: a suggestion goes on a real record only when the member
 *      says so, trait by trait (docs/specs/morph-id.md: no flow hides
 *      uncertainty behind one label). A trait named after a gene says a
 *      photo cannot prove it.
 *
 * Saving adds the ticked tags to the gecko's morph tags and leaves the
 * ones it already has alone. The gecko is read again just before the
 * write, so a tag added elsewhere in the meantime is kept too.
 *
 * Props:
 *   open, onOpenChange(open)
 *   user       the signed-in member
 *   analysis   the result, with the member's corrections applied
 *   target     the gecko this run is for (from its record), or null
 *   onSaved({ gecko, added })  after the write; the page says so
 */
export default function SaveToGeckoDialog({ open, onOpenChange, user, analysis, target = null, onSaved }) {
  const [picked, setPicked] = useState(null);
  const [search, setSearch] = useState('');
  const [ticked, setTicked] = useState(() => new Set());
  const [saving, setSaving] = useState(false);

  const gecko = target || picked;

  // Each opening starts clean: no gecko picked, nothing ticked.
  useEffect(() => {
    if (!open) return;
    setPicked(null);
    setSearch('');
    setTicked(new Set());
  }, [open]);

  const geckosQuery = useQuery({
    queryKey: ['morph-id-save-geckos', user?.email],
    enabled: open && !target && Boolean(user?.email),
    staleTime: 60 * 1000,
    queryFn: () => loadEditableGeckos(user),
  });

  const suggestions = useMemo(() => suggestedTagsFromAnalysis(analysis), [analysis]);
  const existing = useMemo(
    () => new Set((Array.isArray(gecko?.morph_tags) ? gecko.morph_tags : []).map(lower)),
    [gecko],
  );
  const fresh = suggestions.filter((entry) => !existing.has(lower(entry.tag)));
  const already = suggestions.filter((entry) => existing.has(lower(entry.tag)));
  const unsure = morphNeedsChecking(analysis);
  const chosen = fresh.filter((entry) => ticked.has(entry.tag)).map((entry) => entry.tag);

  const toggle = (tag, on) => setTicked((current) => {
    const next = new Set(current);
    if (on) next.add(tag);
    else next.delete(tag);
    return next;
  });

  const pick = (row) => {
    setPicked(row);
    setTicked(new Set());
  };

  const save = async () => {
    if (!gecko?.id || chosen.length === 0 || saving) return;
    setSaving(true);
    try {
      const current = await Gecko.get(gecko.id);
      if (!current) throw new Error('This gecko could not be found. It may have been deleted.');
      const morph_tags = mergeMorphTags(current.morph_tags, chosen);
      const saved = await Gecko.update(gecko.id, { morph_tags });
      captureEvent('morph_id_saved_to_gecko', {
        added: chosen.length,
        suggested: suggestions.length,
        from_record: Boolean(target),
      });
      // My Geckos and the home counts keep their own copies of the collection.
      queryClientInstance.invalidateQueries({ queryKey: ['my-geckos'] });
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('geckos_changed'));
      onSaved?.({ gecko: { ...current, ...(saved || {}), morph_tags }, added: chosen });
      onOpenChange(false);
    } catch (error) {
      // The demo already shows its own "create an account to save" prompt.
      if (!error?.isGuestBlock) {
        console.error('Morph ID traits not saved:', error);
        toast({
          title: 'Traits not saved',
          description: error?.message || 'Please try again.',
          variant: 'destructive',
        });
      }
    } finally {
      setSaving(false);
    }
  };

  const geckos = geckosQuery.data || [];
  const term = lower(search);
  const shown = term
    ? geckos.filter((row) => lower(`${row.name} ${row.gecko_id_code || ''} ${morphLine(row)}`).includes(term))
    : geckos;

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!saving) onOpenChange(next); }}>
      <DialogContent>
        {!gecko ? (
          <>
            <DialogHeader>
              <DialogTitle>Save to a gecko you already have</DialogTitle>
              <DialogDescription className="text-slate-400">
                Pick the gecko in these photos. You choose which traits to save in the next step.
              </DialogDescription>
            </DialogHeader>
            {geckosQuery.isLoading ? (
              <p className="py-6 text-center text-sm text-slate-400" role="status">
                <Loader2 className="inline w-4 h-4 mr-2 animate-spin" aria-hidden="true" /> Loading your geckos...
              </p>
            ) : geckosQuery.isError ? (
              <div className="space-y-3 py-2">
                <p className="text-sm text-red-200">Your geckos could not load. Check your connection and try again.</p>
                <Button variant="outline" onClick={() => geckosQuery.refetch()}>Try again</Button>
              </div>
            ) : geckos.length === 0 ? (
              <p className="py-2 text-sm text-slate-300">
                There are no geckos in your collection that you can change yet. Close this and use
                &ldquo;Add to my collection&rdquo; to start one from this result.
              </p>
            ) : (
              <div className="space-y-3">
                {geckos.length > SEARCH_FROM && (
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
                    <Input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search by name or ID"
                      aria-label="Search your geckos"
                      className="pl-9"
                    />
                  </div>
                )}
                <ul className="max-h-[50vh] space-y-1.5 overflow-y-auto" aria-label="Your geckos">
                  {shown.map((row) => (
                    <li key={row.id}>
                      <button
                        type="button"
                        onClick={() => pick(row)}
                        className="w-full touch:min-h-11 rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2 text-left transition-colors hover:border-emerald-600 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                      >
                        <span className="block text-sm font-medium text-slate-100">{row.name || 'Unnamed gecko'}</span>
                        <span className="block text-xs text-slate-400 line-clamp-1">{morphLine(row)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
                {shown.length === 0 && (
                  <p className="text-sm text-slate-400">No gecko matches &ldquo;{search.trim()}&rdquo;.</p>
                )}
              </div>
            )}
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Save to {nameOf(gecko)}</DialogTitle>
              <DialogDescription className="text-slate-400">
                Tick each trait you can see on {nameOf(gecko)}. Ticked traits are added to its morph tags.
                The tags it already has stay as they are.
              </DialogDescription>
            </DialogHeader>

            {fresh.length > 0 ? (
              <div className="space-y-3">
                {unsure && (
                  <p className="rounded-lg border border-amber-800/70 bg-amber-950/20 px-3 py-2 text-sm text-amber-100">
                    Morph ID was not sure about this one, so check each trait against the gecko before you tick it.
                  </p>
                )}
                <ul className="space-y-2" aria-label="Suggested traits">
                  {fresh.map((entry, index) => {
                    const id = `morph-save-tag-${index}`;
                    return (
                      <li key={entry.tag} className="flex items-start gap-3 rounded-lg border border-slate-700 bg-slate-800/40 px-3 py-2.5">
                        <Checkbox
                          id={id}
                          checked={ticked.has(entry.tag)}
                          onCheckedChange={(value) => toggle(entry.tag, value === true)}
                          className="mt-0.5"
                        />
                        <div className="min-w-0">
                          <label htmlFor={id} className="block text-sm font-medium text-slate-100 cursor-pointer">
                            {entry.tag}
                          </label>
                          {entry.gene && (
                            <p className="mt-0.5 text-xs text-amber-200/90">
                              The photos can show the {entry.tag} look, not prove the gene. Tick it only if
                              the parents or offspring confirm it.
                            </p>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : (
              <p className="text-sm text-slate-300">
                {suggestions.length === 0
                  ? 'This result has no trait that matches a morph tag, so there is nothing to save.'
                  : `${nameOf(gecko)} already has every trait Morph ID suggested. There is nothing to add.`}
              </p>
            )}

            {already.length > 0 && (
              <p className="text-xs text-slate-400">
                Already on {nameOf(gecko)}: {already.map((entry) => entry.tag).join(', ')}.
              </p>
            )}
            <p className="text-xs text-slate-400">{VISIBLE_NOT_PROVEN}</p>

            <DialogFooter>
              {!target && (
                <Button variant="outline" onClick={() => setPicked(null)} disabled={saving} className="sm:mr-auto">
                  <ArrowLeft aria-hidden="true" /> Choose another gecko
                </Button>
              )}
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={save} disabled={chosen.length === 0 || saving}>
                {saving && <Loader2 className="animate-spin" aria-hidden="true" />}
                {chosen.length === 0
                  ? 'Save'
                  : `Save ${chosen.length} ${chosen.length === 1 ? 'trait' : 'traits'}`}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
