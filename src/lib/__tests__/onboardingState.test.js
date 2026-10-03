import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/navItems', () => ({ KEEPER_MODE_STORAGE_KEY: 'geck_keeper_mode' }));

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

const {
  readOnboarding,
  syncOnboardingToBrowser,
  saveOnboarding,
  browserAnswersToUpload,
  holdOnboarding,
  releaseOnboarding,
  onboardingShouldWait,
  _resetOnboardingHolds,
} = await import('../onboardingState');

beforeEach(() => {
  store.clear();
  _resetOnboardingHolds();
});

describe('onboarding state', () => {
  it('a second device reads the answer from the profile', () => {
    const user = { email: 'a@example.com', onboarding_completed_at: '2026-10-01T00:00:00Z', onboarding_role: 'keeper', keeper_mode: true };
    expect(readOnboarding(user)).toMatchObject({ seen: true, roleChosen: true, keeperMode: true });
    expect(syncOnboardingToBrowser(user)).toBe(true);
    expect(store.get('geck_keeper_mode')).toBe('1');
    expect(store.get('geck_inspect_tutorial_seen')).toBe('1');
  });

  it('a brand new account is asked', () => {
    expect(readOnboarding({ email: 'b@example.com' })).toMatchObject({ seen: false, roleChosen: false });
  });

  it('saves to the browser and the profile', async () => {
    const eq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn(() => ({ eq }));
    const supabase = { from: vi.fn(() => ({ update })) };
    const ok = await saveOnboarding(supabase, 'c@example.com', { completed: true, role: 'breeder', keeperMode: false });
    expect(ok).toBe(true);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ onboarding_role: 'breeder', keeper_mode: false }));
    expect(update.mock.calls[0][0].onboarding_completed_at).toBeTruthy();
    expect(eq).toHaveBeenCalledWith('email', 'c@example.com');
    expect(store.get('geck_inspect_role_chosen')).toBe('1');
  });

  it('copies answers given before the columns existed up to the profile', () => {
    store.set('geck_inspect_tutorial_seen', '1');
    store.set('geck_keeper_mode', '1');
    expect(browserAnswersToUpload({ email: 'd@example.com' })).toEqual({ completed: true, keeperMode: true });
    expect(browserAnswersToUpload({ email: 'd@example.com', onboarding_completed_at: 'x' })).toBeNull();
  });

  it('waits while an add form, invite or pending link is in progress', () => {
    expect(onboardingShouldWait({ pathname: '/Dashboard', search: '' })).toBe(false);
    expect(onboardingShouldWait({ pathname: '/MyGeckos', search: '?add=1' })).toBe(true);
    expect(onboardingShouldWait({ pathname: '/collection-invite/abc' })).toBe(true);
    holdOnboarding('quick_add');
    expect(onboardingShouldWait({ pathname: '/MyGeckos' })).toBe(true);
    releaseOnboarding('quick_add');
    expect(onboardingShouldWait({ pathname: '/MyGeckos' })).toBe(false);
    store.set('geck_inspect_post_auth_redirect', JSON.stringify({ path: '/claim/x', at: Date.now() }));
    expect(onboardingShouldWait({ pathname: '/MyGeckos' })).toBe(true);
    store.set('geck_inspect_post_auth_redirect', JSON.stringify({ path: '/claim/x', at: 1 }));
    expect(onboardingShouldWait({ pathname: '/MyGeckos' })).toBe(false);
  });
});
