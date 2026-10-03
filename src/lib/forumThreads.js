/**
 * Arrange a forum thread's comments for display.
 *
 * When a comment is deleted its replies stay in the database. They used to
 * vanish from the page (their parent was gone) while the comment count
 * still included them. Now a reply whose parent is gone is shown at the top
 * level with a note, so every counted comment is one the reader can see.
 *
 * @param {Array<{id: string, parent_comment_id?: string|null}>} comments
 * @param {(comment: object) => boolean} [isHidden] comments to leave out
 *   entirely (for example, from an author the reader blocked)
 * @returns {{ topLevel: object[], replies: Record<string, object[]>, orphanIds: Set<string>, visibleCount: number }}
 */
export function arrangeForumComments(comments, isHidden = () => false) {
    const list = (comments || []).filter((c) => c && !isHidden(c));
    const ids = new Set((comments || []).map((c) => c?.id));
    const visibleIds = new Set(list.map((c) => c.id));
    const topLevel = [];
    const replies = {};
    const orphanIds = new Set();
    for (const c of list) {
        const parent = c.parent_comment_id;
        if (!parent) {
            topLevel.push(c);
        } else if (!ids.has(parent)) {
            // Parent deleted: show this reply on its own.
            orphanIds.add(c.id);
            topLevel.push(c);
        } else if (visibleIds.has(parent)) {
            (replies[parent] ||= []).push(c);
        }
        // A reply under a hidden (blocked) comment stays hidden with it.
    }
    // Count only what is rendered: top-level items and replies reachable
    // from them.
    let visibleCount = 0;
    const walk = (c) => {
        visibleCount += 1;
        for (const r of replies[c.id] || []) walk(r);
    };
    topLevel.forEach(walk);
    return { topLevel, replies, orphanIds, visibleCount };
}
