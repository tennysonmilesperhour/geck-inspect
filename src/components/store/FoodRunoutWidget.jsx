import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { getFoodEstimate, runoutTone } from '@/lib/store/foodEstimate';

const TONE_CLASSES = {
  rose:    { wrap: 'border-rose-700/40 bg-rose-500/10 text-rose-200',       Icon: AlertTriangle },
  amber:   { wrap: 'border-amber-700/40 bg-amber-500/10 text-amber-200',     Icon: Clock },
  emerald: { wrap: 'border-emerald-700/40 bg-emerald-500/10 text-emerald-200', Icon: CheckCircle2 },
};

/**
 * Shows the user's current "your CGD runs out around <date>" estimate,
 * computed by the SECURITY DEFINER estimate_food_runout RPC. Hides
 * itself silently when the user has no food order history yet so the
 * UI doesn't get noisy for first-time visitors.
 */
export default function FoodRunoutWidget({ compact = false }) {
  const [estimate, setEstimate] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getFoodEstimate().then((e) => {
      if (cancelled) return;
      setEstimate(e);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  if (loading) return null;
  if (!estimate?.hasHistory) return null;

  const tone = runoutTone(estimate.daysUntilRunout);
  const cls = TONE_CLASSES[tone] || TONE_CLASSES.emerald;
  const Icon = cls.Icon;
  const dateStr = estimate.runsOutAt
    ? estimate.runsOutAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    : 'soon';

  return (
    <div className={`rounded-md border px-3 py-2 ${cls.wrap}`}>
      <div className="flex items-start gap-2">
        <Icon className="w-4 h-4 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className={`${compact ? 'text-xs' : 'text-sm'} font-semibold leading-tight`}>
            About {estimate.daysUntilRunout} days of CGD left
          </div>
          <div className={`${compact ? 'text-[11px]' : 'text-xs'} opacity-90 mt-0.5`}>
            For {estimate.geckoCount} {estimate.geckoCount === 1 ? 'gecko' : 'geckos'}.
            Runs out around <strong>{dateStr}</strong>.
          </div>
          {!compact && (
            <Link
              to="/Store/c/diet"
              className="inline-block mt-1.5 text-[11px] underline underline-offset-2 hover:opacity-80"
            >
              Browse CGD →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
