/**
 * WeightHealthBadge ,  compact health indicator for a gecko's weight trend.
 *
 * Shows a color-coded badge (green/amber/red) with a trend arrow.
 * Drop it onto gecko cards, detail modals, or the dashboard.
 *
 * Usage:
 *   <WeightHealthBadge weightRecords={gecko.weight_records} />
 */
import { useWeightHealthScore } from '@/hooks/useWeightHealthScore';
import { TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const COLORS = {
  emerald: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40',
  amber: 'bg-amber-500/15 text-amber-400 border-amber-500/40',
  red: 'bg-red-500/15 text-red-400 border-red-500/40',
  slate: 'bg-slate-500/15 text-slate-400 border-slate-500/40',
};

const TREND_ICONS = {
  up: TrendingUp,
  down: TrendingDown,
  stable: Minus,
};

export default function WeightHealthBadge({ weightRecords, showLabel = false }) {
  const health = useWeightHealthScore(weightRecords);

  if (health.score === 'unknown') return null;

  const TrendIcon = TREND_ICONS[health.trend] || Minus;
  const colorClass = COLORS[health.color] || COLORS.slate;
  const isAlert = health.score === 'critical' || health.score === 'warning';

  const badge = (
    <Badge
      variant="outline"
      className={`inline-flex items-center gap-1 text-xs ${colorClass} ${isAlert ? 'animate-pulse' : ''}`}
    >
      {isAlert ? (
        <AlertTriangle className="w-3 h-3" />
      ) : (
        <TrendIcon className="w-3 h-3" />
      )}
      {showLabel ? health.label : `${health.percentChange > 0 ? '+' : ''}${health.percentChange}%`}
    </Badge>
  );

  if (showLabel) return badge;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent side="top" className="bg-slate-800 border-slate-600 text-slate-200 text-xs max-w-xs">
          <p className="font-medium">{health.label}</p>
          <p className="text-slate-400 mt-0.5">
            Latest: {health.latestWeight}g &middot; {health.smoothedRecords.length} records
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
