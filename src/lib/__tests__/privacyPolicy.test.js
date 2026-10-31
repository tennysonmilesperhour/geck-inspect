import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { editorialFor } from '@/lib/editorial';

// The Privacy Policy has to say what account deletion does to the email
// records added in October 2026 (migration 20261015151600_erase_email_logs):
// the delivery log loses the address, and email_suppressions keeps
// addresses that bounced or reported spam, on purpose.
const PAGE = readFileSync(new URL('../../pages/PrivacyPolicy.jsx', import.meta.url), 'utf8');
const LIFECYCLE_SQL = readFileSync(
  new URL('../../../supabase/migrations/20261015151200_lifecycle_emails.sql', import.meta.url),
  'utf8',
);
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

describe('Privacy Policy: email records and deletion', () => {
  it('says deletion removes the address from the email delivery records', () => {
    expect(PAGE).toMatch(/Deletion also removes your email address from our email delivery records/);
  });

  it('says a short do-not-email list of bounced and spam-reporting addresses is kept', () => {
    expect(PAGE).toMatch(/bounced or its owner marked our email as spam/);
    expect(PAGE).toMatch(/do-not-email list/);
    expect(PAGE).toMatch(/even after the account is deleted/);
  });

  // email_suppressions survives account deletion, so the policy has to
  // name every column it keeps. A new column without matching wording
  // here (and in the policy) fails this test.
  it('names everything the do-not-email list keeps', () => {
    const table = LIFECYCLE_SQL.match(/create table if not exists public\.email_suppressions \(([\s\S]*?)\n\);/)?.[1];
    expect(table).toBeTruthy();
    const columns = table
      .split('\n')
      .map((line) => line.trim().match(/^([a-z_]+)\s/)?.[1])
      .filter((name) => name && name !== 'constraint');
    const wording = {
      email: 'It holds the address',
      reason: 'the reason (a bounce or a spam report)',
      created_date: 'when it was added',
      updated_date: 'last changed',
      resend_email_id: 'the reference our email service gave the email',
      detail: 'the short message the receiving mail server sent back',
    };
    expect([...columns].sort()).toEqual(Object.keys(wording).sort());
    const paragraph = PAGE.match(/One short list is kept on purpose\.[^<]*/)?.[0] ?? '';
    for (const phrase of Object.values(wording)) {
      expect(paragraph).toContain(phrase);
    }
  });

  it('shows the same last-updated date everywhere', () => {
    const iso = PAGE.match(/const LAST_UPDATED = '(\d{4}-\d{2}-\d{2})'/)?.[1];
    expect(iso).toBe('2026-10-28');
    const [y, m, d] = iso.split('-').map(Number);
    expect(PAGE).toContain(`Last updated: ${MONTHS[m - 1]} ${d}, ${y}`);
    expect(editorialFor('/PrivacyPolicy').modified).toBe(iso);
  });

  it('uses no dashes as punctuation', () => {
    expect(PAGE).not.toMatch(new RegExp('[\\u2013\\u2014]| -- '));
  });
});

// Weekly Gecko Notes (migration 20261018002200_weekly_notes.sql, 18 Oct
// 2026): the policy says what the weekly email is, what is kept about it,
// how to stop it and what deleting the account does. The two tables' columns
// are read from the migration, so a column added later fails here until the
// policy describes it.
const WEEKLY_SQL = readFileSync(
  new URL('../../../supabase/migrations/20261018002200_weekly_notes.sql', import.meta.url),
  'utf8',
);
const WEEKLY_ERASE_SQL = readFileSync(
  new URL('../../../supabase/migrations/20261018002300_erase_weekly_notes.sql', import.meta.url),
  'utf8',
);
const tableColumns = (sql, table) => {
  const body = sql.match(new RegExp(`create table if not exists public\\.${table} \\(([\\s\\S]*?)\\n\\);`))?.[1];
  expect(body, table).toBeTruthy();
  return body
    .split('\n')
    .map((line) => line.trim().match(/^([a-z_]+)\s/)?.[1])
    .filter((name) => name && name !== 'constraint');
};
const WEEKLY_PARAGRAPH = PAGE.match(/For Weekly Gecko Notes we keep[^<]*/)?.[0] ?? '';

describe('Privacy Policy: Weekly Gecko Notes', () => {
  it('names the weekly email, how often it comes and when it starts', () => {
    expect(PAGE).toContain('Send Weekly Gecko Notes, a short weekly email with one crested gecko care or record-keeping tip, if you have them on. They start after your first two weeks and come once a week until you stop them (in the European Economic Area and the United Kingdom, only if you turn them on; see section 8).');
  });

  it('says what is stored for it', () => {
    expect(WEEKLY_PARAGRAPH).toContain('your email address');
    expect(WEEKLY_PARAGRAPH).toContain('which email in the series we sent and when');
    expect(WEEKLY_PARAGRAPH).toContain('when we last checked whether one was due');
    // profiles.email_weekly_notes_choice_at, added by the same migration.
    expect(WEEKLY_PARAGRAPH).toContain('when you last chose to get them or not');
    expect(WEEKLY_SQL).toContain('add column if not exists email_weekly_notes_choice_at timestamptz');
  });

  it('says how to stop it, and that stopping keeps reminders', () => {
    expect(WEEKLY_PARAGRAPH).toContain('Every weekly email has a link that stops only these emails');
    expect(WEEKLY_PARAGRAPH).toContain('Settings has a switch for them');
    expect(WEEKLY_PARAGRAPH).toContain('Stopping them keeps your reminders and other email');
    // The trigger in the migration: stopping all email stops the notes for good.
    expect(WEEKLY_PARAGRAPH).toContain('Unsubscribing from all notification emails stops them too, and they stay off until you turn them back on in Settings.');
    expect(WEEKLY_SQL).toContain('create trigger profiles_weekly_notes_follow_email_off');
  });

  // The decision of 18 Oct 2026 (docs/planning/weekly-notes-2026-10.md,
  // section 1): off unless turned on in the EEA and the UK, a choice at
  // sign-up for new members, and a recorded choice never overridden.
  const CHOICE_PARAGRAPH = PAGE.match(/New members choose at sign-up[^<]*/)?.[0] ?? '';
  const LOGIN = readFileSync(new URL('../../components/auth/LoginPortal.jsx', import.meta.url), 'utf8');

  it('says new members choose at sign-up, and the sign-up form has the box', () => {
    expect(CHOICE_PARAGRAPH).toContain('New members choose at sign-up: the sign-up form has a box for Weekly Gecko Notes');
    expect(CHOICE_PARAGRAPH).toContain('we save what you chose and when, as we do each time you use the Settings switch or the stop link');
    expect(LOGIN).toContain('Send me Weekly Gecko Notes, one short crested gecko tip a week');
    expect(LOGIN).toContain('[SIGNUP_METADATA_KEY]: weeklyNotes === true');
    expect(WEEKLY_SQL).toContain("jsonb_typeof(new.raw_user_meta_data -> 'weekly_notes_at_signup') = 'boolean'");
    // The stop link records the choice too.
    expect(WEEKLY_SQL).toMatch(/set email_weekly_notes_enabled = false,\s+email_weekly_notes_choice_at = now\(\)\s+where id = v_id;/);
  });

  it('says the box starts unticked in the EEA and the UK, and the notes stay off there once we know where the member is', () => {
    expect(CHOICE_PARAGRAPH).toContain('In the European Economic Area and the United Kingdom the box starts unticked, and once we know you are there (at sign-up, or the next time you sign in from there) the notes stay off unless you turn them on.');
    // No flat promise the code cannot keep for members it has not located yet.
    expect(PAGE).not.toContain('we send them only with your consent');
    expect(CHOICE_PARAGRAPH).toContain("from the country your connection comes from and your browser's time zone");
    expect(LOGIN).toContain('useState(() => signupBoxDefault())');
  });

  it('says what happens to a member there who never chose, and that a choice is never overridden', () => {
    expect(CHOICE_PARAGRAPH).toContain('the notes are turned off for you the next time you sign in from there');
    expect(CHOICE_PARAGRAPH).toContain('until then they stay as they were, and every note has its one-click stop link');
    expect(CHOICE_PARAGRAPH).toContain('Everywhere else the box starts ticked, and the notes come until you stop them.');
    expect(CHOICE_PARAGRAPH).toContain('A choice you made is never changed because of where you are later.');
    // The database function acts only while no choice is recorded.
    const fn = WEEKLY_SQL.slice(WEEKLY_SQL.indexOf('create or replace function public.weekly_notes_region_default'));
    expect(fn).toContain('and p.email_weekly_notes_choice_at is null');
    expect(fn).toContain('where u.id = v_uid');
  });

  it('says deleting the account erases these records, and the erasure does', () => {
    expect(WEEKLY_PARAGRAPH).toContain('Deleting your account erases these records.');
    expect(WEEKLY_ERASE_SQL).toContain('delete from public.weekly_notes_sends x where x.email = v_email;');
    expect(WEEKLY_ERASE_SQL).toContain('delete from public.weekly_notes_polls x where x.email = v_email;');
  });

  // Each column the policy has to account for, and the words that do it.
  // id is the row's own random reference and holds nothing about the member.
  it('describes every column the two tables keep', () => {
    const ledger = {
      id: null,
      email: 'your email address',
      step: 'which email in the series we sent',
      slug: 'which email in the series we sent',
      created_date: 'and when',
    };
    const polls = {
      email: 'your email address',
      polled_at: 'when we last checked whether one was due',
    };
    expect(tableColumns(WEEKLY_SQL, 'weekly_notes_sends')).toEqual(['id', 'email', 'step', 'slug', 'created_date']);
    expect(tableColumns(WEEKLY_SQL, 'weekly_notes_polls')).toEqual(['email', 'polled_at']);
    expect(Object.keys(ledger)).toEqual(tableColumns(WEEKLY_SQL, 'weekly_notes_sends'));
    expect(Object.keys(polls)).toEqual(tableColumns(WEEKLY_SQL, 'weekly_notes_polls'));
    for (const phrase of [...Object.values(ledger), ...Object.values(polls)].filter(Boolean)) {
      expect(WEEKLY_PARAGRAPH).toContain(phrase);
    }
  });
});

// Review item E3 31 (16 Oct 2026): the policy has to match what the code
// now does with analytics and logs.
const PRIVACY_SQL = readFileSync(
  new URL('../../../supabase/migrations/20261016090000_privacy.sql', import.meta.url),
  'utf8',
);
const INDEX_HTML = readFileSync(new URL('../../../index.html', import.meta.url), 'utf8');

describe('Privacy Policy: analytics and log retention', () => {
  it('no longer names the Robauto pixel, and the pixel is gone from the page', () => {
    expect(PAGE).not.toMatch(/Robauto/i);
    expect(INDEX_HTML).not.toMatch(/robauto|hkeytqaukllckucnhzey|functions\/v1\/track/i);
  });

  it('says EEA and UK visitors are asked before analytics load, and how they are placed', () => {
    expect(PAGE).toMatch(/European Economic Area or the United Kingdom, Google Analytics and PostHog do not load until you choose Accept/);
    expect(PAGE).toMatch(/only says "ask" or "open"/);
    expect(PAGE).toMatch(/browser's time zone/);
    expect(PAGE).toContain('<AnalyticsChoice />');
  });

  it('says PostHog gets the account id, not the name or email', () => {
    expect(PAGE).toMatch(/PostHog receives your account's random ID, your plan and your role, not your name or email address/);
  });

  it('states the 90-day log retention the migration schedules', () => {
    expect(PAGE).toMatch(/AI crawlers are deleted after 90 days/);
    expect(PRIVACY_SQL).toMatch(/apply_privacy_retention\(90\)/);
  });

  // Review of 16 Oct 2026: section 8 used to open with "Technical logs are
  // kept for 90 days", but the first-party user_events count is kept
  // longer. The policy now names that exception; this keeps both true.
  it('names the first-party count as the exception to the 90-day schedule', () => {
    expect(PAGE).not.toMatch(/Technical logs are kept for 90 days/);
    expect(PAGE).toMatch(/Our own count of pages and features used \(section 5\) is not on this 90-day schedule/);
    expect(PRIVACY_SQL).not.toMatch(/user_events/);
  });
});

// Review of 16 Oct 2026 (blocking): the consent banner said "Nothing is
// counted unless you accept", but Geck Inspect's own count
// (src/lib/telemetry.js, public.user_events) runs before any choice and
// after Decline. The banner and the privacy switch now promise only what
// the code does, Google Analytics and PostHog staying off, and section 5
// describes the first-party count.
const BANNER = readFileSync(new URL('../../components/shared/ConsentBanner.jsx', import.meta.url), 'utf8');
const SWITCH = readFileSync(new URL('../../components/shared/AnalyticsChoice.jsx', import.meta.url), 'utf8');
const TELEMETRY = readFileSync(new URL('../telemetry.js', import.meta.url), 'utf8');
const TRACKER = readFileSync(new URL('../PostHogPageTracker.jsx', import.meta.url), 'utf8');

// The source without its comments (which explain the rule and so quote
// the old wording), with line breaks folded so JSX text reads as one line.
const visibleText = (source) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\s+/g, ' ');

describe('Consent wording matches what the code does', () => {
  it('the banner promises only that Google Analytics and PostHog stay off', () => {
    const text = visibleText(BANNER);
    expect(text).toMatch(/Google Analytics and PostHog stay off unless you accept/);
    expect(text).not.toMatch(/nothing is counted|count your visit|nothing is tracked|no tracking/i);
  });

  it('the privacy switch names Google Analytics and PostHog in every state', () => {
    const text = visibleText(SWITCH);
    expect(text).toMatch(/so Google Analytics and PostHog are off in this browser/);
    expect(text).toMatch(/Google Analytics and PostHog in this browser:/);
    expect(text).not.toMatch(/(^|\. )Analytics in this browser|analytics are off|Turn analytics off/);
  });

  it('section 5 describes the first-party count and says the choice does not cover it', () => {
    expect(PAGE).toMatch(/That choice covers Google Analytics and PostHog only\./);
    expect(PAGE).toMatch(/random code for this visit \(kept in this browser tab's session storage until the tab closes\)/);
    expect(PAGE).toMatch(/when you are signed in, your account email/);
    expect(PAGE).toMatch(/it runs whatever you choose above/);
  });

  // If the first-party count is ever gated on consent, section 5 (and the
  // banner, which could then promise more) must change with it.
  it('the first-party count really does run without reading the consent choice', () => {
    expect(TRACKER).toMatch(/trackPageView\(pageName\)/);
    expect(TELEMETRY).toMatch(/from\('user_events'\)\.insert/);
    expect(TELEMETRY).toMatch(/sessionStorage\.setItem\('geck_session_id'/);
    expect(TELEMETRY).not.toMatch(/analyticsConsent|analyticsAllowed/);
    expect(TRACKER).not.toMatch(/analyticsAllowed/);
  });
});

// Weekly Gecko Notes for visitors without an account (migration
// 20261018120000_weekly_notes_visitors.sql, 18 Oct 2026). The columns the
// migration adds to newsletter_subscribers, and the form's send log, are
// read from the migration, so one added later fails here until the policy
// describes it.
const VISITOR_SQL = readFileSync(
  new URL('../../../supabase/migrations/20261018120000_weekly_notes_visitors.sql', import.meta.url),
  'utf8',
);
const FIXES_SQL = readFileSync(
  new URL('../../../supabase/migrations/20261018150000_weekly_notes_visitor_fixes.sql', import.meta.url),
  'utf8',
);
const FIXES2_SQL = readFileSync(
  new URL('../../../supabase/migrations/20261018150100_weekly_notes_visitor_fixes_2.sql', import.meta.url),
  'utf8',
);
const FIXES3_SQL = readFileSync(
  new URL('../../../supabase/migrations/20261018150200_weekly_notes_visitor_fixes_3.sql', import.meta.url),
  'utf8',
);
const FIXES4_SQL = readFileSync(
  new URL('../../../supabase/migrations/20261018150300_weekly_notes_visitor_fixes_4.sql', import.meta.url),
  'utf8',
);
const VISITOR_PARAGRAPH = PAGE.match(/If you asked for Weekly Gecko Notes without an account[^<]*/)?.[0] ?? '';

describe('Privacy Policy: the free guides form', () => {
  const GUIDES_FN = readFileSync(new URL('../../../supabase/functions/subscribe-and-send-guides/index.ts', import.meta.url), 'utf8');
  it('says what the homepage guide form keeps, for how long, and who it never emails', () => {
    expect(PAGE).toContain('If you ask for the free Care and Genetics Guides on our homepage, we collect your email address, email you the guides and keep your address in our list of email sign-ups.');
    expect(PAGE).toContain('We keep a record of each request, with your address, a simplified form of it used to count requests to the same inbox and a scrambled form of your network address, for 30 days');
    // Both the address and its inbox key are stored (inbox_key is generated from email).
    expect(GUIDES_FN).toContain('.insert({ email, ip_hash: ipKey })');
    expect(FIXES4_SQL).toContain("delete from public.guide_email_sends where created_at < p_now - interval '30 days';");
    expect(PAGE).toContain('We do not email an address that unsubscribed or is on our do-not-email list (section 8).');
    expect(GUIDES_FN).toContain('supabase.rpc("email_inbox_suppressed", { p_email: email })');
    expect(GUIDES_FN).toContain('if (existing?.unsubscribed_at || suppressed) {');
  });
});

describe('Privacy Policy: Weekly Gecko Notes for visitors', () => {
  it('says what a visitor gives, and that nothing starts before they confirm', () => {
    expect(PAGE).toContain('If you ask for Weekly Gecko Notes on our website (a guide page or the Weekly Gecko Notes page), we collect your email address and the page you asked from. Nothing else is needed, and the notes start only after you confirm by email');
    expect(PAGE).toContain('Send Weekly Gecko Notes to visitors without an account who ask for them on our website, once they confirm by pressing the link we email them.');
    // Only the confirmation button sets confirmed_at.
    expect(VISITOR_SQL).toMatch(/update public\.newsletter_subscribers\s+set confirmed_at = p_now,/);
  });

  it('describes every column the migration adds and the send log', () => {
    const added = [...VISITOR_SQL.matchAll(/add column if not exists ([a-z_]+)/g)].map((m) => m[1]).sort();
    const wording = {
      // The confirmation link is kept only as a hash and goes with the request.
      confirm_sent_at: 'when you asked and confirmed',
      confirm_token_hash: 'If you do not confirm within 30 days of the last confirmation email, we delete the request.',
      weekly_notes_requested_at: 'when you asked and confirmed',
      weekly_notes_source: 'the page you asked from',
    };
    expect(added).toEqual(Object.keys(wording).sort());
    for (const phrase of Object.values(wording)) expect(VISITOR_PARAGRAPH).toContain(phrase);

    const log = tableColumns(VISITOR_SQL, 'weekly_notes_signup_sends');
    expect(log.sort()).toEqual(['created_at', 'email', 'id', 'ip_hash', 'kind'].sort());
    // Added by the fixes migration: the inbox key the limits count.
    expect([...FIXES_SQL.matchAll(/add column if not exists ([a-z_]+)/g)].map((m) => m[1])).toEqual(['inbox_key']);
    expect(VISITOR_PARAGRAPH).toContain('a record of each request the sign-up form received for your address (including any it answered without sending an email, for example to an address that bounced), with your address and a simplified form of it used to count requests to the same inbox (kept 30 days');
    // Quiet requests (nothing sent) are logged too, members with all email off included.
    expect(FIXES3_SQL).toMatch(/insert into public\.weekly_notes_signup_sends \(email, inbox_key, ip_hash, kind, created_at\)\s+values \(v_email, v_inbox, v_ip, v_kind, p_now\);/);
    expect(VISITOR_PARAGRAPH).toContain("If someone uses the form with your account's address, we keep the same record, even if you have turned all email off and nothing is sent.");
    expect(VISITOR_PARAGRAPH).toContain('a scrambled form of your network address with that record, never the address itself');
    expect(VISITOR_SQL).toContain("delete from public.weekly_notes_signup_sends where created_at < p_now - interval '30 days'");
    expect(FIXES_SQL).toContain("and coalesce(confirm_sent_at, weekly_notes_requested_at) < p_now - interval '30 days'");
  });

  it('says how to stop them, what stays, how to have it deleted and what joining does', () => {
    expect(VISITOR_PARAGRAPH).toContain('The link in every note stops them at once, from any device, and it also stops them if you later make an account with the same address, however it is written (with or without a plus tag, and for Gmail with or without dots), until you turn them on again in Settings.');
    // Any spelling of the inbox, and the first sign-in keeps the stop (the fourth fixes migration).
    expect(FIXES4_SQL).toContain('create or replace function public.weekly_notes_visitor_stop_at(p_email text)');
    expect(FIXES4_SQL).toContain('if public.weekly_notes_visitor_stop_at(v_email) is not null then');
    expect(PAGE).toContain('If you stopped them as a visitor before making an account, that stop stays your choice whatever the box says, until you turn them on in Settings (see below).');
    // A new profile for a stopped visitor starts with the notes off, whatever
    // the sign-up box said, and the stop is its recorded choice, so the first
    // sign-in does not save the box over it (the third fixes migration).
    expect(FIXES2_SQL).toContain('create trigger profiles_weekly_notes_visitor_stop');
    expect(FIXES3_SQL).toContain('new.email_weekly_notes_choice_at := v_stop;');
    // The stop link turns off the member switch, and the member rules skip a
    // newer visitor stop (the fixes migration).
    expect(FIXES_SQL).toMatch(/update public\.profiles\s+set email_weekly_notes_enabled = false,\s+email_weekly_notes_choice_at = now\(\)/);
    expect(FIXES_SQL).toContain('and s.unsubscribed_at >= coalesce((');
    expect(VISITOR_PARAGRAPH).toContain('we keep your address, the page and dates of your sign-up, the date you stopped, the list of notes we sent and when we last checked whether one was due');
    expect(VISITOR_PARAGRAPH).toContain('ask us at the address below and we delete all of it, along with your address in our email delivery records');
    expect(FIXES_SQL).toContain('create or replace function public.admin_erase_weekly_notes_visitor(p_email text)');
    expect(FIXES_SQL).toMatch(/update public\.email_deliveries x\s+set email = null,/);
    expect(VISITOR_PARAGRAPH).toContain('If you later make an account with the same address and keep the notes on, they carry on as a member\'s, without repeats.');
  });
});

// The relevance gate (20261020230000, extended in 20261024150000 and
// 20261024210200) and the one-time re-permission email with its record,
// weekly_notes_repermission_sends (20261024150000). The record's columns are
// read from the migration, so a column added later fails here until the
// policy describes it.
const REPERMISSION_SQL = readFileSync(
  new URL('../../../supabase/migrations/20261024150000_weekly_notes_personal_and_repermission.sql', import.meta.url),
  'utf8',
);
const ACTIVITY_SQL = readFileSync(
  new URL('../../../supabase/migrations/20261024210200_weekly_notes_activity_and_erasure.sql', import.meta.url),
  'utf8',
);

describe('Privacy Policy: when Weekly Gecko Notes pause, and the email that asks', () => {
  it('says the notes pause for an unused account and what decides it', () => {
    expect(PAGE).toContain('They pause while your account looks unused, and we then send one email asking whether you want them to keep coming (section 8).');
    expect(WEEKLY_PARAGRAPH).toContain('no gecko on record, no use of Geck Inspect in the last 60 days and no choice to get them in the last year');
    expect(ACTIVITY_SQL).toContain("m.last_active_at > p_now - interval '60 days'");
    expect(ACTIVITY_SQL).toContain("p4.email_weekly_notes_choice_at > p_now - interval '365 days'");
    // What "used Geck Inspect" is read from: the sign-in, a saved session's
    // renewal, and the member's own rows in the count of pages and features.
    expect(WEEKLY_PARAGRAPH).toContain('from your last sign-in, the last time a saved sign-in on your device was renewed and our own count of pages and features used (section 5)');
    expect(ACTIVITY_SQL).toContain('from auth.sessions s where s.user_id = p_uid');
    expect(ACTIVITY_SQL).toContain('from public.user_events e where e.user_email = p_email');
  });

  it('describes every column the re-permission record keeps', () => {
    const wording = {
      email: 'For that email we keep your address',
      created_date: 'when we sent it',
      kept_at: 'when you pressed the button to keep them',
    };
    expect(tableColumns(REPERMISSION_SQL, 'weekly_notes_repermission_sends')).toEqual(Object.keys(wording));
    for (const phrase of Object.values(wording)) expect(WEEKLY_PARAGRAPH).toContain(phrase);
    expect(WEEKLY_PARAGRAPH).toContain('once for each inbox');
    // Deleting the account erases it (the paragraph's last sentence).
    expect(WEEKLY_PARAGRAPH).toContain('Deleting your account erases these records.');
    expect(ACTIVITY_SQL).toContain('delete from public.weekly_notes_repermission_sends x');
  });
});
