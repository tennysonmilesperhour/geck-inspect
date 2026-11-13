import { UpgradePlansLink } from '@/components/subscription/UpgradePlansButton';

// One look and one wording pattern for a plan-limit notice (experience
// review, finding J6). Limit notices used to be written separately in
// each place that had one. This is presentation only: it says nothing
// about plans or prices itself. The caller supplies the one line of
// explanation, and the link is the same "See plans" every paywall uses
// (/Membership?limit_type&surface&from_prompt, with upgrade_prompt_shown
// and upgrade_prompt_clicked recorded exactly as UpgradePlansLink does).

const SHAPES = {
  // In the page, where the limit applies.
  inline: 'rounded-lg border border-amber-600/40 bg-amber-950/30 p-3 text-sm text-amber-200',
  // The same body inside a dialog that has its own title.
  modal: 'text-center text-sm text-slate-300',
};

/** "6 of 10 used", or '' when either number is missing or the plan has no limit. */
export function planLimitCount(used, limit) {
  const a = Number(used);
  const b = Number(limit);
  if (used == null || limit == null || !Number.isFinite(a) || !Number.isFinite(b)) return '';
  return `${a} of ${b} used`;
}

/**
 * Props:
 *   what         what is limited, in a few words ("Geckos", "AI Image
 *                Import"); optional
 *   used, limit  the numbers, shown as "6 of 10 used" when both are known
 *   children     one line of explanation, in the caller's own words
 *   limitType    which limit, for the link and its events
 *   surface      where the notice is, for the link and its events
 *   trackShown   record upgrade_prompt_shown while the notice is on
 *                screen. False (the default) when the parent already
 *                counts it, so one prompt is not counted twice.
 *   shape        'inline' (a box in the page) or 'modal' (inside a dialog)
 *   role         'status' by default, so a screen reader hears it arrive
 * Anything else (data attributes, an id) goes on the outer element.
 */
export default function PlanLimitNotice({
  what, used, limit, children, limitType, surface, trackShown = false, shape = 'inline', role = 'status', ...rest
}) {
  const heading = [what, planLimitCount(used, limit)].filter(Boolean).join(': ');
  return (
    <div role={role} data-plan-limit-notice={limitType || ''} className={SHAPES[shape] || SHAPES.inline} {...rest}>
      {heading && <p className="mb-1 font-semibold text-amber-100">{heading}</p>}
      {children}{' '}
      <UpgradePlansLink
        limitType={limitType}
        surface={surface}
        trackShown={trackShown}
        className="relative touch-hit underline underline-offset-2 hover:text-amber-100"
      >
        See plans
      </UpgradePlansLink>
    </div>
  );
}
