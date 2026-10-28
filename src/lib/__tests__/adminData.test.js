import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabaseClient', () => ({ supabase: { rpc: vi.fn() } }));

import { broadcastRecipients, buildInfo, jobNeedsAttention, seriesPoints, withOwnerEmails, withOwnerEmailsFetched } from '../adminData';

const directory = [
  { id: '1', email: 'admin@example.test', role: 'admin', is_expert: false, has_login: true },
  { id: '2', email: 'lilly@example.test', role: 'user', is_expert: true, has_login: true },
  { id: '3', email: 'harley@example.test', role: 'expert_reviewer', is_expert: false, has_login: true },
  { id: '4', email: 'legacy@example.test', role: 'user', is_expert: true, has_login: false },
  { id: '5', email: null, role: 'user', is_expert: false, has_login: true },
];

describe('broadcastRecipients', () => {
  it('counts only real accounts with an email, never the sender', () => {
    const all = broadcastRecipients(directory, 'all', 'ADMIN@example.test');
    expect(all.map((u) => u.id)).toEqual(['2', '3']);
  });

  it('filters each group', () => {
    expect(broadcastRecipients(directory, 'experts', null).map((u) => u.id)).toEqual(['2']);
    expect(broadcastRecipients(directory, 'reviewers', null).map((u) => u.id)).toEqual(['1', '3']);
    expect(broadcastRecipients(directory, 'admins', null).map((u) => u.id)).toEqual(['1']);
    expect(broadcastRecipients(directory, 'non_experts', null).map((u) => u.id)).toEqual(['3']);
  });
});

describe('seriesPoints', () => {
  it('zips labels and values', () => {
    const series = { labels: ['2026-10-01', '2026-10-02'], accounts: [3, null] };
    expect(seriesPoints(series, 'accounts')).toEqual([
      { key: '2026-10-01', value: 3 },
      { key: '2026-10-02', value: 0 },
    ]);
    expect(seriesPoints(null, 'accounts')).toEqual([]);
  });
});

describe('jobNeedsAttention', () => {
  it('flags failing active jobs only', () => {
    expect(jobNeedsAttention({ active: true, last_status: 'succeeded', failures_7d: 0 })).toBe(false);
    expect(jobNeedsAttention({ active: true, last_status: 'failed', failures_7d: 1 })).toBe(true);
    expect(jobNeedsAttention({ active: true, last_status: 'succeeded', failures_7d: 2 })).toBe(true);
    expect(jobNeedsAttention({ active: false, last_status: 'failed' })).toBe(false);
    expect(jobNeedsAttention({ error: 'cron_unavailable' })).toBe(true);
  });
});

describe('buildInfo', () => {
  it('always returns a commit', () => {
    expect(buildInfo().commit).toBeTruthy();
    expect(buildInfo().shortCommit.length).toBeLessThanOrEqual(7);
  });
});

// Admin screens put the author's email back from the profiles list: signed-in
// accounts, admins included, are losing created_by on photos and forum rows
// (supabase/pending/member_email_columns_revoke.sql).
describe('withOwnerEmails', () => {
  const profiles = [{ id: 'p1', email: 'lilly@example.test' }, { id: 'p2', email: null }];

  it('fills created_by from owner_profile_id, null when the owner has no profile', () => {
    const rows = [{ id: 'a', owner_profile_id: 'p1' }, { id: 'b', owner_profile_id: 'p2' }, { id: 'c', owner_profile_id: null }, { id: 'd' }];
    expect(withOwnerEmails(rows, profiles).map((r) => r.created_by)).toEqual(['lilly@example.test', null, null, null]);
  });

  it('keeps the truncated flag the row reader sets', () => {
    const rows = [{ id: 'a', owner_profile_id: 'p1' }];
    rows.truncated = true;
    expect(withOwnerEmails(rows, profiles).truncated).toBe(true);
  });

  it('looks up only the owners on the rows, 100 ids a request', async () => {
    const asked = [];
    const client = {
      rpc: () => ({
        select: () => ({
          in: async (_col, ids) => { asked.push(ids.length); return { data: ids.map((id) => ({ id, email: `${id}@example.test` })), error: null }; },
        }),
      }),
    };
    const rows = Array.from({ length: 150 }, (_, i) => ({ id: `r${i}`, owner_profile_id: `p${i}` }));
    const out = await withOwnerEmailsFetched(rows, { client });
    expect(asked).toEqual([100, 50]);
    expect(out[149].created_by).toBe('p149@example.test');
    expect(await withOwnerEmailsFetched([], { client })).toEqual([]);
    expect(asked).toEqual([100, 50]);
  });
});
