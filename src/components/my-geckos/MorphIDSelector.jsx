import { useId, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import { MORPH_CATEGORIES, ALL_MORPHS } from './morphTagCatalog';
import { countMorphMatches, searchMorphTags } from './form/morphSearch';

const MATCH_LIMIT = 12;

/**
 * The gecko form's one "Morph" group (experience review D4).
 *
 * The morph used to be entered in two places: a free-text box, and a
 * separate purple button that unfolded the whole catalogue. Here it is
 * one group: a search box that filters the catalogue as the member types
 * and adds a tag with a tap (or Enter for the first match), the chosen
 * tags as chips, and directly under them one free-text line for anything
 * the list does not have. The full catalogue is behind "Browse all".
 *
 * Nothing about the saved data changes: tags are still the gecko's
 * morph_tags list and the free text is still morphs_traits.
 *
 * The tag catalogue lives in ./morphTagCatalog.js (plain JS) so this
 * picker, the gecko filters and the genetics drift check share one list.
 *
 * Props: selectedMorphs and onMorphsChange(tags) for the tags; freeText
 * and onFreeTextChange(text) for the line under them (leave
 * onFreeTextChange out to show the tags alone); disabled locks it all.
 */
export default function MorphIDSelector({ selectedMorphs = [], onMorphsChange, freeText = '', onFreeTextChange, disabled = false }) {
  const [search, setSearch] = useState('');
  const [browse, setBrowse] = useState(false);
  const searchRef = useRef(null);
  const id = useId();

  const isSelected = (morph) => selectedMorphs.includes(morph);
  const toggleMorph = (morph) => {
    if (disabled) return;
    onMorphsChange(isSelected(morph) ? selectedMorphs.filter((m) => m !== morph) : [...selectedMorphs, morph]);
  };

  const typed = search.trim();
  const matches = typed ? searchMorphTags(typed, MATCH_LIMIT) : [];
  const hiddenMatches = typed ? Math.max(0, countMorphMatches(typed) - matches.length) : 0;

  // A tag picked from the matches: add it, and clear the box for the next one.
  const pickMatch = (morph) => {
    toggleMorph(morph);
    setSearch('');
    searchRef.current?.focus();
  };

  // Typed something the list does not have: it belongs on the free-text line.
  const moveToFreeText = () => {
    const current = String(freeText || '').trim();
    onFreeTextChange(current ? `${current}, ${typed}` : typed);
    setSearch('');
  };

  const tagButton = (morph, onClick) => {
    const selected = isSelected(morph);
    return (
      <button
        key={morph}
        type="button"
        aria-pressed={selected}
        onClick={onClick}
        className={`touch:min-h-11 inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
          selected
            ? 'border-emerald-500 bg-emerald-900/50 text-emerald-100'
            : 'border-slate-600 bg-slate-800 text-slate-200 hover:border-slate-400 hover:bg-slate-700'
        }`}
      >
        {selected && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
        {morph}
      </button>
    );
  };

  return (
    <fieldset disabled={disabled} className="min-w-0 space-y-3">
      <legend className="text-sm font-medium leading-none">Morph</legend>

      {/* data-no-dirty: typing a search is not a change to the gecko. */}
      <div className="relative" data-no-dirty>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
        <Input
          ref={searchRef}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter' || e.nativeEvent?.isComposing) return;
            // Enter picks the first match. It must never submit the form.
            e.preventDefault();
            if (matches[0] && !isSelected(matches[0].morph)) pickMatch(matches[0].morph);
          }}
          placeholder="Search morphs, e.g. Lilly White"
          aria-label="Search morphs"
          aria-controls={`${id}-matches`}
          autoComplete="off"
          enterKeyHint="done"
          className="bg-slate-800 border-slate-600 pl-9 text-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>

      <div id={`${id}-matches`}>
        {typed && (
          <div role="group" aria-label="Matching morphs" className="rounded-lg border border-slate-700 bg-slate-800/50 p-2">
            {matches.length > 0 ? (
              <>
                <div className="flex flex-wrap gap-1.5">
                  {matches.map(({ morph }) => tagButton(morph, () => pickMatch(morph)))}
                </div>
                {hiddenMatches > 0 && (
                  <p className="mt-2 text-xs text-slate-400">{hiddenMatches} more match. Keep typing to narrow it down.</p>
                )}
              </>
            ) : (
              <p className="px-1 text-sm text-slate-300">
                Nothing in the morph list matches.{' '}
                {onFreeTextChange && (
                  <button type="button" onClick={moveToFreeText} className="touch-hit font-medium text-emerald-300 underline underline-offset-4 hover:text-emerald-200">
                    Add &ldquo;{typed}&rdquo; to the line below
                  </button>
                )}
              </p>
            )}
          </div>
        )}
      </div>
      <p className="sr-only" role="status" aria-live="polite">
        {typed ? `${matches.length + hiddenMatches} in the morph list` : ''}
      </p>

      {selectedMorphs.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Chosen morphs">
          {selectedMorphs.map((m) => (
            <li key={m}>
              <button
                type="button"
                onClick={() => toggleMorph(m)}
                className="touch:min-h-11 inline-flex items-center gap-1 rounded-full border border-emerald-500/60 bg-emerald-900/50 py-1 pl-3 pr-2 text-sm text-emerald-100 transition-colors hover:border-red-400 hover:bg-red-950/50 hover:text-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label={`Remove ${m}`}
                title="Remove"
              >
                {m}
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {onFreeTextChange && (
        <div>
          <Label htmlFor="morphs_traits">Anything else about its look (optional)</Label>
          <Textarea
            id="morphs_traits"
            rows={2}
            value={freeText}
            onChange={(e) => onFreeTextChange(e.target.value)}
            placeholder="e.g. cream dorsal, heavy lateral pattern"
            className="mt-1 min-h-0 bg-slate-800 border-slate-600 text-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>
      )}

      <div data-no-dirty>
        <button
          type="button"
          onClick={() => setBrowse((open) => !open)}
          aria-expanded={browse}
          aria-controls={`${id}-browse`}
          className="touch:min-h-11 inline-flex items-center gap-1.5 text-sm font-medium text-emerald-300 hover:text-emerald-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ChevronDown className={`h-4 w-4 transition-transform ${browse ? 'rotate-180' : ''}`} aria-hidden="true" />
          Browse all
          <span className="font-normal text-slate-400">{ALL_MORPHS.size} morphs and traits</span>
        </button>
      </div>
      {browse && (
        <div id={`${id}-browse`} className="space-y-4 rounded-lg border border-slate-700 bg-slate-800/50 p-3">
          {Object.entries(MORPH_CATEGORIES).map(([category, { morphs }]) => (
            <div key={category} role="group" aria-label={category}>
              <p className="mb-1.5 text-xs font-semibold text-slate-300">
                {category}
                <span className="ml-1 font-normal text-slate-400">({morphs.length})</span>
              </p>
              <div className="flex flex-wrap gap-1.5">
                {morphs.map((morph) => tagButton(morph, () => toggleMorph(morph)))}
              </div>
            </div>
          ))}
        </div>
      )}
    </fieldset>
  );
}

// Re-exported for callers that historically imported from this file.
export { MORPH_CATEGORIES, ALL_MORPHS };
