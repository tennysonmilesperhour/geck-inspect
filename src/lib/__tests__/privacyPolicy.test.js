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
    expect(iso).toBe('2026-10-18');
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
    expect(PAGE).toMatch(/Send Weekly Gecko Notes, a short weekly email with one crested gecko care or record-keeping tip\. It starts after your first two weeks and comes once a week until you stop it\./);
  });

  it('says what is stored for it', () => {
    expect(WEEKLY_PARAGRAPH).toContain('your email address');
    expect(WEEKLY_PARAGRAPH).toContain('which email in the series we sent and when');
    expect(WEEKLY_PARAGRAPH).toContain('when we last checked whether one was due');
  });

  it('says how to stop it, and that stopping keeps reminders', () => {
    expect(WEEKLY_PARAGRAPH).toContain('Every weekly email has a link that stops only these emails');
    expect(WEEKLY_PARAGRAPH).toContain('Settings has a switch for them');
    expect(WEEKLY_PARAGRAPH).toContain('Stopping them keeps your reminders and other email');
    // The trigger in the migration: stopping all email stops the notes for good.
    expect(WEEKLY_PARAGRAPH).toContain('Unsubscribing from all notification emails stops them too, and they stay off until you turn them back on in Settings.');
    expect(WEEKLY_SQL).toContain('create trigger profiles_weekly_notes_follow_email_off');
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
