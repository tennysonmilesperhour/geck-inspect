import { useMemo } from 'react';
import { Dna, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  tagToGenotype,
  predict,
  getTrait,
  TRAITS,
} from 'crested-gecko-app';

// Pick a representative Trait per locus for display labels. If a locus
// houses multiple allelic traits (e.g. SABLE_COMPLEX), the first one
// wins and the prediction's phenotype_label string already handles
// compound / super labeling.
const LOCUS_TO_TRAIT = (() => {
  const m = new Map();
  for (const t of TRAITS) if (!m.has(t.locus)) m.set(t.locus, t);
  return m;
})();

function tagsToAnimal(id, tags) {
  // tagToGenotype returns Partial<AnimalGenotype>; predict() treats missing
  // loci as wild-type, so the partial is runtime-safe. Cast to satisfy the
  // stricter TS signature on the shared Animal type.
  const partial = tagToGenotype(tags || []).genotype;
  const genotype = /** @type {import('crested-gecko-app').AnimalGenotype} */ (partial);
  return {
    id,
    species: 'correlophus_ciliatus',
    genotype,
    status: 'active',
    is_breeder: true,
    owner_id: id,
    created_at: '',
    updated_at: '',
  };
}

function dominanceBadge(trait) {
  switch (trait?.dominance) {
    case 'incomplete_dominant': return { label: 'Incomplete dominant', cls: 'bg-purple-700 text-xs' };
    case 'codominant':          return { label: 'Co-dominant',          cls: 'bg-purple-700 text-xs' };
    case 'dominant':            return { label: 'Dominant',             cls: 'bg-slate-600 text-xs' };
    case 'fixed_dominant':      return { label: 'Fixed dominant',       cls: 'bg-slate-600 text-xs' };
    case 'recessive':           return { label: 'Recessive',            cls: 'bg-emerald-800 text-xs' };
    case 'polygenic':           return { label: 'Polygenic',            cls: 'bg-slate-600 text-xs' };
    case 'unconfirmed':         return { label: 'Unconfirmed',          cls: 'bg-amber-700 text-xs' };
    default:                    return { label: 'Trait',                cls: 'bg-slate-600 text-xs' };
  }
}

function outcomeType(label, trait) {
  if (!label) return 'normal';
  const lower = label.toLowerCase();
  if (lower === 'wild-type' || lower.startsWith('no ')) return 'normal';
  if (lower.startsWith('super ')) return 'super';
  if (trait?.super_form_name && lower.includes(trait.super_form_name.toLowerCase())) return 'super';
  return 'visual';
}

function severityClasses(severity) {
  if (severity === 'critical') return 'bg-red-950/70 border-red-700 text-red-100';
  if (severity === 'caution')  return 'bg-amber-950/70 border-amber-700 text-amber-100';
  return 'bg-slate-800 border-slate-600 text-slate-200';
}

export default function GeneticCalculator({ sire, dam }) {
  const prediction = useMemo(() => {
    if (!sire || !dam) return null;
    const sireTags = sire.morph_tags || [];
    const damTags = dam.morph_tags || [];
    if (sireTags.length === 0 && damTags.length === 0) return null;

    const sireAnimal = tagsToAnimal(sire.id || 'sire', sireTags);
    const damAnimal = tagsToAnimal(dam.id || 'dam', damTags);
    return predict(sireAnimal, damAnimal);
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
  const damTraits = dam.morph_tags || [];

  if (sireTraits.length === 0 && damTraits.length === 0) {
    return (
      <div className="text-center py-12 text-slate-400">
        <Dna className="w-10 h-10 mx-auto mb-3 opacity-40" />
        <p className="font-medium mb-1">No morph tags assigned to either parent.</p>
        <p className="text-sm">Add Morph ID Tags to each gecko's profile to calculate genetic outcomes.</p>
      </div>
    );
  }

  const warnings = prediction?.warnings || [];
  // Only render loci where at least one outcome is not pure wild-type
  const locusPredictions = (prediction?.locus_predictions || []).filter((lp) =>
    lp.outcomes.some((o) => o.phenotype_label && o.phenotype_label !== 'Wild-type'),
  );

  return (
    <div className="space-y-4">
      {/* Parent summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-800 rounded-lg p-3">
          <p className="text-xs text-blue-400 font-semibold mb-1">♂ Sire ,  {sire.name}</p>
          <div className="flex flex-wrap gap-1">
            {sireTraits.length ? sireTraits.map((t) => (
              <span key={t} className="text-xs bg-blue-900/60 border border-blue-700 text-blue-200 px-1.5 py-0.5 rounded">{t}</span>
            )) : <span className="text-xs text-slate-500">No tags</span>}
          </div>
        </div>
        <div className="bg-slate-800 rounded-lg p-3">
          <p className="text-xs text-pink-400 font-semibold mb-1">♀ Dam ,  {dam.name}</p>
          <div className="flex flex-wrap gap-1">
            {damTraits.length ? damTraits.map((t) => (
              <span key={t} className="text-xs bg-pink-900/60 border border-pink-700 text-pink-200 px-1.5 py-0.5 rounded">{t}</span>
            )) : <span className="text-xs text-slate-500">No tags</span>}
          </div>
        </div>
      </div>

      {/* Warnings ,  critical safety info, always rendered, not filterable */}
      {warnings.length > 0 && (
        <div className="space-y-2">
          {warnings.map((w) => (
            <div key={w.code} className={'rounded-lg p-3 border flex items-start gap-2 ' + severityClasses(w.severity)}>
              <AlertTriangle className={w.severity === 'critical' ? 'w-4 h-4 mt-0.5 flex-shrink-0 text-red-300' : 'w-4 h-4 mt-0.5 flex-shrink-0 text-amber-300'} />
              <div className="text-sm leading-snug">
                <span className="font-semibold uppercase tracking-wide text-xs mr-1">{w.severity}</span>
                {w.message}
                {w.source_url && (
                  <>
                    {' '}
                    <a href={w.source_url} target="_blank" rel="noopener noreferrer" className="underline">
                      source
                    </a>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Per-locus predictions */}
      {locusPredictions.length === 0 && (
        <div className="text-center py-8 text-slate-400 bg-slate-800 rounded-lg">
          <p className="text-sm">No calculable trait interactions found.</p>
          <p className="text-xs mt-1 text-slate-500">
            Neither parent's morph tags mapped to a genotype this calculator can reason about. Add known
            proven traits (Lilly White, Cappuccino, Phantom, Dalmatian, Pinstripe, etc.) to refine.
          </p>
        </div>
      )}

      {locusPredictions.map((lp) => {
        const trait = LOCUS_TO_TRAIT.get(lp.locus) || getTrait(lp.trait);
        const badge = dominanceBadge(trait);
        return (
          <div key={lp.locus} className="bg-slate-800 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <Dna className="w-4 h-4 text-purple-400" />
              <span className="font-semibold text-slate-100">{trait?.name || lp.locus}</span>
              <Badge className={badge.cls}>{badge.label}</Badge>
            </div>
            <div className="space-y-2">
              {lp.outcomes
                .filter((o) => o.probability > 0)
                .sort((a, b) => b.probability - a.probability)
                .map(({ genotype, probability, phenotype_label }) => {
                  const pct = Math.round(probability * 100);
                  const type = outcomeType(phenotype_label, trait);
                  return (
                    <div key={`${genotype[0]}|${genotype[1]}`}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className={
                          type === 'super' ? 'text-yellow-300 font-semibold' :
                          type === 'visual' ? 'text-emerald-300' :
                          'text-slate-400'
                        }>{phenotype_label}</span>
                        <span className="text-slate-300 font-mono">{pct}%</span>
                      </div>
                      <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            type === 'super' ? 'bg-yellow-400' :
                            type === 'visual' ? 'bg-emerald-500' :
                            'bg-slate-600'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        );
      })}

      <p className="text-xs text-slate-500 text-center pt-2">
        Probabilities are per-offspring from Punnett-square math across independent loci, powered by the
        Foundation Genetics consensus (<a className="underline" href="https://lmreptiles.com/fg-overview" target="_blank" rel="noopener noreferrer">lmreptiles.com/fg-overview</a>).
        Morph tags are auto-converted to genotypes ,  add explicit zygosity context for exact results.
      </p>
    </div>
  );
}
