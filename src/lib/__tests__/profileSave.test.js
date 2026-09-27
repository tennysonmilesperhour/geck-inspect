import { beforeEach, describe, expect, it, vi } from 'vitest';

// updateMyUserData writes the whole Settings form to profiles. A field with
// no profiles column used to make PostgREST reject the entire save (this hid
// every Settings change from the server between April and September 2026).
const upserts = [];
let missingColumns = new Set();

vi.mock('@/lib/telemetry', () => ({ reportError: vi.fn() }));
vi.mock('@/lib/userProfile', () => ({ loadUserProfile: vi.fn() }));
vi.mock('@/lib/supabaseClient', () => ({
  normalizeSupabaseUser: (user) => user,
  supabase: {
    auth: {
      updateUser: async () => ({ data: { user: { id: 'u1', email: 'keeper@example.com' } }, error: null }),
    },
    from: () => ({
      upsert: async (row) => {
        upserts.push({ ...row });
        const bad = Object.keys(row).find((key) => missingColumns.has(key));
        if (bad) {
          return { error: { code: 'PGRST204', message: `Could not find the '${bad}' column of 'profiles' in the schema cache` } };
        }
        return { error: null };
      },
    }),
  },
}));

const { User } = await import('@/entities/all');

describe('User.updateMyUserData', () => {
  beforeEach(() => {
    upserts.length = 0;
    missingColumns = new Set();
  });

  it('saves every field in one upsert when all columns exist', async () => {
    await User.updateMyUserData({ hatch_alert_days: 60, feeding_alerts_enabled: true });
    expect(upserts).toHaveLength(1);
    expect(upserts[0]).toMatchObject({ email: 'keeper@example.com', hatch_alert_days: 60, feeding_alerts_enabled: true });
  });

  it('drops a field with no column and still saves the rest', async () => {
    missingColumns = new Set(['not_a_column']);
    await User.updateMyUserData({ hatch_alert_days: 75, not_a_column: 'x' });
    const last = upserts[upserts.length - 1];
    expect(last).toMatchObject({ hatch_alert_days: 75 });
    expect(last).not.toHaveProperty('not_a_column');
  });

  it('still throws errors that are not a missing column', async () => {
    const { supabase } = await import('@/lib/supabaseClient');
    const original = supabase.from;
    supabase.from = () => ({ upsert: async () => ({ error: { code: '42501', message: 'permission denied' } }) });
    await expect(User.updateMyUserData({ hatch_alert_days: 60 })).rejects.toMatchObject({ code: '42501' });
    supabase.from = original;
  });
});
