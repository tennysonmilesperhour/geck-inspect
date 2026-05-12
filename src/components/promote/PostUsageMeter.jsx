import { useMemo } from 'react';
import { Sparkles, AlertTriangle } from 'lucide-react';
import { formatCents } from '@/lib/socialMedia';

// Stacked progress bars showing this month's post usage. The top bar is
// "X of N included posts". The bottom bar is overage (only fills once they
// cross included). Free users see the same shape; once they exceed their
// 1 included post the publish endpoint returns 402 and the trial-offer
// modal pops, so this meter never actually fills past 100% for Free.
export default function PostUsageMeter({ usage, tier, credits = 0 }) {
  const included = Number(usage?.posts_included ?? 1);
  const published = Number(usage?.posts_published ?? 0);
  const overagePosts = Number(usage?.overage_posts ?? 0);
  const overageCents = Number(usage?.overage_cents ?? 0);

  const includedPct = useMemo(() => {
    if (!included) return 0;
    return Math.min(100, Math.round((Math.min(published, included) / included) * 100));
  }, [included, published]);

  const overagePct = useMemo(() => {
    if (overagePosts <= 0) return 0;
    // Show first 20 overage posts on the bar so it doesn't pin to 100%
    // immediately. After that we just leave it at 100% with the dollar
    // amount as the source of truth.
    return Math.min(100, Math.round((overagePosts / 20) * 100));
  }, [overagePosts]);

  const includedRemaining = Math.max(0, included - published);
  const isAtLimit = published >= included;
  const isFree = tier === 'free';

  return (
    <div className="rounded-lg border border-emerald-800/40 bg-emerald-950/30 p-4">
      <div className="flex items-baseline justify-between mb-3">
        <div className="text-xs uppercase tracking-wider font-semibold text-emerald-300">
          Posts this month
        </div>
        <div className="text-xs text-emerald-200/60">
          {published} / {included} included
          {credits > 0 && (
            <span className="ml-2 text-amber-300">
              <Sparkles className="inline w-3 h-3 mr-1" />
              {credits} credit{credits === 1 ? '' : 's'}
            </span>
          )}
        </div>
      </div>

      <div className="h-2 w-full bg-emerald-950/60 rounded-full overflow-hidden mb-2">
        <div
          className="h-full bg-emerald-500 transition-all duration-300"
          style={{ width: `${includedPct}%` }}
        />
      </div>

      {(overagePosts > 0 || isAtLimit) && (
        <>
          <div className="flex items-baseline justify-between mt-3 mb-2">
            <div className="text-xs uppercase tracking-wider font-semibold text-amber-300">
              Overage
            </div>
            <div className="text-xs text-amber-200/80">
              {overagePosts > 0
                ? `${formatCents(overageCents)} (${overagePosts} post${overagePosts === 1 ? '' : 's'} at $0.50)`
                : 'Next post will be $0.50 overage'}
            </div>
          </div>
          <div className="h-2 w-full bg-emerald-950/60 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-500 transition-all duration-300"
              style={{ width: `${overagePct}%` }}
            />
          </div>
        </>
      )}

      {isFree && isAtLimit && (
        <div className="mt-3 flex items-start gap-2 text-xs text-amber-200/90">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>
            You're out of free posts for this month. Add a card to keep posting at $0.50/post,
            or start a free 30-day Keeper trial for 4 posts/month.
          </span>
        </div>
      )}

      {!isFree && includedRemaining === 1 && (
        <div className="mt-3 text-xs text-emerald-200/70">
          1 included post left. Going past your included posts adds $0.50 each, billed at end of month.
        </div>
      )}
    </div>
  );
}
