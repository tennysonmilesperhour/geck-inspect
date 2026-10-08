/**
 * Passport utility functions for the Animal Passport system (P1).
 */

/**
 * Generate a unique passport code in format: GI-YYYY-XXXX
 * where XXXX is a random alphanumeric string (uppercase, no ambiguous chars).
 */
export function generatePassportCode() {
  const year = new Date().getFullYear();
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I, O, 0, 1
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `GI-${year}-${code}`;
}

/**
 * Weigh-in columns a signed-out visitor may read. Public passports show
 * weigh-ins to everyone, but created_by holds the owner's email address,
 * so the anon role is not granted it and a `select('*')` would fail.
 */
export const PUBLIC_WEIGHT_COLUMNS = 'id, gecko_id, weight_grams, record_date, notes, created_date';

/**
 * Feeding and shed columns the passport reads. Same reason: created_by
 * holds an email, so the passport never asks for it (and once
 * 20261008081043_anon_hide_email_columns_more.sql is applied, a signed-out
 * `select('*')` on these tables fails).
 */
export const PUBLIC_FEEDING_COLUMNS = 'id, animal_id, date, food_type, accepted, notes, created_date';
export const PUBLIC_SHED_COLUMNS = 'id, animal_id, date, quality, notes, created_date';

/**
 * Build the public passport URL for a given passport code.
 */
export function passportUrl(passportCode) {
  const base = typeof window !== 'undefined' ? window.location.origin : 'https://geckinspect.com';
  return `${base}/passport/${passportCode}`;
}

/**
 * Calculate age string from DOB or estimated hatch year.
 */
export function calculateAge(dateOfBirth, estimatedHatchYear) {
  if (dateOfBirth) {
    const dob = new Date(dateOfBirth);
    const now = new Date();
    const months = (now.getFullYear() - dob.getFullYear()) * 12 + (now.getMonth() - dob.getMonth());
    if (months < 1) return 'Hatchling';
    if (months < 12) return `${months} month${months !== 1 ? 's' : ''}`;
    const years = Math.floor(months / 12);
    const rem = months % 12;
    if (rem === 0) return `${years} year${years !== 1 ? 's' : ''}`;
    return `${years}y ${rem}m`;
  }
  if (estimatedHatchYear) {
    const years = new Date().getFullYear() - estimatedHatchYear;
    if (years <= 0) return 'Hatchling';
    return `~${years} year${years !== 1 ? 's' : ''}`;
  }
  return 'Unknown';
}

/**
 * Days since a given date. Returns null if no date provided.
 */
export function daysSince(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  const now = new Date();
  return Math.floor((now - d) / (1000 * 60 * 60 * 24));
}

/**
 * Color class for "days since fed" indicator.
 */
export function feedFreshness(daysSinceLastFed) {
  if (daysSinceLastFed === null) return { color: 'text-gray-400', bg: 'bg-gray-400/10', label: 'No data' };
  if (daysSinceLastFed < 3) return { color: 'text-emerald-400', bg: 'bg-emerald-400/10', label: `${daysSinceLastFed}d ago` };
  if (daysSinceLastFed <= 7) return { color: 'text-amber-400', bg: 'bg-amber-400/10', label: `${daysSinceLastFed}d ago` };
  return { color: 'text-red-400', bg: 'bg-red-400/10', label: `${daysSinceLastFed}d ago` };
}

/**
 * Status badge config matching the design system.
 */
export const STATUS_BADGE_STYLES = {
  owned:       { bg: 'rgba(16,185,129,0.15)', text: '#10b981', label: 'Owned' },
  active:      { bg: 'rgba(16,185,129,0.15)', text: '#10b981', label: 'Active' },
  for_sale:    { bg: 'rgba(245,158,11,0.15)', text: '#f59e0b', label: 'For Sale' },
  sold:        { bg: 'rgba(100,116,139,0.2)', text: '#94a3b8', label: 'Sold' },
  completed:   { bg: 'rgba(100,116,139,0.2)', text: '#94a3b8', label: 'Completed' },
  transferred: { bg: 'rgba(100,116,139,0.2)', text: '#cbd5e1', label: 'Transferred' },
  on_loan:     { bg: 'rgba(59,130,246,0.15)', text: '#3b82f6', label: 'On Loan' },
  cancelled:   { bg: 'rgba(239,68,68,0.15)', text: '#ef4444', label: 'Cancelled' },
  deceased:    { bg: 'rgba(239,68,68,0.15)', text: '#ef4444', label: 'Deceased' },
};

/**
 * Pattern grade display config.
 */
export const PATTERN_GRADES = {
  pet:        { label: 'Pet', description: 'Primarily a companion animal', premium: false },
  breeder:    { label: 'Breeder', description: 'Suitable for production', premium: false },
  high_end:   { label: 'High-End', description: 'Exceptional expression', premium: true },
  investment: { label: 'Investment', description: 'Extraordinary specimen', premium: true },
};

/**
 * Transfer method labels for the ownership timeline.
 */
export const TRANSFER_METHOD_LABELS = {
  original_breeder:     'Original Breeder',
  purchased:            'Purchased',
  gifted:               'Gifted',
  breeding_loan_return: 'Breeding Loan Return',
};
