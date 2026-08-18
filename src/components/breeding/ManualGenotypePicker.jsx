import { useMemo } from 'react';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AlertTriangle } from 'lucide-react';
import {
  SIMPLE_TRAITS,
  COMPLEX_ENTRY,
  COMPLEX_ID,
  COMPLEX_OPTIONS,
  COMPLEX_OPTIONS_BY_VALUE,
  zygosityOptions,
  stateToSpec,
  stateToChips,
} from '@/lib/genetics/calculatorCatalog';

/**
 * Manual genotype picker over the full calculator catalog
 * (src/lib/genetics/calculatorCatalog.js): every proven and emerging
 * Mendelian trait, the Cappuccino complex as a single allele-pair slot
 * (which is what makes Luwak and the supers expressible), and
 * probabilistic "possible het" states for recessives.
 *
 * Polygenic traits are intentionally absent: Punnett math on Harlequin
 * or Dalmatian density would be fake precision. See
 * MORPH_CALCULATOR_PLAN.md for the expression-band plan.
 *
 * Stateless: the parent owns the state record ({ traitId: zygosity }),
 * we only emit onChange(next).
 */

const CONFIDENCE_BADGE = {
  proven: {
    label: 'Proven',
    cls: 'bg-emerald-900/50 border-emerald-700 text-emerald-300',
    title: 'Proven through replicated breeding trials with broad community consensus.',
  },
  emerging: {
    label: 'Emerging',
    cls: 'bg-amber-900/40 border-amber-700 text-amber-300',
    title: 'Documented by one or few breeders, or newly proven. Computed like any gene, badged so the state of the science is visible.',
  },
};

function ConfidenceBadge({ confidence }) {
  const badge = CONFIDENCE_BADGE[confidence];
  if (!badge) return null;
  return (
    <span
      title={badge.title}
      className={`text-[10px] uppercase tracking-wider border px-1.5 py-0.5 rounded-full ${badge.cls}`}
    >
      {badge.label}
    </span>
  );
}

/**
 * Build the animal-shaped object the calculator and simulator consume.
 * `genotype_spec` carries the weighted-locus spec (the precise path);
 * `morph_tags` carries display chips so parent summaries render the
 * same way for manual and collection parents.
 */
export function buildParentFromState(id, name, state) {
  return {
    id,
    name,
    sex: 'Unsexed',
    image_urls: [],
    morph_tags: stateToChips(state),
    genotype_spec: stateToSpec(state),
  };
}

function TraitRow({ trait, value, onSelect, accentClass }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-slate-300 font-medium flex items-center gap-1.5">
        {trait.label}
        <ConfidenceBadge confidence={trait.confidence} />
      </Label>
      <Select value={value || 'none'} onValueChange={onSelect}>
        <SelectTrigger className={`bg-slate-800 ${accentClass} text-slate-100 h-9 text-xs`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="bg-slate-800 border-slate-600 text-slate-200">
          {zygosityOptions(trait).map((opt) => (
            <SelectItem key={opt.value} value={opt.value} className="text-xs">
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export default function ManualGenotypePicker({ value, onChange, accentClass = 'border-emerald-700' }) {
  const chips = useMemo(() => stateToChips(value || {}), [value]);

  const setState = (traitId, v) => {
    const next = { ...(value || {}) };
    if (!v || v === 'none') delete next[traitId];
    else next[traitId] = v;
    onChange?.(next);
  };

  const proven = SIMPLE_TRAITS.filter((t) => t.confidence === 'proven');
  const emerging = SIMPLE_TRAITS.filter((t) => t.confidence !== 'proven');

  const complexValue = value?.[COMPLEX_ID] || 'none';
  const complexOption = COMPLEX_OPTIONS_BY_VALUE[complexValue];
  const lethalSuper = value?.lilly_white === 'super';

  return (
    <div className="space-y-4">
      {/* Proven Mendelian genes */}
      <div className="space-y-2">
        <p className="text-[10px] uppercase tracking-widest text-slate-500">Proven genes</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {proven.map((trait) => (
            <TraitRow
              key={trait.id}
              trait={trait}
              value={value?.[trait.id]}
              onSelect={(v) => setState(trait.id, v)}
              accentClass={accentClass}
            />
          ))}
        </div>
      </div>

      {/* The Cappuccino complex: one locus, one allele-pair slot */}
      <div className="space-y-1">
        <p className="text-[10px] uppercase tracking-widest text-slate-500">
          Cappuccino complex (one gene, allelic)
        </p>
        <Label className="text-xs text-slate-300 font-medium flex items-center gap-1.5">
          {COMPLEX_ENTRY.label}
          <ConfidenceBadge confidence="proven" />
        </Label>
        <Select value={complexValue} onValueChange={(v) => setState(COMPLEX_ID, v)}>
          <SelectTrigger className={`bg-slate-800 ${accentClass} text-slate-100 h-9 text-xs`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-slate-800 border-slate-600 text-slate-200">
            {COMPLEX_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value} className="text-xs">
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-[11px] text-slate-500 leading-snug">
          Cappuccino and Sable are versions of the same gene, so one parent holds at most two
          complex alleles. Cappuccino x Sable makes Luwak and can never make a super.
        </p>
        {complexOption?.caution && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-700 bg-amber-950/40 px-3 py-2">
            <AlertTriangle className="w-4 h-4 text-amber-300 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-200 leading-snug">{complexOption.caution}</p>
          </div>
        )}
      </div>

      {/* Emerging genes */}
      <div className="space-y-2">
        <p className="text-[10px] uppercase tracking-widest text-slate-500">Emerging genes</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {emerging.map((trait) => (
            <TraitRow
              key={trait.id}
              trait={trait}
              value={value?.[trait.id]}
              onSelect={(v) => setState(trait.id, v)}
              accentClass={accentClass}
            />
          ))}
        </div>
      </div>

      {lethalSuper && (
        <div className="flex items-start gap-2 rounded-lg border border-red-700 bg-red-950/40 px-3 py-2">
          <AlertTriangle className="w-4 h-4 text-red-300 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-200 leading-snug">
            Super Lilly White is lethal in the egg, so this combination cannot exist in a living
            animal. The calculator still runs the math so you can see the predicted distribution,
            but expect lethal-egg warnings in the results.
          </p>
        </div>
      )}

      {chips.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          <span className="text-[11px] uppercase tracking-wider text-slate-500 mr-1 self-center">
            Genotype:
          </span>
          {chips.map((t) => (
            <span
              key={t}
              className="text-xs bg-slate-700/60 border border-slate-600 text-slate-200 px-1.5 py-0.5 rounded"
            >
              {t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
