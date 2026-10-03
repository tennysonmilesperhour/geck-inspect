import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabaseClient', () => ({ supabase: {} }));

import {
  REPORT_TARGETS,
  buildReport,
  isBlockedContent,
  moderateContent,
  reportTargetLink,
  submitReport,
} from '../moderation';

describe('building a report', () => {
  it('trims the reason and keeps a known category', () => {
    expect(buildReport({ targetType: 'gecko_image', targetId: 42, category: 'misleading', reason: '  stolen photo  ' }))
      .toEqual({ target_type: 'gecko_image', target_id: '42', category: 'misleading', reason: 'stolen photo', excerpt: null, page: null });
  });

  it('falls back to other for an unknown category', () => {
    expect(buildReport({ targetType: 'gecko', targetId: 'g1', category: 'nope', reason: 'x' }).category).toBe('other');
  });

  it('refuses a missing reason, id or type', () => {
    expect(() => buildReport({ targetType: 'gecko', targetId: 'g1', reason: '   ' })).toThrow(/describe/);
    expect(() => buildReport({ targetType: 'gecko', targetId: '', reason: 'x' })).toThrow();
    expect(() => buildReport({ targetType: 'blog_post', targetId: '1', reason: 'x' })).toThrow();
  });

  it('every reportable type matches the database list', () => {
    expect(Object.keys(REPORT_TARGETS).sort()).toEqual([
      'breeder_page', 'conversation', 'forum_comment', 'forum_post', 'gecko', 'gecko_image',
      'morph_photo', 'profile', 'store_page', 'waitlist',
    ]);
  });
});

describe('submitting a report', () => {
  it('inserts one row', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    const client = { from: vi.fn(() => ({ insert })) };
    expect(await submitReport({ targetType: 'profile', targetId: 'p1', reason: 'spam' }, { client })).toEqual({ alreadyReported: false });
    expect(client.from).toHaveBeenCalledWith('content_reports');
    expect(insert.mock.calls[0][0]).toMatchObject({ target_type: 'profile', target_id: 'p1' });
  });

  it('treats a second open report of the same item as already reported', async () => {
    const client = { from: () => ({ insert: () => Promise.resolve({ error: { code: '23505', message: 'dup' } }) }) };
    expect(await submitReport({ targetType: 'profile', targetId: 'p1', reason: 'spam' }, { client })).toEqual({ alreadyReported: true });
  });

  it('surfaces other errors', async () => {
    const client = { from: () => ({ insert: () => Promise.resolve({ error: { code: '42501', message: 'denied' } }) }) };
    await expect(submitReport({ targetType: 'profile', targetId: 'p1', reason: 'spam' }, { client })).rejects.toThrow('denied');
  });
});

function fakeClient() {
  const deletes = [];
  const client = {
    from: vi.fn((table) => ({
      delete: () => ({ eq: (col, val) => { deletes.push([table, col, val]); return Promise.resolve({ error: null }); } }),
    })),
    rpc: vi.fn().mockResolvedValue({ data: { action: 'hidden' }, error: null }),
  };
  return { client, deletes };
}

describe('moderating', () => {
  it('hide is one database call and erases nothing', async () => {
    const { client, deletes } = fakeClient();
    await moderateContent('gecko_image', 'img1', 'hide', { client });
    expect(deletes).toEqual([]);
    expect(client.rpc).toHaveBeenCalledWith('moderate_content', { p_target_type: 'gecko_image', p_target_id: 'img1', p_action: 'hide' });
  });

  it('removing a forum post erases its comments, then the post, then closes the reports', async () => {
    const { client, deletes } = fakeClient();
    await moderateContent('forum_post', 'p9', 'remove', { client });
    expect(deletes).toEqual([['forum_comments', 'post_id', 'p9'], ['forum_posts', 'id', 'p9']]);
    expect(client.rpc).toHaveBeenCalledWith('moderate_content', { p_target_type: 'forum_post', p_target_id: 'p9', p_action: 'remove' });
  });

  it('removing a listing leaves the row for the database to unpublish', async () => {
    const { client, deletes } = fakeClient();
    await moderateContent('gecko', 'g1', 'remove', { client });
    expect(deletes).toEqual([]);
    expect(client.rpc).toHaveBeenCalledTimes(1);
  });

  it('refuses unknown actions', async () => {
    const { client } = fakeClient();
    await expect(moderateContent('gecko', 'g1', 'ban', { client })).rejects.toThrow();
  });
});

describe('links and blocking', () => {
  it('links each report to its item', () => {
    expect(reportTargetLink({ target_type: 'forum_comment', target_id: 'c1', target: { post_id: 'p1' } })).toBe('/ForumPost?id=p1');
    expect(reportTargetLink({ target_type: 'gecko', target_id: 'g1', target: { passport_code: 'GI-AB12' } })).toBe('/passport/GI-AB12');
    expect(reportTargetLink({ target_type: 'store_page', target_id: 's1', target: { slug: 'canopy' } })).toBe('/store/canopy');
    expect(reportTargetLink({ target_type: 'profile', target_id: 'p 1', target: {} })).toBe('/PublicProfile?userId=p%201');
  });

  it('matches blocked members by email or profile id', () => {
    const blocked = { emails: new Set(['b@example.com']), profileIds: new Set(['prof-9']) };
    expect(isBlockedContent(blocked, { created_by: 'b@example.com' })).toBe(true);
    expect(isBlockedContent(blocked, { owner_email: 'B@example.com' })).toBe(true);
    expect(isBlockedContent(blocked, { owner_profile_id: 'prof-9' })).toBe(true);
    expect(isBlockedContent(blocked, { created_by: 'a@example.com', owner_profile_id: 'prof-1' })).toBe(false);
    expect(isBlockedContent({ emails: new Set(), profileIds: new Set() }, { created_by: 'b@example.com' })).toBe(false);
  });
});
