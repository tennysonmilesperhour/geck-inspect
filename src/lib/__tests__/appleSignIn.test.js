import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authorize: vi.fn(),
  idToken: vi.fn(),
  updateUser: vi.fn(),
  profileUpdate: vi.fn(),
}));
vi.mock('@capacitor/core', () => ({ registerPlugin: () => ({ authorize: mocks.authorize }) }));
vi.mock('../supabaseLazy', () => ({
  getSupabase: async () => ({
    auth: { signInWithIdToken: mocks.idToken, updateUser: mocks.updateUser },
    from: () => ({ update: (row) => ({ eq: (col, val) => ({ is: (c, v) => { mocks.profileUpdate(row, col, val, c, v); return Promise.resolve({}); } }) }) }),
  }),
}));

import { appleFullName, isAppleCancel, signInWithApple } from '../appleSignIn';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.updateUser.mockResolvedValue({});
  mocks.idToken.mockResolvedValue({ data: { user: { email: 'keeper@privaterelay.appleid.com' } }, error: null });
});

describe('Sign in with Apple', () => {
  it('sends Apple the hashed nonce and Supabase the raw one', async () => {
    mocks.authorize.mockResolvedValue({ identityToken: 'tok', givenName: '', familyName: '' });
    await signInWithApple();
    const hashed = mocks.authorize.mock.calls[0][0].nonce;
    const { provider, token, nonce } = mocks.idToken.mock.calls[0][0];
    expect(provider).toBe('apple');
    expect(token).toBe('tok');
    expect(createHash('sha256').update(nonce).digest('hex')).toBe(hashed);
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it('saves the first-sign-in name only into an empty profile name', async () => {
    mocks.authorize.mockResolvedValue({ identityToken: 'tok', givenName: 'Sam', familyName: 'Rivera' });
    await signInWithApple();
    expect(mocks.updateUser).toHaveBeenCalledWith({ data: { full_name: 'Sam Rivera' } });
    expect(mocks.profileUpdate).toHaveBeenCalledWith({ full_name: 'Sam Rivera' }, 'email', 'keeper@privaterelay.appleid.com', 'full_name', null);
  });

  it('throws when Supabase refuses the token', async () => {
    mocks.authorize.mockResolvedValue({ identityToken: 'tok' });
    mocks.idToken.mockResolvedValue({ data: null, error: new Error('Provider is not enabled') });
    await expect(signInWithApple()).rejects.toThrow('Provider is not enabled');
  });

  it('joins name parts and spots a cancel', () => {
    expect(appleFullName({ givenName: ' Sam ', familyName: '' })).toBe('Sam');
    expect(appleFullName({})).toBe('');
    expect(isAppleCancel({ code: 'CANCELED' })).toBe(true);
    expect(isAppleCancel(new Error('x'))).toBe(false);
  });
});
