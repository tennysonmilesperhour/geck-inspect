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
        or: (expr) => { calls.push(['or', expr]); return q; },
        then: (resolve) => resolve(result),
    };
    return q;
}
let nextResult = { error: null };
vi.mock('@/lib/supabaseClient', () => ({
    supabase: { from: (table) => { calls.push(['from', table]); return chain(nextResult); } },
}));

const {
    NOT_QUIET_FILTER,
    countUnreadNotifications,
    fetchNotificationsPage,
    hatchAlertedEggIds,
    isQuietNotification,
    markAllNotificationsRead,
} = await import('../notificationsApi');
const { applyFilter } = await import('@/api/supabaseEntities');

beforeEach(() => {
    filter.mockReset();
    calls.length = 0;
    nextResult = { error: null };
});

const NOT_QUIET = { $or: [{ 'metadata->>quiet': null }, { 'metadata->>quiet': { $ne: 'true' } }] };

describe('fetchNotificationsPage', () => {
    it('asks for one extra row and reports whether another page exists', async () => {
        filter.mockResolvedValue([1, 2, 3].map((id) => ({ id })));
        const page = await fetchNotificationsPage('a@example.com', { limit: 2, offset: 4 });
        expect(filter).toHaveBeenCalledWith({ user_email: 'a@example.com', ...NOT_QUIET }, '-created_date', 3, 4);
        expect(page.rows.map((r) => r.id)).toEqual([1, 2]);
        expect(page.hasMore).toBe(true);
    });

    it('filters to unread rows when asked', async () => {
        filter.mockResolvedValue([{ id: 1 }]);
        const page = await fetchNotificationsPage('a@example.com', { limit: 2, unreadOnly: true });
        expect(filter.mock.calls[0][0]).toEqual({ user_email: 'a@example.com', ...NOT_QUIET, is_read: false });
        expect(page.hasMore).toBe(false);
    });

    it('leaves out the quiet hatch alert rows the nightly job keeps for each egg', async () => {
        filter.mockResolvedValue([
            { id: 'sent', type: 'hatch_alert', metadata: { egg_id: 'e1', egg_ids: ['e1', 'e2'] } },
            { id: 'quiet', type: 'hatch_alert', metadata: { egg_id: 'e2', quiet: true, grouped_in: 'e1' } },
            { id: 'msg', type: 'new_message', metadata: null },
        ]);
        const page = await fetchNotificationsPage('a@example.com', { limit: 10 });
        // Asked of the server, and checked again here.
        expect(filter.mock.calls[0][0].$or).toEqual(NOT_QUIET.$or);
        expect(page.rows.map((r) => r.id)).toEqual(['sent', 'msg']);
    });
});

describe('quiet rows', () => {
    it('knows a quiet row', () => {
        expect(isQuietNotification({ metadata: { quiet: true } })).toBe(true);
        expect(isQuietNotification({ metadata: { quiet: 'true' } })).toBe(true);
        expect(isQuietNotification({ metadata: { quiet: false } })).toBe(false);
        expect(isQuietNotification({ metadata: null })).toBe(false);
        expect(isQuietNotification(null)).toBe(false);
    });

    it('becomes a PostgREST "or" that keeps rows with no quiet flag', () => {
        const ops = [];
        const q = new Proxy({}, { get: (_t, op) => (...args) => { ops.push([op, ...args]); return q; } });
        applyFilter(q, { user_email: 'a@example.com', is_read: false, ...NOT_QUIET_FILTER });
        expect(ops).toEqual([
            ['eq', 'user_email', 'a@example.com'],
            ['eq', 'is_read', false],
            ['or', 'metadata->>quiet.is.null,metadata->>quiet.neq.true'],
        ]);
    });

    it('keeps every row of the demo inbox', async () => {
        const { GUEST_EMAIL, guestMockFilter } = await import('@/lib/guestMockData');
        const all = await guestMockFilter('Notification', { user_email: GUEST_EMAIL });
        const shown = await guestMockFilter('Notification', { user_email: GUEST_EMAIL, ...NOT_QUIET_FILTER });
        expect(all.length).toBeGreaterThan(0);
        expect(shown).toHaveLength(all.length);
    });
});

describe('hatchAlertedEggIds', () => {
    const now = Date.parse('2026-10-20T12:00:00Z');
    const since = now - 7 * 24 * 60 * 60 * 1000;

    it('counts the egg each row names and every egg the grouped alert lists', () => {
        const ids = hatchAlertedEggIds([
            { created_date: '2026-10-20T06:00:00Z', metadata: { egg_id: 'e1', egg_ids: ['e1', 'e2', 'e3'], count: 3 } },
            { created_date: '2026-10-19T06:00:00Z', metadata: { egg_id: 'e4', quiet: true, grouped_in: 'e1' } },
            { created_date: '2026-10-18T06:00:00Z', metadata: { egg_id: 'e5' } },
        ], since);
        expect([...ids].sort()).toEqual(['e1', 'e2', 'e3', 'e4', 'e5']);
    });

    it('ignores rows older than the cutoff and junk ids', () => {
        const ids = hatchAlertedEggIds([
            { created_date: '2026-10-12T06:00:00Z', metadata: { egg_id: 'old', egg_ids: ['old2'] } },
            { created_date: 'not a date', metadata: { egg_id: 'bad-date' } },
            { created_date: '2026-10-20T06:00:00Z', metadata: { egg_ids: [null, 7, '', 'ok'] } },
            { created_date: '2026-10-20T06:00:00Z', metadata: null },
        ], since);
        expect([...ids]).toEqual(['ok']);
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

    it('does not count quiet rows', async () => {
        nextResult = { count: 2, error: null };
        await countUnreadNotifications('a@example.com');
        expect(calls).toContainEqual(['or', 'metadata->>quiet.is.null,metadata->>quiet.neq.true']);
    });
});
