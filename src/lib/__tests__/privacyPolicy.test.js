import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { editorialFor } from '@/lib/editorial';

// The Privacy Policy has to say what account deletion does to the email
// records added in October 2026 (migration 20261015151600_erase_email_logs):
// the delivery log loses the address, and email_suppressions keeps
// addresses that bounced or reported spam, on purpose.
const PAGE = readFileSync(new URL('../../pages/PrivacyPolicy.jsx', import.meta.url), 'utf8');
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
