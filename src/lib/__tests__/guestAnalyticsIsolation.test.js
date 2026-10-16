import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const state = vi.hoisted(() => ({ guest: true }));
const supabase = vi.hoisted(() => ({
  auth: { getUser: vi.fn() },
  from: vi.fn(),
}));
const analytics = vi.hoisted(() => ({ trackEvent: vi.fn() }));
const indexHtml = readFileSync(fileURLToPath(new URL('../../../index.html', import.meta.url)), 'utf8');

vi.mock('@/lib/guestMode', () => ({ isGuestMode: () => state.guest }));
vi.mock('@/lib/supabaseClient', () => ({ supabase }));
vi.mock('@/lib/telemetry', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    trackEvent: (...args) => {
      analytics.trackEvent(...args);
      return actual.trackEvent(...args);
    },
  };
});

import { trackEvent, reportError } from '../telemetry';
import { captureEvent, capturePageview, identifyUser } from '../posthog';

describe('guest demo analytics isolation', () => {
  beforeEach(() => {
    state.guest = true;
    vi.clearAllMocks();
  });

  it('does not write guest product events or errors to Supabase', async () => {
    await trackEvent('guest_tour', { action: 'start' });
    await reportError(new Error('demo failure'));
    expect(supabase.auth.getUser).not.toHaveBeenCalled();
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('does not send guest events, pageviews, or identities to PostHog', () => {
    captureEvent('guest_tour');
    capturePageview('/MarketplaceSalesStats');
    identifyUser({ email: 'guest@local' });
    expect(analytics.trackEvent).not.toHaveBeenCalled();
  });

  it('has no third-party beacon or analytics loader inline in the page', () => {
    // The Robauto pixel was removed (review item E3 31) and Google
    // Analytics is started by the app after the consent check, so nothing
    // in index.html calls out before the app has decided.
    expect(indexHtml).not.toMatch(/functions\/v1\/track|sendBeacon|googletagmanager\.com\/gtag/);
  });
});
