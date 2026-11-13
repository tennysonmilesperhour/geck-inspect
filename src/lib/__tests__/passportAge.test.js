import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { calculateAge } from '@/lib/passportUtils';

// The passport's Age chip for a gecko with only a hatch year (owner
// decision E13): whole years at best, never "Hatchling" for a gecko that
// may be ten months old.
describe('calculateAge with a hatch year alone', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 13, 12));
  });
  afterEach(() => vi.useRealTimers());

  it('says under a year for this year', () => {
    expect(calculateAge(null, 2026)).toBe('Under 1 year');
  });

  it('counts whole years for earlier years', () => {
    expect(calculateAge(null, 2025)).toBe('~1 year');
    expect(calculateAge(null, 2022)).toBe('~4 years');
    expect(calculateAge(undefined, '2024')).toBe('~2 years');
  });

  it('says unknown for a year still to come, or none', () => {
    expect(calculateAge(null, 2027)).toBe('Unknown');
    expect(calculateAge(null, null)).toBe('Unknown');
  });

  it('prefers a whole hatch date', () => {
    expect(calculateAge('2026-11-10', 2020)).toBe('Hatchling');
    expect(calculateAge('2025-11-01', 2020)).toBe('1 year');
  });
});
