/**
 * TrustPanel, the seller trust layer.
 *
 * Shows a seller's provable on-platform history instead of an asserted
 * reputation: animals tracked, husbandry records, completed transfers,
 * buyer reviews, account age. Two variants:
 *
 *   compact: tier badge + the 2-3 strongest signals on one line, for
 *            marketplace cards and listing detail areas.
 *   full:    a card with every signal as an icon row, for the public
 *            breeder page.
 *
 * Evidence framing only: we never call anyone untrustworthy. 'New' is a
 * neutral starting point. If the data cannot be fetched, the panel
 * renders nothing rather than rendering doubt.
 */
import { useEffect, useState } from 'react';
import {
  CalendarDays, ClipboardList, Scale, ArrowLeftRight, Star,
  ShieldCheck, Award,
} from 'lucide-react';
import { computeTrustSignals, deriveTrustTier, TRUST_TIER_META } from '@/lib/trustScore';

// Session cache: one fetch per seller email, shared across every panel
// on the page (a marketplace grid can show the same seller many times).
const signalsCache = new Map();

function getTrustData(email) {
  if (!signalsCache.has(email)) {
    const promise = computeTrustSignals(email)
      .then((signals) => ({ signals, tier: deriveTrustTier(signals) }))
      .catch((err) => {
        // Let the next mount retry instead of caching the failure forever.
        signalsCache.delete(email);
        throw err;
      });
    signalsCache.set(email, promise);
  }
  return signalsCache.get(email);
}

const TIER_BADGE_CLASSES = {
  new: 'border-slate-600 bg-slate-800/60 text-slate-300',
  establishing: 'border-sky-500/40 bg-sky-500/10 text-sky-300',
  established: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  pillar: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
};

function TierBadge({ tier, size = 'sm' }) {
  const meta = TRUST_TIER_META[tier] || TRUST_TIER_META.new;
  const sizeClasses = size === 'sm'
    ? 'px-2 py-0.5 text-[10px]'
    : 'px-3 py-1 text-xs';
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border font-semibold whitespace-nowrap ${sizeClasses} ${TIER_BADGE_CLASSES[tier] || TIER_BADGE_CLASSES.new}`}
      title={meta.description}
    >
      <ShieldCheck className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
      {meta.label}
    </span>
  );
}

function monthsLabel(months) {
  if (months >= 24) return `${Math.floor(months / 12)} years`;
  if (months >= 12) return '1 year';
  return `${months} month${months === 1 ? '' : 's'}`;
}

// Pick the 2-3 strongest signals for the compact one-liner, strongest
// first. "Strong" means most specific to a real selling history.
function compactHighlights(signals) {
  const parts = [];
  if (signals.animalsTracked > 0) {
    parts.push(
      signals.accountAgeMonths >= 1
        ? `Tracking ${signals.animalsTracked} gecko${signals.animalsTracked === 1 ? '' : 's'} for ${monthsLabel(signals.accountAgeMonths)}`
        : `Tracking ${signals.animalsTracked} gecko${signals.animalsTracked === 1 ? '' : 's'}`
    );
  }
  if (signals.avgRating != null && signals.reviewCount > 0) {
    parts.push(`${signals.avgRating} from ${signals.reviewCount} review${signals.reviewCount === 1 ? '' : 's'}`);
  }
  if (parts.length < 3 && signals.weightLogsCount >= 5) {
    parts.push(`${signals.weightLogsCount} weight logs`);
  }
  if (parts.length < 3 && signals.ownershipTransfers >= 1) {
    parts.push(`${signals.ownershipTransfers} completed transfer${signals.ownershipTransfers === 1 ? '' : 's'}`);
  }
  if (parts.length < 3 && signals.isVerifiedBreeder) {
    parts.push('Verified breeder');
  }
  return parts.slice(0, 3);
}

function SignalRow({ icon: Icon, children }) {
  return (
    <div className="flex items-center gap-2.5 text-sm text-slate-300">
      <Icon className="w-4 h-4 text-emerald-400 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

export default function TrustPanel({ email, variant = 'compact' }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!email) return undefined;
    let cancelled = false;
    getTrustData(email)
      .then((d) => { if (!cancelled) setData(d); })
      .catch(() => { if (!cancelled) setData(null); });
    return () => { cancelled = true; };
  }, [email]);

  if (!email || !data) return null;
  const { signals, tier } = data;

  if (variant === 'compact') {
    const highlights = compactHighlights(signals);
    return (
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <TierBadge tier={tier} size="sm" />
        {highlights.length > 0 && (
          <span className="text-[11px] text-slate-400 leading-snug">
            {highlights.join(' · ')}
          </span>
        )}
      </div>
    );
  }

  // Full variant: every signal as an icon row inside a card.
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h3 className="text-sm font-bold text-white uppercase tracking-wide">
          Track record
        </h3>
        <TierBadge tier={tier} size="md" />
      </div>

      <div className="space-y-2.5">
        <SignalRow icon={CalendarDays}>
          On Geck Inspect for{' '}
          <span className="font-semibold text-white">{monthsLabel(signals.accountAgeMonths)}</span>
        </SignalRow>
        <SignalRow icon={ClipboardList}>
          <span className="font-semibold text-white">{signals.animalsTracked}</span>
          {' '}gecko{signals.animalsTracked === 1 ? '' : 's'} tracked
        </SignalRow>
        <SignalRow icon={Scale}>
          <span className="font-semibold text-white">{signals.weightLogsCount}</span>
          {' '}weight log{signals.weightLogsCount === 1 ? '' : 's'} recorded
        </SignalRow>
        <SignalRow icon={ArrowLeftRight}>
          <span className="font-semibold text-white">{signals.ownershipTransfers}</span>
          {' '}ownership record{signals.ownershipTransfers === 1 ? '' : 's'} on file
        </SignalRow>
        {signals.reviewCount > 0 && signals.avgRating != null && (
          <SignalRow icon={Star}>
            <span className="font-semibold text-white">{signals.avgRating}</span>
            {' '}average from{' '}
            <span className="font-semibold text-white">{signals.reviewCount}</span>
            {' '}buyer review{signals.reviewCount === 1 ? '' : 's'}
          </SignalRow>
        )}
        {signals.isVerifiedBreeder && (
          <SignalRow icon={ShieldCheck}>Verified breeder profile</SignalRow>
        )}
        {signals.isFeaturedBreeder && (
          <SignalRow icon={Award}>Featured breeder on Geck Inspect</SignalRow>
        )}
      </div>

      <p className="mt-4 pt-3 border-t border-slate-800 text-xs text-slate-500 leading-relaxed">
        These numbers come from records created on the platform. Each entry is
        timestamped the moment it is saved and cannot be backdated.
      </p>
    </div>
  );
}
