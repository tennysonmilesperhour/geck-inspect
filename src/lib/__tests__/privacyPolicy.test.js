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
    expect(iso).toBe('2026-10-15');
    const [y, m, d] = iso.split('-').map(Number);
    expect(PAGE).toContain(`Last updated: ${MONTHS[m - 1]} ${d}, ${y}`);
    expect(editorialFor('/PrivacyPolicy').modified).toBe(iso);
  });

  it('uses no dashes as punctuation', () => {
    expect(PAGE).not.toMatch(new RegExp('[\\u2013\\u2014]| -- '));
  });
});
