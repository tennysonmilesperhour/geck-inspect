import { describe, it, expect } from 'vitest';
import { parseSort } from '../supabaseEntities';

describe('parseSort default column by table', () => {
  it('defaults created_date-convention tables to created_date desc', () => {
    expect(parseSort(null, 'Gecko')).toEqual([{ column: 'created_date', ascending: false }]);
    expect(parseSort(null, 'BreedingPlan')).toEqual([{ column: 'created_date', ascending: false }]);
  });

  it('defaults created_at tables to created_at desc, not created_date', () => {
    expect(parseSort(null, 'Collection')).toEqual([{ column: 'created_at', ascending: false }]);
    expect(parseSort(null, 'Testimonial')).toEqual([{ column: 'created_at', ascending: false }]);
  });

  it('applies no default sort to tables with no timestamp column', () => {
    // These 400'd before: default created_date on a table that lacks it.
    expect(parseSort(null, 'CollectionMember')).toEqual([]);
    expect(parseSort(null, 'AppSettings')).toEqual([]);
    expect(parseSort(null, 'SocialPostPhotoUsage')).toEqual([]);
  });

  it('treats an unknown entity as a created_date table', () => {
    expect(parseSort(null, 'SomethingNew')).toEqual([{ column: 'created_date', ascending: false }]);
  });
});

describe('parseSort explicit sorts', () => {
  it('parses ascending and descending prefixes', () => {
    expect(parseSort('name', 'Gecko')).toEqual([{ column: 'name', ascending: true }]);
    expect(parseSort('-created_date', 'Gecko')).toEqual([{ column: 'created_date', ascending: false }]);
  });

  it('supports comma-separated multi-column sorts', () => {
    expect(parseSort('-created_date,name', 'Gecko')).toEqual([
      { column: 'created_date', ascending: false },
      { column: 'name', ascending: true },
    ]);
  });

  it('remaps an explicit created_date sort to created_at on created_at tables', () => {
    expect(parseSort('-created_date', 'Collection')).toEqual([{ column: 'created_at', ascending: false }]);
  });

  it('drops an explicit created_date sort on tables with no timestamp column', () => {
    // sort_order still applies; the impossible created_date column is dropped.
    expect(parseSort('created_date,sort_order', 'CollectionMember')).toEqual([
      { column: 'sort_order', ascending: true },
    ]);
    expect(parseSort('created_date', 'CollectionMember')).toEqual([]);
  });

  it('leaves non-created_date explicit columns untouched everywhere', () => {
    expect(parseSort('sort_order', 'Testimonial')).toEqual([{ column: 'sort_order', ascending: true }]);
    expect(parseSort('invited_at', 'CollectionMember')).toEqual([{ column: 'invited_at', ascending: true }]);
  });
});
