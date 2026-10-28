// Layout counts a member's photos and forum posts by profiles.id (members
// cannot filter on those tables' created_by, an email), and that id is only
// known once loadUserProfile has run: before it, user.id is the sign-in id.
import { describe, expect, it, vi } from 'vitest';

const profile = { id: 'profile-7', email: 'sam@example.com', full_name: 'Sam Keeper' };

vi.mock('@/lib/supabaseLazy', () => {
  const answer = (data) => {
    const q = { then: (resolve) => resolve({ data, error: null }) };
    q.select = () => q;
    q.eq = () => q;
    q.maybeSingle = async () => ({ data, error: null });
    return q;
  };
  return {
    getSupabase: async () => ({
      from: (table) => answer(table === 'profiles' ? profile : []),
    }),
  };
});
vi.mock('@/lib/offlineSession', () => ({
  readCachedProfile: () => null,
  saveCachedProfile: () => {},
  isOffline: () => false,
  readStoredSession: () => null,
}));

const { loadUserProfile } = await import('../userProfile');
const { loadedProfileId } = await import('../loadedProfileId');
const { normalizeSupabaseUser } = await import('../normalizeSupabaseUser');

const authUser = { id: 'auth-uid-1', email: 'sam@example.com', user_metadata: {} };

describe('loadedProfileId', () => {
  it('is null for the sign-in user before the profile loads', () => {
    expect(loadedProfileId(normalizeSupabaseUser(authUser))).toBe(null);
    expect(loadedProfileId(null)).toBe(null);
  });

  it('is the profile id once loadUserProfile has filled the user in', async () => {
    const user = await loadUserProfile(authUser);
    expect(user.id).toBe('profile-7');
    expect(loadedProfileId(user)).toBe('profile-7');
  });
});
