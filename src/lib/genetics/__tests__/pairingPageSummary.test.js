import { describe, it, expect } from 'vitest';
import { PAIRING_PAGES, PAIRING_PAGES_BY_SLUG, stateToSpec } from '../calculatorCatalog';
import { predictWeighted } from '../predictWeighted';
import { allPairingPageSummaries, pairingMetaDescription, pairingPageSummary, POLYGENIC_NOTE } from '../pairingPageSummary';

const summary = (slug) => pairingPageSummary(PAIRING_PAGES_BY_SLUG[slug]);
const outcome = (s, name) => s.outcomes.find((o) => o.label.startsWith(name));

describe('calculator pairing page summary (server HTML)', () => {
  it('has a summary for every pairing page, with odds that add up to one', () => {
    const all = allPairingPageSummaries();
    expect(Object.keys(all)).toEqual(PAIRING_PAGES.map((p) => p.slug));
    for (const s of Object.values(all)) {
      const total = s.outcomes.reduce((sum, o) => sum + o.probability, 0);
      expect(total, s.slug).toBeCloseTo(1, 6);
    }
  });

  it('matches the live calculator engine for every page', () => {
    for (const page of PAIRING_PAGES) {
      const engine = predictWeighted(stateToSpec(page.sire), stateToSpec(page.dam));
      const s = pairingPageSummary(page);
      const engineTotal = (engine.offspring_phenotypes || []).length;
      expect(s.outcomes.length, page.slug).toBeLessThanOrEqual(engineTotal);
      expect(s.warnings.length, page.slug).toBe((engine.warnings || []).length);
    }
  });

  it('shows the lethal Super Lilly White and the critical warning for Lilly White x Lilly White', () => {
    const s = summary('lilly-white-x-lilly-white');
    expect(outcome(s, 'Lilly White').percent).toBe('50%');
    expect(outcome(s, 'Super Lilly White')).toMatchObject({ percent: '25%', fraction: '1/4', healthRisk: 'lethal' });
    expect(s.nonViable).toBeCloseTo(0.25, 6);
    expect(s.warnings.some((w) => w.severity === 'critical' && /lethal/i.test(w.message))).toBe(true);
  });

  it('keeps Lilly White x Normal free of warnings and losses', () => {
    const s = summary('lilly-white-x-normal');
    expect(s.warnings).toEqual([]);
    expect(s.nonViable).toBe(0);
    expect(s.dam).toMatch(/^Normal/);
  });

  it('names Luwak in Cappuccino x Sable and flags the super in Cappuccino x Cappuccino', () => {
    expect(outcome(summary('cappuccino-x-sable'), 'Luwak').percent).toBe('25%');
    const capp = summary('cappuccino-x-cappuccino');
    expect(outcome(capp, 'Super Cappuccino').healthRisk).toBe('severe');
    expect(capp.warnings.some((w) => w.severity === 'critical')).toBe(true);
  });

  it('gives recessive odds for Het Axanthic x Het Axanthic', () => {
    const s = summary('het-axanthic-x-het-axanthic');
    expect(outcome(s, 'Visual Axanthic').percent).toBe('25%');
    expect(outcome(s, 'Het Axanthic').percent).toBe('50%');
  });

  it('says which gene a single-gene combo stands for', () => {
    expect(summary('phantom-x-phantom').outcomes[0].label).toBe('Patternless (Visual Phantom)');
  });

  it('never gives a polygenic look a percentage', () => {
    for (const s of Object.values(allPairingPageSummaries())) {
      for (const o of s.outcomes) {
        expect(o.label, s.slug).not.toMatch(/Harlequin|Pinstripe|Dalmatian|Flame|Tiger|Red base|Yellow base/i);
      }
      expect(s.polygenicNote).toBe(POLYGENIC_NOTE);
    }
    expect(POLYGENIC_NOTE).toMatch(/never given a percentage/);
    expect(POLYGENIC_NOTE).toMatch(/likely/);
    expect(POLYGENIC_NOTE).toMatch(/possible/);
  });

  it('writes a snippet with the real odds that fits in a search result', () => {
    for (const s of Object.values(allPairingPageSummaries())) {
      const text = pairingMetaDescription(s);
      expect(text.length, s.slug).toBeLessThanOrEqual(158);
      expect(text.length, s.slug).toBeGreaterThanOrEqual(110);
      expect(text, s.slug).toContain(s.outcomes[0].percent);
      expect(text, s.slug).not.toMatch(/[\u2013\u2014]|--/);
    }
    expect(pairingMetaDescription(summary('lilly-white-x-lilly-white'))).toContain('25% Super Lilly White (dies in the egg)');
    expect(pairingMetaDescription(summary('axanthic-x-axanthic'))).not.toMatch(/can differ/);
  });

  it('keeps the most likely outcome even when nothing else fits', () => {
    const long = {
      label: 'A very long pairing name that takes up most of the snippet on its own x Another long name',
      warnings: [],
      outcomes: [
        { percent: '50%', short: 'An outcome with a very long descriptive name for testing', probability: 0.5, healthRisk: null },
        { percent: '50%', short: 'Another outcome with a long name', probability: 0.5, healthRisk: null },
      ],
    };
    const text = pairingMetaDescription(long);
    expect(text).toContain('50% An outcome with a very long descriptive name for testing');
    expect(text).not.toContain('Another outcome');
  });
});
