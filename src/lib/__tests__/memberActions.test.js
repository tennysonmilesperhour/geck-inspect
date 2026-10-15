import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/supabaseClient', () => ({ supabase: {} }));

const {
  followedProfileIds, setFollow, blockProfile, sendMessageToProfile, breederSlugForProfile,
  messageSendErrorText,
} = await import('../memberActions');

function fakeClient(result) {
  const calls = [];
  return {
    calls,
    rpc: async (name, args) => {
      calls.push([name, args]);
      return typeof result === 'function' ? result(name, args) : result;
    },
  };
}

describe('member actions go by profile id, never by email', () => {
  it('asks which profiles are followed and returns a Set of ids', async () => {
    const client = fakeClient({ data: ['p2'], error: null });
    const ids = await followedProfileIds(['p1', 'p2', 'p2', null], { client });
    expect(client.calls).toEqual([['follow_state', { p_profile_ids: ['p1', 'p2'] }]]);
    expect(ids).toEqual(new Set(['p2']));
  });

  it('skips the call when there is nothing to ask about', async () => {
    const client = fakeClient({ data: [], error: null });
    expect(await followedProfileIds([], { client })).toEqual(new Set());
    expect(client.calls).toHaveLength(0);
  });

  it('follows and unfollows by profile id', async () => {
    const client = fakeClient((name, args) => ({ data: args.p_follow, error: null }));
    expect(await setFollow('p9', true, { client })).toBe(true);
    expect(await setFollow('p9', false, { client })).toBe(false);
    expect(client.calls[0]).toEqual(['follow_profile', { p_profile_id: 'p9', p_follow: true }]);
  });

  it('blocks by profile id and passes database errors on', async () => {
    const client = fakeClient({ data: null, error: null });
    await blockProfile(7, { client });
    expect(client.calls).toEqual([['block_profile', { p_profile_id: '7' }]]);
    const failing = fakeClient({ data: null, error: new Error('We could not find this member to block.') });
    await expect(blockProfile('x', { client: failing })).rejects.toThrow('could not find');
  });

  it('starts a conversation by profile id and returns the saved message', async () => {
    const row = { id: 'm1', recipient_email: 'keeper@example.com' };
    const client = fakeClient({ data: row, error: null });
    expect(await sendMessageToProfile('p3', 'Is your Lilly White male available?', 'direct', { client })).toBe(row);
    expect(client.calls[0]).toEqual(['send_direct_message_to_profile', {
      p_profile_id: 'p3', p_content: 'Is your Lilly White male available?', p_message_type: 'direct',
    }]);
  });

  it('looks up a breeder page slug, or null', async () => {
    const client = fakeClient({ data: ' sable-street-geckos ', error: null });
    expect(await breederSlugForProfile('p1', { client })).toBe('sable-street-geckos');
    expect(await breederSlugForProfile(null, { client })).toBe(null);
    const none = fakeClient({ data: null, error: null });
    expect(await breederSlugForProfile('p1', { client: none })).toBe(null);
  });
});

describe('why a message did not send', () => {
  it('explains the new-contact rule instead of asking to try again', () => {
    // What PostgREST returns when the direct_messages insert policy refuses.
    const rls = { code: '42501', message: 'new row violates row-level security policy for table "direct_messages"' };
    expect(messageSendErrorText(rls)).toMatch(/not taking messages from new contacts/);
    expect(messageSendErrorText(rls)).not.toMatch(/try again/i);
  });

  it('explains the hourly cap on new conversations', () => {
    expect(messageSendErrorText({ code: '54000', message: 'Too many new conversations in the last hour. Try again later.' }))
      .toMatch(/new conversations in the last hour/);
  });

  it('says a blocked conversation is unavailable', () => {
    expect(messageSendErrorText({ code: 'P0001', message: 'This conversation is unavailable' }))
      .toBe('This conversation is unavailable.');
  });

  it('falls back to a retry message for anything else', () => {
    expect(messageSendErrorText(new Error('Failed to fetch'))).toBe('Failed to send message. Please try again.');
    expect(messageSendErrorText(null)).toBe('Failed to send message. Please try again.');
  });
});
