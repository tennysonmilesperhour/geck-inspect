import { describe, it, expect } from 'vitest';
import { buildReviewQueuePage, buildReviewQueueCount } from '../reviewQueue';

// A tiny stand-in for the supabase query builder that records each call.
function fakeSupabase() {
  const calls = [];
  const builder = new Proxy({}, {
    get(_target, prop) {
      if (prop === 'calls') return calls;
      return (...args) => { calls.push([prop, ...args]); return builder; };
    },
  });
  return { from: (table) => { calls.push(['from', table]); return builder; }, calls };
}

describe('review queue query', () => {
  it('filters to member submissions on the server', () => {
    const sb = fakeSupabase();
    buildReviewQueuePage(sb, { excludeIds: ['abc', 'bad id)', 'd-1'] });
    expect(sb.calls).toContainEqual(['eq', 'verified', false]);
    expect(sb.calls).toContainEqual(['not', 'user_id', 'is', null]);
    expect(sb.calls).toContainEqual(['in', 'training_meta->>provenance', ['community', 'ai_then_expert']]);
    expect(sb.calls.some(([m, arg]) => m === 'or' && arg.includes('neq.rejected'))).toBe(true);
    // Unsafe ids are dropped instead of breaking the in() list.
    expect(sb.calls).toContainEqual(['not', 'id', 'in', '("abc","d-1")']);
    expect(sb.calls).toContainEqual(['order', 'created_date', { ascending: false }]);
  });

  it('pages by created_date in the sort direction', () => {
    const newest = fakeSupabase();
    buildReviewQueuePage(newest, { after: '2026-10-01T00:00:00Z' });
    expect(newest.calls).toContainEqual(['lt', 'created_date', '2026-10-01T00:00:00Z']);

    const oldest = fakeSupabase();
    buildReviewQueuePage(oldest, { sort: 'oldest', after: '2026-10-01T00:00:00Z' });
    expect(oldest.calls).toContainEqual(['gt', 'created_date', '2026-10-01T00:00:00Z']);
  });

  it('counts with the same filters and no id list when nothing was voted', () => {
    const sb = fakeSupabase();
    buildReviewQueueCount(sb);
    expect(sb.calls).toContainEqual(['in', 'training_meta->>provenance', ['community', 'ai_then_expert']]);
    expect(sb.calls.some(([m, col]) => m === 'not' && col === 'id')).toBe(false);
  });
});
