import { TrendingUp } from 'lucide-react';
import { canUseFeature } from '@/components/subscription/PlanLimitChecker';
import { Link } from 'react-router-dom';

// Keep the header shortcut inside the app. Only members with Market
// Intelligence (Enterprise) see it; the page it opens is called Prices.
export default function MarketIntelligenceButton({ user }) {
  const canUse = canUseFeature(user, 'market_intelligence');

  if (!canUse) return null;

  return (
    <Link
      to="/Market"
      className="gecko-header-action"
      aria-label="Open Prices"
      title="Prices"
    >
      <TrendingUp />
    </Link>
  );
}
