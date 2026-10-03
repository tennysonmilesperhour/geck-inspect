import { describe, it, expect, vi } from 'vitest';

vi.mock('@/entities/all', () => ({ SupportMessage: { filter: vi.fn() } }));
vi.mock('@/lib/supabaseClient', () => ({ supabase: {} }));

const { memberFacingBody, memberFacingSubject, supportReplyNotificationContent } = await import('../supportTickets');

const report = {
    subject: 'Content report: forum_comment',
    body: 'Reason: Selling a sick Lilly White\nEntity: forum_comment\nRecord: abc\nAuthor: someone@example.com\nExcerpt: hi',
};

describe('member-facing ticket text', () => {
    it('shows only the reason of a content report, never the reported author', () => {
        expect(memberFacingBody(report)).toBe('Selling a sick Lilly White');
        expect(memberFacingBody(report)).not.toContain('@');
    });

    it('names a content report in plain words', () => {
        expect(memberFacingSubject(report)).toBe('Your report about a forum comment');
    });

    it('keeps an ordinary message as written', () => {
        const msg = { subject: 'Billing question', body: 'Can I switch to yearly?' };
        expect(memberFacingSubject(msg)).toBe('Billing question');
        expect(memberFacingBody(msg)).toBe('Can I switch to yearly?');
    });

    it('builds a short notification', () => {
        const text = supportReplyNotificationContent({ subject: 'Billing question' }, 'x'.repeat(300));
        expect(text.startsWith('Geck Inspect support replied to "Billing question": ')).toBe(true);
        expect(text.length).toBeLessThan(220);
    });
});
