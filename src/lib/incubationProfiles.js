import { addDays } from 'date-fns';
import { parseLocalDate } from '@/lib/dateUtils';
import { INCUBATION_PROFILES as FACT_PROFILES } from '@/data/husbandry-facts';

export const DEFAULT_INCUBATION_PROFILE_ID = 'balanced';

// The temperature ranges and day counts live in src/data/husbandry-facts.js
// so the care guide's incubation table and the app's hatch estimates are
// the same numbers. Before October 2026 the guide said 60 to 90 days at 72
// to 76°F while the app estimated 70 to 90 days at 72 to 75°F.
export const INCUBATION_PROFILES = FACT_PROFILES;

export function getIncubationProfile(profileId) {
  return INCUBATION_PROFILES.find((profile) => profile.id === profileId)
    || INCUBATION_PROFILES.find((profile) => profile.id === DEFAULT_INCUBATION_PROFILE_ID);
}

export function getEstimatedHatchDates(layDate, profileId) {
  const start = parseLocalDate(layDate);
  if (!start) return null;
  const profile = getIncubationProfile(profileId);
  return {
    earliest: addDays(start, profile.minDays),
    estimated: addDays(start, profile.estimatedDays),
    latest: addDays(start, profile.maxDays),
  };
}
