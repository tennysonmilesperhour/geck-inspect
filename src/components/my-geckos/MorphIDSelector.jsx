import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dna, ChevronDown, ChevronUp, Search } from 'lucide-react';
import { MORPH_CATEGORIES, ALL_MORPHS } from './morphTagCatalog';

/**
 * Comprehensive crested gecko morph/trait tag selector.
 *
 * The tag catalog lives in ./morphTagCatalog.js (plain JS) so the picker,
 * the gecko filters, and the genetics drift check all share one list.
 */

export default function MorphIDSelector({ selectedMorphs = [], onMorphsChange, disabled = false }) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');

  const toggleMorph = (morph) => {
    if (disabled) return;
    if (selectedMorphs.includes(morph)) {
      onMorphsChange(selectedMorphs.filter(m => m !== morph));
    } else {
      onMorphsChange([...selectedMorphs, morph]);
    }
  };

  const totalSelected = selectedMorphs.length;
  const q = search.toLowerCase();

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        className="w-full border-purple-600 text-purple-300 hover:bg-purple-900/20 flex items-center justify-between"
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
      >
        <div className="flex items-center gap-2">
          <Dna className="w-4 h-4" />
          <span>Morph ID Tags {totalSelected > 0 ? `(${totalSelected} selected)` : ''}</span>
        </div>
        {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </Button>

      {isOpen && (
        <div className="border border-slate-700 rounded-lg p-3 space-y-4 bg-slate-800/50">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <Input
              placeholder="Search traits..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-xs bg-slate-900 border-slate-700 text-slate-100"
            />
          </div>

          {/* Selected tags */}
          {totalSelected > 0 && (
            <div className="flex flex-wrap gap-1 pb-2 border-b border-slate-700">
              <span className="text-xs text-slate-400 mr-1 leading-6">Selected:</span>
              {selectedMorphs.map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleMorph(m); }}
                  className="text-xs bg-purple-600 text-white px-2 py-0.5 rounded-full hover:bg-red-600 transition-colors"
                  title="Click to remove"
                >
                  {m} \u2715
                </button>
              ))}
            </div>
          )}

          {/* Category groups */}
          {Object.entries(MORPH_CATEGORIES).map(([category, { color, badge, morphs }]) => {
            const filtered = q
              ? morphs.filter(m => m.toLowerCase().includes(q))
              : morphs;
            if (filtered.length === 0) return null;

            return (
              <div key={category}>
                <div className={`text-xs font-semibold text-slate-300 mb-2 px-2 py-1 rounded border ${color}`}>
                  {category}
                  <span className="text-slate-500 font-normal ml-1">({filtered.length})</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {filtered.map(morph => {
                    const isSelected = selectedMorphs.includes(morph);
                    return (
                      <button
                        key={morph}
                        type="button"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleMorph(morph); }}
                        className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                          isSelected
                            ? `${badge} text-white border-transparent shadow-sm ring-2 ring-white/30`
                            : 'bg-slate-700 text-slate-300 border-slate-600 hover:border-slate-400 hover:bg-slate-600'
                        }`}
                        disabled={disabled}
                      >
                        {isSelected ? '\u2713 ' : ''}{morph}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          <div className="flex items-center justify-between pt-1 border-t border-slate-700">
            <span className="text-xs text-slate-500">{ALL_MORPHS.size} traits available</span>
            <Button type="button" size="sm" variant="ghost" className="text-slate-400 hover:text-slate-200" onClick={() => setIsOpen(false)}>
              Done
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// Re-exported for callers that historically imported from this file.
export { MORPH_CATEGORIES, ALL_MORPHS };
