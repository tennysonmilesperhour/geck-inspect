import { useEffect, useRef } from 'react';
import { Egg, Notification } from '@/entities/all';
import { differenceInDays } from 'date-fns';
import { parseLocalDate } from '@/lib/dateUtils';

/**
 * HatchAlertSystem ,  silent producer for `hatch_alert` notifications.
 *
 * Polls the signed-in user's incubating eggs every 15 minutes. When an
 * egg has been incubating long enough that the user's
 * `hatch_alert_days` threshold has been reached (default 60 days), we
 * insert a `hatch_alert` notification row. The DB trigger on
 * notifications.INSERT then fans out to web push + email subject to
 * the user's preferences in Settings → Notifications.
 *
 * Mirrors src/components/feeding/FeedingAlertSystem.jsx ,  same
 * polling-with-localStorage-dedup pattern, but renders no UI. The
 * Hatchery page already highlights "near hatching" eggs visually;
 * this component just owns the *off-page* notification path.
 *
 * Dedup: localStorage key `geck_hatch_notified_<eggId>` → ISO
 * timestamp. We only re-notify after NOTIFY_DEDUP_HOURS even if the
 * egg keeps qualifying. That way one egg in its hatch window doesn't
 * pummel the user with daily pushes for two months.
 */

const POLL_INTERVAL_MS = 15 * 60 * 1000;       // 15 min
const NOTIFY_DEDUP_HOURS = 72;                 // re-ping at most every 3 days
const DEFAULT_HATCH_ALERT_DAYS = 60;

function shouldNotify(eggId) {
  try {
    const last = localStorage.getItem(`geck_hatch_notified_${eggId}`);
    if (!last) return true;
    const elapsedHours = (Date.now() - new Date(last).getTime()) / 36e5;
    return elapsedHours >= NOTIFY_DEDUP_HOURS;
  } catch { return true; }
}
function markNotified(eggId) {
  try {
    localStorage.setItem(`geck_hatch_notified_${eggId}`, new Date().toISOString());
  } catch {}
}

export default function HatchAlertSystem({ user, enabled }) {
  // Guard against the 15-min interval and the focus listener firing
  // checkEggs() in parallel ,  without this, two scans could each pass
  // the localStorage shouldNotify() check before either has written
  // its dedup stamp, doubling the notification row insert.
  const loadingRef = useRef(false);

  useEffect(() => {
    if (!user?.email || enabled === false) return undefined;

    const threshold = Number.isFinite(user?.hatch_alert_days)
      ? user.hatch_alert_days
      : DEFAULT_HATCH_ALERT_DAYS;

    const checkEggs = async () => {
      if (loadingRef.current) return;
      loadingRef.current = true;
      try {
        const eggs = await Egg.filter({ created_by: user.email });
        const today = new Date();

        for (const egg of eggs || []) {
          if (egg.status !== 'Incubating') continue;
          if (egg.archived) continue;
          if (!egg.lay_date) continue;
          const daysIncubating = differenceInDays(today, parseLocalDate(egg.lay_date));
          if (daysIncubating < threshold) continue;
          if (!shouldNotify(egg.id)) continue;

          // Build a friendly description. Prefer the explicit
          // hatch_date_expected if set; otherwise just say "now in
          // hatch window" with the day count.
          const expected = egg.hatch_date_expected
            ? parseLocalDate(egg.hatch_date_expected)
            : null;
          const daysToExpected = expected
            ? differenceInDays(expected, today)
            : null;
          let body;
          if (daysToExpected != null && daysToExpected >= 0) {
            body = `An egg in your incubator is due to hatch in ${daysToExpected} day${daysToExpected === 1 ? '' : 's'} (incubating for ${daysIncubating} days). Time to check on it.`;
          } else if (daysToExpected != null && daysToExpected < 0) {
            body = `An egg in your incubator is ${Math.abs(daysToExpected)} day${Math.abs(daysToExpected) === 1 ? '' : 's'} past its expected hatch date. Check on it ASAP.`;
          } else {
            body = `An egg has been incubating for ${daysIncubating} days ,  within the hatch window.`;
          }

          try {
            await Notification.create({
              user_email: user.email,
              type: 'hatch_alert',
              content: body,
              link: '/Breeding',
              metadata: {
                egg_id: egg.id,
                lay_date: egg.lay_date,
                hatch_date_expected: egg.hatch_date_expected || null,
                days_incubating: daysIncubating,
              },
              is_read: false,
            });
            markNotified(egg.id);
          } catch (err) {
            console.warn('hatch_alert notification failed:', err);
          }
        }
      } catch (err) {
        console.warn('HatchAlertSystem: egg poll failed:', err);
      } finally {
        loadingRef.current = false;
      }
    };

    // Run once on mount, then on the polling cadence. We also re-check
    // on window-focus so a user opening the PWA mid-day doesn't have
    // to wait up to 15 minutes for the first check.
    checkEggs();
    const interval = setInterval(checkEggs, POLL_INTERVAL_MS);
    const onFocus = () => checkEggs();
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [user?.email, user?.hatch_alert_days, enabled]);

  return null;
}
