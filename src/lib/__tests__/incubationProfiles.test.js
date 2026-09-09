import { describe, expect, it } from 'vitest';
import { format } from 'date-fns';
import {
  DEFAULT_INCUBATION_PROFILE_ID,
  getEstimatedHatchDates,
  getIncubationProfile,
} from '@/lib/incubationProfiles';

describe('incubation profiles', () => {
  it('falls back to the balanced profile', () => {
    expect(getIncubationProfile('unknown').id).toBe(DEFAULT_INCUBATION_PROFILE_ID);
  });

  it('calculates the balanced hatch estimate and window from the lay date', () => {
    const dates = getEstimatedHatchDates('2026-09-01', 'balanced');
    expect(format(dates.earliest, 'yyyy-MM-dd')).toBe('2026-11-10');
    expect(format(dates.estimated, 'yyyy-MM-dd')).toBe('2026-11-20');
    expect(format(dates.latest, 'yyyy-MM-dd')).toBe('2026-11-30');
  });

  it('moves the alert earlier for warmer incubation', () => {
    expect(getIncubationProfile('warm').alertDay).toBeLessThan(
      getIncubationProfile('cool').alertDay,
    );
  });
});
