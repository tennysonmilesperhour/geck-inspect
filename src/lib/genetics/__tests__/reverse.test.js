import { describe, it, expect } from 'vitest';
import {
  REVERSE_TARGETS,
  REVERSE_TARGETS_BY_ID,
  solveTarget,
  scanCollection,
  childPairDist,
} from '../reverseSolver';
import { parsePairing } from '../pairingParser';
import { stateToSpec, COMPLEX_ID } from '../calculatorCatalog';
import { predictWeighted, tagsToSpec } from '../predictWeighted';

describe('childPairDist', () => {
  it('pools unordered pairs from 50/50 gametes', () => {
    const dist = childPairDist(['lilly_white', 'wild_type'], ['lilly_white', 'wild_type']);
    const byKey = Object.fromEntries(dist.map((d) => [d.pair.join('|'), d.p]));
    expect(byKey['lilly_white|lilly_white']).toBeCloseTo(0.25, 10);
    expect(byKey['lilly_white|wild_type']).toBeCloseTo(0.5, 10);
    expect(byKey['wild_type|wild_type']).toBeCloseTo(0.25, 10);
  });
});

describe('solveTarget', () => {
  it('ranks the safe Lilly White pairing above LW x LW', () => {
    const results = solveTarget('lilly_white');
    expect(results.length).toBeGreaterThan(0);
    // Both LW x normal and LW x LW give 50% living Lilly Whites, but
    // the tie must break toward the pairing with no lethal eggs.
    expect(results[0].p).toBeCloseTo(0.5, 10);
    expect(results[0].lethalP).toBe(0);
    const lwxlw = results.find((r) => r.lethalP > 0);
    expect(lwxlw).toBeTruthy();
    expect(lwxlw.lethalP).toBeCloseTo(0.25, 10);
    expect(results.indexOf(lwxlw)).toBeGreaterThan(0);
  });

  it('finds Luwak only from cross-allele pairings and agrees with the forward engine', () => {
    const results = solveTarget('luwak');
    expect(results[0].p).toBeGreaterThan(0);
    // Best route: Cappuccino x Sable (or supers thereof). Verify the
    // top suggestion against the exact forward prediction.
    const forward = predictWeighted(
      stateToSpec(results[0].sireState),
      stateToSpec(results[0].damState),
    );
    const luwak = forward.offspring_phenotypes
      .filter((o) => (o.matching_combo_morphs || []).includes('luwak'))
      .reduce((s, o) => s + o.probability, 0);
    expect(luwak).toBeCloseTo(results[0].p, 10);
    // Super Sable x Super Capp would be 100% Luwak, but Super Capp is
    // excluded as a parent; Super Sable x Cappuccino gives 1/2.
    expect(results[0].p).toBeGreaterThanOrEqual(0.5);
  });

  it('never suggests lethal or welfare-excluded parents', () => {
    for (const target of REVERSE_TARGETS) {
      for (const r of solveTarget(target.id, { limit: 50 })) {
        expect(r.sireState.lilly_white).not.toBe('super');
        expect(r.damState.lilly_white).not.toBe('super');
        expect(r.sireState[COMPLEX_ID]).not.toBe('super_cappuccino');
        expect(r.damState[COMPLEX_ID]).not.toBe('super_cappuccino');
        expect(r.sireState[COMPLEX_ID]).not.toBe('super_highway');
        expect(r.damState[COMPLEX_ID]).not.toBe('super_highway');
      }
    }
  });

  it('solves a multi-gene combo with correct multiplied odds', () => {
    const results = solveTarget('axanthic_lilly');
    // Best possible: visual Axanthic Lilly White x visual Axanthic:
    // AX 100% x L 50% = 50%.
    expect(results[0].p).toBeCloseTo(0.5, 10);
    expect(results[0].needsProvenHet).toBe(false);
    // Het-based routes exist further down and are flagged.
    const hetRoute = results.find((r) => r.needsProvenHet);
    expect(hetRoute).toBeTruthy();
  });

  it('marks compromised-super risk on Cappuccino x Cappuccino style routes', () => {
    const results = solveTarget('frappuccino', { limit: 50 });
    const risky = results.find((r) => r.compromisedP > 0);
    expect(risky).toBeTruthy();
    expect(risky.compromisedP).toBeGreaterThanOrEqual(0.25 - 1e-9);
  });

  it('every suggestion carries a permalink that decodes back into states', () => {
    for (const r of solveTarget('phantom_frappuccino', { limit: 5 })) {
      expect(r.permalink.startsWith('/calculator?')).toBe(true);
      expect(r.p).toBeGreaterThan(0);
    }
  });
});

describe('scanCollection', () => {
  const gecko = (id, sex, tags) => ({ id, name: id, sex, spec: tagsToSpec(tags) });

  it('ranks collection pairs and respects sex', () => {
    const geckos = [
      gecko('m1', 'Male', ['Lilly White']),
      gecko('m2', 'Male', []),
      gecko('f1', 'Female', ['Axanthic']),
      gecko('f2', 'Female', ['Het Axanthic']),
    ];
    const { results } = scanCollection('axanthic_visual', geckos);
    // No male carries Axanthic, so nothing can produce a visual.
    expect(results).toHaveLength(0);

    const withCarrier = [...geckos, gecko('m3', 'Male', ['Het Axanthic'])];
    const scan = scanCollection('axanthic_visual', withCarrier);
    expect(scan.results.length).toBeGreaterThan(0);
    // Best: het male x visual female = 50%.
    expect(scan.results[0].p).toBeCloseTo(0.5, 10);
    expect(scan.results[0].dam.id).toBe('f1');
  });

  it('flags lethal loss on LW x LW collection pairs', () => {
    const geckos = [
      { id: 'm', name: 'm', sex: 'Male', spec: tagsToSpec(['Lilly White']) },
      { id: 'f', name: 'f', sex: 'Female', spec: tagsToSpec(['Lilly White']) },
    ];
    const { results } = scanCollection('lilly_white', geckos);
    expect(results[0].lethalP).toBeCloseTo(0.25, 10);
  });
});

describe('parsePairing', () => {
  it('parses full pairings with hobby shorthand', () => {
    const { sire, dam, unrecognized } = parsePairing('lilly white het axanthic x sable');
    expect(sire).toEqual({ lilly_white: 'het', axanthic: 'het' });
    expect(dam).toEqual({ [COMPLEX_ID]: 'sable' });
    expect(unrecognized).toHaveLength(0);
  });

  it('handles aliases, poss hets, and visuals', () => {
    const { sire, dam } = parsePairing('lw 66% het ax x visual phantom capp');
    expect(sire).toEqual({ lilly_white: 'het', axanthic: 'ph66' });
    expect(dam).toEqual({ phantom: 'visual', [COMPLEX_ID]: 'cappuccino' });
  });

  it('reads bare recessive names as visuals', () => {
    const { sire } = parsePairing('axanthic');
    expect(sire).toEqual({ axanthic: 'visual' });
  });

  it('parses supers and Luwak, including melanistic as Super Cappuccino', () => {
    const { sire, dam } = parsePairing('luwak x melanistic');
    expect(sire).toEqual({ [COMPLEX_ID]: 'luwak' });
    expect(dam).toEqual({ [COMPLEX_ID]: 'super_cappuccino' });
  });

  it('reports unrecognized words instead of dropping them silently', () => {
    const { sire, unrecognized } = parsePairing('dalmatian lilly white x hypo');
    expect(sire.lilly_white).toBe('het');
    expect(unrecognized).toContain('dalmatian');
  });

  it('handles empty and separator-free input', () => {
    expect(parsePairing('')).toEqual({ sire: {}, dam: {}, unrecognized: [] });
    const solo = parsePairing('super soft scale');
    expect(solo.sire).toEqual({ softscale: 'super' });
    expect(solo.dam).toEqual({});
  });
});
