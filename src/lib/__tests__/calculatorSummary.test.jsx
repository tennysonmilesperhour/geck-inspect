import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { afterAll, describe, expect, it, vi } from 'vitest';

// The UI kit reads window.self at import time.
vi.hoisted(() => vi.stubGlobal('window', { self: null, top: null }));
afterAll(() => vi.unstubAllGlobals());

import ManualGenotypePicker, { buildParentFromState } from '@/components/breeding/ManualGenotypePicker';
import CollectionParentPicker from '@/components/breeding/CollectionParentPicker';
import { summariseParents } from '@/lib/genetics/resultSummary';
import { parsePairing } from '@/lib/genetics/pairingParser';

const parents = (text) => {
  const { sire, dam } = parsePairing(text);
  return [buildParentFromState('s', 'Sire', sire), buildParentFromState('d', 'Dam', dam)];
};
const byLabel = (summary) => Object.fromEntries(summary.items.map((i) => [i.label, Math.round(i.probability * 1000) / 10]));

describe('result summary: the answer in one line, from the same engine', () => {
  it('Lilly White het Axanthic x Sable: each gene on half the eggs', () => {
    const summary = summariseParents(...parents('lilly white het axanthic x sable'));
    expect(byLabel(summary)).toMatchObject({ 'Lilly White': 50, 'Het Axanthic': 50, Sable: 50, 'Wild-type': 12.5 });
    // Wild-type is listed last, after the genes the breeder picked.
    expect(summary.items.at(-1).label).toBe('Wild-type');
  });

  it('Lilly White x Lilly White flags the lethal super and only the super', () => {
    const summary = summariseParents(...parents('lilly white x lilly white'));
    expect(byLabel(summary)).toMatchObject({ 'Lilly White': 50, 'Super Lilly White': 25, 'Wild-type': 25 });
    expect(summary.items.find((i) => i.label === 'Super Lilly White').lethal).toBe(true);
    expect(summary.items.find((i) => i.label === 'Lilly White').lethal).toBe(false);
    expect(summary.lethal).toHaveLength(1);
  });

  it('het Axanthic x het Axanthic gives a quarter visual Axanthic', () => {
    const summary = summariseParents(...parents('het axanthic x het axanthic'));
    expect(byLabel(summary)).toMatchObject({ 'Visual Axanthic': 25, 'Het Axanthic': 50, 'Wild-type': 25 });
  });

  it('returns nothing when neither parent has a gene', () => {
    expect(summariseParents(buildParentFromState('s', 'S', {}), buildParentFromState('d', 'D', {}))).toBeNull();
    expect(summariseParents(null, null)).toBeNull();
  });
});

describe('every gene select has a name', () => {
  it('names each trigger by parent, gene and current value', () => {
    const html = renderToStaticMarkup(
      <ManualGenotypePicker value={{ lilly_white: 'het' }} onChange={() => {}} parentLabel="Sire" />,
    );
    const triggers = [...html.matchAll(/<button[^>]*role="combobox"[^>]*>/g)].map((m) => m[0]);
    expect(triggers.length).toBeGreaterThanOrEqual(9);
    for (const tag of triggers) {
      const labelledby = tag.match(/aria-labelledby="([^"]+)"/)?.[1];
      expect(labelledby, tag).toBeTruthy();
      const ids = labelledby.split(/\s+/);
      expect(ids).toHaveLength(3);
      for (const id of ids) expect(html).toContain(`id="${id}"`);
    }
    // The parent part of the name is real text.
    expect(html).toMatch(/<span id="[^"]+-parent" class="sr-only">Sire<\/span>/);
  });
});

describe('calculator page: the answer sits under Fill parents', () => {
  // A full render of the page needs a browser (the r3/ux Playwright check
  // measured where the summary lands on a phone). This guards the order in
  // the source so it does not drift back below the pickers.
  const page = readFileSync(new URL('../../pages/GeneticCalculatorTool.jsx', import.meta.url), 'utf8');
  it('renders the summary after the pairing box and before the gene pickers', () => {
    const form = page.indexOf('Fill parents');
    const summary = page.indexOf('<CalculatorResultSummary');
    const picker = page.indexOf('<ManualGenotypePicker');
    const results = page.indexOf('id="calculator-results"');
    expect(form).toBeGreaterThan(-1);
    expect(summary).toBeGreaterThan(form);
    expect(picker).toBeGreaterThan(summary);
    expect(results).toBeGreaterThan(picker);
    expect(page).toMatch(/<CalculatorResultSummary[\s\S]*?className="sticky/);
  });
  it('names both parents on the gene pickers and the collection selects', () => {
    expect(page).toContain('parentLabel="Sire"');
    expect(page).toContain('parentLabel="Dam"');
    // The "From my collection" selects live in CollectionParentPicker.jsx,
    // which loads with the calculator's engine.
    const html = renderToStaticMarkup(
      <CollectionParentPicker
        sireId=""
        damId=""
        onSireChange={() => {}}
        onDamChange={() => {}}
        sireOptions={[]}
        damOptions={[]}
        sire={null}
        dam={null}
        onSwap={() => {}}
      />,
    );
    for (const parent of ['sire', 'dam']) {
      expect(html).toContain(`aria-labelledby="calc-${parent}-label calc-${parent}-pick"`);
      expect(html).toContain(`id="calc-${parent}-label"`);
      expect(html).toContain(`id="calc-${parent}-pick"`);
    }
  });
});
