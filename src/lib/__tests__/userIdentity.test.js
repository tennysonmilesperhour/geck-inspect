import { describe, expect, it, vi } from 'vitest';
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({}) }));
import { normalizeSupabaseUser } from '../supabaseClient';
import { resolveAppUserId } from '../revenuecat';
const id = '11111111-1111-4111-8111-111111111111';

describe('canonical account identity', () => {
  it('never trusts editable metadata for identity, role or paid access', () => {
    const user = normalizeSupabaseUser({ id, email: 'owner@example.com', user_metadata: {
      id: 'someone-else', auth_user_id: 'someone-else', email: 'someone-else@example.com',
      role: 'admin', membership_tier: 'enterprise', subscription_status: 'grandfathered',
      revenuecat_tier: 'breeder', revenuecat_pro_active: true, full_name: 'Display name',
    } });
    expect(user).toMatchObject({ id, auth_user_id: id, email: 'owner@example.com', role: 'user',
      membership_tier: 'free', subscription_status: null, revenuecat_tier: 'free', revenuecat_pro_active: false, full_name: 'Display name' });
  });
  it('uses the auth UUID for store purchases and refuses legacy or guest identities', () => {
    expect(resolveAppUserId({ id: 'legacy-profile', auth_user_id: id })).toBe(id);
    expect(resolveAppUserId({ id })).toBe(id);
    expect(resolveAppUserId({ id: 'legacy-profile' })).toBeNull();
    expect(resolveAppUserId({ id, is_guest: true })).toBeNull();
  });
});
