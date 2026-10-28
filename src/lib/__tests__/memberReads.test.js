// src/lib/memberReads.js: likes, reactions, "my rows" and forum
// notifications come from the database helpers in
// supabase/migrations/20261028020000_member_email_reads.sql, so the browser
// never reads another member's email. Until those helpers exist (the site
// can deploy first) each one falls back to the old read.
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabaseLazy', () => ({ getSupabase: async () => { throw new Error('tests pass a client'); } }));

const {
  isMissingFunction, myRowIds, forumLikeState, reactionState, notifyForumThreadAuthor, reactionKey,
} = await import('../memberReads');

const MISSING = { code: 'PGRST202', message: 'Could not find the function public.forum_like_state' };

/** A client whose rpc answers `rpcAnswer` and whose table reads answer `rows`, recording every call. */
function fakeClient({ rpcAnswer = { data: null, error: null }, rows = [] } = {}) {
  const calls = [];
  const query = (table) => {
    const q = { then: (resolve) => resolve({ data: rows, error: null }) };
    for (const m of ['select', 'in', 'eq']) q[m] = (...args) => { calls.push([table, m, ...args]); return q; };
    return q;
  };
  return {
    calls,
    rpc: async (name, args) => { calls.push(['rpc', name, args]); return rpcAnswer; },
    from: (table) => { calls.push([table, 'from']); return query(table); },
  };
}

describe('isMissingFunction', () => {
  it('knows the PostgREST and Postgres codes for a function that is not there yet', () => {
    expect(isMissingFunction(MISSING)).toBe(true);
    expect(isMissingFunction({ code: '42883', message: 'function does not exist' })).toBe(true);
    expect(isMissingFunction({ code: '42501', message: 'permission denied' })).toBe(false);
    expect(isMissingFunction(null)).toBe(false);
  });
});

describe('forumLikeState', () => {
  it('asks the database once for every post and comment, and never reads who liked', async () => {
    const client = fakeClient({ rpcAnswer: { data: [{ target_id: 'post-1', like_count: 3, liked: true }], error: null } });
    const state = await forumLikeState(['post-1', 'comment-1', 'post-1'], { email: 'sam@example.com', client });
    expect(client.calls).toEqual([['rpc', 'forum_like_state', { p_target_ids: ['post-1', 'comment-1'] }]]);
    expect(state.get('post-1')).toEqual({ count: 3, liked: true });
    expect(state.get('comment-1')).toEqual({ count: 0, liked: false });
  });

  it('falls back to the old read while the function is missing', async () => {
    const rows = [
      { target_id: 'post-1', user_email: 'sam@example.com' },
      { target_id: 'post-1', user_email: 'kai@example.com' },
      { target_id: 'comment-1', user_email: 'kai@example.com' },
    ];
    const client = fakeClient({ rpcAnswer: { data: null, error: MISSING }, rows });
    const state = await forumLikeState(['post-1', 'comment-1'], { email: 'sam@example.com', client });
    expect(state.get('post-1')).toEqual({ count: 2, liked: true });
    expect(state.get('comment-1')).toEqual({ count: 1, liked: false });
  });

  it('does not fall back on any other error', async () => {
    const client = fakeClient({ rpcAnswer: { data: null, error: { code: '42501', message: 'permission denied' } } });
    await expect(forumLikeState(['post-1'], { client })).rejects.toMatchObject({ code: '42501' });
    expect(client.calls.some(([table]) => table === 'forum_likes')).toBe(false);
  });
});

describe('reactionState', () => {
  const events = [{ event_type: 'upload', event_id: 'img-1' }, { event_type: 'forum_post', event_id: 'p-1' }];

  it('groups the counts by event and reaction, with only "mine" about the member', async () => {
    const client = fakeClient({ rpcAnswer: { data: [
      { event_type: 'upload', event_id: 'img-1', reaction: 'heart', reaction_count: 2, mine: true },
      { event_type: 'upload', event_id: 'img-1', reaction: 'fire', reaction_count: 1, mine: false },
    ], error: null } });
    const state = await reactionState(events, { client });
    expect(client.calls[0]).toEqual(['rpc', 'community_reaction_state', { p_event_types: ['upload', 'forum_post'], p_event_ids: ['img-1', 'p-1'] }]);
    expect(state[reactionKey('upload', 'img-1')]).toEqual({ heart: { count: 2, mine: true }, fire: { count: 1, mine: false } });
    expect(state[reactionKey('forum_post', 'p-1')]).toBeUndefined();
  });

  it('falls back to the old read while the function is missing', async () => {
    const rows = [
      { event_type: 'upload', event_id: 'img-1', reaction: 'heart', user_email: 'sam@example.com' },
      { event_type: 'upload', event_id: 'img-1', reaction: 'heart', user_email: 'kai@example.com' },
    ];
    const client = fakeClient({ rpcAnswer: { data: null, error: MISSING }, rows });
    const state = await reactionState(events, { email: 'sam@example.com', client });
    expect(state[reactionKey('upload', 'img-1')]).toEqual({ heart: { count: 2, mine: true } });
  });
});

describe('myRowIds', () => {
  it('returns the ids, or null while the function is missing so the page can use its old filter', async () => {
    expect(await myRowIds('user_badges', { client: fakeClient({ rpcAnswer: { data: ['b1', 'b2'], error: null } }) })).toEqual(['b1', 'b2']);
    expect(await myRowIds('user_badges', { client: fakeClient({ rpcAnswer: { data: null, error: MISSING } }) })).toBeNull();
  });
});

describe('notifyForumThreadAuthor', () => {
  it('names only the new comment; the database finds the author', async () => {
    const client = fakeClient({ rpcAnswer: { data: true, error: null } });
    const legacy = vi.fn();
    expect(await notifyForumThreadAuthor('comment-9', { legacy, client })).toBe(true);
    expect(client.calls).toEqual([['rpc', 'notify_forum_thread_author', { p_comment_id: 'comment-9' }]]);
    expect(legacy).not.toHaveBeenCalled();
  });

  it('runs the old browser-side notification while the function is missing', async () => {
    const legacy = vi.fn(async () => {});
    expect(await notifyForumThreadAuthor('comment-9', { legacy, client: fakeClient({ rpcAnswer: { data: null, error: MISSING } }) })).toBe(true);
    expect(legacy).toHaveBeenCalledTimes(1);
  });

  it('passes a refusal on (a block, the hourly limit), without the fallback', async () => {
    const legacy = vi.fn();
    const refused = { code: '42501', message: 'You cannot notify this member' };
    await expect(notifyForumThreadAuthor('comment-9', { legacy, client: fakeClient({ rpcAnswer: { data: null, error: refused } }) }))
      .rejects.toMatchObject(refused);
    expect(legacy).not.toHaveBeenCalled();
  });
});
