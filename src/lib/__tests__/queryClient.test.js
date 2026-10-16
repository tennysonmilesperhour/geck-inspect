import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import { invalidateCollectionCaches } from '@/lib/query-client';

// 'geckos_changed' (a gecko added, imported, hatched or edited) marks every
// cached copy of the collection out of date, so the next screen to show it
// asks again. Field Mode keeps the app's two-minute default, so it relies
// on this alone; Today, the Log tab and /log also ask on every open.
describe('invalidateCollectionCaches', () => {
  it('marks the Dashboard counts and the phone screens\' collection copy out of date', () => {
    const client = new QueryClient();
    const keys = [
      ['dashboard', 'personal', 'sam@example.com'],
      ['dashboard', 'hatchery', 'sam@example.com'],
      ['field-mode', 'sam@example.com'],
    ];
    for (const key of keys) client.setQueryData(key, []);
    client.setQueryData(['market-brief'], {});

    invalidateCollectionCaches(client);

    for (const key of keys) expect(client.getQueryState(key).isInvalidated).toBe(true);
    // Nothing else is asked for again.
    expect(client.getQueryState(['market-brief']).isInvalidated).toBe(false);
  });
});
