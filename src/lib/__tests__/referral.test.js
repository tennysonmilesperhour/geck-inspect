import { describe, it, expect, vi, beforeEach } from 'vitest';

const rpc = vi.fn();
vi.mock('@/lib/supabaseClient', () => ({ supabase: { rpc: (...args) => rpc(...args) } }));

// The suite runs in plain Node (no jsdom), so give the module the two
// browser globals it looks for: window (only checked for existence) and a
// minimal localStorage.
function memoryStorage() {
  const store = new Map();
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  };
}
globalThis.window = globalThis;
globalThis.localStorage = memoryStorage();

const { buildReferralLink, applyPendingReferral } = await import('../referral');

describe('buildReferralLink', () => {
  it('returns an empty string without a code', () => {
    expect(buildReferralLink('', 'https://geckinspect.com')).toBe('');
    expect(buildReferralLink(null, 'https://geckinspect.com')).toBe('');
  });

  it('puts the code in the ref query parameter on the landing page', () => {
    expect(buildReferralLink('ab12cd34', 'https://geckinspect.com')).toBe(
      'https://geckinspect.com/?ref=ab12cd34',
    );
  });

  it('URL-encodes the code', () => {
    expect(buildReferralLink('a b', 'https://geckinspect.com')).toBe(
      'https://geckinspect.com/?ref=a%20b',
    );
  });
});

describe('applyPendingReferral', () => {
  beforeEach(() => {
    rpc.mockReset();
    localStorage.clear();
  });

  it('does nothing when no code is pending', async () => {
    await applyPendingReferral({ email: 'keeper@example.com' });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('drops the pending code without a call when it is the member\'s own', async () => {
    localStorage.setItem('geck_inspect_pending_referral', 'mine1234');
    await applyPendingReferral({ email: 'keeper@example.com', referral_code: 'mine1234' });
    expect(rpc).not.toHaveBeenCalled();
    expect(localStorage.getItem('geck_inspect_pending_referral')).toBeNull();
  });

  it('hands the code to apply_referral_code and clears it on success', async () => {
    localStorage.setItem('geck_inspect_pending_referral', 'ab12cd34');
    rpc.mockResolvedValue({ data: true, error: null });
    await applyPendingReferral({ email: 'keeper@example.com' });
    expect(rpc).toHaveBeenCalledWith('apply_referral_code', { p_code: 'ab12cd34' });
    expect(localStorage.getItem('geck_inspect_pending_referral')).toBeNull();
  });

  it('keeps the code for a retry when the call fails', async () => {
    localStorage.setItem('geck_inspect_pending_referral', 'ab12cd34');
    rpc.mockResolvedValue({ data: null, error: new Error('network') });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await applyPendingReferral({ email: 'keeper@example.com' });
    expect(localStorage.getItem('geck_inspect_pending_referral')).toBe('ab12cd34');
    warn.mockRestore();
  });
});
