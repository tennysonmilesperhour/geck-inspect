import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dna, ChevronDown, ChevronUp, Search } from 'lucide-react';

/**
 * Comprehensive crested gecko morph/trait tag selector.
 *
 * Inheritance classifications follow the Foundation Genetics consensus
 * (mirrored in `src/components/morph-id/morphTaxonomy.js` ,  the canonical
 * in-repo reference). Trait list sourced from MorphMarket Morphpedia,
 * Lil Monsters Foundation Genetics, Fringemorphs, and community glossaries.
 *
 * Notes on intentional omissions:
 *   - Super Lilly White is embryonic-lethal (Lilly × Lilly loses ~25% of
 *     eggs). No animal walks around as one, so it isn't a taggable state.
 *   - Albino is not a proven crested gecko trait. Leucistic / axanthic
 *     animals get mislabeled as albino; keep the axanthic tag instead.
 *
 * Traits are mutually exclusive where biologically appropriate (e.g. a
 * gecko can't be both Fired Up and Fired Down simultaneously) but the
 * selector doesn't enforce that ,  breeders know their animals.
 */

const MORPH_CATEGORIES = {
  "Proven Genetics (Incomplete Dominant)": {
    color: "bg-purple-900/50 border-purple-700",
    badge: "bg-purple-700",
    morphs: [
      "Lilly White",
      "Cappuccino", "Super Cappuccino",
      "Soft Scale", "Super Soft Scale",
      "Moonglow",
      "Empty Back", "Super Empty Back",
      "White Wall",
    ],
  },
  "Proven Genetics (Recessive)": {
    color: "bg-rose-900/50 border-rose-700",
    badge: "bg-rose-700",
    morphs: [
      "Axanthic",
    ],
  },
  "Combo Morphs": {
    color: "bg-fuchsia-900/50 border-fuchsia-700",
    badge: "bg-fuchsia-700",
    morphs: [
      "Frappuccino",
      "Cappuccino Lilly White",
      "Axanthic Lilly White",
      "Axanthic Cappuccino",
      "Soft Scale Lilly White",
      "Soft Scale Cappuccino",
      "Moonglow Lilly White",
    ],
  },
  "Het Status": {
    color: "bg-indigo-900/50 border-indigo-700",
    badge: "bg-indigo-700",
    morphs: [
      "Het Lilly White", "Possible Het Lilly White",
      "Het Axanthic", "Possible Het Axanthic",
      "Het Cappuccino", "Possible Het Cappuccino",
      "Het Soft Scale", "Possible Het Soft Scale",
      "Het Moonglow", "Possible Het Moonglow",
      "Het Empty Back", "Possible Het Empty Back",
    ],
  },
  "Base Patterns": {
    color: "bg-emerald-900/50 border-emerald-700",
    badge: "bg-emerald-700",
    morphs: [
      "Flame", "Chevron Flame",
      "Harlequin", "Extreme Harlequin",
      "Pinstripe", "Full Pinstripe", "Phantom Pinstripe",
      "Tiger",
      "Brindle", "Extreme Brindle",
      "Patternless",
      "Bicolor",
      "Tricolor",
      "Phantom",
      "Whiteout",
    ],
  },
  "Harlequin Variants": {
    color: "bg-pink-900/50 border-pink-700",
    badge: "bg-pink-700",
    morphs: [
      "Red Harlequin", "Extreme Red Harlequin",
      "Yellow Harlequin",
      "Cream Harlequin",
      "Orange Harlequin",
      "Halloween Harlequin",
    ],
  },
  "Pinstripe Variants": {
    color: "bg-cyan-900/50 border-cyan-700",
    badge: "bg-cyan-700",
    morphs: [
      "Partial Pinstripe",
      "Dashed Pinstripe",
      "Reverse Pinstripe",
      "Quad Stripe",
      "Super Stripe",
    ],
  },
  "Base Colors": {
    color: "bg-yellow-900/50 border-yellow-700",
    badge: "bg-yellow-700",
    morphs: [
      "Red Base", "Dark Red Base",
      "Orange Base",
      "Yellow Base", "Bright Yellow Base",
      "Cream Base",
      "Pink Base",
      "Olive Base", "Dark Olive Base",
      "Green Base",
      "Tan Base",
      "Brown Base", "Dark Brown Base",
      "Chocolate Base",
      "Buckskin Base",
      "Lavender Base",
      "Near Black Base",
    ],
  },
  "Color Traits": {
    color: "bg-amber-900/50 border-amber-700",
    badge: "bg-amber-700",
    morphs: [
      "Hypo",
      "Translucent",
      "High White",
      "High Contrast",
    ],
  },
  "Dalmatian & Spots": {
    color: "bg-blue-900/50 border-blue-700",
    badge: "bg-blue-700",
    morphs: [
      "Dalmatian", "Super Dalmatian",
      "Ink Spots", "Oil Spots",
      "Red Spots",
      "Confetti",
      "Spots on Head",
      "Dalmatian Tail",
    ],
  },
  "Structure & Texture": {
    color: "bg-violet-900/50 border-violet-700",
    badge: "bg-violet-700",
    morphs: [
      "Furred",
      "Crowned",
    ],
  },
  "Body Markings": {
    color: "bg-teal-900/50 border-teal-700",
    badge: "bg-teal-700",
    morphs: [
      "White Fringe",
      "Kneecaps",
      "Portholes",
      "Drippy Dorsal",
      "White Tipped Crests",
      "Colored Crests",
      "Side Stripe",
      "Tiger Striping",
      "Banded",
      "Broken Banding",
      "Chevron Pattern",
      "Diamond Pattern",
      "Reticulated",
      "Mottled",
      "Speckled",
    ],
  },
  "Display State": {
    color: "bg-slate-700/50 border-slate-600",
    badge: "bg-slate-600",
    morphs: [
      "Fired Up",
      "Fired Down",
      "Full Tail",
      "Tailless",
    ],
  },
};

// Build a flat set of all morphs for dedup validation
const ALL_MORPHS = new Set(
  Object.values(MORPH_CATEGORIES).flatMap(c => c.morphs)
);

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

export { MORPH_CATEGORIES, ALL_MORPHS };
