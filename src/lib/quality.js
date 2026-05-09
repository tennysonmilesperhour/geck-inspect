/**
 * Quality scale helpers shared by the QualityInput slider, the
 * QualityBadge chip, and any other surface that needs to translate a
 * numeric quality score into a tier label + color.
 *
 * Source of truth: docs/specs/P11-quality-rubric.md and the public
 * /QualityScale page. Keep tier cutoffs in sync with both.
 *
 * Score is a numeric value in [0, 10]. Anything outside that range is
 * clamped on read; null/undefined means "not graded yet".
 */

export const TIERS = [
  {
    id: 'pet',
    label: 'Pet',
    min: 0,
    max: 4.9,
    swatch: '#64748b',
    track: '#475569',
    chipBg: 'bg-slate-700/40',
    chipBorder: 'border-slate-600',
    chipText: 'text-slate-200',
    btnActive: 'bg-slate-600 text-slate-100 border-slate-500',
    btnIdle: 'bg-slate-800/40 text-slate-400 border-slate-700 hover:bg-slate-800/70',
  },
  {
    id: 'breeder',
    label: 'Breeder',
    min: 5.0,
    max: 6.9,
    swatch: '#10b981',
    track: '#059669',
    chipBg: 'bg-emerald-900/40',
    chipBorder: 'border-emerald-700',
    chipText: 'text-emerald-200',
    btnActive: 'bg-emerald-600 text-white border-emerald-500',
    btnIdle: 'bg-emerald-950/40 text-emerald-400 border-emerald-900 hover:bg-emerald-900/40',
  },
  {
    id: 'high_end',
    label: 'High-end',
    min: 7.0,
    max: 8.4,
    swatch: '#0ea5e9',
    track: '#0284c7',
    chipBg: 'bg-sky-900/40',
    chipBorder: 'border-sky-700',
    chipText: 'text-sky-200',
    btnActive: 'bg-sky-600 text-white border-sky-500',
    btnIdle: 'bg-sky-950/40 text-sky-400 border-sky-900 hover:bg-sky-900/40',
  },
  {
    id: 'investment',
    label: 'Investment',
    min: 8.5,
    max: 10,
    swatch: '#f59e0b',
    track: '#d97706',
    chipBg: 'bg-amber-900/40',
    chipBorder: 'border-amber-700',
    chipText: 'text-amber-200',
    btnActive: 'bg-amber-500 text-amber-950 border-amber-400',
    btnIdle: 'bg-amber-950/40 text-amber-400 border-amber-900 hover:bg-amber-900/40',
  },
];

export const SCORE_MIN = 0;
export const SCORE_MAX = 10;
export const SCORE_STEP = 0.5;

export function clampScore(score) {
  if (score == null || Number.isNaN(Number(score))) return null;
  const n = Number(score);
  if (n < SCORE_MIN) return SCORE_MIN;
  if (n > SCORE_MAX) return SCORE_MAX;
  return n;
}

/**
 * Resolve a numeric score to the tier object it falls inside.
 * Returns null when score is null/undefined.
 */
export function tierForScore(score) {
  const s = clampScore(score);
  if (s == null) return null;
  for (const t of TIERS) {
    if (s >= t.min && s <= t.max) return t;
  }
  return TIERS[0];
}

/**
 * Map a score back to the legacy `pattern_grade` enum value used by
 * Market Pricing aggregations. Lets us keep one source of truth (the
 * score) while continuing to populate the older column for downstream
 * reporting.
 */
export function patternGradeForScore(score) {
  const t = tierForScore(score);
  return t?.id ?? null;
}

/**
 * CSS linear-gradient for the slider track. Hard color stops at the
 * tier boundaries so the user can see where their score will tip into
 * the next tier as they drag the handle.
 */
export function tierGradient() {
  const stops = [];
  for (const t of TIERS) {
    const startPct = (t.min / SCORE_MAX) * 100;
    const endPct = (t.max / SCORE_MAX) * 100;
    stops.push(`${t.track} ${startPct}%`, `${t.track} ${endPct}%`);
  }
  return `linear-gradient(to right, ${stops.join(', ')})`;
}

export function formatScore(score) {
  const s = clampScore(score);
  if (s == null) return '';
  return Number.isInteger(s) ? `${s}.0` : s.toFixed(1);
}
