import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabaseClient', () => ({ supabase: { rpc: vi.fn() } }));

import { broadcastRecipients, buildInfo, jobNeedsAttention, seriesPoints } from '../adminData';

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
