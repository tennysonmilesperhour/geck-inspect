import { addDays } from 'date-fns';
import { parseLocalDate } from '@/lib/dateUtils';

export const DEFAULT_INCUBATION_PROFILE_ID = 'balanced';

export const INCUBATION_PROFILES = [
  {
    id: 'cool',
    label: 'Cool and steady',
    fahrenheit: '68 to 71°F',
    celsius: '20 to 22°C',
    minDays: 90,
    maxDays: 120,
    estimatedDays: 105,
    alertDay: 85,
    summary: 'A slower incubation timeline with more time for development.',
    breederNote: 'Breeders often choose this range when they prefer a slower incubation. Hatchlings may emerge later, so steady conditions and patience matter.',
  },
  {
    id: 'balanced',
    label: 'Balanced room temperature',
    fahrenheit: '72 to 75°F',
    celsius: '22 to 24°C',
    minDays: 70,
    maxDays: 90,
    estimatedDays: 80,
    alertDay: 65,
    summary: 'A common middle range that balances development time and predictability.',
    breederNote: 'Many crested gecko breeders use this range because it avoids pushing development while keeping the hatch window manageable.',
  },
  {
    id: 'warm',
    label: 'Warm',
    fahrenheit: '76 to 78°F',
    celsius: '24 to 26°C',
    minDays: 60,
    maxDays: 75,
    estimatedDays: 68,
    alertDay: 55,
    summary: 'A faster timeline that calls for closer temperature monitoring.',
    breederNote: 'Warmer incubation can shorten development time. Stable control is especially important, and eggs should never be allowed to overheat.',
  },
];

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
