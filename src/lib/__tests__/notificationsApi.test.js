import { describe, it, expect, vi, beforeEach } from 'vitest';

const filter = vi.fn();
vi.mock('@/entities/all', () => ({ Notification: { filter: (...args) => filter(...args) } }));
vi.mock('@/lib/guestMode', () => ({ isGuestMode: () => false }));

const calls = [];
function chain(result) {
    const q = {
        update: (patch) => { calls.push(['update', patch]); return q; },
        select: (...args) => { calls.push(['select', ...args]); return q; },
        eq: (col, val) => { calls.push(['eq', col, val]); return q; },
        then: (resolve) => resolve(result),
    };
    return q;
}
let nextResult = { error: null };
vi.mock('@/lib/supabaseClient', () => ({
    supabase: { from: (table) => { calls.push(['from', table]); return chain(nextResult); } },
}));

const { fetchNotificationsPage, markAllNotificationsRead, countUnreadNotifications } = await import('../notificationsApi');

beforeEach(() => {
    filter.mockReset();
    calls.length = 0;
    nextResult = { error: null };
});

describe('fetchNotificationsPage', () => {
    it('asks for one extra row and reports whether another page exists', async () => {
        filter.mockResolvedValue([1, 2, 3].map((id) => ({ id })));
        const page = await fetchNotificationsPage('a@example.com', { limit: 2, offset: 4 });
        expect(filter).toHaveBeenCalledWith({ user_email: 'a@example.com' }, '-created_date', 3, 4);
        expect(page.rows.map((r) => r.id)).toEqual([1, 2]);
        expect(page.hasMore).toBe(true);
    });

    it('filters to unread rows when asked', async () => {
        filter.mockResolvedValue([{ id: 1 }]);
        const page = await fetchNotificationsPage('a@example.com', { limit: 2, unreadOnly: true });
        expect(filter.mock.calls[0][0]).toEqual({ user_email: 'a@example.com', is_read: false });
        expect(page.hasMore).toBe(false);
    });
});

describe('markAllNotificationsRead', () => {
    it('sends a single update scoped to the member and to unread rows', async () => {
        await markAllNotificationsRead('a@example.com');
        expect(calls[0]).toEqual(['from', 'notifications']);
        expect(calls[1][0]).toBe('update');
        expect(calls[1][1].is_read).toBe(true);
        expect(calls).toContainEqual(['eq', 'user_email', 'a@example.com']);
        expect(calls).toContainEqual(['eq', 'is_read', false]);
    });

    it('throws when the update fails', async () => {
        nextResult = { error: new Error('nope') };
        await expect(markAllNotificationsRead('a@example.com')).rejects.toThrow('nope');
    });
});

describe('countUnreadNotifications', () => {
    it('uses a head count instead of loading rows', async () => {
        nextResult = { count: 7, error: null };
        expect(await countUnreadNotifications('a@example.com')).toBe(7);
        expect(calls).toContainEqual(['select', 'id', { count: 'exact', head: true }]);
    });
});
