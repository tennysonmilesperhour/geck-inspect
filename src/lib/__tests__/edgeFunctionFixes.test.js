// Edge function fixes from the October 2026 review, each checked by
// running the function's real handler against a fake database and a fake
// network (see edgeHarness.js).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { clientIp } from '../../../supabase/functions/_shared/client-ip.ts';
// send-email imports the lifecycle copy and the Weekly Gecko Notes helper;
// the harness drops imports, so the tests hand the real modules in as globals.
import * as lifecycleCopy from '../../../supabase/functions/_shared/lifecycle-copy.ts';
import * as weeklyNotes from '../../../supabase/functions/_shared/weekly-notes.ts';
import { TIER_LIMITS } from '../tierLimits';
import {
  actionOf, fakeFetch, fakeSupabase, filterValue, functionSource, loadFunction, optionsOf, payloadOf, postJson,
} from './edgeHarness';

const ENV = {
  SUPABASE_URL: 'https://project.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
  SUPABASE_ANON_KEY: 'anon-key',
  RESEND_API_KEY: 're_test',
  ANTHROPIC_API_KEY: 'sk-ant-test',
};
const USER = { id: 'user-1', email: 'keeper@example.com' };
const migration = (name) => readFileSync(new URL(`../../../supabase/migrations/${name}`, import.meta.url), 'utf8');

describe('client IP for rate limits', () => {
  const headers = (h) => new Headers(h);

  it('trusts the address Cloudflare sets over anything the caller sends', () => {
    expect(clientIp(headers({ 'cf-connecting-ip': '203.0.113.9', 'x-forwarded-for': '1.2.3.4' }))).toBe('203.0.113.9');
  });

  it('never takes the first x-forwarded-for entry, which the caller controls', () => {
    expect(clientIp(headers({ 'x-forwarded-for': '6.6.6.6, 198.51.100.7' }))).toBe('198.51.100.7');
    expect(clientIp(headers({ 'x-real-ip': '6.6.6.6' }))).toBeNull();
    expect(clientIp(headers({}))).toBeNull();
  });

  it.each(['send-breeder-inquiry', 'subscribe-and-send-guides', 'recognize-gecko-morph'])(
    '%s uses the shared helper',
    (name) => {
      const src = functionSource(name);
      expect(src).toContain('import { clientIp } from "../_shared/client-ip.ts";');
      expect(src).not.toMatch(/x-forwarded-for"\)[^\n]*split\(","\)\[0\]/);
      expect(src).not.toMatch(/xff\.split\(","\)\[0\]/);
    },
  );
});

describe('subscribe-and-send-guides never undoes an unsubscribe', () => {
  function run(existing) {
    const db = fakeSupabase((call) => {
      if (call.table === 'guide_email_sends' && actionOf(call) === 'select') return { count: 0, error: null };
      if (call.table === 'newsletter_subscribers' && actionOf(call) === 'select') return { data: existing, error: null };
      return undefined;
    });
    const net = fakeFetch(() => ({ body: { id: 'email-1' } }));
    const fn = loadFunction('subscribe-and-send-guides', {
      env: ENV,
      globals: { createClient: () => db.client, clientIp, fetch: net.fetch },
    });
    return { db, net, fn };
  }

  it('leaves an unsubscribed address alone and sends it nothing', async () => {
    const { db, net, fn } = run({ id: 'sub-1', unsubscribed_at: '2026-09-01T00:00:00Z' });
    const res = await fn.handle(postJson('https://x.test/', { email: 'gone@example.com' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    const writes = db.table('newsletter_subscribers').filter((c) => actionOf(c) !== 'select');
    expect(writes).toHaveLength(0);
    expect(net.requests).toHaveLength(0);
  });

  it('answers an unsubscribed address exactly like one it emailed, and counts it toward the limit', async () => {
    const gone = run({ id: 'sub-1', unsubscribed_at: '2026-09-01T00:00:00Z' });
    const sent = run({ id: 'sub-2', unsubscribed_at: null });
    const goneReply = await (await gone.fn.handle(postJson('https://x.test/', { email: 'gone@example.com' }))).json();
    const sentReply = await (await sent.fn.handle(postJson('https://x.test/', { email: 'reader@example.com' }))).json();
    expect(goneReply).toEqual(sentReply);
    expect(sent.net.requests).toHaveLength(1);
    for (const { db } of [gone, sent]) {
      expect(db.table('guide_email_sends').filter((c) => actionOf(c) === 'insert')).toHaveLength(1);
    }
  });

  it('does not touch an existing subscriber row', async () => {
    const { db, net, fn } = run({ id: 'sub-1', unsubscribed_at: null });
    await fn.handle(postJson('https://x.test/', { email: 'reader@example.com' }));
    expect(db.table('newsletter_subscribers').filter((c) => actionOf(c) !== 'select')).toHaveLength(0);
    expect(net.requests).toHaveLength(1);
  });

  it('adds a new address without overwriting a racing one', async () => {
    const { db, net, fn } = run(null);
    await fn.handle(postJson('https://x.test/', { email: 'new@example.com' }));
    const upsert = db.table('newsletter_subscribers').find((c) => actionOf(c) === 'upsert');
    expect(payloadOf(upsert)).not.toHaveProperty('unsubscribed_at');
    expect(optionsOf(upsert)).toMatchObject({ onConflict: 'email', ignoreDuplicates: true });
    expect(net.requests).toHaveLength(1);
  });
});

describe('send-collection-invite uses names from the database', () => {
  it('ignores the inviter and collection names typed by the caller', async () => {
    const db = fakeSupabase((call) => {
      if (call.table === 'collections' && filterValue(call, 'ilike', 'owner_email')) return { data: [{ id: 'c1' }], error: null };
      if (call.table === 'collection_members') return { data: [{ id: 'm1', collection_id: 'c1' }], error: null };
      if (call.table === 'collections') return { data: { name: 'Lilly White project' }, error: null };
      if (call.table === 'profiles') return { data: { full_name: 'Real Keeper' }, error: null };
      return undefined;
    }, { user: USER });
    const net = fakeFetch(() => ({ body: { id: 'email-1' } }));
    const fn = loadFunction('send-collection-invite', {
      env: ENV,
      globals: { createClient: () => db.client, fetch: net.fetch },
    });
    const res = await fn.handle(postJson('https://x.test/', {
      to_email: 'friend@example.com',
      inviter_email: USER.email,
      inviter_name: 'Geck Inspect Support',
      collection_name: 'Verify your account here',
      role: 'viewer',
      invite_url: 'https://geckinspect.com/collection-invite/tok123',
    }, { authorization: 'Bearer user-jwt' }));
    expect(await res.json()).toMatchObject({ delivered: 1 });
    const mail = net.requests[0].body;
    expect(mail.subject).toBe('Real Keeper invited you to a crested gecko collection');
    expect(mail.html).toContain('Lilly White project');
    expect(mail.html).not.toContain('Geck Inspect Support');
    expect(mail.text).not.toContain('Verify your account here');
  });

  it('finds the invite by the token in the link and mails a rebuilt link', async () => {
    const memberCalls = [];
    const db = fakeSupabase((call) => {
      if (call.table === 'collections' && filterValue(call, 'ilike', 'owner_email')) return { data: [{ id: 'c1' }, { id: 'c2' }], error: null };
      if (call.table === 'collection_members') {
        memberCalls.push(call);
        return filterValue(call, 'eq', 'invite_token') === 'tok-c2'
          ? { data: [{ id: 'm2', collection_id: 'c2', role: 'editor' }], error: null }
          : { data: [], error: null };
      }
      if (call.table === 'collections') return { data: { name: filterValue(call, 'eq', 'id') === 'c2' ? 'Harlequin holdbacks' : 'Wrong one' }, error: null };
      if (call.table === 'profiles') return { data: { full_name: 'Real Keeper' }, error: null };
      return undefined;
    }, { user: USER });
    const net = fakeFetch(() => ({ body: { id: 'email-2' } }));
    const fn = loadFunction('send-collection-invite', {
      env: ENV,
      globals: { createClient: () => db.client, fetch: net.fetch },
    });
    const res = await fn.handle(postJson('https://x.test/', {
      to_email: 'friend@example.com',
      inviter_email: USER.email,
      role: 'viewer',
      invite_url: 'https://www.geckinspect.com/collection-invite/tok-c2?next=https://evil.test',
    }, { authorization: 'Bearer user-jwt' }));
    expect(await res.json()).toMatchObject({ delivered: 1 });
    expect(filterValue(memberCalls[0], 'eq', 'invite_token')).toBe('tok-c2');
    const mail = net.requests[0].body;
    expect(mail.html).toContain('Harlequin holdbacks');
    expect(mail.html).toContain('https://geckinspect.com/collection-invite/tok-c2');
    expect(mail.html).not.toContain('evil.test');
    expect(mail.text).toContain('editor');
  });

  it('refuses a link with no invite token', async () => {
    const fn = loadFunction('send-collection-invite', { env: ENV });
    const res = await fn.handle(postJson('https://x.test/', {
      to_email: 'friend@example.com',
      inviter_email: USER.email,
      role: 'viewer',
      invite_url: 'https://geckinspect.com/collection-invite/',
    }, { authorization: 'Bearer user-jwt' }));
    expect(res.status).toBe(400);
  });

  it('falls back to the verified sign-in email when the profile has no name', () => {
    const { context } = loadFunction('send-collection-invite', { env: ENV });
    expect(context.inviterDisplayName(null, 'a@b.c')).toBe('a@b.c');
    expect(context.inviterDisplayName({ full_name: ' ', breeder_name: 'Crest Co' }, 'a@b.c')).toBe('Crest Co');
  });
});

describe('send-email skips people who cannot sign in', () => {
  function run(loginAnswer) {
    const db = fakeSupabase((call) => {
      if (call.table === 'profiles') {
        return {
          data: { id: 'p1', role: 'user', email_notifications_enabled: true, email_notification_types: ['announcements', 'breeding_updates'] },
          error: null,
        };
      }
      if (call.rpc === 'email_has_login') return loginAnswer;
      if (call.rpc === 'email_unsubscribe_token') return { data: 'tok', error: null };
      return undefined;
    });
    const net = fakeFetch(() => ({ body: { id: 'email-1' } }));
    const fn = loadFunction('send-email', { env: ENV, globals: { createClient: () => db.client, fetch: net.fetch, ...lifecycleCopy, ...weeklyNotes } });
    const send = () => fn.handle(postJson('https://x.test/', {
      user_email: 'Legacy@Example.com', type: 'weekly_digest', title: 'Your week', body: 'Hi',
    }, { authorization: `Bearer ${ENV.SUPABASE_SERVICE_ROLE_KEY}` }));
    return { db, net, send };
  }

  it('does not mail an imported profile with no login', async () => {
    const { db, net, send } = run({ data: false, error: null });
    expect(await (await send()).json()).toEqual({ delivered: 0, skipped: 'no-login' });
    expect(db.rpcCalls('email_has_login')[0].args).toEqual({ p_email: 'legacy@example.com' });
    expect(net.requests).toHaveLength(0);
  });

  it('mails a real member', async () => {
    const { net, send } = run({ data: true, error: null });
    expect(await (await send()).json()).toMatchObject({ delivered: 1 });
    expect(net.requests).toHaveLength(1);
  });

  it('keeps sending when the check is not available yet', async () => {
    const { net, send } = run({ data: null, error: { message: 'function email_has_login does not exist' } });
    expect(await (await send()).json()).toMatchObject({ delivered: 1 });
    expect(net.requests).toHaveLength(1);
  });

  it('the check is only open to the service role', () => {
    const sql = migration('20261015140100_email_has_login.sql');
    expect(sql).toContain('from public, anon, authenticated');
    expect(sql).toContain('to service_role');
    expect(sql).toContain('lower(u.email) = lower(trim(p_email))');
  });
});

describe('send-email keeps the notification link inside its href', () => {
  function send(url) {
    const db = fakeSupabase((call) => {
      if (call.table === 'profiles') {
        return {
          data: { id: 'p1', role: 'user', email_notifications_enabled: true, email_notification_types: ['forum_replies', 'new_reply'] },
          error: null,
        };
      }
      if (call.rpc === 'email_has_login') return { data: true, error: null };
      if (call.rpc === 'email_unsubscribe_token') return { data: 'tok', error: null };
      return undefined;
    });
    const net = fakeFetch(() => ({ body: { id: 'email-1' } }));
    const fn = loadFunction('send-email', { env: ENV, globals: { createClient: () => db.client, fetch: net.fetch, ...lifecycleCopy, ...weeklyNotes } });
    return fn.handle(postJson('https://x.test/', {
      user_email: 'keeper@example.com', type: 'new_reply', title: 'New reply', body: 'Bob replied to your comment.', url,
    }, { authorization: `Bearer ${ENV.SUPABASE_SERVICE_ROLE_KEY}` })).then(() => net.requests[0]?.body);
  }

  it('escapes a quote-bearing link so it cannot add markup', async () => {
    const mail = await send('/ForumPost?id=x"><img src=x>&next=https://evil.com');
    expect(mail.html).not.toContain('"><img');
    expect(mail.html).toContain('href="https://geckinspect.com/ForumPost?id=x&quot;&gt;&lt;img src=x&gt;&amp;next=https://evil.com"');
    expect(mail.text).not.toMatch(/["<> ]img/);
    expect(mail.text).toContain('https://geckinspect.com/ForumPost?id=x%22%3E%3Cimg%20src=x%3E&next=https://evil.com');
  });

  it('never links to another website', async () => {
    for (const url of ['https://evil.example/login', '//evil.example', '/\\evil.example', 'javascript:alert(1)']) {
      const mail = await send(url);
      expect(mail.html).toContain('href="https://geckinspect.com/"');
      expect(mail.html).not.toContain('evil.example');
      expect(mail.text).not.toContain('evil.example');
    }
  });

  it('keeps an ordinary in-app link as it is', async () => {
    const mail = await send('/Messages?recipient=bob%40example.com');
    expect(mail.html).toContain('href="https://geckinspect.com/Messages?recipient=bob%40example.com"');
    expect(mail.text).toContain('https://geckinspect.com/Messages?recipient=bob%40example.com');
  });
});

describe('health-screen gives the credit back when a screen fails', () => {
  function run({ anthropicStatus = 500 } = {}) {
    const db = fakeSupabase((call) => {
      if (call.table === 'profiles') return { data: { role: 'user' }, error: null };
      if (call.rpc === 'effective_tier_for_current_user') return { data: 'keeper', error: null };
      if (call.rpc === 'consume_feature_credit') return { data: { credits_included: 5, credits_consumed: 2 }, error: null };
      return undefined;
    }, { user: USER });
    const net = fakeFetch(() => ({ status: anthropicStatus, body: { error: 'overloaded' } }));
    const fn = loadFunction('health-screen', { env: ENV, globals: { createClient: () => db.client, fetch: net.fetch } });
    return { db, net, fn };
  }

  it('refunds after the AI call fails', async () => {
    const { db, fn } = run();
    const res = await fn.handle(postJson('https://x.test/', { image_url: 'https://img.test/g.jpg' }, { authorization: 'Bearer jwt' }));
    expect(res.status).toBe(502);
    expect(await res.json()).toMatchObject({ code: 'vision_error', refunded: true });
    expect(db.rpcCalls('refund_feature_credit')[0].args).toEqual({ p_user_id: USER.id, p_feature: 'health_screen' });
  });

  it('takes no credit for a request without a photo', async () => {
    const { db, fn } = run();
    const res = await fn.handle(postJson('https://x.test/', {}, { authorization: 'Bearer jwt' }));
    expect(res.status).toBe(400);
    expect(db.rpcCalls('consume_feature_credit')).toHaveLength(0);
  });
});

describe('generate-social-post is metered', () => {
  const body = { post_id: 'post-1', gecko: { id: 'g1', name: 'Juniper' }, platforms: ['bluesky'], template: 'meet', voice_preset: 'casual' };
  const draft = {
    model: 'claude-sonnet-5-5',
    usage: { input_tokens: 10, output_tokens: 10 },
    content: [{ type: 'tool_use', name: 'submit_post_variant', input: { variants: [{ hook: 'Juniper hit 31g', body: 'Up from 4g.' }] } }],
  };
  function run({ credit = { data: {}, error: null }, anthropic = { status: 500, body: {} } } = {}) {
    const db = fakeSupabase((call) => {
      if (call.table === 'profiles') return { data: { role: 'user' }, error: null };
      if (call.table === 'social_posts' && actionOf(call) === 'select') {
        return { data: { id: 'post-1', iteration_count: 0, created_by_user_id: USER.id }, error: null };
      }
      if (call.rpc === 'consume_feature_credit') return credit;
      return undefined;
    }, { user: USER });
    const net = fakeFetch(() => anthropic);
    const fn = loadFunction('generate-social-post', {
      env: ENV,
      globals: { createClient: () => db.client, fetch: net.fetch, scrubDashes: (s) => s },
    });
    const send = () => fn.handle(postJson('https://x.test/', body, { authorization: 'Bearer jwt' }));
    return { db, net, send };
  }

  it('takes one social_draft credit before calling the model', async () => {
    const { db, send } = run({ anthropic: { status: 200, body: draft } });
    const res = await send();
    expect(res.status).toBe(200);
    expect(db.rpcCalls('consume_feature_credit')[0].args).toMatchObject({ p_feature: 'social_draft', p_cost: 1 });
    expect(db.rpcCalls('refund_feature_credit')).toHaveLength(0);
  });

  it('stops at the monthly limit without calling the model', async () => {
    const { net, send } = run({ credit: { data: null, error: { message: 'feature_credits_exhausted' } } });
    const res = await send();
    expect(res.status).toBe(402);
    expect(await res.json()).toEqual({ error: 'draft_credits_exhausted' });
    expect(net.requests).toHaveLength(0);
  });

  it('gives the credit back when no drafts come back', async () => {
    const { db, send } = run();
    const res = await send();
    expect(res.status).toBe(502);
    expect(await res.json()).toMatchObject({ error: 'anthropic_failed', refunded: true });
    expect(db.rpcCalls('refund_feature_credit')[0].args).toEqual({ p_user_id: USER.id, p_feature: 'social_draft' });
  });

  it('seeds an allowance for every plan, ten tries per included post', () => {
    const sql = migration('20261015140000_social_draft_allotments.sql');
    for (const [tier, limits] of Object.entries(TIER_LIMITS)) {
      expect(sql).toContain(`('social_draft', '${tier}', ${limits.monthlySocialPosts * 10})`);
    }
  });
});

describe('copy rule', () => {
  it.each([
    'stripe-webhook', 'store-stripe-webhook', 'health-screen', 'generate-social-post', 'send-email',
    'send-collection-invite', 'subscribe-and-send-guides', 'send-breeder-inquiry',
  ])('%s has no em or en dashes', (name) => {
    expect(functionSource(name)).not.toMatch(/\u2014|\u2013/);
  });
});
