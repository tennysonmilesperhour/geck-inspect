import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Dna, AlertTriangle, ChevronDown, ChevronRight, Shuffle, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { getTrait, getComboMorph, displayText } from '@/lib/genetics';
import { predictWeighted, tagsToSpec } from '@/lib/genetics/predictWeighted';
import { MORPH_GUIDE_SLUGS, COMPLEX_LOCUS } from '@/lib/genetics/calculatorCatalog';
import {
  EGGS_PER_CLUTCH,
  DEFAULT_CLUTCHES_PER_SEASON,
  MAX_CLUTCHES_PER_SEASON,
  pAtLeastOne,
  eggsForConfidence,
  roundExpected,
  simpleFraction,
  pct,
  scatterHits,
} from '@/lib/genetics/clutchMath';

/**
 * Pairing results: combined offspring outcomes with combo names first
 * (the engine's offspring_phenotypes, which the old UI never rendered),
 * egg-first probability display per the plan's natural-frequency
 * guidance, warnings (never filterable), and the per-gene Punnett math
 * behind a toggle for anyone who wants to see the work.
 *
 * Accepts parents from two sources through one code path:
 *   - manual mode: animal.genotype_spec (weighted-locus spec, supports
 *     possible hets and the Cappuccino complex)
 *   - collection mode: animal.morph_tags, converted via the engine's
 *     tag importer
 */

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

function severityClasses(severity) {
  if (severity === 'critical') return 'bg-red-950/70 border-red-700 text-red-100';
  if (severity === 'caution')  return 'bg-amber-950/70 border-amber-700 text-amber-100';
  return 'bg-slate-800 border-slate-600 text-slate-200';
}

function animalToSpec(animal) {
  if (animal?.genotype_spec) return animal.genotype_spec;
  return tagsToSpec(animal?.morph_tags || []);
}

function outcomeLabel(outcome) {
  const combos = (outcome.matching_combo_morphs || [])
    .map((id) => getComboMorph(id)?.name)
    .filter(Boolean);
  if (combos.length > 0) return combos.join(' + ');
  return outcome.phenotype_description || 'Wild-type';
}

function guideLinksFor(outcome) {
  const seen = new Set();
  const links = [];
  for (const id of outcome.matching_combo_morphs || []) {
    const slug = MORPH_GUIDE_SLUGS[id];
    if (slug && !seen.has(slug)) {
      seen.add(slug);
      links.push({ slug, name: getComboMorph(id)?.name || id });
    }
  }
  return links;
}

/** Which expressing complex alleles a definite spec carries. */
function complexAlleles(spec) {
  const options = spec?.loci?.[COMPLEX_LOCUS];
  if (!options || options.length !== 1) return new Set();
  return new Set(options[0].pair.filter((a) => a !== 'wild_type'));
}

function EggArray({ eggs, hits, seed }) {
  const shown = Math.min(eggs, 20);
  const shownHits = Math.min(Math.round((hits / eggs) * shown), shown);
  const marks = scatterHits(shown, shownHits, seed);
  return (
    <div className="flex flex-wrap gap-1.5" aria-hidden="true">
      {marks.map((hit, i) => (
        <span
          key={i}
          className={`inline-block w-4 h-5 border ${
            hit
              ? 'bg-emerald-500/90 border-emerald-400'
              : 'bg-slate-700/70 border-slate-600'
          }`}
          style={{ borderRadius: '50% 50% 50% 50% / 58% 58% 42% 42%' }}
        />
      ))}
      {eggs > shown && (
        <span className="text-[11px] text-slate-500 self-center ml-1">
          showing {shown} of {eggs} eggs
        </span>
      )}
    </div>
  );
}

export default function GeneticCalculator({ sire, dam }) {
  const [clutches, setClutches] = useState(DEFAULT_CLUTCHES_PER_SEASON);
  const [selectedKey, setSelectedKey] = useState(null);
  const [shuffleSeed, setShuffleSeed] = useState(1);
  const [showLocusMath, setShowLocusMath] = useState(false);

  const prediction = useMemo(() => {
    if (!sire || !dam) return null;
    const sireSpec = animalToSpec(sire);
    const damSpec = animalToSpec(dam);
    const sireEmpty = Object.keys(sireSpec.loci || {}).length === 0;
    const damEmpty = Object.keys(damSpec.loci || {}).length === 0;
    if (sireEmpty && damEmpty) return null;
    try {
      return { ...predictWeighted(sireSpec, damSpec), sireSpec, damSpec };
    } catch {
      return null;
    }
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

  if (!prediction) {
    return (
      <div className="text-center py-12 text-slate-400">
        <Dna className="w-10 h-10 mx-auto mb-3 opacity-40" />
        <p className="font-medium mb-1">Nothing to calculate yet.</p>
        <p className="text-sm">
          Pick at least one gene on either parent. Proven genes: Lilly White, Axanthic, Phantom,
          Empty Back, and the Cappuccino complex (Cappuccino, Sable, Luwak).
        </p>
      </div>
    );
  }

  const { offspring_phenotypes, locus_predictions, warnings, uncertain, sireSpec, damSpec } = prediction;
  const eggs = clutches * EGGS_PER_CLUTCH;

  const outcomes = offspring_phenotypes;
  const defaultKey =
    outcomes.find((o) => (o.phenotype_description || '').toLowerCase() !== 'wild-type')
      ?.phenotype_description || outcomes[0]?.phenotype_description;
  const activeKey = selectedKey && outcomes.some((o) => o.phenotype_description === selectedKey)
    ? selectedKey
    : defaultKey;
  const selected = outcomes.find((o) => o.phenotype_description === activeKey) || outcomes[0];

  const lethalP = outcomes
    .filter((o) => o.health_risk === 'lethal')
    .reduce((s, o) => s + o.probability, 0);

  // Cappuccino-complex coaching: same expressing allele on both sides
  // risks a super; Capp x Sable is the safe route (Luwak, no super).
  const sireComplex = complexAlleles(sireSpec);
  const damComplex = complexAlleles(damSpec);
  const sharedComplex = [...sireComplex].filter((a) => damComplex.has(a));
  const crossComplex =
    sireComplex.size > 0 && damComplex.size > 0 && sharedComplex.length === 0;

  return (
    <div className="space-y-4">
      {/* Parent summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-800 rounded-lg p-3">
          <p className="text-xs text-blue-400 font-semibold mb-1">♂ Sire, {sire.name}</p>
          <div className="flex flex-wrap gap-1">
            {sireTraits.length ? sireTraits.map((t) => (
              <span key={t} className="text-xs bg-blue-900/60 border border-blue-700 text-blue-200 px-1.5 py-0.5 rounded">{t}</span>
            )) : <span className="text-xs text-slate-500">No genes selected</span>}
          </div>
        </div>
        <div className="bg-slate-800 rounded-lg p-3">
          <p className="text-xs text-pink-400 font-semibold mb-1">♀ Dam, {dam.name}</p>
          <div className="flex flex-wrap gap-1">
            {damTraits.length ? damTraits.map((t) => (
              <span key={t} className="text-xs bg-pink-900/60 border border-pink-700 text-pink-200 px-1.5 py-0.5 rounded">{t}</span>
            )) : <span className="text-xs text-slate-500">No genes selected</span>}
          </div>
        </div>
      </div>

      {/* Safety warnings: always rendered, never filterable */}
      {warnings.length > 0 && (
        <div className="space-y-2">
          {warnings.map((w) => (
            <div key={w.code} className={'rounded-lg p-3 border flex items-start gap-2 ' + severityClasses(w.severity)}>
              <AlertTriangle className={w.severity === 'critical' ? 'w-4 h-4 mt-0.5 flex-shrink-0 text-red-300' : 'w-4 h-4 mt-0.5 flex-shrink-0 text-amber-300'} />
              <div className="text-sm leading-snug">
                <span className="font-semibold uppercase tracking-wide text-xs mr-1">{w.severity}</span>
                {displayText(w.message)}
                {w.conditional && (
                  <span className="text-xs opacity-80"> (applies only if the possible het proves out)</span>
                )}
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

      {/* Cappuccino-complex coaching */}
      {sharedComplex.length > 0 && sharedComplex.some((a) => a !== 'sable') && (
        <div className="rounded-lg p-3 border bg-amber-950/50 border-amber-700 text-amber-100 text-sm leading-snug">
          Both parents carry {getTrait(sharedComplex[0])?.name || sharedComplex[0]}, so this pairing
          can produce its super form. Looking for the complex look without super risk? Pairing
          Cappuccino to Sable produces Luwak and can never make a super.
        </div>
      )}
      {sharedComplex.length > 0 && sharedComplex.every((a) => a === 'sable') && (
        <div className="rounded-lg p-3 border bg-slate-800 border-slate-600 text-slate-200 text-sm leading-snug">
          Sable x Sable can produce Super Sable, which appears viable. Community practice is to
          check nostril openings at hatch on any super in the Cappuccino complex.
        </div>
      )}
      {crossComplex && (
        <div className="rounded-lg p-3 border bg-emerald-950/40 border-emerald-800 text-emerald-100 text-sm leading-snug">
          Safe complex pairing: the parents carry different alleles of the Cappuccino complex, so
          no super form is possible from this cross.
        </div>
      )}

      {/* Season framing: cresties lay 2-egg clutches */}
      <div className="bg-slate-800 rounded-lg p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-sm font-semibold text-slate-200">Predicted offspring</h4>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span>Season:</span>
            <select
              value={clutches}
              onChange={(e) => setClutches(Number(e.target.value))}
              className="bg-slate-700 border border-slate-600 rounded px-1.5 py-1 text-slate-200"
              aria-label="Clutches per season"
            >
              {Array.from({ length: MAX_CLUTCHES_PER_SEASON }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>{n} clutch{n > 1 ? 'es' : ''}</option>
              ))}
            </select>
            <span className="font-mono text-slate-300">{eggs} eggs</span>
          </div>
        </div>
        <p className="text-xs text-slate-500">
          Crested geckos lay 2-egg clutches every 30 to 45 days. Odds below are per egg; the egg
          counts show what a {eggs}-egg season typically produces. Every egg is an independent
          draw, so real seasons scatter around these numbers.
        </p>

        <div className="space-y-1.5">
          {outcomes.map((o) => {
            const isActive = o.phenotype_description === selected?.phenotype_description;
            const frac = simpleFraction(o.probability);
            const label = outcomeLabel(o);
            const links = guideLinksFor(o);
            return (
              <button
                key={o.phenotype_description}
                type="button"
                onClick={() => setSelectedKey(o.phenotype_description)}
                className={`w-full text-left rounded-lg border px-3 py-2 transition-colors ${
                  isActive
                    ? 'border-purple-500/70 bg-purple-950/30'
                    : 'border-slate-700 bg-slate-900/40 hover:border-slate-500'
                }`}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className={`text-sm ${
                    o.health_risk === 'lethal' ? 'text-red-300' :
                    o.health_risk === 'severe' || o.health_risk === 'moderate' ? 'text-amber-300' :
                    label === 'Wild-type' ? 'text-slate-400' : 'text-emerald-300'
                  }`}>
                    {label}
                    {o.health_risk === 'lethal' && <span className="ml-1.5 text-xs text-red-400">(non-viable)</span>}
                  </span>
                  <span className="text-sm font-mono text-slate-200 whitespace-nowrap">
                    {pct(o.probability)}
                    {frac && <span className="text-slate-500 ml-1.5">{frac}</span>}
                  </span>
                </div>
                {label !== o.phenotype_description && (
                  <p className="text-xs text-slate-500 mt-0.5">{o.phenotype_description}</p>
                )}
                <div className="flex items-center justify-between gap-3 mt-1">
                  <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        o.health_risk === 'lethal' ? 'bg-red-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.max(o.probability * 100, 1.5)}%` }}
                    />
                  </div>
                  <span className="text-xs text-slate-400 font-mono whitespace-nowrap">
                    ≈{roundExpected(o.probability * eggs)} of {eggs} eggs
                  </span>
                </div>
                {links.length > 0 && (
                  <div className="mt-1 flex gap-2">
                    {links.map((l) => (
                      <Link
                        key={l.slug}
                        to={`/MorphGuide/${l.slug}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-xs text-purple-300 hover:text-purple-200 underline inline-flex items-center gap-0.5"
                      >
                        {l.name} in the Morph Guide
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Selected outcome, egg-array view */}
        {selected && (
          <div className="border-t border-slate-700 pt-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-slate-300">
                <span className="font-semibold text-slate-100">{outcomeLabel(selected)}</span> across
                a {eggs}-egg season
              </p>
              <button
                type="button"
                onClick={() => setShuffleSeed((s) => s + 1)}
                className="text-xs text-slate-400 hover:text-slate-200 inline-flex items-center gap-1"
                title="Reshuffle which eggs hit. The odds do not change; the scatter is the point."
              >
                <Shuffle className="w-3 h-3" /> shuffle
              </button>
            </div>
            <EggArray
              eggs={eggs}
              hits={Math.round(selected.probability * eggs)}
              seed={shuffleSeed * 7919 + (selected.phenotype_description?.length || 1)}
            />
            <p className="text-xs text-slate-400">
              Chance of at least one this season:{' '}
              <span className="font-mono text-emerald-300">{pct(pAtLeastOne(selected.probability, eggs))}</span>
              {selected.probability > 0 && selected.probability < 1 && (
                <>
                  {' '}· roughly{' '}
                  <span className="font-mono text-slate-300">
                    {eggsForConfidence(selected.probability, 0.9)}
                  </span>{' '}
                  eggs for 90% odds
                </>
              )}
            </p>
          </div>
        )}

        {lethalP > 0 && (
          <div className="rounded-lg border border-red-800 bg-red-950/40 px-3 py-2 text-xs text-red-200">
            Expected loss: about {roundExpected(lethalP * eggs)} of {eggs} eggs this season are
            predicted non-viable from lethal super outcomes. That loss is part of why pairings like
            this are discouraged.
          </div>
        )}

        {uncertain && (
          <p className="text-xs text-slate-500">
            A parent carries a possible het, so these odds average over whether it proves out.
            Hatch results will tell you which side of the odds you are on.
          </p>
        )}
      </div>

      {/* Per-gene Punnett math, on demand */}
      <div>
        <button
          type="button"
          onClick={() => setShowLocusMath((v) => !v)}
          className="flex items-center gap-1.5 text-sm text-slate-300 hover:text-slate-100"
        >
          {showLocusMath ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          Show the gene-by-gene math
        </button>
        {showLocusMath && (
          <div className="space-y-3 mt-3">
            {locus_predictions.map((lp) => {
              const trait = getTrait(lp.trait) || null;
              const badge = dominanceBadge(trait);
              const slug = trait && MORPH_GUIDE_SLUGS[trait.id];
              return (
                <div key={lp.locus} className="bg-slate-800 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Dna className="w-4 h-4 text-purple-400" />
                    <span className="font-semibold text-slate-100">{trait?.name || lp.locus}</span>
                    <Badge className={badge.cls}>{badge.label}</Badge>
                    {slug && (
                      <Link to={`/MorphGuide/${slug}`} className="text-xs text-purple-300 underline ml-auto">
                        Morph Guide
                      </Link>
                    )}
                  </div>
                  <div className="space-y-2">
                    {lp.outcomes.map(({ genotype, probability, phenotype_label }) => (
                      <div key={`${genotype[0]}|${genotype[1]}|${phenotype_label}`}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className={
                            phenotype_label?.toLowerCase().startsWith('super') ? 'text-yellow-300 font-semibold' :
                            phenotype_label === 'Wild-type' ? 'text-slate-400' : 'text-emerald-300'
                          }>{phenotype_label}</span>
                          <span className="text-slate-300 font-mono">{pct(probability)}</span>
                        </div>
                        <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              phenotype_label?.toLowerCase().startsWith('super') ? 'bg-yellow-400' :
                              phenotype_label === 'Wild-type' ? 'bg-slate-600' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${Math.max(probability * 100, 1)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <p className="text-xs text-slate-500 text-center pt-2">
        Per-egg probabilities from exact Punnett math across independent genes, aligned with the
        Foundation Genetics consensus (<a className="underline" href="https://lmreptiles.com/fg-overview" target="_blank" rel="noopener noreferrer">lmreptiles.com/fg-overview</a>).
        Polygenic traits (Harlequin, Pinstripe coverage, Dalmatian density) are not given fake
        percentages; that honesty is deliberate.
      </p>
    </div>
  );
}
