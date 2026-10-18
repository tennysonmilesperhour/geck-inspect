// Weekly Gecko Notes for visitors without an account
// (docs/planning/weekly-notes-2026-10.md, section 9): the visitor buttons
// in the note files, the visitor order, send-email's visitor branch, the
// visitor stop link in email-unsubscribe, and the subscribe-weekly-notes
// form function. The database rules are in
// supabase/tests/weekly_notes_visitors_regressions.sql.
import { describe, expect, it } from 'vitest';
import * as lifecycleCopy from '../../../supabase/functions/_shared/lifecycle-copy.ts';
import * as weeklyNotes from '../../../supabase/functions/_shared/weekly-notes.ts';
import { noteProblems, parseNote, readWeeklyNotes, VISITOR_PAGES, visitorPathProblem, writingProblems } from '../../../scripts/lib/weekly-notes.mjs';
import { fakeFetch, fakeSupabase, loadFunction, postJson } from './edgeHarness';

const NOTES = readWeeklyNotes();
const SITE = 'https://geckinspect.com';
const ENV = {
  SUPABASE_URL: 'https://project.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
  RESEND_API_KEY: 're_test',
};
const POSTAL = '123 Gecko Lane, Springfield, OR 97477';

// ---------- the note files and the visitor order ------------------------------

describe('visitor buttons in the notes', () => {
  it('every note a visitor gets opens a page that works signed out', () => {
    for (const note of NOTES.filter((n) => n.visitors)) {
      expect(visitorPathProblem(note.visitorPath ?? note.path), note.fileName).toBeNull();
    }
  });

  it('members-only notes are marked, and at least most notes go to visitors', () => {
    const membersOnly = NOTES.filter((n) => !n.visitors).map((n) => n.slug);
    expect(membersOnly).toEqual(['today-tells-you-what-is-due']);
    expect(NOTES.filter((n) => n.visitors).length).toBeGreaterThanOrEqual(NOTES.length - 2);
  });

  it('visitor button words follow the writing rules', () => {
    for (const note of NOTES.filter((n) => n.visitorCta)) {
      expect(writingProblems(note.visitorCta), note.fileName).toEqual([]);
    }
  });

  it('a members-only page with no visitor button is refused, and so is a visitor button that needs an account', () => {
    const base = (extra) => `---\nstep: 2\nslug: watch-the-weight-trend\nsubject: One weight is a snapshot\ncta: Open your geckos\npath: /MyGeckos\n${extra}sources: src/data/husbandry-facts.js:1-2\n---\n${'Weigh every gecko on the same scale. '.repeat(14)}\n`;
    const bare = noteProblems(parseNote('002-watch-the-weight-trend.md', base('')));
    expect(bare.some((p) => p.includes('add visitor_cta and visitor_path for visitors, or visitors: no'))).toBe(true);
    const wrong = noteProblems(parseNote('002-watch-the-weight-trend.md', base('visitor_cta: Open Today\nvisitor_path: /Today\n')));
    expect(wrong.some((p) => p.startsWith('visitor_path "/Today"') && p.includes('works signed out'))).toBe(true);
    const ok = noteProblems(parseNote('002-watch-the-weight-trend.md', base('visitor_cta: Read the weight guide\nvisitor_path: /CareGuide/weight-tracking\n')));
    expect(ok.filter((p) => p.includes('visitor') || p.includes('needs an account'))).toEqual([]);
    const skipped = noteProblems(parseNote('002-watch-the-weight-trend.md', base('visitors: no\n')));
    expect(skipped.filter((p) => p.includes('visitor') || p.includes('needs an account'))).toEqual([]);
  });

  it('is strict about the visitor keys', () => {
    const head = '---\nstep: 1\nslug: a\nsubject: A\ncta: B\npath: /CareGuide\n';
    expect(parseNote('001-a.md', `${head}visitor_cta: Read it\nsources: x:1\n---\nBody.\n`).errors)
      .toContain('visitor_cta and visitor_path go together: give both or neither');
    expect(parseNote('001-a.md', `${head}visitors: yes\nsources: x:1\n---\nBody.\n`).errors)
      .toContain('visitors "yes" can only be no (leave it out to send the note to visitors too)');
    expect(parseNote('001-a.md', `${head}visitors: no\nvisitor_cta: Read it\nvisitor_path: /CareGuide\nsources: x:1\n---\nBody.\n`).errors)
      .toContain('a note with visitors: no has no visitor button; drop visitor_cta and visitor_path');
  });

  it('the visitor pages are public routes, not app pages', () => {
    expect(VISITOR_PAGES).not.toContain('/MyGeckos');
    expect(visitorPathProblem('/MyGeckos')).toMatch(/works signed out/);
    expect(visitorPathProblem('/CareGuide/temperature')).toBeNull();
    expect(visitorPathProblem('/calculator/reverse')).toBeNull();
    expect(visitorPathProblem('/pedigree-tracker')).toBeNull();
  });

  it('weekly-notes.ts gives the visitor order and the visitor button', () => {
    const { weeklyNoteVisitorSlugs, weeklyNoteVisitorSteps, weeklyNoteSlugs, weeklyNoteEmail } = weeklyNotes;
    expect(weeklyNoteVisitorSlugs()).toEqual(NOTES.filter((n) => n.visitors).map((n) => n.slug));
    // The catalog step of each, so a visitor's ledger row says the member's step.
    expect(weeklyNoteVisitorSteps()).toEqual(NOTES.filter((n) => n.visitors).map((n) => n.step));
    expect(weeklyNoteVisitorSteps()).toContain(4);
    expect(weeklyNoteVisitorSteps()).not.toContain(3);
    expect(weeklyNoteVisitorSlugs()).not.toContain('today-tells-you-what-is-due');
    expect(weeklyNoteSlugs()).toContain('today-tells-you-what-is-due');
    const withButton = NOTES.find((n) => n.visitorPath);
    expect(weeklyNoteEmail(withButton.slug, { hasGecko: true, visitor: true })).toEqual({
      title: withButton.subject, body: withButton.body, url: withButton.visitorPath, cta: withButton.visitorCta,
    });
    const own = NOTES.find((n) => n.visitors && !n.visitorPath);
    expect(weeklyNoteEmail(own.slug, { hasGecko: true, visitor: true })).toMatchObject({ url: own.path, cta: own.cta });
    expect(weeklyNoteEmail('today-tells-you-what-is-due', { hasGecko: true, visitor: true })).toBeNull();
    // Members still get the member button.
    expect(weeklyNoteEmail(withButton.slug, { hasGecko: true })).toMatchObject({ url: withButton.path, cta: withButton.cta });
    expect(writingProblems(weeklyNotes.WEEKLY_NOTES_VISITOR_REASON)).toEqual([]);
  });
});

// ---------- send-email: the visitor branch -------------------------------------

function setup({ rpc = {}, env = { EMAIL_POSTAL_ADDRESS: POSTAL } } = {}) {
  const db = fakeSupabase((call) => {
    if (call.rpc && rpc[call.rpc]) return rpc[call.rpc](call);
    if (call.rpc === 'email_is_suppressed') return { data: false, error: null };
    if (call.rpc === 'weekly_notes_subscriber_token') return { data: 'sub1.sig', error: null };
    if (call.rpc === 'claim_weekly_note_subscriber') {
      return { data: { slug: weeklyNotes.weeklyNoteVisitorSlugs()[1], step: 2 }, error: null };
    }
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

const VISITOR = { user_email: 'Ana@Example.com', type: 'weekly_notes', weekly: { run_at: '2026-10-18T00:50:00Z', audience: 'visitor' } };

describe('send-email sends a visitor their note', () => {
  it('claims in the visitor order and sends the visitor button, footer and stop link', async () => {
    const { db, net, send } = setup();
    const out = await send(VISITOR);
    expect(out).toMatchObject({ delivered: 1, id: 'email-1' });
    // No member lookups: no profile, no login check, no member token or claim.
    expect(db.table('profiles')).toHaveLength(0);
    expect(db.rpcCalls('email_has_login')).toHaveLength(0);
    expect(db.rpcCalls('email_unsubscribe_token')).toHaveLength(0);
    expect(db.rpcCalls('claim_weekly_note')).toHaveLength(0);
    expect(db.rpcCalls('weekly_notes_subscriber_token')[0].args).toEqual({ p_email: 'ana@example.com' });
    expect(db.rpcCalls('claim_weekly_note_subscriber')[0].args).toEqual({
      p_email: 'ana@example.com', p_slugs: weeklyNotes.weeklyNoteVisitorSlugs(), p_steps: weeklyNotes.weeklyNoteVisitorSteps(),
    });

    const note = NOTES.find((n) => n.slug === weeklyNotes.weeklyNoteVisitorSlugs()[1]);
    const mail = net.requests[0].body;
    expect(mail.to).toBe('ana@example.com');
    expect(mail.subject).toBe(note.subject);
    expect(mail.text).toContain(`${note.visitorCta ?? note.cta}: ${SITE}${note.visitorPath ?? note.path}`);
    expect(mail.text).toContain(weeklyNotes.WEEKLY_NOTES_VISITOR_REASON);
    expect(mail.text).toContain(`Stop Weekly Gecko Notes: ${SITE}/Unsubscribe?t=sub1.sig&scope=visitor`);
    expect(mail.text).toContain(`Geck Inspect, ${POSTAL}`);
    expect(mail.html).toContain(`href="${SITE}/Unsubscribe?t=sub1.sig&amp;scope=visitor" style="color:#86efac;">Stop Weekly Gecko Notes</a>`);
    // A visitor has no Settings page.
    expect(mail.html).not.toContain('Change preferences');
    expect(mail.html).not.toContain('/Settings');
    expect(mail.headers['List-Unsubscribe']).toBe('<https://project.supabase.co/functions/v1/email-unsubscribe?t=sub1.sig&scope=visitor>');
    expect(mail.headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
    expect(mail.tags).toEqual([{ name: 'type', value: 'weekly_notes' }]);
  });

  it('skips before any claim without a postal address, when suppressed, or with no token', async () => {
    const cases = [
      [{ env: {} }, 'weekly-notes-no-postal-address'],
      [{ rpc: { email_is_suppressed: () => ({ data: true, error: null }) } }, 'suppressed'],
      [{ rpc: { email_is_suppressed: () => ({ data: null, error: { message: 'down' } }) } }, 'weekly-notes-check-failed'],
      [{ rpc: { weekly_notes_subscriber_token: () => ({ data: null, error: null }) } }, 'weekly-notes-no-token'],
    ];
    for (const [opts, skipped] of cases) {
      const { db, net, send } = setup(opts);
      expect(await send(VISITOR)).toEqual({ delivered: 0, skipped });
      expect(db.rpcCalls('claim_weekly_note_subscriber')).toHaveLength(0);
      expect(net.requests).toHaveLength(0);
    }
  });

  it('sends nothing when the claim refuses or fails', async () => {
    for (const [answer, skipped] of [
      [{ data: { reason: 'caught-up' }, error: null }, 'weekly-notes-caught-up'],
      [{ data: { reason: 'not-eligible' }, error: null }, 'weekly-notes-not-eligible'],
      [{ data: null, error: { message: 'boom' } }, 'weekly-notes-claim-failed'],
      [{ data: { slug: 'today-tells-you-what-is-due', step: 3 }, error: null }, 'weekly-notes-unknown-slug'],
    ]) {
      const { net, send } = setup({ rpc: { claim_weekly_note_subscriber: () => answer } });
      expect(await send(VISITOR)).toEqual({ delivered: 0, skipped });
      expect(net.requests).toHaveLength(0);
    }
  });

  it('only the job\'s run marker makes a visitor send: a member run is unchanged', async () => {
    const { db, send } = setup();
    await send({ ...VISITOR, weekly: { run_at: '2026-10-18T00:50:00Z' } });
    expect(db.rpcCalls('claim_weekly_note_subscriber')).toHaveLength(0);
    expect(db.table('profiles')).toHaveLength(1);
  });
});

// ---------- email-unsubscribe: the visitor scope ----------------------------------

function unsubscribe(rpcAnswer = { data: true, error: null }) {
  const db = fakeSupabase((call) => (call.rpc ? rpcAnswer : undefined));
  const fn = loadFunction('email-unsubscribe', { env: ENV, globals: { createClient: () => db.client } });
  return { db, handle: fn.handle };
}

describe('email-unsubscribe and the visitor scope', () => {
  it('a GET keeps the visitor scope on its way to the page', async () => {
    const { handle } = unsubscribe();
    const res = await handle(new Request('https://x.test/email-unsubscribe?t=sub1.sig&scope=visitor'));
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe(`${SITE}/Unsubscribe?t=sub1.sig&scope=visitor`);
  });

  it('a one-click POST with scope=visitor stops the visitor\'s notes', async () => {
    const { db, handle } = unsubscribe();
    const res = await handle(new Request('https://x.test/email-unsubscribe?t=sub1.sig&scope=visitor', { method: 'POST', body: 'List-Unsubscribe=One-Click' }));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('You will not get Weekly Gecko Notes any more.');
    expect(db.calls.map((c) => c.rpc)).toEqual(['unsubscribe_weekly_notes_subscriber']);
    expect(db.calls[0].args).toEqual({ p_token: 'sub1.sig' });
  });

  it('an invalid visitor token is refused', async () => {
    const { handle } = unsubscribe({ data: false, error: null });
    const res = await handle(new Request('https://x.test/email-unsubscribe?t=bad&scope=visitor', { method: 'POST' }));
    expect(res.status).toBe(400);
  });
});

// ---------- subscribe-weekly-notes ------------------------------------------------------

function form({ answer = { data: { status: 'confirm', token: 'tok_ABC-123' }, error: null }, env = {}, resend = () => ({ body: { id: 'e1' } }) } = {}) {
  const db = fakeSupabase((call) => (call.rpc === 'request_weekly_notes_signup' ? answer : undefined));
  const net = fakeFetch(resend);
  const fn = loadFunction('subscribe-weekly-notes', {
    env: { ...ENV, ...env },
    globals: { createClient: () => db.client, fetch: net.fetch, clientIp: () => '203.0.113.9' },
  });
  const post = async (body) => {
    const res = await fn.handle(postJson('https://x.test/', body));
    return { status: res.status, body: await res.json() };
  };
  return { db, net, post };
}

describe('subscribe-weekly-notes', () => {
  it('sends the confirmation link for a new address, and stores nothing itself', async () => {
    const { db, net, post } = form();
    expect(await post({ email: ' Ana@Example.com ', source: 'morph_end' })).toEqual({ status: 200, body: { ok: true } });
    const args = db.rpcCalls('request_weekly_notes_signup')[0].args;
    expect(args.p_email).toBe('ana@example.com');
    expect(args.p_source).toBe('morph_end');
    // A keyed hash, never the IP itself.
    expect(args.p_ip_hash).toMatch(/^[0-9a-f]{32}$/);
    expect(args.p_ip_hash).not.toContain('203.0.113.9');
    expect(db.calls).toHaveLength(1);

    const mail = net.requests[0].body;
    expect(mail.to).toBe('ana@example.com');
    expect(mail.subject).toBe('Confirm your Weekly Gecko Notes');
    expect(mail.text).toContain(`Confirm my email: ${SITE}/WeeklyNotes?t=tok_ABC-123`);
    expect(mail.text).toContain('If you did not ask for this, ignore this email. Nothing more will come.');
    expect(mail.html).toContain(`href="${SITE}/WeeklyNotes?t=tok_ABC-123"`);
    expect(mail.tags).toEqual([{ name: 'type', value: 'weekly_notes_signup_confirm' }]);
    // No dashes as punctuation (CLAUDE.md).
    for (const text of [mail.subject, mail.text]) expect(text).not.toMatch(/[\u2013\u2014]| -- /);
  });

  it('answers the same for an address already signed up or with an account, and the email says which', async () => {
    for (const [status, subject] of [['already', 'You already get Weekly Gecko Notes'], ['member', 'Weekly Gecko Notes and your Geck Inspect account']]) {
      const { net, post } = form({ answer: { data: { status }, error: null } });
      expect(await post({ email: 'ana@example.com' })).toEqual({ status: 200, body: { ok: true } });
      expect(net.requests[0].body.subject).toBe(subject);
      expect(net.requests[0].body.text).not.toContain('/WeeklyNotes?t=');
      expect(net.requests[0].body.text).not.toMatch(/[\u2013\u2014]| -- /);
    }
  });

  it('sends nothing to a suppressed address or a member with email off, and answers as usual', async () => {
    const { net, post } = form({ answer: { data: { status: 'quiet' }, error: null } });
    expect(await post({ email: 'ana@example.com' })).toEqual({ status: 200, body: { ok: true } });
    expect(net.requests).toHaveLength(0);
  });

  it('refuses an address with characters a real one does not need, before the database', async () => {
    for (const email of ['<x>@example.com', '"a"@example.com', 'a,b@example.com', 'a@exa mple.com']) {
      const { db, post } = form();
      expect((await post({ email })).status).toBe(400);
      expect(db.calls).toHaveLength(0);
    }
  });

  it('says so, and sends nothing, when the address had its emails for the day', async () => {
    const { net, post } = form({ answer: { data: { status: 'address-limit' }, error: null } });
    expect(await post({ email: 'ana@example.com' })).toEqual({ status: 200, body: { ok: true, recently_sent: true } });
    expect(net.requests).toHaveLength(0);
  });

  it('refuses a busy network, a bad address and a failed database step', async () => {
    const busy = form({ answer: { data: { status: 'network-limit' }, error: null } });
    expect((await busy.post({ email: 'ana@example.com' })).status).toBe(429);
    expect(busy.net.requests).toHaveLength(0);

    const bad = form();
    expect(await bad.post({ email: 'not an address' })).toEqual({ status: 400, body: { error: 'Please enter a valid email address.' } });
    expect(bad.db.calls).toHaveLength(0);

    const down = form({ answer: { data: null, error: { message: 'down' } } });
    expect((await down.post({ email: 'ana@example.com' })).status).toBe(500);
    expect(down.net.requests).toHaveLength(0);
  });

  it('a filled honeypot gets a normal reply and nothing happens', async () => {
    const { db, net, post } = form();
    expect(await post({ email: 'ana@example.com', website: 'spam.example' })).toEqual({ status: 200, body: { ok: true } });
    expect(db.calls).toHaveLength(0);
    expect(net.requests).toHaveLength(0);
  });

  it('reports a failed send instead of saying the email is on its way', async () => {
    const { post } = form({ resend: () => ({ status: 500, body: { message: 'resend down' } }) });
    expect((await post({ email: 'ana@example.com' })).status).toBe(502);
  });

  it('is closed until its secrets are set', async () => {
    const { db, post } = form({ env: { RESEND_API_KEY: '' } });
    expect((await post({ email: 'ana@example.com' })).status).toBe(503);
    expect(db.calls).toHaveLength(0);
  });
});
