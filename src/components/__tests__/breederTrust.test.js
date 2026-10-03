import { describe, expect, it, vi } from 'vitest';

vi.hoisted(() => { globalThis.window = globalThis.window || { self: 1, top: 1 }; });
vi.mock('@/lib/supabaseClient', () => ({ supabase: {} }));
vi.mock('@/lib/AuthContext', () => ({ useAuth: () => ({}) }));

import { inquiryStatus, replyHref } from '../marketplace/InquiriesInbox';
import { checklistComplete, VERIFICATION_CHECKLIST } from '../admin/BreederVerification';
import { PUBLIC_REVIEW_COLUMNS } from '../breeder/BreederReviews';

describe('breeder verification checklist', () => {
  it('needs every item ticked', () => {
    const all = Object.fromEntries(VERIFICATION_CHECKLIST.map((i) => [i.key, true]));
    expect(checklistComplete(all)).toBe(true);
    expect(checklistComplete({ ...all, policies: false })).toBe(false);
    expect(checklistComplete({})).toBe(false);
    expect(checklistComplete(null)).toBe(false);
  });
  it('uses the keys the database checks', () => {
    expect(VERIFICATION_CHECKLIST.map((i) => i.key)).toEqual(
      ['identity', 'own_animals', 'sales_record', 'policies', 'clean_record'],
    );
  });
});

describe('public reviews', () => {
  it('never reads the reviewer email column', () => {
    expect(PUBLIC_REVIEW_COLUMNS).not.toMatch(/created_by|reviewer/);
  });
});

describe('inquiries inbox', () => {
  it('derives the status from the timestamps', () => {
    expect(inquiryStatus({ status: 'new' })).toBe('new');
    expect(inquiryStatus({ status: 'new', read_at: '2026-10-01' })).toBe('read');
    expect(inquiryStatus({ status: 'read', replied_at: '2026-10-02' })).toBe('replied');
  });
  it('builds a reply email to the buyer with the message quoted', () => {
    const href = replyHref({ buyer_email: 'buyer@example.com', buyer_name: 'Sam', gecko_name: 'Lilly White female', message: 'Is she available?' });
    expect(href.startsWith('mailto:buyer%40example.com?subject=')).toBe(true);
    expect(decodeURIComponent(href)).toContain('Re: your inquiry about Lilly White female');
    expect(decodeURIComponent(href)).toContain('> Is she available?');
  });
});
