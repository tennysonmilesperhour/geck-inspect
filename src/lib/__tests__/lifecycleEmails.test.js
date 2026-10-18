// Lifecycle emails (plan item E2 16) and the email delivery fixes in
// send-email: the copy built from a member's own facts, the preferences
// and suppressions it honours, the unsubscribe route it always carries,
// and the preview Tennyson approves staying in step with the real copy.
//
// To refresh the preview after a copy change:
//   WRITE_LIFECYCLE_PREVIEW=1 pnpm vitest run src/lib/__tests__/lifecycleEmails.test.js
import { readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as lifecycleCopy from '../../../supabase/functions/_shared/lifecycle-copy.ts';
// send-email also imports the Weekly Gecko Notes helper; the harness drops
// imports, so both modules go in as globals.
import * as weeklyNotes from '../../../supabase/functions/_shared/weekly-notes.ts';
import { WEIGH_IN_DAYS } from '../../data/husbandry-facts.js';
import { fakeFetch, fakeSupabase, loadFunction, postJson } from './edgeHarness';

const { lifecycleEmail, lifecycleReason, LIFECYCLE_TYPES } = lifecycleCopy;

const ENV = {
  SUPABASE_URL: 'https://project.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
  RESEND_API_KEY: 're_test',
};

const MANGO = {
  first_name: 'Sam',
  signed_up_at: '2026-10-15T14:05:00+00:00',
  gecko_count: 1,
  gecko_id: 'g_mango',
  gecko_name: 'Mango',
  gecko_morph: 'Lilly White Harlequin',
  has_sire: false,
  has_dam: false,
  weight_count: 0,
};

// Every variant Tennyson needs to approve, with the facts that pick it.
const SAMPLES = [
  ['Day 0, no gecko yet', 'lifecycle_day0', { ...MANGO, gecko_count: 0, gecko_id: undefined, gecko_name: undefined }],
  ['Day 0, one gecko, no weight yet', 'lifecycle_day0', MANGO],
  ['Day 0, one gecko already weighed', 'lifecycle_day0', { ...MANGO, weight_count: 1, last_weight_grams: 4.5, last_weight_date: '2026-10-15' }],
  ['Day 1, still no gecko (only sent when the collection is empty)', 'lifecycle_day1', { ...MANGO, gecko_count: 0, gecko_id: undefined, gecko_name: undefined }],
  ['Day 3, no parents on record', 'lifecycle_day3', MANGO],
  ['Day 3, sire on record, dam missing', 'lifecycle_day3', { ...MANGO, has_sire: true }],
  ['Day 3, both parents on record', 'lifecycle_day3', { ...MANGO, has_sire: true, has_dam: true }],
  ['Day 7, no weight yet', 'lifecycle_day7', MANGO],
  ['Day 7, one weight', 'lifecycle_day7', { ...MANGO, weight_count: 1, last_weight_grams: 4.5, last_weight_date: '2026-10-16' }],
  ['Day 14, no weight yet', 'lifecycle_day14', MANGO],
  ['Day 14, one weight', 'lifecycle_day14', { ...MANGO, weight_count: 1, last_weight_grams: 4.5, last_weight_date: '2026-10-16' }],
  ['Day 14, three weights', 'lifecycle_day14', { ...MANGO, weight_count: 3, last_weight_grams: 6, last_weight_date: '2026-10-28' }],
];

const SITE = 'https://geckinspect.com';

function previewOf(title, type, facts) {
  const email = lifecycleEmail(type, facts);
  return [
    `### ${title}`,
    '',
    `Subject: ${email.title}`,
    '',
    '```text',
    email.body,
    '',
    `[ ${email.cta} ]  ${SITE}${email.url}`,
    '',
    lifecycleReason(facts),
    'Change preferences or unsubscribe from these emails.',
    '```',
  ].join('\n');
}

const PREVIEW = SAMPLES.map(([title, type, facts]) => previewOf(title, type, facts)).join('\n\n');
const DOC_URL = new URL('../../../docs/planning/lifecycle-emails-2026-10.md', import.meta.url);
const START = '<!-- preview:start -->';
const END = '<!-- preview:end -->';

describe('lifecycle copy', () => {
  it('covers every lifecycle type', () => {
    expect([...new Set(SAMPLES.map(([, type]) => type))].sort()).toEqual([...LIFECYCLE_TYPES].sort());
  });

  it('the preview in docs/planning matches what is sent', () => {
    const doc = readFileSync(DOC_URL, 'utf8');
    const block = `${START}\n${PREVIEW}\n${END}`;
    if (process.env.WRITE_LIFECYCLE_PREVIEW) {
      const start = doc.indexOf(START);
      const end = doc.indexOf(END) + END.length;
      writeFileSync(DOC_URL, `${doc.slice(0, start)}${block}${doc.slice(end)}`);
      return;
    }
    expect(doc).toContain(block);
  });

  it.each(SAMPLES)('%s: no em dash, en dash or double hyphen', (_title, type, facts) => {
    const email = lifecycleEmail(type, facts);
    const all = `${email.title}\n${email.body}\n${email.cta}\n${lifecycleReason(facts)}`;
    expect(all).not.toMatch(/\u2014|\u2013|--/);
    expect(email.title.length).toBeLessThanOrEqual(70);
    expect(email.url.startsWith('/')).toBe(true);
  });

  it('weigh-in emails open the one-tap log for the first gecko', () => {
    for (const type of ['lifecycle_day7', 'lifecycle_day14']) {
      expect(lifecycleEmail(type, MANGO).url).toBe('/log?gecko=g_mango&type=weight');
    }
    expect(lifecycleEmail('lifecycle_day0', MANGO).url).toBe('/log?gecko=g_mango&type=weight');
  });

  it('the footer says Weekly Gecko Notes follow, not that the emails stop', () => {
    const reason = lifecycleReason(MANGO);
    expect(reason).toBe('You are getting this because you joined Geck Inspect on Oct 15. It is one of a few short emails in your first two weeks. After that, Weekly Gecko Notes come once a week, and each one has a link to stop them.');
    expect(reason).not.toMatch(/stop after that/);
  });

  it('states the facts the weekly notes repeat the same way', () => {
    // The scale: care guide, weight tracking (src/data/care-guide.js).
    expect(lifecycleEmail('lifecycle_day0', MANGO).body).toContain('Use a kitchen scale that reads to 0.1 g.');
    expect(lifecycleEmail('lifecycle_day0', MANGO).body).not.toMatch(/reads to 1 g/);
    // The rhythm: the weigh-in reminders' own numbers.
    const day14 = lifecycleEmail('lifecycle_day14', MANGO).body;
    expect(day14).toContain(`every ${WEIGH_IN_DAYS.growing} days while a crested gecko is growing, every ${WEIGH_IN_DAYS.subadult} days as a sub-adult and every ${WEIGH_IN_DAYS.adult} days as an adult`);
  });

  it('the lineage email opens that gecko on the family tree', () => {
    expect(lifecycleEmail('lifecycle_day3', MANGO).url).toBe('/Lineage?geckoId=g_mango');
  });

  it('uses the member\'s own numbers', () => {
    const email = lifecycleEmail('lifecycle_day14', { ...MANGO, weight_count: 3, last_weight_grams: '6.04', last_weight_date: '2026-10-28' });
    expect(email.body).toContain('Mango has 3 weights on record');
    expect(email.body).toContain('The last was 6 g on Oct 28.');
  });

  it('has nothing to say about a gecko that is not there', () => {
    for (const type of ['lifecycle_day3', 'lifecycle_day7', 'lifecycle_day14']) {
      expect(lifecycleEmail(type, { first_name: 'Sam', gecko_count: 0 })).toBeNull();
    }
    expect(lifecycleEmail('weekly_digest', MANGO)).toBeNull();
  });

  it('copes with no name, an address in the name field, and a gecko with no name', () => {
    expect(lifecycleEmail('lifecycle_day1', { first_name: null }).body.startsWith('Hi,')).toBe(true);
    expect(lifecycleEmail('lifecycle_day0', { first_name: 'sam@example.com', gecko_count: 0 }).title).toBe('Welcome to Geck Inspect');
    const unnamed = lifecycleEmail('lifecycle_day7', { ...MANGO, gecko_name: '  ' });
    expect(unnamed.title).toBe('Time to weigh your gecko');
    expect(unnamed.cta).toBe("Log your gecko's weight");
    expect(lifecycleEmail('lifecycle_day3', { ...MANGO, gecko_name: 'Biscuits' }).title).toBe("Who are Biscuits' parents?");
  });

  it('keeps line breaks and control characters out of the subject', () => {
    const email = lifecycleEmail('lifecycle_day7', { ...MANGO, gecko_name: 'Mango\r\nBcc: x@evil.test' });
    expect(email.title).toBe('Time to weigh Mango Bcc: x@evil.test');
    expect(email.title).not.toMatch(/[\r\n]/);
  });
});

function setup({ profile = {}, rpc = {}, env = {} } = {}) {
  const db = fakeSupabase((call) => {
    if (call.table === 'profiles') {
      return {
        data: {
          id: 'p1', role: 'user', email_notifications_enabled: true,
          email_notification_types: ['announcements', 'breeding_updates'], ...profile,
        },
        error: null,
      };
    }
    if (call.rpc && rpc[call.rpc]) return rpc[call.rpc](call);
    if (call.rpc === 'email_has_login') return { data: true, error: null };
    if (call.rpc === 'email_is_suppressed') return { data: false, error: null };
    if (call.rpc === 'email_unsubscribe_token') return { data: 'p1.sig', error: null };
    if (call.rpc === 'record_email_event') return { data: true, error: null };
    return undefined;
  });
  const net = fakeFetch(() => ({ body: { id: 'email-1' } }));
  const fn = loadFunction('send-email', {
    env: { ...ENV, ...env },
    globals: { createClient: () => db.client, fetch: net.fetch, ...lifecycleCopy, ...weeklyNotes },
  });
  const send = async (payload) => {
    const res = await fn.handle(postJson('https://x.test/', payload, { authorization: `Bearer ${ENV.SUPABASE_SERVICE_ROLE_KEY}` }));
    return res.json();
  };
  return { db, net, send };
}

describe('send-email sends lifecycle emails', () => {
  it('builds the email from the facts, tags it and logs it as sent', async () => {
    const { db, net, send } = setup();
    const out = await send({ user_email: 'Sam@Example.com', type: 'lifecycle_day3', facts: MANGO });
    expect(out).toMatchObject({ delivered: 1, id: 'email-1' });
    const mail = net.requests[0].body;
    expect(mail.subject).toBe("Who are Mango's parents?");
    expect(mail.text).toContain("Add Mango's sire and dam.");
    expect(mail.text).toContain(`Open Mango's family tree: ${SITE}/Lineage?geckoId=g_mango`);
    expect(mail.text).toContain('you joined Geck Inspect on Oct 15');
    expect(mail.html).toContain('>Open Mango&#39;s family tree</a>');
    expect(mail.tags).toEqual([{ name: 'type', value: 'lifecycle_day3' }]);
    expect(mail.headers['List-Unsubscribe']).toBe('<https://project.supabase.co/functions/v1/email-unsubscribe?t=p1.sig>');
    expect(db.rpcCalls('record_email_event')[0].args).toEqual({
      p_event: 'sent', p_event_key: 'sent:email-1', p_resend_email_id: 'email-1',
      p_email: 'sam@example.com', p_email_type: 'lifecycle_day3',
    });
  });

  it('ignores a title or body in the payload, so only the approved copy goes out', async () => {
    const { net, send } = setup();
    await send({ user_email: 'sam@example.com', type: 'lifecycle_day1', title: 'Buy now', body: 'spam', facts: { first_name: 'Sam' } });
    expect(net.requests[0].body.subject).toBe('Start with the gecko you know best');
    expect(net.requests[0].body.text).not.toContain('spam');
  });

  it('skips a lifecycle type that arrives without facts, as a notification row would', async () => {
    // A member can write a notification to themselves with any type the
    // guard allows; the dispatcher then calls send-email with a title and
    // body but no facts. That must not send a welcome around the master
    // switch and the ledger.
    for (const facts of [undefined, null, 'day0', ['x'], 5]) {
      const { net, send } = setup();
      const out = await send({ user_email: 'sam@example.com', type: 'lifecycle_day0', title: 'Geck Inspect', body: 'Hi', url: '/', facts });
      expect(out).toMatchObject({ delivered: 0, skipped: 'lifecycle-without-facts' });
      expect(net.requests).toHaveLength(0);
    }
  });

  it('escapes a gecko name in the html', async () => {
    const { net, send } = setup();
    await send({ user_email: 'sam@example.com', type: 'lifecycle_day7', facts: { ...MANGO, gecko_name: '<img src=x>' } });
    expect(net.requests[0].body.html).not.toContain('<img src=x>');
    expect(net.requests[0].body.html).toContain('&lt;img src=x&gt;');
  });

  it('follows the announcements switch for day 0 to 3 and the care switch for the weigh-ins', async () => {
    const careOnly = setup({ profile: { email_notification_types: ['breeding_updates'] } });
    expect(await careOnly.send({ user_email: 'sam@example.com', type: 'lifecycle_day0', facts: MANGO }))
      .toEqual({ delivered: 0, skipped: 'type-not-allowed' });
    expect(await careOnly.send({ user_email: 'sam@example.com', type: 'lifecycle_day7', facts: MANGO }))
      .toMatchObject({ delivered: 1 });
  });

  it('stops when the member turned email off', async () => {
    const { net, send } = setup({ profile: { email_notifications_enabled: false } });
    expect(await send({ user_email: 'sam@example.com', type: 'lifecycle_day0', facts: MANGO }))
      .toEqual({ delivered: 0, skipped: 'master-off' });
    expect(net.requests).toHaveLength(0);
  });

  it('skips a weigh-in email with no gecko to weigh', async () => {
    const { net, send } = setup();
    expect(await send({ user_email: 'sam@example.com', type: 'lifecycle_day7', facts: { first_name: 'Sam' } }))
      .toEqual({ delivered: 0, skipped: 'lifecycle-not-applicable' });
    expect(net.requests).toHaveLength(0);
  });
});

describe('send-email and bounced or complained addresses', () => {
  it('does not mail a suppressed address', async () => {
    const { db, net, send } = setup({ rpc: { email_is_suppressed: () => ({ data: true, error: null }) } });
    expect(await send({ user_email: 'Gone@Example.com', type: 'weekly_digest', title: 'Your week', body: 'Hi' }))
      .toEqual({ delivered: 0, skipped: 'suppressed' });
    expect(db.rpcCalls('email_is_suppressed')[0].args).toEqual({ p_email: 'gone@example.com' });
    expect(net.requests).toHaveLength(0);
  });

  it('keeps sending when the check is not available yet', async () => {
    const { net, send } = setup({ rpc: { email_is_suppressed: () => ({ data: null, error: { message: 'does not exist' } }) } });
    expect(await send({ user_email: 'sam@example.com', type: 'weekly_digest', title: 'Your week', body: 'Hi' }))
      .toMatchObject({ delivered: 1 });
    expect(net.requests).toHaveLength(1);
  });

  it('a failed delivery-log write never stops the email', async () => {
    const { net, send } = setup({ rpc: { record_email_event: () => ({ data: null, error: { message: 'boom' } }) } });
    expect(await send({ user_email: 'sam@example.com', type: 'weekly_digest', title: 'Your week', body: 'Hi' }))
      .toMatchObject({ delivered: 1 });
    expect(net.requests).toHaveLength(1);
  });
});

describe('send-email always carries a working unsubscribe route', () => {
  const digest = { user_email: 'sam@example.com', type: 'weekly_digest', title: 'Your week', body: 'Hi' };

  it('retries the token once before giving up on one-click', async () => {
    let calls = 0;
    const { db, net, send } = setup({
      rpc: {
        email_unsubscribe_token: () => {
          calls += 1;
          return calls === 1 ? { data: null, error: { message: 'connection reset' } } : { data: 'p1.sig', error: null };
        },
      },
    });
    await send(digest);
    expect(db.rpcCalls('email_unsubscribe_token')).toHaveLength(2);
    expect(net.requests[0].body.headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
  });

  it('falls back to the Settings switches when no token can be made', async () => {
    const { net, send } = setup({ rpc: { email_unsubscribe_token: () => ({ data: null, error: { message: 'no secret' } }) } });
    expect(await send(digest)).toMatchObject({ delivered: 1 });
    const mail = net.requests[0].body;
    // Before the fix both the header and the footer link were dropped.
    expect(mail.headers['List-Unsubscribe']).toBe(`<${SITE}/Settings#email-notifications>`);
    expect(mail.headers['List-Unsubscribe-Post']).toBeUndefined();
    expect(mail.html).toContain(`href="${SITE}/Settings#email-notifications" style="color:#86efac;">turn these emails off</a>`);
    expect(mail.text).toContain(`Turn these emails off in Settings: ${SITE}/Settings#email-notifications`);
  });

  it('adds a hand-handled mailbox to the fallback when one is set', async () => {
    const { net, send } = setup({
      rpc: { email_unsubscribe_token: () => ({ data: null, error: { message: 'no secret' } }) },
      env: { UNSUBSCRIBE_MAILTO: 'support@geckinspect.com' },
    });
    await send(digest);
    expect(net.requests[0].body.headers['List-Unsubscribe'])
      .toBe(`<${SITE}/Settings#email-notifications>, <mailto:support@geckinspect.com?subject=unsubscribe>`);
  });

  it('a profile with no id still gets the Settings route', async () => {
    const { net, send } = setup({ profile: { id: null } });
    await send(digest);
    expect(net.requests[0].body.headers['List-Unsubscribe']).toBe(`<${SITE}/Settings#email-notifications>`);
  });

  it('prints the postal address when it is set', async () => {
    const { net, send } = setup({ env: { EMAIL_POSTAL_ADDRESS: '123 Gecko Lane, Springfield, OR 97477' } });
    await send(digest);
    expect(net.requests[0].body.html).toContain('Geck Inspect, 123 Gecko Lane, Springfield, OR 97477');
    expect(net.requests[0].body.text).toContain('Geck Inspect, 123 Gecko Lane, Springfield, OR 97477');
  });
});
