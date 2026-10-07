/** Filters combine with AND; array categories match any contained value. */
export function matchesCategories(record, categories) {
    return Object.entries(categories).every(([key, value]) => {
        if (!value) return true;
        const actual = record[key];
        return Array.isArray(actual) ? actual.map(String).includes(value) : String(actual ?? '') === value;
    });
}

/** Process sequentially to respect API limits and preserve dependent hatch IDs. */
export async function runBulkAction(records, action) {
    const succeeded = [];
    const failed = [];
    for (const record of records) {
        try {
            await action(record);
            succeeded.push(record.id);
        } catch (error) {
            failed.push({ id: record.id, message: error?.message || 'Could not save this record.' });
        }
    }
    return { succeeded, failed };
}
