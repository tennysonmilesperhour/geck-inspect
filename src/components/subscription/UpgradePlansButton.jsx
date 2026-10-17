import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { openUpgradePlans, upgradeMembershipPath, upgradePromptShown } from '@/lib/activation';

/**
 * Plans control on a locked feature.
 *
 * A button wrapped in a link is invalid HTML. The click lands on the
 * button, so the link's handler never runs: no navigation, and no
 * upgrade_prompt_clicked. This control is one button. It records the
 * click through captureEvent (via openUpgradePlans) and opens
 * /Membership?from_prompt&limit_type&surface in this tab.
 *
 * trackShown records upgrade_prompt_shown while the control is on screen.
 * Parents that already record the view (the plan limit modal, the Morph ID
 * locked card) pass false so the same prompt is not counted twice.
 */
export default function UpgradePlansButton({
  limitType,
  surface,
  trackShown = true,
  children = 'See plans',
  className,
  variant,
  size,
  onAfter,
}) {
  const navigate = useNavigate();
  useEffect(() => {
    if (trackShown) upgradePromptShown(limitType, surface || limitType);
  }, [trackShown, limitType, surface]);

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      onClick={() => {
        openUpgradePlans(limitType, surface || limitType, navigate);
        if (onAfter) onAfter();
      }}
    >
      {children}
    </Button>
  );
}

/**
 * Inline "See plans" link. The href carries the same query, so a new tab
 * still lands on Membership with the prompt. A normal click stays in the
 * app and records upgrade_prompt_clicked before the route changes.
 */
export function UpgradePlansLink({
  limitType,
  surface,
  trackShown = false,
  className,
  children = 'See plans',
}) {
  const face = surface || limitType;
  const path = upgradeMembershipPath(limitType, face);
  useEffect(() => {
    if (trackShown) upgradePromptShown(limitType, face);
  }, [trackShown, limitType, face]);

  return (
    <Link
      to={path}
      className={className}
      onClick={() => openUpgradePlans(limitType, face)}
    >
      {children}
    </Link>
  );
}
