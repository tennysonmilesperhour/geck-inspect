import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ guest: true }));
const supabase = vi.hoisted(() => ({
  auth: { getUser: vi.fn() },
  from: vi.fn(),
}));
const analytics = vi.hoisted(() => ({ trackEvent: vi.fn() }));

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
});
