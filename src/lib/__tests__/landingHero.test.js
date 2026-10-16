import { beforeEach, describe, expect, it } from 'vitest';
import { guestMockFilter } from '@/lib/guestMockData';
import { DEMO_ENTRY_STEP_ID, TOUR_BY_ID, getTourState, isOnStep, startDemoAtRecord, backTour, advanceTour } from '../guestTour';

const store = new Map();
globalThis.sessionStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

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

// The hero button change itself (one solid primary, the demo as a text link
// that calls startDemoAtRecord) waits for the homepage A/B test to end, with
// its tests: docs/planning/homepage-ab-test-2026-10.md, "Queued until the
// test ends", item 2.
