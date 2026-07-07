import { describe, it, expect } from 'vitest';
import {
  computeSeasonWindow,
  seasonStatus,
  inferSeasonLabel,
  currentSeasonLabel,
  parseSeasonLabel,
  compareSeasonLabels,
} from '../seasons';

describe('the winter rule: a season label round-trips through seasonStatus', () => {
  // For a date in every month of the year, the season inferred FROM that
  // date must report status 'active' AT that date. This is the exact
  // contradiction that used to exist: Jan dates labeled "<year> Winter"
  // while the winter window started the following December.
  const days = [
    '2026-01-15', '2026-02-15', '2026-03-15', '2026-04-15',
    '2026-05-15', '2026-06-15', '2026-07-15', '2026-08-15',
    '2026-09-15', '2026-10-15', '2026-11-15', '2026-12-15',
  ];
  for (const day of days) {
    it(`round-trips ${day}`, () => {
      const date = new Date(`${day}T12:00:00`);
      const label = inferSeasonLabel(date);
      const { year, season } = parseSeasonLabel(label);
      expect(seasonStatus(season.toLowerCase(), year, date)).toBe('active');
    });
  }
});

describe('winter anchoring', () => {
  it('labels December with the NEXT year (Dec 2026 is part of 2027 Winter)', () => {
    expect(inferSeasonLabel(new Date(2026, 11, 20))).toBe('2027 Winter');
  });

  it('labels January and February with their own year', () => {
    expect(inferSeasonLabel(new Date(2027, 0, 5))).toBe('2027 Winter');
    expect(inferSeasonLabel(new Date(2027, 1, 28))).toBe('2027 Winter');
  });

  it('gives December and the following January the same season label', () => {
    expect(inferSeasonLabel(new Date(2026, 11, 31))).toBe(
      inferSeasonLabel(new Date(2027, 0, 1)),
    );
  });

  it('computes the winter window as Dec 1 (Y-1) through end of Feb (Y)', () => {
    const w = computeSeasonWindow('winter', 2027);
    expect(w.start).toEqual(new Date(2026, 11, 1));
    expect(w.end.getFullYear()).toBe(2027);
    expect(w.end.getMonth()).toBe(1); // February
    expect(w.end.getDate()).toBe(28); // 2027 is not a leap year
  });

  it('handles leap-year February ends', () => {
    const w = computeSeasonWindow('winter', 2028);
    expect(w.end.getDate()).toBe(29); // 2028 is a leap year
  });

  it('reports a January date as active for its own winter, not future', () => {
    const jan = new Date(2027, 0, 20);
    expect(seasonStatus('winter', 2027, jan)).toBe('active');
    expect(seasonStatus('winter', 2028, jan)).toBe('future');
    expect(seasonStatus('winter', 2026, jan)).toBe('past');
  });
});

describe('non-winter seasons are unchanged', () => {
  it('spring window is Mar 1 through May 31 of the same year', () => {
    const w = computeSeasonWindow('spring', 2026);
    expect(w.start).toEqual(new Date(2026, 2, 1));
    expect(w.end.getMonth()).toBe(4);
    expect(w.end.getDate()).toBe(31);
  });

  it('status transitions work for summer', () => {
    expect(seasonStatus('summer', 2026, new Date(2026, 3, 1))).toBe('future');
    expect(seasonStatus('summer', 2026, new Date(2026, 6, 1))).toBe('active');
    expect(seasonStatus('summer', 2026, new Date(2026, 9, 1))).toBe('past');
  });
});

describe('label ordering stays chronological under the winter rule', () => {
  it('sorts a year as Winter (ends Feb) then Spring then Summer then Fall', () => {
    const labels = ['2026 Fall', '2026 Winter', '2026 Summer', '2026 Spring'];
    labels.sort(compareSeasonLabels);
    expect(labels).toEqual(['2026 Winter', '2026 Spring', '2026 Summer', '2026 Fall']);
  });

  it('currentSeasonLabel agrees with inferSeasonLabel', () => {
    const now = new Date(2026, 11, 10);
    expect(currentSeasonLabel(now)).toBe(inferSeasonLabel(now));
  });
});
