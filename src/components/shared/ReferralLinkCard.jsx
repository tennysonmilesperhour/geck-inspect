import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Gift, Copy, Check } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { buildReferralLink } from '@/lib/referral';

// The member's referral link, shown on the Dashboard and the Membership
// page. It used to live in the sidebar footer, which left the rail too
// crowded to scroll comfortably on a phone.
//
// Every signed-in member has a link. When someone who signed up through it
// starts a paid plan, the referrer gets one free month of Keeper (a month
// credited to the next bill if they already subscribe); the reward is
// settled server-side by award_referral_reward(). Only a brand new
// account that has never had a plan can be referred (apply_referral_code).
// Grandfathered Breeder members already have Breeder free for life, so a
// Keeper month would give them nothing: they see the link without a
// reward promise. Renders nothing for guests and signed-out visitors,
// since there is no link to share.
export default function ReferralLinkCard({ className = '' }) {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);

  if (!user?.referral_code) return null;

  const link = buildReferralLink(user.referral_code);
  const paidReferrals = Number(user.referral_signup_count) || 0;
  const isGrandfathered = user.subscription_status === 'grandfathered';

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
    <div className={`rounded-xl border border-emerald-500/30 bg-emerald-950/30 p-5 md:p-6 ${className}`}>
      <div className="flex flex-col md:flex-row md:items-center gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-emerald-200">
            <Gift className="w-4 h-4 flex-shrink-0" />
            <span className="text-xs font-semibold uppercase tracking-wider">
              Refer a keeper
            </span>
          </div>
          {isGrandfathered ? (
            <p className="mt-2 text-sm leading-relaxed text-emerald-100/80">
              Share your link with another crested gecko keeper. Your Breeder plan
              is already free for life, so there is no reward to add, but every
              new keeper helps the community grow.
            </p>
          ) : (
            <p className="mt-2 text-sm leading-relaxed text-emerald-100/80">
              Share your link with a crested gecko keeper who is new to Geck
              Inspect. When they sign up through it and start a paid plan, you get{' '}
              <span className="font-semibold text-emerald-200">a free month of Keeper</span>.
              Already subscribed? A month comes off your next bill.
            </p>
          )}
          {paidReferrals > 0 && (
            <p className="mt-1.5 text-xs text-emerald-300/80">
              {paidReferrals} paid {paidReferrals === 1 ? 'referral' : 'referrals'} so far
            </p>
          )}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleCopy}
          className="w-full md:w-auto md:flex-shrink-0 justify-center whitespace-nowrap text-emerald-100/90 hover:text-white border-emerald-800/60 hover:border-emerald-600 bg-emerald-950/40"
        >
          {copied ? (
            <>
              <Check className="w-4 h-4 mr-2" /> Copied!
            </>
          ) : (
            <>
              <Copy className="w-4 h-4 mr-2" /> Copy referral link
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
