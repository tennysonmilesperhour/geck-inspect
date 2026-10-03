import { describe, it, expect } from 'vitest';
import { parseWeightNote, reptileEventWeight, reptileWeightRecords, newReptileWeightEvent } from '../reptileWeights';

describe('reptile weights', () => {
  it('parses whole and decimal grams from a note', () => {
    expect(parseWeightNote('Weight: 45g')).toBe(45);
    expect(parseWeightNote('Weight: 45.5g')).toBe(45.5);
    expect(parseWeightNote('Weight: 12,5 g')).toBe(12.5);
    expect(parseWeightNote('no weight here')).toBeNull();
    expect(parseWeightNote(null)).toBeNull();
  });

  it('prefers the stored number and skips prey weights on feedings', () => {
    expect(reptileEventWeight({ weight_grams: 61.2, notes: 'Weight: 60g' })).toBe(61.2);
    expect(reptileEventWeight({ event_type: 'feeding', notes: 'Prey: mouse, Weight: 8g' })).toBeNull();
    expect(reptileEventWeight({ event_type: 'custom', custom_event_name: 'Weight Check', notes: 'Weight: 330g' })).toBe(330);
    expect(reptileEventWeight({ event_type: 'custom', custom_event_name: 'Vet', notes: 'Weight: 330g' })).toBeNull();
  });

  it('builds chart records and new rows', () => {
    const records = reptileWeightRecords([
      { id: 'a', event_date: '2026-10-01', weight_grams: '99' },
      { id: 'b', event_date: '2026-09-01', event_type: 'feeding', notes: 'Weight: 5g' },
    ]);
    expect(records).toEqual([{ id: 'a', record_date: '2026-10-01', weight_grams: 99 }]);
    const row = newReptileWeightEvent('r1', 42, new Date('2026-10-03T00:00:00Z'));
    expect(row).toMatchObject({ reptile_id: 'r1', weight_grams: 42, notes: 'Weight: 42g', custom_event_name: 'Weight Check' });
  });
});
