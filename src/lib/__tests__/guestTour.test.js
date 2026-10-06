import { beforeEach, describe, expect, it } from 'vitest';
import { guestMockFilter } from '@/lib/guestMockData';
import { MORPHS } from '@/data/morph-guide';
import { CARE_CATEGORIES } from '@/data/care-guide';
import {
  TOURS,
  TOUR_SIGNUP_URL,
  TOUR_STEPS,
  advanceTour,
  backTour,
  closeHub,
  closeTour,
  getTourState,
  isOnStep,
  openHub,
  orderedTours,
  setRole,
  startTour,
  suggestedTour,
} from '../guestTour';

const store = new Map();
globalThis.sessionStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

describe('guided demo', () => {
  beforeEach(() => store.clear());

  it('offers the tour, then walks the quick tour to its end card', () => {
    expect(getTourState()).toMatchObject({ status: 'offer', tour: 'quick', step: 0, done: [] });
    startTour();
    expect(getTourState()).toMatchObject({ status: 'active', tour: 'quick', step: 0 });
    for (let i = 1; i < TOUR_STEPS.length; i += 1) advanceTour();
    expect(getTourState()).toMatchObject({ status: 'active', step: TOUR_STEPS.length - 1 });
    backTour();
    expect(getTourState().step).toBe(TOUR_STEPS.length - 2);
    advanceTour();
    advanceTour();
    expect(getTourState()).toMatchObject({ status: 'finished', done: ['quick'] });
    closeTour();
    expect(getTourState().status).toBe('closed');
  });

  it('reads a tour saved by the old three-stop version', () => {
    store.set('geck_inspect_guest_tour', JSON.stringify({ status: 'active', step: 1 }));
    expect(getTourState()).toMatchObject({ status: 'active', tour: 'quick', step: 1, done: [] });
  });

  it('suggests the quick tour first, then follows keeper or breeder order', () => {
    expect(suggestedTour().id).toBe('quick');
    startTour('quick');
    for (let i = 0; i < TOUR_STEPS.length; i += 1) advanceTour();
    expect(suggestedTour().id).toBe('breeding');
    setRole('keeper');
    expect(suggestedTour().id).toBe('collection');
    expect(orderedTours().map((t) => t.id)).toHaveLength(TOURS.length);
    for (const t of TOURS) {
      startTour(t.id);
      for (let i = 0; i < t.steps.length; i += 1) advanceTour();
    }
    expect(suggestedTour()).toBeNull();
  });

  it('returns from the hub to the card it was opened from', () => {
    startTour('morphs');
    advanceTour();
    openHub();
    expect(getTourState().status).toBe('hub');
    closeHub();
    expect(getTourState()).toMatchObject({ status: 'active', tour: 'morphs', step: 1 });
    closeTour();
    openHub();
    closeHub();
    expect(getTourState().status).toBe('closed');
  });

  it('gives every tour unique stop ids and a page for each stop', () => {
    const ids = TOURS.flatMap((t) => t.steps.map((s) => s.id));
    expect(new Set(ids).size).toBe(ids.length);
    for (const t of TOURS) {
      expect(t.steps.length).toBeGreaterThan(1);
      for (const step of t.steps) expect(step.path.startsWith('/')).toBe(true);
    }
  });

  it('links to a care guide topic that exists', () => {
    const ids = new Set(CARE_CATEGORIES.flatMap((c) => (c.sections || []).map((sec) => sec.id)));
    const careStops = TOURS.flatMap((t) => t.steps).filter((s) => s.path.startsWith('/CareGuide/'));
    expect(careStops.length).toBeGreaterThan(0);
    for (const s of careStops) expect(ids.has(s.path.split('/')[2])).toBe(true);
  });

  it('links to a morph that exists in the guide', () => {
    const slugs = new Set(MORPHS.map((m) => m.slug));
    const morphStops = TOURS.flatMap((t) => t.steps).filter((s) => s.path.startsWith('/MorphGuide/'));
    for (const s of morphStops) expect(slugs.has(s.path.split('/')[2])).toBe(true);
  });

  it('knows which page each stop is on', () => {
    expect(isOnStep(TOUR_STEPS[0], '/MyGeckos', '')).toBe(true);
    expect(isOnStep(TOUR_STEPS[1], '/GeckoDetail', '?id=mock-gecko-4')).toBe(true);
    expect(isOnStep(TOUR_STEPS[1], '/GeckoDetail', '?id=other')).toBe(false);
    expect(isOnStep(TOUR_STEPS[2], '/calculator', '?damGecko=mock-gecko-1&sireGecko=mock-gecko-2')).toBe(true);
    expect(isOnStep(TOUR_STEPS[2], '/Dashboard', '')).toBe(false);
  });

  it('points at demo geckos that exist, with the right parents', async () => {
    const geckos = await guestMockFilter('Gecko', {});
    const ids = new Set(geckos.map((g) => g.id));
    const nimbus = geckos.find((g) => g.id === 'mock-gecko-4');
    expect(nimbus?.name).toBe('Nimbus');
    expect(ids.has(nimbus.sire_id) && ids.has(nimbus.dam_id)).toBe(true);
    expect(TOUR_STEPS[2].path).toContain(`sireGecko=${nimbus.sire_id}`);
    expect(TOUR_STEPS[2].path).toContain(`damGecko=${nimbus.dam_id}`);
  });

  it('ends on sign-up, then adding a first gecko', () => {
    const url = new URL(TOUR_SIGNUP_URL, 'https://geckinspect.com');
    expect(url.pathname).toBe('/AuthPortal');
    expect(url.searchParams.get('mode')).toBe('signup');
    expect(url.searchParams.get('redirect')).toBe('/MyGeckos?add=1');
  });
});
