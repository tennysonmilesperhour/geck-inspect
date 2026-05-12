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

/**
 * Curated set of Mendelian crested gecko traits available in the
 * unauthenticated / manual-entry calculator. The list is intentionally
 * shorter than the full TRAITS export from `crested-gecko-app` , 
 * polygenic morphs (Harlequin, Pinstripe intensity, base color
 * gradients) don't follow Punnett squares, and the allelic complex at
 * SABLE_COMPLEX is presented as a single picker since selecting two
 * different alleles at the same locus on one parent isn't expressible
 * here.
 *
 * Each entry encodes the canonical tag strings the upstream
 * `tagToGenotype` library recognizes ,  so changing labels here is safe
 * but changing `tags.*` strings will silently break genotype mapping.
 */
export const PICKER_TRAITS = [
  {
    id: 'lilly_white',
    slug: 'lilly-white',
    label: 'Lilly White',
    dominance: 'incomplete_dominant',
    tags: { het: 'Lilly White', super: 'Super Lilly White' },
    super_lethal: true,
    blurb: 'Incomplete dominant. Heterozygous "Lilly White" expresses; the homozygous Super form is lethal in the egg.',
  },
  {
    id: 'cappuccino',
    slug: 'cappuccino',
    label: 'Cappuccino',
    dominance: 'incomplete_dominant',
    tags: { het: 'Cappuccino', super: 'Super Cappuccino' },
    super_warning: 'Super Cappuccino (Melanistic) has documented severe health concerns.',
    blurb: 'Incomplete dominant. The homozygous Super Cappuccino, also called Melanistic, has documented health concerns.',
  },
  {
    id: 'whiteout',
    slug: 'whiteout',
    label: 'Whiteout',
    dominance: 'incomplete_dominant',
    tags: { het: 'Whiteout', super: 'Super Whiteout' },
    blurb: 'Incomplete dominant. Het Whiteout adds a clean white belly; Super Whiteout expresses on a much larger scale.',
  },
  {
    id: 'empty_back',
    slug: 'empty-back',
    label: 'Empty Back',
    dominance: 'incomplete_dominant',
    tags: { het: 'Empty Back', super: 'Super Empty Back' },
    blurb: 'Incomplete dominant. Reduces dorsal pattern; Super form removes nearly all dorsal markings.',
  },
  {
    id: 'softscale',
    slug: 'soft-scale',
    label: 'Soft Scale',
    dominance: 'incomplete_dominant',
    tags: { het: 'Softscale', super: 'Super Softscale' },
    blurb: 'Incomplete dominant. Affects scale texture; Super Softscale is the maximum expression and is healthy.',
  },
  {
    id: 'axanthic',
    slug: 'axanthic',
    label: 'Axanthic',
    dominance: 'recessive',
    tags: { het: 'Het Axanthic', visual: 'Axanthic' },
    blurb: 'Recessive. Het carriers look wild-type; only the homozygous visual lacks red and yellow pigments.',
  },
  {
    id: 'phantom',
    slug: 'phantom',
    label: 'Phantom',
    dominance: 'recessive',
    tags: { het: 'Het Phantom', visual: 'Visual Phantom' },
    blurb: 'Recessive. Visual Phantom lacks white pattern; Het Phantom is invisible to the eye but doubles offspring odds.',
  },
  {
    id: 'hypo',
    slug: 'hypo',
    label: 'Hypo',
    dominance: 'dominant',
    tags: { visual: 'Hypo' },
    blurb: 'Dominant. A single copy expresses; reduces melanin and combines with base colors.',
  },
];

export const PICKER_TRAITS_BY_SLUG = Object.fromEntries(
  PICKER_TRAITS.map((t) => [t.slug, t]),
);

/**
 * Translate a per-trait zygosity record like
 *   { lilly_white: 'het', axanthic: 'visual' }
 * into the canonical morph_tags array the GeneticCalculator + the
 * upstream tagToGenotype library accept.
 */
export function zygosityToTags(zygosity) {
  const tags = [];
  for (const trait of PICKER_TRAITS) {
    const z = zygosity?.[trait.id];
    if (!z || z === 'none') continue;
    const tag = trait.tags[z];
    if (tag) tags.push(tag);
  }
  return tags;
}

/**
 * Build a Gecko-shaped object the existing GeneticCalculator + Breeding
 * Simulator components can consume. We pass through `morph_tags` (not
 * a prebuilt genotype) so the same code path runs whether the parents
 * came from the user's collection or from this picker.
 */
export function buildAnimalFromZygosity(id, name, zygosity) {
  return {
    id,
    name,
    sex: 'Unsexed',
    image_urls: [],
    morph_tags: zygosityToTags(zygosity),
  };
}

function zygosityOptions(trait) {
  const opts = [{ value: 'none', label: 'No (wild-type)' }];
  if (trait.dominance === 'recessive') {
    opts.push({ value: 'het', label: 'Het carrier (1 copy, no visual)' });
    opts.push({ value: 'visual', label: 'Visual (homozygous)' });
  } else if (trait.dominance === 'incomplete_dominant') {
    opts.push({ value: 'het', label: 'Visual (heterozygous, 1 copy)' });
    opts.push({
      value: 'super',
      label: trait.super_lethal
        ? 'Super (homozygous) ,  lethal in the egg'
        : 'Super (homozygous)',
    });
  } else {
    // dominant, no super form modeled
    opts.push({ value: 'visual', label: 'Expressing (1+ copies)' });
  }
  return opts;
}

/**
 * Stateless picker ,  the parent owns the zygosity record and renders
 * the resulting summary tags. We only emit `onChange(newZygosity)`.
 */
export default function ManualGenotypePicker({ value, onChange, accentClass = 'border-emerald-700' }) {
  const tags = useMemo(() => zygosityToTags(value || {}), [value]);
  const lethalSuper = useMemo(
    () =>
      PICKER_TRAITS.some(
        (t) => t.super_lethal && value?.[t.id] === 'super',
      ),
    [value],
  );

  const setZyg = (traitId, z) => {
    const next = { ...(value || {}) };
    if (z === 'none') delete next[traitId];
    else next[traitId] = z;
    onChange?.(next);
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {PICKER_TRAITS.map((trait) => (
          <div key={trait.id} className="space-y-1">
            <Label className="text-xs text-slate-300 font-medium">
              {trait.label}
            </Label>
            <Select
              value={value?.[trait.id] || 'none'}
              onValueChange={(v) => setZyg(trait.id, v)}
            >
              <SelectTrigger
                className={`bg-slate-800 ${accentClass} text-slate-100 h-9 text-xs`}
              >
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
        ))}
      </div>

      {lethalSuper && (
        <div className="flex items-start gap-2 rounded-lg border border-red-700 bg-red-950/40 px-3 py-2">
          <AlertTriangle className="w-4 h-4 text-red-300 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-200 leading-snug">
            Super Lilly White is lethal in the egg ,  this combination cannot
            exist in a living animal. The calculator still runs the math so
            you can see the predicted distribution, but expect lethal-egg
            warnings in the results.
          </p>
        </div>
      )}

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          <span className="text-[11px] uppercase tracking-wider text-slate-500 mr-1 self-center">
            Genotype:
          </span>
          {tags.map((t) => (
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
