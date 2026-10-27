import { TrendingUp } from 'lucide-react';
import { canUseFeature } from '@/components/subscription/PlanLimitChecker';
import { Link } from 'react-router-dom';

// Keep the header shortcut inside the app.
export default function MarketIntelligenceButton({ user }) {
  const canUse = canUseFeature(user, 'market_intelligence');

  if (!canUse) return null;

  return (
    <Link
      to="/Market"
      className="gecko-header-action"
      aria-label="Open Market Intelligence"
      title="Market Intelligence"
    >
      <TrendingUp />
    </Link>
  );
}
