import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Gift, Copy, Check } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { buildReferralLink } from '@/lib/referral';

// Sidebar card surfacing the user's referral link. Sits above the
// Membership CTA so it's seen alongside the upgrade prompt ,  every
// signed-in user has a link, and they earn 10% of any referred user's
// subscription revenue for life. Hidden for guests / signed-out users
// (no link to share) and collapses with the rest of the sidebar chrome
// when the rail is in icon-only mode.
export default function ReferralLinkCard() {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);

  if (!user?.referral_code) return null;

  const link = buildReferralLink(user.referral_code);

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
            Refer & earn
          </span>
        </div>
        <p className="mt-2 text-[11px] leading-snug text-emerald-100/80">
          Share your link. Earn{' '}
          <span className="font-semibold text-emerald-200">10%</span> of every
          subscription paid by anyone who signs up through it ,  for life.
        </p>
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
