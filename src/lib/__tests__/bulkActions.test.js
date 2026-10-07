import { describe, expect, it } from 'vitest';
import { matchesCategories, runBulkAction } from '../bulkActions';

describe('bulk category selection', () => {
    it('combines categories and supports morph arrays', () => {
        const gecko = { sex: 'Female', status: 'For Sale', morph_tags: ['Lilly White', 'Harlequin'] };
        expect(matchesCategories(gecko, { sex: 'Female', status: 'For Sale', morph_tags: 'Lilly White' })).toBe(true);
        expect(matchesCategories(gecko, { sex: 'Male', morph_tags: 'Lilly White' })).toBe(false);
        expect(matchesCategories(gecko, { morph_tags: 'Axanthic' })).toBe(false);
        expect(matchesCategories({}, { status: '' })).toBe(true);
    });
});

describe('bulk writes', () => {
    it('continues after a failure and reports exact IDs for retry', async () => {
        const visited = [];
        const result = await runBulkAction([{ id: 'a' }, { id: 'b' }, { id: 'c' }], async record => {
            visited.push(record.id);
            if (record.id === 'b') throw new Error('Permission denied');
        });
        expect(visited).toEqual(['a', 'b', 'c']);
        expect(result).toEqual({ succeeded: ['a', 'c'], failed: [{ id: 'b', message: 'Permission denied' }] });
    });
    it('waits for each write before starting the next', async () => {
        let active = 0;
        await runBulkAction([{ id: 1 }, { id: 2 }], async () => {
            expect(active).toBe(0);
            active += 1;
            await Promise.resolve();
            active -= 1;
        });
    });
});
