import { describe, expect, it, vi } from 'vitest';

vi.mock('@/entities/all', () => ({}));

const { rosterCSV, withParentNames } = await import('../exportUtils');

const sire = { id: 's1', name: 'Mango', gecko_id_code: 'MG01', sex: 'Male', archived: true };
const dam = { id: 'd1', name: 'Pip', sex: 'Female' };
const hatchling = {
  id: 'h1', name: 'Mango x Pip #1', sex: 'Unsexed', hatch_date: '2025-03-04',
  sire_id: 's1', dam_id: 'd1', morph_tags: ['Harlequin', 'Tricolor'],
};

describe('roster export', () => {
  it('names linked parents from the collection, archived ones included', () => {
    const [row] = withParentNames([hatchling], [sire, dam, hatchling]);
    expect(row.sire_name).toBe('Mango');
    expect(row.dam_name).toBe('Pip');
  });

  it('keeps a typed parent name when the parent is not in the collection', () => {
    const [row] = withParentNames([{ id: 'x', sire_id: 'gone', sire_name: 'Outside sire' }], []);
    expect(row.sire_name).toBe('Outside sire');
  });

  it('writes the hatch date as stored, with no timezone shift', () => {
    const csv = rosterCSV([hatchling], { collection: [sire, dam, hatchling] });
    const [, line] = csv.replace('﻿', '').split('\r\n');
    expect(line).toContain('2025-03-04');
    expect(line).toContain('Mango,Pip');
    expect(line).toContain('"Harlequin, Tricolor"');
  });

  it('neutralises spreadsheet formulas in text cells', () => {
    const csv = rosterCSV([{ id: 'z', name: '=HYPERLINK("x")' }]);
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
  });
});
