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
  owned:       { bg: '#E8F0E8', text: '#1A2E1A', label: 'Owned' },
  active:      { bg: '#E8F0E8', text: '#1A2E1A', label: 'Active' },
  for_sale:    { bg: '#FDF3E0', text: '#633806', label: 'For Sale' },
  sold:        { bg: '#6B7B6B', text: '#ffffff', label: 'Sold' },
  completed:   { bg: '#6B7B6B', text: '#ffffff', label: 'Completed' },
  transferred: { bg: '#D3D1C7', text: '#3D4A3D', label: 'Transferred' },
  on_loan:     { bg: '#E6F1FB', text: '#0C447C', label: 'On Loan' },
  cancelled:   { bg: '#FCEBEB', text: '#791F1F', label: 'Cancelled' },
  deceased:    { bg: '#FCEBEB', text: '#791F1F', label: 'Deceased' },
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
