import { Link } from 'react-router-dom';
import { Award, X } from 'lucide-react';
import {
  TIERS,
  SCORE_MIN,
  SCORE_MAX,
  SCORE_STEP,
  tierForScore,
  tierGradient,
  formatScore,
  clampScore,
} from '@/lib/quality';

/**
 * QualityInput
 *
 * Tier buttons + color-zoned slider for picking a gecko's quality
 * score on the Geck Inspect Standard 0-10 scale. The slider track is
 * a hard-stop gradient that mirrors the tier boundaries (Pet 0-4.9,
 * Breeder 5-6.9, High-end 7-8.4, Investment 8.5-10) so the user can
 * see where the score will tip into the next tier as they drag.
 *
 * Tapping a tier button snaps to the midpoint of that tier so a user
 * who just wants "Breeder grade" without dialing in a precise number
 * can do it in one click.
 *
 * value: numeric score (0-10) or null for "not graded yet"
 * onChange(score|null): called whenever the user changes the score
 */
export default function QualityInput({ value, onChange }) {
  const score = clampScore(value);
  const activeTier = tierForScore(score);

  const tierMidpoint = (tier) => {
    const mid = (tier.min + tier.max) / 2;
    return Math.round(mid * 2) / 2;
  };

  const handleSlider = (e) => {
    const next = parseFloat(e.target.value);
    onChange(Number.isNaN(next) ? null : next);
  };

  const handleTierClick = (tier) => {
    if (activeTier?.id === tier.id) {
      onChange(null);
      return;
    }
    onChange(tierMidpoint(tier));
  };

  const handleClear = () => onChange(null);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-slate-200">
          Quality grade
          <span className="ml-2 text-xs font-normal text-slate-500">
            Geck Inspect Standard
          </span>
        </label>
        <Link
          to="/QualityScale"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-emerald-400 hover:text-emerald-300 underline"
        >
          How to score
        </Link>
      </div>

      {/* Tier buttons */}
      <div className="grid grid-cols-4 gap-2">
        {TIERS.map((tier) => {
          const isActive = activeTier?.id === tier.id;
          return (
            <button
              key={tier.id}
              type="button"
              onClick={() => handleTierClick(tier)}
              className={`flex flex-col items-center justify-center rounded-lg border px-2 py-2 text-xs font-semibold leading-tight transition-colors ${
                isActive ? tier.btnActive : tier.btnIdle
              }`}
              aria-pressed={isActive}
              title={`${tier.label} grade: ${formatScore(tier.min)} to ${formatScore(tier.max)}`}
            >
              <span>{tier.label}</span>
              <span className="text-[10px] font-mono opacity-75 mt-0.5">
                {formatScore(tier.min)}-{formatScore(tier.max)}
              </span>
            </button>
          );
        })}
      </div>

      {/* Slider with tier-zone gradient track */}
      <div className="space-y-1.5">
        <div className="relative">
          <input
            type="range"
            min={SCORE_MIN}
            max={SCORE_MAX}
            step={SCORE_STEP}
            value={score ?? 0}
            onChange={handleSlider}
            className="quality-slider w-full"
            style={{ background: tierGradient() }}
            aria-label="Quality score, 0 to 10"
          />
        </div>
        <div className="flex items-center justify-between text-[10px] font-mono text-slate-500">
          <span>0.0</span>
          <span>2.5</span>
          <span>5.0</span>
          <span>7.5</span>
          <span>10.0</span>
        </div>
      </div>

      {/* Current score display + clear */}
      <div className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-900/40 px-3 py-2">
        {score == null ? (
          <span className="text-sm text-slate-500">Not graded yet</span>
        ) : (
          <span className="inline-flex items-center gap-2 text-sm">
            <Award size={14} className={activeTier?.chipText ?? 'text-slate-300'} />
            <span className={`font-semibold ${activeTier?.chipText ?? 'text-slate-200'}`}>
              {activeTier?.label}
            </span>
            <span className="font-mono tabular-nums text-slate-300">
              · {formatScore(score)}
            </span>
          </span>
        )}
        {score != null && (
          <button
            type="button"
            onClick={handleClear}
            className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200"
          >
            <X size={12} />
            Clear
          </button>
        )}
      </div>

      <p className="text-[11px] text-slate-500 leading-relaxed">
        Be honest. Optimistic scoring of your own animal is the most common source of mispriced listings. The full rubric, eligibility floor, and per-morph standards are at <Link to="/QualityScale" className="text-emerald-400 underline">/QualityScale</Link>.
      </p>
    </div>
  );
}
