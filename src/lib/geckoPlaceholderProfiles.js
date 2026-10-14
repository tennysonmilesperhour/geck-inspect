import { differenceInCalendarDays, differenceInMonths, isValid } from 'date-fns';
import { parseLocalDate } from './dateUtils';

// Keep this order and length stable: saved IDs map to a permanent visual family.
export const GECKO_ART_STYLES = [
  { id: 'engraving', label: 'Botanical engraving', ink: '#233d2e', male: '#244f68', female: '#754353', unsexed: '#3b5738', paper: '#f6ebd1' },
  { id: 'woodcut', label: 'Indigo woodcut', ink: '#173a56', male: '#204d75', female: '#993f36', unsexed: '#5e633c', paper: '#f4e4c6' },
  { id: 'nouveau', label: 'Art Nouveau', ink: '#442b2e', male: '#205b57', female: '#803a51', unsexed: '#68602b', paper: '#f9ecd3' },
  { id: 'celestial', label: 'Celestial enamel', ink: '#102f44', male: '#075768', female: '#8c3145', unsexed: '#755a16', paper: '#fff0cb' },
  { id: 'terracotta', label: 'Terracotta print', ink: '#39261e', male: '#3f4e50', female: '#933e28', unsexed: '#74551e', paper: '#f5dfbb' },
];

export const GECKO_ART_SEXES = {
  male: { label: 'Male', symbol: '♂' },
  female: { label: 'Female', symbol: '♀' },
  unsexed: { label: 'Unsexed', symbol: '?' },
};

export const GECKO_ART_AGES = {
  hatchling: 'Hatchling',
  juvenile: 'Juvenile',
  adult: 'Adult',
  unknown: 'Age not set',
};

export function geckoArtStyle(gecko) {
  const identity = gecko?.id || gecko?.gecko_id_code || gecko?.name;
  if (!identity) return GECKO_ART_STYLES[0];
  let hash = 2166136261;
  for (const char of String(identity)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return GECKO_ART_STYLES[(hash >>> 0) % GECKO_ART_STYLES.length];
}

function normalizeSex(value) {
  const sex = String(value || '').trim().toLowerCase();
  return sex === 'male' || sex === 'female' ? sex : 'unsexed';
}

// These are illustration bands, not a maturity or breeding-readiness judgment.
function ageBand(months) {
  if (months < 6) return 'hatchling';
  if (months < 18) return 'juvenile';
  return 'adult';
}

function recordedAge(gecko, now) {
  const rawDate = gecko?.hatch_date;
  const hatch = typeof rawDate === 'string' || rawDate instanceof Date ? parseLocalDate(rawDate) : null;
  if (hatch && isValid(hatch)) {
    const days = differenceInCalendarDays(now, hatch);
    if (days < 0) return { group: 'unknown', detail: null };
    const months = differenceInMonths(now, hatch);
    const detail = months < 1 ? `${days}d`
      : months < 12 ? `${months}mo`
        : `${Math.floor(months / 12)}y${months % 12 ? ` ${months % 12}mo` : ''}`;
    return { group: ageBand(months), detail };
  }
  // A year alone never becomes an invented birthday. Pick a band only when
  // every possible hatch date in that year lands in the same band today.
  const year = Number(gecko?.estimated_hatch_year);
  if (!gecko?.hatch_date && Number.isInteger(year) && year >= 1900 && year <= now.getFullYear()) {
    const youngest = differenceInMonths(now, new Date(year, 11, 31));
    const oldest = differenceInMonths(now, new Date(year, 0, 1));
    const group = youngest >= 0 && ageBand(youngest) === ageBand(oldest) ? ageBand(youngest) : 'unknown';
    return { group, detail: `Hatched ~${year}` };
  }
  return { group: 'unknown', detail: null };
}

export function geckoPlaceholderProfile(gecko, now = new Date(), styleId) {
  const style = GECKO_ART_STYLES.find(item => item.id === styleId) || geckoArtStyle(gecko);
  const sex = normalizeSex(gecko?.sex);
  const age = recordedAge(gecko, now);
  return {
    style,
    sex,
    sexLabel: GECKO_ART_SEXES[sex].label,
    ageGroup: age.group,
    ageLabel: GECKO_ART_AGES[age.group],
    ageDetail: age.detail,
    // The neutral, fully drawn animal remains a generic emblem when age
    // is absent. Its label explicitly says that no age has been supplied.
    artStage: age.group === 'unknown' ? 'adult' : age.group,
  };
}

export function geckoPlaceholderAsset(profile, width = 512) {
  const size = width > 512 ? 1024 : 512;
  return `/gecko-placeholders/${profile.style.id}-${profile.artStage}-${size}.webp`;
}
