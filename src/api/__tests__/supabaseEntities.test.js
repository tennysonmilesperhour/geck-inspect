import { describe, it, expect } from 'vitest';
import { buildInsertRecord, buildUpdateRecord, isDateColumn, parseSort } from '../supabaseEntities';

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

describe('audit columns on writes', () => {
  const now = '2026-09-29T12:00:00.000Z';

  it('adds created_date, updated_date and created_by on legacy tables', () => {
    expect(buildInsertRecord('Gecko', { name: 'Mango' }, 'a@b.co', now)).toEqual({
      name: 'Mango', created_date: now, updated_date: now, created_by: 'a@b.co',
    });
  });

  it('adds nothing a collection or its members lack (every insert failed before)', () => {
    expect(buildInsertRecord('Collection', { name: 'Holdbacks', owner_email: 'a@b.co' }, 'a@b.co', now))
      .toEqual({ name: 'Holdbacks', owner_email: 'a@b.co', updated_at: now });
    expect(buildInsertRecord('CollectionMember', { collection_id: 'c1', member_email: 'x@y.co' }, 'a@b.co', now))
      .toEqual({ collection_id: 'c1', member_email: 'x@y.co' });
  });

  it('uses the right columns for testimonials and giveaway entries', () => {
    expect(buildInsertRecord('Testimonial', { quote: 'Great' }, 'a@b.co', now)).toEqual({ quote: 'Great', updated_at: now });
    expect(buildInsertRecord('GiveawayEntry', { giveaway_id: 'g1' }, 'a@b.co', now)).toEqual({ giveaway_id: 'g1', created_date: now });
    expect(buildInsertRecord('BlogLog', { message: 'ok' }, 'a@b.co', now)).toEqual({ message: 'ok', created_date: now, created_by: 'a@b.co' });
  });

  it('sends blank dates as null (an empty due date failed every new project)', () => {
    const row = buildInsertRecord('Project', { name: 'Holdback check', due_date: '', description: '' }, 'a@b.co', now);
    expect(row.due_date).toBeNull();
    expect(row.description).toBe('');
    expect(buildUpdateRecord('Egg', { hatch_date_actual: '', status: 'Hatched' }, now).hatch_date_actual).toBeNull();
  });

  it('sends a blank vet follow-up date as null (saving a visit without one failed)', () => {
    const row = buildInsertRecord('VetRecord', { animal_id: 'g1', date: '2026-10-02', follow_up: '', reason: '' }, 'a@b.co', now);
    expect(row.follow_up).toBeNull();
    expect(row.reason).toBe('');
    expect(buildUpdateRecord('VetRecord', { follow_up: '' }, now).follow_up).toBeNull();
    expect(buildUpdateRecord('VetRecord', { follow_up: '2026-10-16' }, now).follow_up).toBe('2026-10-16');
  });

  it('knows the date columns the name pattern misses', () => {
    expect(isDateColumn('follow_up')).toBe(true);
    expect(isDateColumn('expected_return')).toBe(true);
    expect(isDateColumn('hatch_date_actual')).toBe(true);
    expect(isDateColumn('vet_name')).toBe(false);
  });

  it('keeps a caller-supplied created_date', () => {
    expect(buildInsertRecord('Gecko', { created_date: '2026-01-01' }, null, now).created_date).toBe('2026-01-01');
  });

  it('stamps the table\'s own updated column and drops undefined fields', () => {
    expect(buildUpdateRecord('Gecko', { name: 'Mango', notes: undefined }, now)).toEqual({ name: 'Mango', updated_date: now });
    expect(buildUpdateRecord('Testimonial', { approved: true }, now)).toEqual({ approved: true, updated_at: now });
    expect(buildUpdateRecord('CollectionMember', { status: 'accepted' }, now)).toEqual({ status: 'accepted' });
  });
});
