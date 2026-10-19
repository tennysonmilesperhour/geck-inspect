import { describe, expect, it } from 'vitest';
import { isEmptySocialLogin } from '../../../supabase/functions/_shared/empty-account.ts';

describe('isEmptySocialLogin', () => {
  it('allows a Facebook login with no email or phone', () => {
    expect(isEmptySocialLogin({ email: '', phone: '', identities: [{ provider: 'facebook' }] })).toBe(true);
    expect(isEmptySocialLogin({ email: null, identities: [{ provider: 'facebook' }] })).toBe(true);
  });

  it('never allows a real member', () => {
    expect(isEmptySocialLogin({ email: 'keeper@example.com', identities: [{ provider: 'facebook' }] })).toBe(false);
    expect(isEmptySocialLogin({ email: '', phone: '+15555550100', identities: [{ provider: 'facebook' }] })).toBe(false);
    expect(isEmptySocialLogin({ email: '', identities: [{ provider: 'facebook' }, { provider: 'email' }] })).toBe(false);
    expect(isEmptySocialLogin({ email: '', identities: [] })).toBe(false);
    expect(isEmptySocialLogin({ email: '' })).toBe(false);
    expect(isEmptySocialLogin(null)).toBe(false);
  });
});
