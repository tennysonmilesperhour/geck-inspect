import { beforeEach, describe, expect, it } from 'vitest';
import { guestMockFilter } from '@/lib/guestMockData';
import {
  TOUR_SIGNUP_URL,
  TOUR_STEPS,
  advanceTour,
  closeTour,
  getTourState,
  isOnStep,
  startTour,
} from '../guestTour';

const store = new Map();
globalThis.sessionStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

describe('guided demo', () => {
  beforeEach(() => store.clear());

  it('offers the tour, then walks three stops to the sign-up card', () => {
    expect(getTourState()).toEqual({ status: 'offer', step: 0 });
    startTour();
    expect(getTourState()).toEqual({ status: 'active', step: 0 });
    advanceTour();
    advanceTour();
    expect(getTourState()).toEqual({ status: 'active', step: 2 });
    advanceTour();
    expect(getTourState().status).toBe('finished');
    closeTour();
    expect(getTourState().status).toBe('closed');
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
