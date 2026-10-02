import { describe, it, expect } from 'vitest';
import { MORPH_CATEGORIES } from '@/components/my-geckos/morphTagCatalog';
import { translateMorphTags, parseTag, POSSIBLE_HET_CHANCE } from '../tagTranslation';
import { predictWeighted, tagsToSpec } from '../predictWeighted';
import { scanCollection } from '../reverseSolver';
import { predictGeckoPair, pairingEggValue } from '@/lib/pairingValue';
import { waitlistOutcomes } from '@/lib/pairingWaitlist';
import { formatHetTag } from '@/lib/hetUtils';
import { outcomeTraits } from '@/lib/genetics';

const PICKER_TAGS = Object.values(MORPH_CATEGORIES).flatMap((c) => c.morphs);
const NORMAL = { loci: {} };

const locusSum = (prediction, locus, label) =>
  (prediction.locus_predictions.find((l) => l.locus === locus)?.outcomes || [])
    .filter((o) => o.phenotype_label === label)
    .reduce((s, o) => s + o.probability, 0);

describe('every tag in the picker', () => {
  it.each(PICKER_TAGS)('"%s" produces a genotype or a visible warning', (tag) => {
    const { spec, used, notUsed } = translateMorphTags([tag]);
    const loci = Object.keys(spec.loci);
    if (used.length > 0) {
      expect(notUsed).toHaveLength(0);
      expect(loci.length).toBeGreaterThan(0);
      // The engine must actually compute it: some non-wild outcome
      // appears when paired with a normal.
      const prediction = predictWeighted(spec, NORMAL);
      const anyTrait = prediction.locus_predictions.some((lp) =>
        lp.outcomes.some((o) => o.phenotype_label !== 'Wild-type' && o.probability > 0));
      expect(anyTrait).toBe(true);
    } else {
      expect(loci).toHaveLength(0);
      expect(notUsed).toHaveLength(1);
      expect(notUsed[0].reason.length).toBeGreaterThan(10);
      // No em or en dashes in anything shown to members.
      expect(notUsed[0].reason).not.toMatch(/[\u2013\u2014]/);
    }
  });

  it('includes Het Phantom (D13)', () => {
    expect(PICKER_TAGS).toContain('Het Phantom');
  });
});

describe('translateMorphTags: the tags step 24 found ignored', () => {
  it('reads Soft Scale spellings as the engine Softscale', () => {
    expect(tagsToSpec(['Soft Scale']).loci.SS).toEqual([{ pair: ['softscale', 'wild_type'], weight: 1 }]);
    expect(tagsToSpec(['Super Soft Scale']).loci.SS).toEqual([{ pair: ['softscale', 'softscale'], weight: 1 }]);
    expect(tagsToSpec(['Het Soft Scale']).loci.SS).toEqual([{ pair: ['softscale', 'wild_type'], weight: 1 }]);
  });

  it('reads White Wall as Whiteout (D13)', () => {
    expect(tagsToSpec(['White Wall']).loci.WO).toEqual([{ pair: ['whiteout', 'wild_type'], weight: 1 }]);
    expect(tagsToSpec(['Whiteout']).loci.WO).toEqual([{ pair: ['whiteout', 'wild_type'], weight: 1 }]);
  });

  it('reads a bare Phantom as a visual Phantom and Het Phantom as one copy (D13)', () => {
    expect(tagsToSpec(['Phantom']).loci.PH).toEqual([{ pair: ['phantom', 'phantom'], weight: 1 }]);
    expect(tagsToSpec(['Het Phantom']).loci.PH).toEqual([{ pair: ['phantom', 'wild_type'], weight: 1 }]);
  });

  it('never treats a Possible Het as a confirmed het', () => {
    for (const tag of PICKER_TAGS.filter((t) => t.startsWith('Possible Het'))) {
      const { spec, used, notUsed } = translateMorphTags([tag]);
      if (notUsed.length) continue;
      expect(used).toHaveLength(1);
      const [options] = Object.values(spec.loci);
      expect(options).toHaveLength(2);
      const carrier = options.find((o) => o.pair.includes('wild_type') && o.pair.some((a) => a !== 'wild_type'));
      expect(carrier.weight).toBe(POSSIBLE_HET_CHANCE);
      expect(carrier.weight).toBeLessThan(1);
    }
  });

  it('uses a number in the tag as the carrier chance', () => {
    const options = tagsToSpec(['66% Het Axanthic']).loci.AX;
    expect(options[0]).toEqual({ pair: ['axanthic', 'wild_type'], weight: 0.66 });
    expect(options[1].weight).toBeCloseTo(0.34, 10);
    expect(tagsToSpec(['100% Het Axanthic']).loci.AX).toEqual([{ pair: ['axanthic', 'wild_type'], weight: 1 }]);
    // On a plain tag a percentage is coverage, not odds.
    expect(tagsToSpec(['100% Pinstripe']).loci.PIN).toEqual([{ pair: ['pinstripe', 'wild_type'], weight: 1 }]);
  });

  it('possible het x visual gives the marginal per-egg odds', () => {
    // 50% poss het Axanthic x visual Axanthic: 0.5 x 0.5 = 25% visual.
    const prediction = predictWeighted(tagsToSpec(['Possible Het Axanthic']), tagsToSpec(['Axanthic']));
    expect(locusSum(prediction, 'AX', 'Visual Axanthic')).toBeCloseTo(0.25, 10);
    expect(prediction.uncertain).toBe(true);
  });

  it('lists Tiger, Moonglow and descriptors as not used, with a reason', () => {
    const { notUsed, spec } = translateMorphTags(['Tiger', 'Moonglow', 'Het Moonglow', 'Fired Up', 'Lilly White']);
    expect(notUsed.map((t) => t.tag)).toEqual(['Tiger', 'Moonglow', 'Het Moonglow', 'Fired Up']);
    expect(Object.keys(spec.loci)).toEqual(['L']);
  });

  it('keeps both alleles of a Cappuccino + Sable compound', () => {
    expect(tagsToSpec(['Luwak']).loci.SABLE_COMPLEX).toEqual([{ pair: ['cappuccino', 'sable'], weight: 1 }]);
    expect(tagsToSpec(['Cappuccino', 'Sable']).loci.SABLE_COMPLEX).toEqual([{ pair: ['cappuccino', 'sable'], weight: 1 }]);
  });

  it('reads combo names as their genes', () => {
    const spec = tagsToSpec(['Frappuccino']);
    expect(spec.loci.SABLE_COMPLEX[0].pair).toEqual(['cappuccino', 'wild_type']);
    expect(spec.loci.L[0].pair).toEqual(['lilly_white', 'wild_type']);
  });

  it('lets a definite tag win over a possible het at the same gene', () => {
    expect(tagsToSpec(['Possible Het Axanthic', 'Axanthic']).loci.AX).toEqual([{ pair: ['axanthic', 'axanthic'], weight: 1 }]);
    expect(tagsToSpec(['Het Axanthic', 'Possible Het Axanthic']).loci.AX).toEqual([{ pair: ['axanthic', 'wild_type'], weight: 1 }]);
  });

  it('parses prefixes and percentages', () => {
    expect(parseTag('pos het Phantom')).toEqual({ kind: 'possible', chance: 0.5, body: 'phantom' });
    expect(parseTag('Axanthic het')).toEqual({ kind: 'het', chance: 1, body: 'axanthic' });
    expect(parseTag('50% possible het Axanthic')).toEqual({ kind: 'possible', chance: 0.5, body: 'axanthic' });
  });
});

describe('every consumer reads tags the same way', () => {
  const softScale = { id: 's', morph_tags: ['Soft Scale'] };
  const normal = { id: 'n', morph_tags: [] };

  it('pairing value and the Pairing Planner see Soft Scale', () => {
    const prediction = predictGeckoPair(softScale, normal);
    expect(prediction.offspring_phenotypes.map(outcomeTraits).join(' ')).toMatch(/Softscale|Soft Scale/);
    const value = pairingEggValue(softScale, normal, null);
    expect(value.outcomes.length).toBeGreaterThan(1);
  });

  it('waitlist odds see White Wall', () => {
    const outcomes = waitlistOutcomes({ morph_tags: ['White Wall'] }, normal);
    expect(outcomes.some((o) => /Whiteout/.test(o.label))).toBe(true);
    expect(outcomes.find((o) => /Whiteout/.test(o.label)).probability).toBeCloseTo(0.5, 3);
  });

  it('pairing value counts a possible het lethal risk only partly', () => {
    const value = pairingEggValue({ morph_tags: ['Possible Het Lilly White'] }, { morph_tags: ['Lilly White'] }, null);
    // 0.5 chance the sire carries it x 0.25 lethal = 12.5%.
    expect(value.lethalShare).toBeCloseTo(0.125, 10);
  });

  it('the reverse calculator averages over a possible het', () => {
    const geckos = [
      { id: 'a', name: 'a', sex: 'Male', spec: tagsToSpec(['Possible Het Axanthic']) },
      { id: 'b', name: 'b', sex: 'Female', spec: tagsToSpec(['Axanthic']) },
    ];
    const { results } = scanCollection('axanthic_visual', geckos);
    expect(results[0].p).toBeCloseTo(0.25, 10);
  });

  it('profile badges show the same possible het chance the odds use', () => {
    expect(formatHetTag('Possible Het Axanthic')).toBe('Possible Het Axanthic (50%)');
    expect(formatHetTag('66% Het Axanthic')).toBe('66% Het Axanthic');
  });
});
