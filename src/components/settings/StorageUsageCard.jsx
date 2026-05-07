import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { HardDrive, ArrowRight, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import {
  getTierLimits,
  formatBytes,
  bytesUsedPercent,
} from '@/lib/tierLimits';
import { getUserStorageBytes } from '@/lib/uploadFile';

/**
 * Storage-usage card for the Settings page. Calls the
 * `get_user_storage_bytes` RPC to find the user's current footprint
 * in the geck-inspect-media bucket and renders a progress bar against
 * their tier's max. Renders `Unlimited` for breeder-tier accounts and
 * silently shows the bar at 0% if the RPC is unavailable (migration
 * not yet applied) — never blocks the page.
 */
export default function StorageUsageCard({ user }) {
  const [bytes, setBytes] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getUserStorageBytes().then((v) => {
      if (cancelled) return;
      setBytes(v);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const limits = getTierLimits(user);
  const limit = limits.maxStorageBytes;
  const isUnlimited = limit == null;
  const used = bytes ?? 0;
  const pct = bytesUsedPercent(used, limit);
  const isNearLimit = !isUnlimited && pct >= 80;
  const isOverLimit = !isUnlimited && pct >= 100;

  return (
    <Card className="bg-slate-900/50 border-slate-700 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-slate-100 flex items-center gap-2">
          <HardDrive className="w-5 h-5" />
          Photo storage
        </CardTitle>
        <CardDescription className="text-slate-400">
          How much of your <strong>{limits.label}</strong> tier&rsquo;s photo storage is in use.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-slate-400 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            Calculating…
          </div>
        ) : (
          <>
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-white font-semibold">
                {formatBytes(used)}
              </span>
              <span className="text-slate-400">
                of{' '}
                <span className="font-semibold text-slate-200">
                  {isUnlimited ? 'Unlimited' : formatBytes(limit)}
                </span>
              </span>
            </div>

            {!isUnlimited && (
              <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    isOverLimit
                      ? 'bg-red-500'
                      : isNearLimit
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.max(2, pct)}%` }}
                />
              </div>
            )}

            {isOverLimit && (
              <p className="text-sm text-red-300 leading-snug">
                You&rsquo;re over your photo-storage limit. New uploads are
                blocked until you upgrade or delete some photos.
              </p>
            )}
            {!isOverLimit && isNearLimit && (
              <p className="text-sm text-amber-300 leading-snug">
                You&rsquo;re close to your storage limit ({pct}% used). Consider
                upgrading or removing photos you don&rsquo;t need.
              </p>
            )}

            {!isUnlimited && (
              <div className="pt-2">
                <Link to={createPageUrl('Subscription')}>
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-emerald-950/40 text-emerald-100 hover:bg-emerald-900/60 hover:text-white border-emerald-500/40"
                  >
                    Upgrade plan
                    <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                  </Button>
                </Link>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
