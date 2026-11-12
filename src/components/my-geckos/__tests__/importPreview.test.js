import { describe, expect, it } from 'vitest';
import { importLimitNotice, previewImport } from '../csv/importPreview';

const rows = (n, extra = () => ({})) => Array.from({ length: n }, (_, i) => ({ name: `Gecko ${i + 1}`, ...extra(i) }));
const owned = (active, archived = 0) => [
  ...Array.from({ length: active }, (_, i) => ({ id: `a${i}`, gecko_id_code: `LW-${i}`, archived: false })),
  ...Array.from({ length: archived }, (_, i) => ({ id: `z${i}`, gecko_id_code: `OLD-${i}`, archived: true })),
];

describe('the import preview under a gecko limit', () => {
  it('says how many rows fit before anything is imported', () => {
    const preview = previewImport({ rows: rows(34), existingGeckos: owned(6), limit: 10 });
    expect(preview).toMatchObject({ active: 6, total: 34, newRows: 34, willAdd: 4, held: 30, willImport: 4 });
    expect(importLimitNotice(preview)).toBe(
      'Your plan holds 10 geckos and you have 6. This file has 34 rows: the first 4 will be imported.',
    );
  });

  it('does not count archived geckos toward the limit', () => {
    const preview = previewImport({ rows: rows(5), existingGeckos: owned(6, 9), limit: 10 });
    expect(preview).toMatchObject({ active: 6, willAdd: 4, held: 1 });
  });

  it('says nothing on an unlimited plan or when the file fits', () => {
    expect(importLimitNotice(previewImport({ rows: rows(500), existingGeckos: owned(120), limit: Infinity }))).toBeNull();
    expect(importLimitNotice(previewImport({ rows: rows(4), existingGeckos: owned(6), limit: 10 }))).toBeNull();
    expect(importLimitNotice(null)).toBeNull();
  });

  it('treats rows that match a gecko already held as updates, which use no slot', () => {
    const file = [...rows(3, (i) => ({ gecko_id_code: `lw-${i}` })), ...rows(5)];
    const preview = previewImport({ rows: file, existingGeckos: owned(9), limit: 10 });
    expect(preview).toMatchObject({ updates: 3, newRows: 5, willAdd: 1, held: 4, willImport: 4 });
    expect(importLimitNotice(preview)).toBe(
      'Your plan holds 10 geckos and you have 9. This file has 8 rows, 5 of them new geckos: '
      + 'only the first new one will be added, and the 3 that match geckos you already have will be updated.',
    );
    // "Create new only" skips the matches, the same as the import does.
    expect(previewImport({ rows: file, existingGeckos: owned(9), limit: 10, importMode: 'create_only' }))
      .toMatchObject({ updates: 0, willImport: 1 });
  });

  it('skips rows with no name and says so when the plan is full', () => {
    const preview = previewImport({ rows: [{ name: '' }, ...rows(2)], existingGeckos: owned(10), limit: 10 });
    expect(preview).toMatchObject({ newRows: 2, willAdd: 0, held: 2, willImport: 0 });
    expect(importLimitNotice(preview)).toBe(
      'Your plan holds 10 geckos and you have 10. This file has 3 rows, 2 of them new geckos: none of the new ones can be added.',
    );
  });

  it('counts every row as new while the Name column is not mapped yet', () => {
    const preview = previewImport({ rows: [{ name: '' }, { name: '' }, { name: '' }], existingGeckos: owned(9), limit: 10, nameMapped: false });
    expect(preview).toMatchObject({ newRows: 3, willAdd: 1, held: 2 });
  });

  it('counts a repeated new ID code once, like the import', () => {
    const file = [{ name: 'Mango', gecko_id_code: 'NEW-1' }, { name: 'Mango again', gecko_id_code: 'new-1' }];
    expect(previewImport({ rows: file, existingGeckos: owned(9), limit: 10 }))
      .toMatchObject({ newRows: 1, willAdd: 1, updates: 1, held: 0 });
  });
});
