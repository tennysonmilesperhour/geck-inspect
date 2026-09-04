import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Gift, Copy, Check } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { buildReferralLink } from '@/lib/referral';

// Sidebar card surfacing the member's referral link. Sits above the
// Membership CTA so it is seen alongside the upgrade prompt. Every
// signed-in member has a link. When someone who signed up through it
// starts a paid plan, the referrer gets one free month of Keeper (a month
// credited to the next bill if they already subscribe); the reward is
// settled server-side by award_referral_reward(). Hidden for guests and
// signed-out visitors (no link to share) and collapses with the rest of
// the sidebar chrome when the rail is in icon-only mode.
export default function ReferralLinkCard() {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);

  if (!user?.referral_code) return null;

  const link = buildReferralLink(user.referral_code);
  const paidReferrals = Number(user.referral_signup_count) || 0;

  const handleCopy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt('Copy your referral link:', link);
    }
  };

  return (
    <div className="sidebar-collapse-hide">
      <div className="rounded-lg border border-emerald-700/50 bg-emerald-900/30 p-3">
        <div className="flex items-center gap-2 text-emerald-200">
          <Gift className="w-4 h-4 flex-shrink-0" />
          <span className="text-xs font-semibold uppercase tracking-wider">
            Refer a keeper
          </span>
        </div>
        <p className="mt-2 text-[11px] leading-snug text-emerald-100/80">
          Share your link with another crested gecko keeper. When they start a
          paid plan, you get{' '}
          <span className="font-semibold text-emerald-200">a free month of Keeper</span>.
          Already subscribed? A month comes off your next bill.
        </p>
        {paidReferrals > 0 && (
          <p className="mt-1 text-[11px] text-emerald-300/80">
            {paidReferrals} paid {paidReferrals === 1 ? 'referral' : 'referrals'} so far
          </p>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleCopy}
          className="mt-3 w-full justify-start text-emerald-100/90 hover:text-white border-emerald-800/60 hover:border-emerald-600 bg-emerald-950/40 text-xs"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 mr-2" /> Copied!
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5 mr-2" /> Copy referral link
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
