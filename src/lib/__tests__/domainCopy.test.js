import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

vi.mock('@/entities/all', () => ({
  Gecko: {}, WeightRecord: {}, Egg: {}, BreedingPlan: {}, FeedingGroup: {},
  ShedRecord: { filter: async () => [] },
}));
vi.mock('@/lib/husbandryLog', () => ({ logFeedings: vi.fn(), undoFeedings: vi.fn() }));

import { ACTIONS, shedRhythmShort } from '../assistantActions';
import { LIFE_STAGES } from '@/data/husbandry-facts';
import { MORPHS } from '@/data/morph-guide';
import { FEEDING_GUIDE } from '@/data/keepers-guides/feeding';
import { SETUP_GUIDE } from '@/data/keepers-guides/setup';
import { HANDBOOK_GUIDE } from '@/data/keepers-guides/handbook';
import { MORPH_GUIDE } from '@/data/keepers-guides/morph';
import { BREEDING_GUIDE } from '@/data/keepers-guides/breeding';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '../../..');
const read = (rel) => readFileSync(resolve(ROOT, rel), 'utf8');

function* strings(value) {
  if (typeof value === 'string') yield value;
  else if (Array.isArray(value)) for (const item of value) yield* strings(item);
  else if (value && typeof value === 'object') for (const item of Object.values(value)) yield* strings(item);
}

describe('the assistant shed reply', () => {
  it('gives the shed rhythm from the life stages, not "every 2 to 4 weeks"', () => {
    const growing = LIFE_STAGES.filter((s) => s.maxGrams !== null);
    const adult = LIFE_STAGES.find((s) => s.maxGrams === null);
    expect(shedRhythmShort()).toBe(
      `about every ${growing[0].shedWeeks[0]} to ${growing[growing.length - 1].shedWeeks[1]} weeks while growing and every ${adult.shedWeeks[0]} to ${adult.shedWeeks[1]} weeks as adults`,
    );
    expect(shedRhythmShort()).toBe('about every 1 to 4 weeks while growing and every 4 to 6 weeks as adults');
  });

  it('says it when a gecko has no shed logged', async () => {
    const { message } = await ACTIONS.list_due.execute({ what: 'sheds' }, { geckos: [{ id: 'g1', name: 'Mango' }] });
    expect(message).toContain('Mango');
    expect(message).toContain(`Cresties shed ${shedRhythmShort()}, so a long gap usually just means it was not logged.`);
    expect(message).not.toMatch(/2 to 4 weeks/);
  });
});

describe('morph page list in llms.txt', () => {
  it('promises a typical price only where index data supports it', () => {
    const phrase = 'lookalikes and, where index data supports it, a typical price';
    expect(read('scripts/build-llms-full.mjs')).toContain(phrase);
    expect(read('public/llms.txt')).toContain(phrase);
    expect(read('public/llms.txt')).not.toMatch(/genetics, typical price, lookalikes/);
    expect(read('public/llms.txt')).toContain(`Each of the ${MORPHS.length} crested gecko morphs`);
  });
});

describe("Keeper's Guides", () => {
  const guides = { FEEDING_GUIDE, SETUP_GUIDE, HANDBOOK_GUIDE, MORPH_GUIDE, BREEDING_GUIDE };

  it('use no spaced hyphen as a dash (comma, colon or full stop instead)', () => {
    const found = [];
    for (const [name, guide] of Object.entries(guides)) {
      for (const text of strings(guide)) if (/\s-\s|^- |\s-$/.test(text)) found.push(`${name}: ${text}`);
    }
    expect(found).toEqual([]);
  });

  it('keep the two clause breaks the review named fixed', () => {
    const all = [...strings(guides)].join('\n');
    expect(all).toContain('Adults shed every 4-6 weeks, which is easy to miss if colors are dark.');
    expect(all).toContain('Check her calcium sacs (back of mouth): if they are pale or shrunken, rest her from breeding.');
  });
});

describe('the genetics and facts check', () => {
  it('reads the search and pairing text built from the genetics facts', () => {
    const script = read('scripts/check-genetics-consistency.mjs');
    const guideFiles = script.match(/const GUIDE_FILES = \[([\s\S]*?)\];/)[1];
    const factFiles = script.match(/const FACT_FILES = \[([\s\S]*?)\];/)[1];
    for (const file of ['src/lib/geneticsGuideSeo.js', 'src/data/morph-seo-descriptions.js', 'src/lib/genetics/pairingPageSummary.js']) {
      expect(guideFiles, file).toContain(`'${file}'`);
      expect(factFiles, file).toContain(`'${file}'`);
    }
  });
});

describe('Morph Guide privacy', () => {
  it('names no private breeder or home town (Albino entry, 16 Oct 2026 review)', () => {
    // This test names no one, since the repo is public. It checks that the
    // business is credited with no person or place in brackets after it and
    // no home state. The next test catches any "(Firstname Lastname," mention.
    const albino = MORPHS.find((m) => m.slug === 'albino');
    const albinoText = JSON.stringify(albino);
    expect(albinoText).not.toMatch(/Eureka Exotics \(/);
    expect(albinoText).not.toMatch(/Florida/);
    expect(albino.description).toContain('Eureka Exotics announced');
  });

  it('names only public founders of breeding businesses as people', () => {
    // "Firstname Lastname (" or "(Firstname Lastname" style mentions of a
    // person: each must be a founder the hobby credits in public.
    const people = new Set();
    for (const text of strings(MORPHS)) {
      for (const m of text.matchAll(/\(([A-Z][a-z]+ [A-Z][a-z]+)[,)]/g)) people.add(m[1]);
      for (const m of text.matchAll(/\bby ([A-Z][a-z]+ [A-Z][a-z]+) at\b/g)) people.add(m[1]);
    }
    const PUBLIC_FOUNDERS = ['Anthony Caponetto', 'Nick Lumb'];
    const NOT_PEOPLE = ['Foundation Genetics', 'Lilly Exotics', 'Eureka Exotics', 'Gecko Haven', 'Gorgeous Gecko', 'Phantom Pinstripe', 'Lilly White'];
    const unknown = [...people].filter((p) => !PUBLIC_FOUNDERS.includes(p) && !NOT_PEOPLE.includes(p));
    expect(unknown).toEqual([]);
  });
});
