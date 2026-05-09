import { Award } from 'lucide-react';
import { Link } from 'react-router-dom';
import { tierForScore, formatScore } from '@/lib/quality';

/**
 * QualityBadge
 *
 * Renders a tier + score chip for a gecko that has been graded on the
 * Geck Inspect Standard. See /QualityScale for the public rubric and
 * docs/specs/P11-quality-rubric.md for the spec.
 *
 * Returns null when the gecko has no quality_score yet, so callers can
 * drop it inline without adding empty-state branching.
 *
 * Variants:
 *   default  full chip, label + score, suitable for the Animal Passport
 *   sm       compact chip for gecko cards
 *   xs       tiny dot + score for dense grids
 */
export default function QualityBadge({
  score,
  size = 'default',
  linkToScale = false,
  className = '',
  title,
}) {
  const tier = tierForScore(score);
  if (!tier) return null;

  const formatted = formatScore(score);
  const tooltip = title ?? `${tier.label} grade · ${formatted} on the Geck Inspect Quality Scale`;

  const sizeClass = {
    default: 'h-7 px-2.5 text-xs gap-1.5',
    sm: 'h-5 px-1.5 text-[10px] gap-1',
    xs: 'h-4 px-1 text-[10px] gap-0.5',
  }[size];

  const iconSize = {
    default: 12,
    sm: 10,
    xs: 9,
  }[size];

  const inner = (
    <span
      className={`inline-flex items-center rounded-full border font-semibold leading-none ${tier.chipBg} ${tier.chipBorder} ${tier.chipText} ${sizeClass} ${className}`}
      title={tooltip}
    >
      <Award size={iconSize} className="flex-shrink-0" />
      <span className="truncate">{tier.label}</span>
      <span className="opacity-70">·</span>
      <span className="font-mono tabular-nums">{formatted}</span>
    </span>
  );

  if (!linkToScale) return inner;

  return (
    <Link
      to="/QualityScale"
      onClick={(e) => e.stopPropagation()}
      className="inline-flex"
      aria-label="Learn about the Geck Inspect Quality Scale"
    >
      {inner}
    </Link>
  );
}
