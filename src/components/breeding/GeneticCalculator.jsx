import { useMemo } from 'react';
import { Dna } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

// Proven genetic traits — incomplete dominant (visual in single copy, super in double).
// These are the only traits where Punnett-square math applies.
const CO_DOM_TRAITS = new Set([
  'Lilly White', 'Axanthic', 'Cappuccino', 'Soft Scale', 'Moonglow',
  'Empty Back', 'White Wall',
]);

// Polygenic / dominant / display traits — presence/absence only, no
// Mendelian math. Kept in sync with MorphIDSelector categories.
const DOM_TRAITS = new Set([
  // Combo morphs
  'Frappuccino', 'Super Cappuccino', 'Cappuccino Lilly White',
  'Axanthic Lilly White', 'Axanthic Cappuccino',
  'Soft Scale Lilly White', 'Soft Scale Cappuccino', 'Moonglow Lilly White',
  // Base patterns
  'Flame', 'Chevron Flame', 'Harlequin', 'Extreme Harlequin',
  'Pinstripe', 'Full Pinstripe', 'Phantom Pinstripe',
  'Tiger', 'Brindle', 'Extreme Brindle', 'Patternless',
  'Bicolor', 'Tricolor', 'Phantom', 'Whiteout',
  // Harlequin variants
  'Red Harlequin', 'Extreme Red Harlequin', 'Yellow Harlequin',
  'Cream Harlequin', 'Orange Harlequin', 'Halloween Harlequin',
  // Pinstripe variants
  'Partial Pinstripe', 'Dashed Pinstripe', 'Reverse Pinstripe',
  'Quad Stripe', 'Super Stripe',
  // Base colors
  'Red Base', 'Dark Red Base', 'Orange Base', 'Yellow Base', 'Bright Yellow Base',
  'Cream Base', 'Pink Base', 'Olive Base', 'Dark Olive Base', 'Green Base',
  'Tan Base', 'Brown Base', 'Dark Brown Base', 'Chocolate Base',
  'Buckskin Base', 'Lavender Base', 'Near Black Base',
  // Color traits
  'Hypo', 'Translucent', 'High White', 'High Contrast',
  // Dalmatian & spots
  'Dalmatian', 'Super Dalmatian', 'Ink Spots', 'Oil Spots',
  'Red Spots', 'Confetti', 'Spots on Head', 'Dalmatian Tail',
  // Structure
  'Furred', 'Crowned',
  // Body markings
  'White Fringe', 'Kneecaps', 'Portholes', 'Drippy Dorsal',
  'White Tipped Crests', 'Colored Crests', 'Side Stripe',
  'Tiger Striping', 'Banded', 'Broken Banding',
  'Chevron Pattern', 'Diamond Pattern', 'Reticulated', 'Mottled', 'Speckled',
  // Display state
  'Fired Up', 'Fired Down', 'Full Tail', 'Tailless',
]);

// For co-dominant traits, if one parent has the "Super" version infer double copy
function inferCopies(traitName, morphTags) {
  const superName = `Super ${traitName}`;
  if (morphTags.includes(superName)) return 2; // homozygous
  if (morphTags.includes(traitName)) return 1;  // heterozygous
  return 0;
}

function calcCoDomOutcomes(sireCopies, damCopies, traitName) {
  // Punnett: S = single (visual), N = normal, SS = super/homozygous
  const sireAlleles = sireCopies === 2 ? ['S', 'S'] : sireCopies === 1 ? ['S', 'N'] : ['N', 'N'];
  const damAlleles  = damCopies  === 2 ? ['S', 'S'] : damCopies  === 1 ? ['S', 'N'] : ['N', 'N'];

  const results = {};
  for (const sa of sireAlleles) {
    for (const da of damAlleles) {
      const combo = [sa, da].sort().join('');
      results[combo] = (results[combo] || 0) + 1;
    }
  }
  const total = 4;
  const outcomes = [];
  for (const [combo, count] of Object.entries(results)) {
    const pct = Math.round((count / total) * 100);
    if (combo === 'SS') outcomes.push({ label: `Super ${traitName}`, pct, type: 'super' });
    else if (combo === 'SN') outcomes.push({ label: traitName, pct, type: 'visual' });
    else outcomes.push({ label: `Normal (no ${traitName})`, pct, type: 'normal' });
  }
  return outcomes.filter(o => o.pct > 0);
}

function calcDomOutcome(sireHas, damHas, traitName) {
  if (!sireHas && !damHas) return [];
  const prob = sireHas && damHas ? 75 : 50;
  return [
    { label: traitName, pct: prob, type: 'visual' },
    { label: `No ${traitName}`, pct: 100 - prob, type: 'normal' }
  ];
}

export default function GeneticCalculator({ sire, dam }) {
  const results = useMemo(() => {
    if (!sire || !dam) return [];
    const sireTagSet = new Set(sire.morph_tags || []);
    const damTagSet  = new Set(dam.morph_tags  || []);
    const allTraits  = new Set([...sireTagSet, ...damTagSet]);

    const output = [];

    // Co-dominant traits
    for (const trait of CO_DOM_TRAITS) {
      const superTrait = `Super ${trait}`;
      if (!allTraits.has(trait) && !allTraits.has(superTrait)) continue;

      // Skip "Super X" entries — we handle them via base trait
      if (trait.startsWith('Super ')) continue;

      const sireCopies = inferCopies(trait, sire.morph_tags || []);
      const damCopies  = inferCopies(trait, dam.morph_tags  || []);
      if (sireCopies === 0 && damCopies === 0) continue;

      const outcomes = calcCoDomOutcomes(sireCopies, damCopies, trait);
      output.push({ trait, type: 'codom', outcomes });
    }

    // Dominant / polygenic traits
    for (const trait of DOM_TRAITS) {
      if (!allTraits.has(trait)) continue;
      const sireHas = sireTagSet.has(trait);
      const damHas  = damTagSet.has(trait);
      const outcomes = calcDomOutcome(sireHas, damHas, trait);
      if (outcomes.length) output.push({ trait, type: 'dom', outcomes });
    }

    return output;
  }, [sire, dam]);

  if (!sire || !dam) {
    return (
      <div className="text-center py-12 text-slate-400">
        <Dna className="w-10 h-10 mx-auto mb-3 opacity-40" />
        <p>Select both a sire and dam to see genetic outcomes.</p>
      </div>
    );
  }

  const sireTraits = sire.morph_tags || [];
  const damTraits  = dam.morph_tags  || [];

  if (sireTraits.length === 0 && damTraits.length === 0) {
    return (
      <div className="text-center py-12 text-slate-400">
        <Dna className="w-10 h-10 mx-auto mb-3 opacity-40" />
        <p className="font-medium mb-1">No morph tags assigned to either parent.</p>
        <p className="text-sm">Add Morph ID Tags to each gecko's profile to calculate genetic outcomes.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Parent summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-800 rounded-lg p-3">
          <p className="text-xs text-blue-400 font-semibold mb-1">♂ Sire — {sire.name}</p>
          <div className="flex flex-wrap gap-1">
            {sireTraits.length ? sireTraits.map(t => (
              <span key={t} className="text-xs bg-blue-900/60 border border-blue-700 text-blue-200 px-1.5 py-0.5 rounded">{t}</span>
            )) : <span className="text-xs text-slate-500">No tags</span>}
          </div>
        </div>
        <div className="bg-slate-800 rounded-lg p-3">
          <p className="text-xs text-pink-400 font-semibold mb-1">♀ Dam — {dam.name}</p>
          <div className="flex flex-wrap gap-1">
            {damTraits.length ? damTraits.map(t => (
              <span key={t} className="text-xs bg-pink-900/60 border border-pink-700 text-pink-200 px-1.5 py-0.5 rounded">{t}</span>
            )) : <span className="text-xs text-slate-500">No tags</span>}
          </div>
        </div>
      </div>

      {results.length === 0 && (
        <div className="text-center py-8 text-slate-400 bg-slate-800 rounded-lg">
          <p className="text-sm">No calculable trait interactions found.</p>
          <p className="text-xs mt-1 text-slate-500">Traits carried by only one parent with no co-dominant interaction are shown below.</p>
        </div>
      )}

      {results.map(({ trait, type, outcomes }) => (
        <div key={trait} className="bg-slate-800 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <Dna className="w-4 h-4 text-purple-400" />
            <span className="font-semibold text-slate-100">{trait}</span>
            <Badge className={type === 'codom' ? 'bg-purple-700 text-xs' : 'bg-slate-600 text-xs'}>
              {type === 'codom' ? 'Co-dominant' : 'Dominant'}
            </Badge>
          </div>
          <div className="space-y-2">
            {outcomes.map(({ label, pct, type: oType }) => (
              <div key={label}>
                <div className="flex justify-between text-sm mb-1">
                  <span className={
                    oType === 'super' ? 'text-yellow-300 font-semibold' :
                    oType === 'visual' ? 'text-emerald-300' :
                    'text-slate-400'
                  }>{label}</span>
                  <span className="text-slate-300 font-mono">{pct}%</span>
                </div>
                <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      oType === 'super' ? 'bg-yellow-400' :
                      oType === 'visual' ? 'bg-emerald-500' :
                      'bg-slate-600'
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      <p className="text-xs text-slate-500 text-center pt-2">
        Probabilities are per-offspring. Co-dominant calculations use standard Punnett square ratios.
        Polygenic traits show approximate inheritance likelihood.
      </p>
    </div>
  );
}