import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { guestMockFilter } from '@/lib/guestMockData';
import { DEMO_ENTRY_STEP_ID, TOUR_BY_ID, getTourState, isOnStep, startDemoAtRecord, backTour, advanceTour } from '../guestTour';

const store = new Map();
globalThis.sessionStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

const home = readFileSync(new URL('../../pages/Home.jsx', import.meta.url), 'utf8');

describe('the demo opens where it shows the product best', () => {
  beforeEach(() => store.clear());

  it("opens on Nimbus's record with the quick tour at that stop", () => {
    const path = startDemoAtRecord();
    expect(path).toBe('/GeckoDetail?id=mock-gecko-4');
    const state = getTourState();
    expect(state).toMatchObject({ status: 'active', tour: 'quick' });
    const step = TOUR_BY_ID.quick.steps[state.step];
    expect(step.id).toBe(DEMO_ENTRY_STEP_ID);
    const [pathname, search] = path.split('?');
    expect(isOnStep(step, pathname, `?${search}`)).toBe(true);
  });

  it('the record it opens has a value-ready morph and both parents in the demo data', async () => {
    const [nimbus] = await guestMockFilter('Gecko', { id: 'mock-gecko-4' });
    expect(nimbus?.name).toBe('Nimbus');
    expect(nimbus.sire_id).toBeTruthy();
    expect(nimbus.dam_id).toBeTruthy();
    expect(nimbus.morphs_traits || (nimbus.morph_tags || []).length).toBeTruthy();
  });

  it('Back shows the whole collection and Next goes on to the clutch odds', () => {
    startDemoAtRecord();
    backTour();
    expect(TOUR_BY_ID.quick.steps[getTourState().step].path).toBe('/MyGeckos');
    advanceTour();
    advanceTour();
    expect(TOUR_BY_ID.quick.steps[getTourState().step].id).toBe('calculator');
  });
});

describe('landing hero: one primary action and a distinct secondary', () => {
  it('the landing demo button no longer opens the Dashboard', () => {
    const handler = home.match(/const handleContinueAsGuest = [\s\S]*?\n {2}};/)[0];
    expect(handler).toContain('startDemoAtRecord()');
    expect(handler).not.toMatch(/createPageUrl\('Dashboard'\)/);
  });

  it('the demo is a text link, not a second button styled like the primary', () => {
    expect(home).not.toMatch(/Or look around the demo collection/);
    const demoLinks = home.match(/<button[^>]*onClick=\{\(\) => handleContinueAsGuest\('(hero|bottom)'\)\}[^>]*>/g) || [];
    expect(demoLinks).toHaveLength(2);
    for (const tag of demoLinks) {
      expect(tag).toContain('underline');
      expect(tag).not.toContain('home-glass-button');
    }
  });

  it('the primary is a solid button, so the two choices never look alike', () => {
    const primaries = home.match(/<Button\s+asChild\s+size="lg"\s+className="[^"]*"\s*>\s*<Link\s+to="\/AuthPortal\?mode=signup"/g) || [];
    expect(primaries).toHaveLength(2);
    for (const tag of primaries) expect(tag).not.toContain('home-glass-button');
    expect(home).toContain('Start free, no card needed');
  });
});
