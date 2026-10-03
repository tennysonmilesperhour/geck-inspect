import { describe, expect, it, vi } from 'vitest';

vi.hoisted(() => { globalThis.window = globalThis.window || { self: 1, top: 1 }; });
vi.mock('@/lib/supabaseClient', () => ({ supabase: {} }));

import { buildPlanFromFuturePlan, computeSeasonWindow } from '../seasons';
import { legacyNotesToRows, readLegacyNotes } from '@/components/project-manager/StickyNotes';

const sire = { id: 'sire-1', name: 'Mango', gecko_id_code: 'TT-01' };
const dam = { id: 'dam-1', name: 'Cappuccino girl', gecko_id_code: 'TT-02' };

describe('Start this pairing', () => {
  it('builds a planned breeding plan from a future plan', () => {
    const row = buildPlanFromFuturePlan(
      { target_season: 'spring', target_year: 2027, goals: 'Lilly White x Cappuccino', notes: 'Weigh her first' },
      sire, dam, new Date(2027, 2, 4),
    );
    expect(row).toEqual({
      sire_id: 'sire-1',
      dam_id: 'dam-1',
      breeding_id: 'TT-01xTT-02',
      pairing_date: '2027-03-04',
      status: 'Planned',
      breeding_season: '2027',
      notes: 'Goals: Lilly White x Cappuccino\n\nWeigh her first',
    });
  });
  it('falls back to the current season and placeholder codes', () => {
    const row = buildPlanFromFuturePlan({}, { id: 's' }, { id: 'd' }, new Date(2026, 9, 3));
    expect(row.breeding_season).toBe('2026');
    expect(row.breeding_id).toBe('UNKxUNK');
    expect(row.notes).toBe('');
  });
});

describe('season windows match the server', () => {
  it('uses the same dates as season_window_start and season_window_end', () => {
    // Mirrors supabase/migrations/20261003031932_season_planner_server_reminders.sql
    const w = computeSeasonWindow('winter', 2027);
    expect([w.start.getFullYear(), w.start.getMonth(), w.start.getDate()]).toEqual([2026, 11, 1]);
    expect([w.end.getFullYear(), w.end.getMonth(), w.end.getDate()]).toEqual([2027, 1, 28]);
    const f = computeSeasonWindow('fall', 2026);
    expect([f.start.getMonth(), f.start.getDate(), f.end.getMonth(), f.end.getDate()]).toEqual([8, 1, 10, 30]);
  });
});

describe('notes from the old browser-only version', () => {
  it('reads the shared key and turns it into rows, oldest first', () => {
    const storage = {
      getItem: () => JSON.stringify([
        { id: '2', title: 'Second', body: 'b', color: 'Blue', created_at: '2026-05-02T00:00:00Z' },
        { id: '1', title: '', body: 'first', created_at: '2026-05-01T00:00:00Z' },
        { id: '3' },
      ]),
    };
    const notes = readLegacyNotes(storage);
    expect(notes).toHaveLength(2);
    expect(legacyNotesToRows(notes)).toEqual([
      { title: 'Note', body: 'first', color: 'Yellow', created_at: '2026-05-01T00:00:00Z' },
      { title: 'Second', body: 'b', color: 'Blue', created_at: '2026-05-02T00:00:00Z' },
    ]);
  });
  it('ignores damaged storage', () => {
    expect(readLegacyNotes({ getItem: () => 'not json' })).toEqual([]);
    expect(readLegacyNotes(null)).toEqual([]);
  });
});
