import { describe, it, expect } from 'vitest';
import { currentSeasonYear, eggSeasonYear, planSeasonYear, seasonYearOf } from '../seasons';
import { summarizeBreedingHistory } from '../breedingHistoryUtils';

describe('D17: a breeding season is the calendar year', () => {
  it('reads a stored plain year first', () => {
    expect(planSeasonYear({ breeding_season: '2026', pairing_date: '2025-12-30' })).toBe(2026);
  });

  it('uses the pairing date before an old quarter label', () => {
    // An old December plan was labelled with NEXT year's winter.
    expect(planSeasonYear({ breeding_season: '2027 Winter', pairing_date: '2026-12-15' })).toBe(2026);
  });

  it('falls back to the label year, then the creation year', () => {
    expect(planSeasonYear({ breeding_season: '2025 Spring' })).toBe(2025);
    expect(planSeasonYear({ created_date: '2024-05-02T10:00:00Z' })).toBe(2024);
    expect(planSeasonYear(null)).toBeNull();
  });

  it('counts a hatched egg in the year it hatched, others in the year laid', () => {
    expect(eggSeasonYear({ status: 'Hatched', lay_date: '2026-11-20', hatch_date_actual: '2027-01-25' })).toBe(2027);
    expect(eggSeasonYear({ status: 'Slug', lay_date: '2026-11-20' })).toBe(2026);
  });

  it('reads a date string without time zone drift', () => {
    expect(seasonYearOf('2027-01-01')).toBe(2027);
    expect(currentSeasonYear(new Date(2026, 0, 1))).toBe(2026);
  });

  it('groups a female\'s breeding history by calendar year', () => {
    const rows = summarizeBreedingHistory({
      eggs: [
        { lay_date: '2026-03-10', status: 'Hatched' },
        { lay_date: '2026-11-02', status: 'Infertile' },
        { lay_date: '2025-06-01', status: 'Hatched' },
      ],
      breedingPlans: [{ id: 'p', breeding_season: '2026 Spring' }],
    });
    expect(rows.map((r) => r.seasonLabel)).toEqual(['2025', '2026']);
    expect(rows[1]).toMatchObject({ year: 2026, eggsLaid: 2, hatched: 1, infertile: 1, seasonNumber: 2 });
  });
});
