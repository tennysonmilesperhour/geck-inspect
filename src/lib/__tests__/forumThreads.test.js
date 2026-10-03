import { describe, expect, it } from 'vitest';
import { arrangeForumComments } from '../forumThreads';

describe('arrangeForumComments', () => {
    it('nests replies under their parent and counts everything', () => {
        const r = arrangeForumComments([
            { id: 'a' },
            { id: 'b', parent_comment_id: 'a' },
            { id: 'c', parent_comment_id: 'b' },
        ]);
        expect(r.topLevel.map((c) => c.id)).toEqual(['a']);
        expect(r.replies.a.map((c) => c.id)).toEqual(['b']);
        expect(r.replies.b.map((c) => c.id)).toEqual(['c']);
        expect(r.visibleCount).toBe(3);
    });

    it('shows replies to a deleted comment at the top level and counts them', () => {
        const r = arrangeForumComments([
            { id: 'b', parent_comment_id: 'gone' },
            { id: 'c', parent_comment_id: 'b' },
        ]);
        expect(r.topLevel.map((c) => c.id)).toEqual(['b']);
        expect(r.orphanIds.has('b')).toBe(true);
        expect(r.visibleCount).toBe(2);
    });

    it('leaves out hidden comments and the replies under them', () => {
        const r = arrangeForumComments(
            [
                { id: 'a', created_by: 'blocked' },
                { id: 'b', parent_comment_id: 'a' },
                { id: 'c' },
            ],
            (c) => c.created_by === 'blocked'
        );
        expect(r.topLevel.map((c) => c.id)).toEqual(['c']);
        expect(r.visibleCount).toBe(1);
    });
});
