import { useEffect, useState } from 'react';
import { TrendingUp } from 'lucide-react';
import { canUseFeature } from '@/components/subscription/PlanLimitChecker';
import { MARKET_INTELLIGENCE_URL } from '@/lib/constants';

// Topbar launcher for the standalone Market Intelligence (geck-data) app.
// Only renders for users whose effective tier unlocks `market_intelligence`
// (Enterprise + admins; grandfathered accounts stay on Breeder and don't
// get it ,  that's intentional per the pricing sheet).
//
// When the geck-data deployment exposes an /api/unread-count endpoint
// (returning `{ count: number }` with CORS allowing this origin) a badge
// will show. If the endpoint is missing, errors, or the browser is
// offline, the badge simply doesn't render ,  no console noise, no
// broken UI. The endpoint contract is:
//   GET <MARKET_INTELLIGENCE_URL>/api/unread-count?email=<user_email>
//   -> 200 { "count": <integer> }  | any other response = no badge
const POLL_INTERVAL_MS = 2 * 60 * 1000; // match existing unread pollers

export default function MarketIntelligenceButton({ user }) {
  const [unreadCount, setUnreadCount] = useState(0);
  const canUse = canUseFeature(user, 'market_intelligence');

  useEffect(() => {
    if (!canUse || !user?.email) {
      setUnreadCount(0);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    const url = `${MARKET_INTELLIGENCE_URL}/api/unread-count?email=${encodeURIComponent(user.email)}`;

    const fetchCount = async () => {
      try {
        const res = await fetch(url, {
          signal: controller.signal,
          credentials: 'omit',
        });
        if (!res.ok) return; // silently ignore ,  endpoint may not exist yet
        const data = await res.json();
        if (cancelled) return;
        const n = Number(data?.count);
        if (Number.isFinite(n) && n >= 0) setUnreadCount(n);
      } catch {
        // Network error, CORS error, malformed JSON ,  all map to "no badge"
      }
    };

    fetchCount();
    const interval = setInterval(fetchCount, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      controller.abort();
      clearInterval(interval);
    };
  }, [canUse, user?.email]);

  if (!canUse) return null;

  return (
    <a
      href={MARKET_INTELLIGENCE_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="gecko-header-action"
      aria-label="Open Market Intelligence in a new tab"
      title="Market Intelligence (opens in new tab)"
    >
      <TrendingUp />
      {unreadCount > 0 && (
        <span className="notification-badge">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </a>
  );
}
