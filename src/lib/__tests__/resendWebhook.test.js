// resend-webhook: Resend's delivery events reach email_deliveries only
// with a valid Svix signature, and each one is recorded with what the
// suppression rule needs. Runs the real handler (see edgeHarness.js).
import { createHmac, randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { fakeSupabase, functionSource, loadFunction } from './edgeHarness';

const KEY = randomBytes(24);
const SECRET = `whsec_${KEY.toString('base64')}`;
const ENV = {
  SUPABASE_URL: 'https://project.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
  RESEND_WEBHOOK_SECRET: SECRET,
};

const sign = (id, ts, body, key = KEY) =>
  `v1,${createHmac('sha256', key).update(`${id}.${ts}.${body}`).digest('base64')}`;

function webhook(payload, { id = 'msg_1', ts = Math.floor(Date.now() / 1000), signature, body } = {}) {
  const raw = body ?? JSON.stringify(payload);
  return new Request('https://x.test/resend-webhook', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'svix-id': id,
      'svix-timestamp': String(ts),
      'svix-signature': signature ?? sign(id, ts, JSON.stringify(payload)),
    },
    body: raw,
  });
}

function setup({ env = ENV, rpc = () => ({ data: true, error: null }) } = {}) {
  const db = fakeSupabase((call) => (call.rpc === 'record_email_event' ? rpc(call) : undefined));
  const fn = loadFunction('resend-webhook', { env, globals: { createClient: () => db.client, atob, btoa } });
  return { db, fn };
}

const bounced = {
  type: 'email.bounced',
  created_at: '2026-10-16T15:00:00.000Z',
  data: {
    email_id: 're_123',
    to: ['Sam Keeper <Sam@Example.com>'],
    subject: 'Time to weigh Mango',
    tags: { type: 'lifecycle_day7' },
    bounce: { type: 'Permanent', subType: 'General', message: 'Mailbox does not exist' },
  },
};

describe('resend-webhook', () => {
  it('records a signed bounce with what the suppression rule needs', async () => {
    const { db, fn } = setup();
    const res = await fn.handle(webhook(bounced));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ recorded: true, event: 'bounced' });
    expect(db.rpcCalls('record_email_event')[0].args).toEqual({
      p_event: 'bounced',
      p_event_key: 'msg_1',
      p_resend_email_id: 're_123',
      p_email: 'sam@example.com',
      p_email_type: 'lifecycle_day7',
      p_occurred_at: '2026-10-16T15:00:00.000Z',
      p_detail: { bounce_type: 'Permanent', bounce_subtype: 'General', message: 'Mailbox does not exist' },
    });
  });

  it('refuses a wrong signature, so nobody can forge a bounce to switch off email', async () => {
    const { db, fn } = setup();
    const res = await fn.handle(webhook(bounced, { signature: sign('msg_1', Math.floor(Date.now() / 1000), JSON.stringify(bounced), randomBytes(24)) }));
    expect(res.status).toBe(401);
    expect(db.rpcCalls('record_email_event')).toHaveLength(0);
  });

  it('refuses a body changed after signing', async () => {
    const { db, fn } = setup();
    const tampered = JSON.stringify({ ...bounced, data: { ...bounced.data, to: ['victim@example.com'] } });
    const res = await fn.handle(webhook(bounced, { body: tampered }));
    expect(res.status).toBe(401);
    expect(db.rpcCalls('record_email_event')).toHaveLength(0);
  });

  it('refuses a replay older than five minutes', async () => {
    const { fn } = setup();
    const ts = Math.floor(Date.now() / 1000) - 600;
    const res = await fn.handle(webhook(bounced, { ts, signature: sign('msg_1', ts, JSON.stringify(bounced)) }));
    expect(res.status).toBe(401);
  });

  it('refuses unsigned requests', async () => {
    const { fn } = setup();
    const res = await fn.handle(webhook(bounced, { signature: '' }));
    expect(res.status).toBe(401);
  });

  it('accepts any one valid signature, the way Svix rotates secrets', async () => {
    const { fn } = setup();
    const ts = Math.floor(Date.now() / 1000);
    const both = `v1,bm90LXRoZS1yaWdodC1vbmU= ${sign('msg_1', ts, JSON.stringify(bounced))}`;
    expect((await fn.handle(webhook(bounced, { ts, signature: both }))).status).toBe(200);
  });

  it('refuses everything when the secret is not set', async () => {
    const { db, fn } = setup({ env: { ...ENV, RESEND_WEBHOOK_SECRET: '' } });
    expect((await fn.handle(webhook(bounced))).status).toBe(500);
    expect(db.rpcCalls('record_email_event')).toHaveLength(0);
  });

  it('answers 500 when the database write fails, so Resend retries', async () => {
    const { fn } = setup({ rpc: () => ({ data: null, error: { message: 'down' } }) });
    expect((await fn.handle(webhook(bounced))).status).toBe(500);
  });

  it('ignores events it does not log', async () => {
    const { db, fn } = setup();
    const res = await fn.handle(webhook({ type: 'contact.created', data: {} }));
    expect(await res.json()).toEqual({ ignored: 'contact.created' });
    expect(db.rpcCalls('record_email_event')).toHaveLength(0);
  });

  it('reads list-style tags and keeps only the clicked link', async () => {
    const { db, fn } = setup();
    const clicked = {
      type: 'email.clicked',
      created_at: '2026-10-16T15:00:00.000Z',
      data: {
        email_id: 're_9',
        to: 'sam@example.com',
        tags: [{ name: 'type', value: 'weekly_digest' }],
        click: { link: 'https://geckinspect.com/MyGeckos', ipAddress: '203.0.113.9', userAgent: 'Mail' },
      },
    };
    await fn.handle(webhook(clicked));
    const args = db.rpcCalls('record_email_event')[0].args;
    expect(args.p_email_type).toBe('weekly_digest');
    expect(args.p_email).toBe('sam@example.com');
    expect(args.p_detail).toEqual({ link: 'https://geckinspect.com/MyGeckos' });
  });

  it('drops the query string and fragment of a clicked link', async () => {
    // An unsubscribe link carries the member's signed token in its query.
    for (const [link, kept] of [
      ['https://geckinspect.com/Unsubscribe?t=p1.secret-signature', 'https://geckinspect.com/Unsubscribe'],
      ['https://geckinspect.com/log?gecko=g1&type=weight#top', 'https://geckinspect.com/log'],
      ['https://geckinspect.com/Settings#email-notifications', 'https://geckinspect.com/Settings'],
    ]) {
      const { db, fn } = setup();
      await fn.handle(webhook({
        type: 'email.clicked',
        data: { email_id: 're_10', to: 'sam@example.com', click: { link } },
      }));
      expect(db.rpcCalls('record_email_event')[0].args.p_detail).toEqual({ link: kept });
    }
  });

  it('never trusts a tag that is not a plain type name', async () => {
    const { db, fn } = setup();
    await fn.handle(webhook({ ...bounced, data: { ...bounced.data, tags: { type: "x'; drop table" } } }));
    expect(db.rpcCalls('record_email_event')[0].args.p_email_type).toBeNull();
  });

  it('has no em or en dashes', () => {
    expect(functionSource('resend-webhook')).not.toMatch(/—|–/);
  });
});
