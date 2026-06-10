import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  HeartPulse,
  Loader2,
  CheckCircle2,
  Eye,
  AlertTriangle,
  Crown,
  LogIn,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { createPageUrl } from '@/utils';
import { isGuestMode } from '@/lib/guestMode';
import { getFeatureUsage } from '@/lib/usageMeter';
import { getTierLimits, tierOf, TIER_LIMITS } from '@/lib/tierLimits';
import { runHealthScreen, firstPhotoUrl } from '@/lib/healthScreen';

/**
 * AI Health Check (beta): photo-based husbandry observations for one gecko.
 *
 * Props:
 *   gecko - gecko record (image_urls, name, hatch_date, weight_grams,
 *           morph_tags). Renders nothing if the gecko has no photos.
 *   user  - signed-in user record, or null/undefined for guests.
 *
 * METERING NOTE: the `health-screen` edge function consumes the monthly
 * credit server-side. This component only READS the ledger via
 * getFeatureUsage('health_screen') to show the "N of M left" hint. Do
 * not call consumeFeatureCredit('health_screen') here: the server
 * already debits, and a client-side consume would double-charge.
 */

const SEVERITY_STYLES = {
  looks_typical: {
    Icon: CheckCircle2,
    iconClass: 'text-emerald-400',
    label: 'Looks typical',
    labelClass: 'text-emerald-300',
  },
  worth_watching: {
    Icon: Eye,
    iconClass: 'text-amber-400',
    label: 'Worth watching',
    labelClass: 'text-amber-300',
  },
  see_a_vet: {
    Icon: AlertTriangle,
    iconClass: 'text-red-400',
    label: 'Consider an exotics vet',
    labelClass: 'text-red-300 font-bold',
  },
};

function ObservationRow({ observation }) {
  const style = SEVERITY_STYLES[observation?.severity] || SEVERITY_STYLES.worth_watching;
  const { Icon } = style;
  return (
    <div className="flex items-start gap-3 rounded-lg border border-slate-700/60 bg-slate-900/40 p-3">
      <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${style.iconClass}`} />
      <div className="min-w-0 text-sm">
        <p className="text-slate-200">
          {observation?.area && (
            <span className="font-medium text-white">{observation.area}: </span>
          )}
          {observation?.finding}
        </p>
        <p className={`text-xs mt-0.5 ${style.labelClass}`}>{style.label}</p>
        {observation?.note && (
          <p className="text-slate-400 text-xs mt-1">{observation.note}</p>
        )}
        {observation?.severity === 'see_a_vet' && (
          <p className="text-slate-300 text-xs mt-1">
            Not an emergency call from a photo, but{' '}
            <span className="font-bold text-red-300">consider an exotics vet</span>{' '}
            so a professional can take a proper look.
          </p>
        )}
      </div>
    </div>
  );
}

export default function HealthScreenCard({ gecko, user }) {
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState(null); // last successful screen
  const [errorMsg, setErrorMsg] = useState(null);
  const [exhausted, setExhausted] = useState(false);
  const [exhaustedInfo, setExhaustedInfo] = useState(null); // { included, tier } from the server
  const [usage, setUsage] = useState(null); // { included, remaining } for the hint

  const guest = !user || isGuestMode();
  const photoUrl = firstPhotoUrl(gecko);
  const geckoName = gecko?.name || 'this gecko';

  // "N of M left" hint, read-only. The server is the source of truth and
  // does the actual consuming; this just keeps the button honest.
  useEffect(() => {
    if (guest) return;
    let cancelled = false;
    (async () => {
      const row = await getFeatureUsage('health_screen');
      if (cancelled) return;
      if (row) {
        setUsage({ included: row.included, remaining: row.remaining });
      } else {
        // No ledger row yet this month: fall back to the tier allotment.
        const included = getTierLimits(user).monthlyHealthScreens;
        setUsage(included == null ? null : { included, remaining: included });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [guest, user]);

  // No photos, nothing to review: stay out of the way entirely.
  if (!photoUrl) return null;

  const handleRun = async () => {
    if (isRunning) return;
    setIsRunning(true);
    setErrorMsg(null);
    setExhausted(false);
    try {
      const screen = await runHealthScreen(gecko);
      if (screen.ok) {
        setResult(screen);
        if (screen.creditsRemaining != null) {
          setUsage((prev) => ({
            included: prev?.included ?? null,
            remaining: screen.creditsRemaining,
          }));
        }
      } else if (screen.exhausted) {
        setExhausted(true);
        setExhaustedInfo({ included: screen.included, tier: screen.tier });
        setUsage((prev) => (prev ? { ...prev, remaining: 0 } : prev));
      } else {
        setErrorMsg(screen.error || 'The check could not finish. Please try again in a moment.');
      }
    } finally {
      setIsRunning(false);
    }
  };

  const limitForPlan =
    exhaustedInfo?.included ?? getTierLimits(user).monthlyHealthScreens;
  const planLabel =
    (exhaustedInfo?.tier && TIER_LIMITS[exhaustedInfo.tier]?.label) ||
    TIER_LIMITS[tierOf(user)]?.label ||
    'Free';
  const usageHint =
    usage && usage.included != null && usage.remaining != null
      ? `${usage.remaining} of ${usage.included} left this month`
      : null;

  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-white flex items-center gap-2 text-base">
            <HeartPulse className="w-4 h-4 text-emerald-400" />
            AI Health Check
            <span className="text-[10px] font-medium uppercase tracking-wide text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded px-1.5 py-0.5">
              beta
            </span>
          </CardTitle>
          {!guest && usageHint && (
            <span className="text-xs text-slate-400 shrink-0">{usageHint}</span>
          )}
        </div>
        <p className="text-xs text-slate-400">
          Reviews the latest photo for body condition, shed, and visible concerns.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {guest ? (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 flex items-start gap-3">
            <LogIn className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
            <div className="text-sm">
              <p className="text-emerald-200 font-medium">Sign in to run a health check</p>
              <p className="text-slate-300 text-xs mt-1">
                Health checks need an account so we can track your monthly allotment.
              </p>
              <Link to={createPageUrl('AuthPortal')} className="inline-block mt-2">
                <Button size="sm">Sign in</Button>
              </Link>
            </div>
          </div>
        ) : (
          <Button onClick={handleRun} disabled={isRunning} className="w-full sm:w-auto">
            {isRunning ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Reviewing photo, 5-15 seconds
              </>
            ) : (
              <>
                <HeartPulse className="w-4 h-4" />
                Run health check
              </>
            )}
          </Button>
        )}

        {errorMsg && (
          <p className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg p-3">
            {errorMsg}
          </p>
        )}

        {exhausted && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 flex items-start gap-3">
            <Crown className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
            <div className="text-sm">
              <p className="text-amber-200 font-medium">
                You have used this month&apos;s health checks.
              </p>
              <p className="text-slate-300 text-xs mt-1">
                {limitForPlan != null
                  ? `The ${planLabel} plan includes ${limitForPlan} health check${limitForPlan === 1 ? '' : 's'} per month. `
                  : ''}
                Upgrade for more monthly checks, or your allotment resets at the start of next month.
              </p>
              <Link to={createPageUrl('Membership')} className="inline-block mt-2">
                <Button size="sm">View plans</Button>
              </Link>
            </div>
          </div>
        )}

        {result && (
          <div className="space-y-2">
            {result.observations.length > 0 ? (
              result.observations.map((observation, i) => (
                <ObservationRow
                  key={`${observation?.area || 'observation'}-${i}`}
                  observation={observation}
                />
              ))
            ) : (
              <p className="text-sm text-slate-300">
                The photo did not give us enough to comment on. A clear, well-lit
                full-body shot works best.
              </p>
            )}
            {result.overallNote && (
              <p className="text-sm text-slate-200 border-l-2 border-emerald-500/50 pl-3 py-1">
                {result.overallNote}
              </p>
            )}
            <p className="text-xs text-slate-500">{result.disclaimer}</p>
            <p className="text-xs text-slate-500">
              Based on the current main photo of {geckoName}. A photo check is a
              starting point for routine care, not a substitute for hands-on
              husbandry or a vet visit.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
