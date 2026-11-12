import { useState, useEffect, useRef } from 'react';
import { FeedingGroup, OtherReptile } from '@/entities/all';
import { daysSinceLocal } from '@/lib/dateUtils';
import { startVisiblePolling } from '@/lib/pagePolling';
import { loadUnlessRetired } from '@/lib/retiredPages';
import { getPushStatus, isPushSupported } from '@/lib/webPush';
import { isIOSDevice, isStandaloneApp, pushAskState, readPushAskDismissed } from '@/lib/pushAsk';
import PushAskCard from '@/components/notifications/PushAskCard';
import { useFloatingNotice } from '@/components/shared/floatingNoticeQueue';

// The floating feeding reminder cards are gone (experience review B4, 12
// Nov 2026). They sat on top of the page, and a dismissed card came back
// after every reload. Today lists what is due, and the menu shows a count
// on Today.
//
// What is left here is the one thing that lived only in those cards: the
// one-line ask to get feeding reminders as phone notifications. It shows
// while a feeding is due, only to a member this device can still ask
// (signed in, not subscribed, has not said "Not now"), and it takes the
// "feeding" turn in the floating notice queue
// (src/components/shared/floatingNoticeQueue.js). So this component loads
// feeding groups only to learn whether one is due, and only when the ask
// could show.
//
// The feeding_due push and email notifications come from the server
// (enqueue_feeding_reminders, a daily pg_cron job since 27 Sep 2026) so
// they arrive with the app closed, as one combined message a day.

// Days past the feeding due date: 0 is due today, 1 is a day late.
const daysOverdue = (lastFedDate, intervalDays) => {
  if (!lastFedDate) return intervalDays;
  return (daysSinceLocal(lastFedDate) ?? 0) - intervalDays;
};

export default function FeedingAlertSystem({ user, enabled }) {
  const email = user?.email;
  const isGuest = Boolean(user?.is_guest);
  const [mayAsk, setMayAsk] = useState(false);
  const [feedingDue, setFeedingDue] = useState(false);
  // In-flight guard: the profile object changes on every auth event, and
  // two loads must not run at once.
  const loadingRef = useRef(false);

  // Can this device still be asked? The same rule the card applies
  // (src/lib/pushAsk.js), checked first so a member who is subscribed, or
  // who said "Not now", costs no feeding query at all.
  useEffect(() => {
    if (!enabled || !email || isGuest) {
      setMayAsk(false);
      return undefined;
    }
    const supported = isPushSupported();
    const askable = (status) => pushAskState({
      user: { email, is_guest: isGuest },
      hasReminder: true,
      supported,
      ios: isIOSDevice(),
      standalone: isStandaloneApp(),
      status,
      dismissed: readPushAskDismissed(),
    }) !== 'hidden';
    if (!supported) {
      setMayAsk(askable(null));
      return undefined;
    }
    let cancelled = false;
    getPushStatus()
      .then((status) => { if (!cancelled) setMayAsk(askable(status)); })
      .catch(() => { if (!cancelled) setMayAsk(false); });
    return () => { cancelled = true; };
  }, [enabled, email, isGuest]);

  useEffect(() => {
    if (!mayAsk || !email) {
      setFeedingDue(false);
      return undefined;
    }

    const load = async () => {
      if (loadingRef.current) return;
      loadingRef.current = true;
      try {
        const [feedingGroups, otherReptiles] = await Promise.all([
          FeedingGroup.filter({ created_by: email }),
          // Other Reptiles is retired; its reminders come back with the page.
          // (The emailed reminders have their own switch on the server.)
          loadUnlessRetired('OtherReptiles', () => OtherReptile.filter({ created_by: email, archived: false })),
        ]);
        // A group the member muted (feeding_reminder_enabled === false) does
        // not count. Rows older than that column default to on.
        const groupDue = feedingGroups.some((group) =>
          group.feeding_reminder_enabled !== false && daysOverdue(group.last_fed_date, group.interval_days) >= 0);
        const reptileDue = otherReptiles.some((reptile) =>
          reptile.feeding_reminder_enabled && daysOverdue(reptile.last_fed_date, reptile.feeding_interval_days || 7) >= 0);
        setFeedingDue(groupDue || reptileDue);
      } catch (error) {
        console.error('Failed to check for due feedings:', error);
      } finally {
        loadingRef.current = false;
      }
    };

    load();
    // Again every 5 minutes while the tab is visible and the member is active.
    return startVisiblePolling(load, 5 * 60 * 1000);
  }, [mayAsk, email]);

  if (!mayAsk || !feedingDue) return null;
  return <FeedingPushAsk user={user} />;
}

// The card decides for itself whether it has anything to show, and stops
// showing after "Not now". This holder watches whether the card drew
// anything, and asks for the queue's "feeding" turn only while it did.
function FeedingPushAsk({ user }) {
  const holderRef = useRef(null);
  const [filled, setFilled] = useState(false);

  useEffect(() => {
    const holder = holderRef.current;
    if (!holder) return undefined;
    const read = () => setFilled(holder.childElementCount > 0);
    read();
    if (typeof MutationObserver === 'undefined') return undefined;
    const observer = new MutationObserver(read);
    observer.observe(holder, { childList: true });
    return () => observer.disconnect();
  }, []);

  const showing = useFloatingNotice('feeding', filled);

  return (
    <div
      ref={holderRef}
      hidden={!showing}
      data-floating-notice={showing ? 'feeding' : undefined}
      className="w-[min(24rem,calc(100vw-2rem))]"
    >
      <PushAskCard user={user} hasReminder compact subject="feeding reminders" source="feeding_alert" />
    </div>
  );
}
