import { useState, useEffect, useRef } from 'react';
import { FeedingGroup, OtherReptile, Notification } from '@/entities/all';
import { Button } from '@/components/ui/button';
import { X, CheckCircle2, Clock } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { todayLocalISO, daysSinceLocal } from '@/lib/dateUtils';

// Dedup window: fire at most one push/email per entity per day. The
// 5-minute polling loop would otherwise create 288 notifications a day
// for a single overdue reptile. The dedup key is scoped by the
// entity's current `last_fed_date` so that each new feeding cycle
// gets a fresh slot — without this, a user on a 1-day interval would
// only get notified every other day.
// Key: geck_fed_notified_<alertId>__<lastFedDate> → ISO timestamp of last firing.
const NOTIFY_DEDUP_HOURS = 24;
function dedupKey(alertId, lastFedDate) {
  return `geck_fed_notified_${alertId}__${lastFedDate || 'never'}`;
}
function shouldNotify(alertId, lastFedDate) {
  try {
    const last = localStorage.getItem(dedupKey(alertId, lastFedDate));
    if (!last) return true;
    const elapsedHours = (Date.now() - new Date(last).getTime()) / 36e5;
    return elapsedHours >= NOTIFY_DEDUP_HOURS;
  } catch { return true; }
}
function markNotified(alertId, lastFedDate) {
  try {
    localStorage.setItem(dedupKey(alertId, lastFedDate), new Date().toISOString());
  } catch {}
}

export default function FeedingAlertSystem({ user, enabled, lateReminders }) {
  const [alerts, setAlerts] = useState([]);
  const [dismissedAlerts, setDismissedAlerts] = useState(new Set());
  // In-flight guard. AuthContext's setUser fires on profile-enrich, every
  // auth state change, and every tab visibility change — so without this
  // mutex two loadAlerts() can race past the read-then-write dedup and
  // each insert their own notification row, fanning out to 2x pushes.
  const loadingRef = useRef(false);

  // Days past the feeding due date. 0 = due today (interval has just elapsed),
  // 1 = a day late, etc. Negative values (not yet due) are filtered upstream
  // by the `daysOverdue >= 0` check.
  const calculateDaysOverdue = (lastFedDate, intervalDays) => {
    if (!lastFedDate) return intervalDays;
    const daysElapsed = daysSinceLocal(lastFedDate) ?? 0;
    return daysElapsed - intervalDays;
  };

  // Get color based on days overdue. Order matters — check the most-overdue
  // bucket first so a 30-day overdue alert doesn't fall through to yellow.
  const getAlertColor = (daysOverdue) => {
    if (daysOverdue > 21) return 'red';
    if (daysOverdue > 14) return 'orange';
    return 'yellow';
  };

  const getGlowClass = (color) => {
    switch (color) {
      case 'red':
        return 'glow-red';
      case 'orange':
        return 'glow-orange';
      case 'yellow':
        return 'glow-yellow';
      default:
        return 'glow-yellow';
    }
  };

  // Load alerts
  useEffect(() => {
    if (!user?.email || !enabled) {
      setAlerts([]);
      return;
    }

    const loadAlerts = async () => {
      if (loadingRef.current) return;
      loadingRef.current = true;
      try {
        const [feedingGroups, otherReptiles, recentNotifs] = await Promise.all([
          FeedingGroup.filter({ created_by: user.email }),
          OtherReptile.filter({ created_by: user.email, archived: false }),
          // Pull this user's recent feeding_due notifications so we
          // can dedup across devices/tabs/sessions where localStorage
          // can't see the other side's firings. 50 is far more than a
          // single user could rack up in a day across all their
          // groups + reptiles.
          Notification.filter({ user_email: user.email, type: 'feeding_due' }, '-created_date', 50).catch(() => []),
        ]);

        const todayStr = new Date().toISOString().split('T')[0];
        const firedTodayEntityIds = new Set(
          (recentNotifs || [])
            .filter(n => {
              const created = n.created_date || n.created_at;
              return created && String(created).startsWith(todayStr);
            })
            .map(n => n.metadata?.entity_id)
            .filter(Boolean)
        );

        const newAlerts = [];

        // Check feeding groups
        feedingGroups.forEach(group => {
          const daysOverdue = calculateDaysOverdue(group.last_fed_date, group.interval_days);
          if (daysOverdue >= 0) {
            newAlerts.push({
              id: `group-${group.id}`,
              type: 'feedingGroup',
              entityId: group.id,
              name: group.name || group.label,
              daysOverdue,
              intervalDays: group.interval_days,
              lastFedDate: group.last_fed_date,
              color: getAlertColor(daysOverdue),
              group
            });
          }
        });

        // Check other reptiles with feeding reminders enabled
        otherReptiles.forEach(reptile => {
          if (reptile.feeding_reminder_enabled) {
            const daysOverdue = calculateDaysOverdue(reptile.last_fed_date, reptile.feeding_interval_days || 7);
            if (daysOverdue >= 0) {
              newAlerts.push({
                id: `reptile-${reptile.id}`,
                type: 'otherReptile',
                entityId: reptile.id,
                name: reptile.name,
                daysOverdue,
                intervalDays: reptile.feeding_interval_days || 7,
                lastFedDate: reptile.last_fed_date,
                color: getAlertColor(daysOverdue),
                reptile
              });
            }
          }
        });

        setAlerts(newAlerts);

        // Fire one `feeding_due` notification per entity per 24h. By
        // default we only ping on the day feeding becomes due
        // (daysOverdue === 0); the user has to opt into late reminders
        // in Settings to keep getting daily re-pings while overdue.
        // The DB trigger fans out to push + email subject to the
        // user's per-type preferences in Settings → Notifications.
        for (const a of newAlerts) {
          if (a.daysOverdue > 0 && !lateReminders) continue;
          if (!shouldNotify(a.id, a.lastFedDate)) continue;
          // Cross-device dedup: another browser/tab may have already
          // inserted a feeding_due row for this entity earlier today.
          if (firedTodayEntityIds.has(a.entityId)) {
            markNotified(a.id, a.lastFedDate);
            continue;
          }
          const linkPath = a.type === 'feedingGroup'
            ? '/BatchHusbandry'
            : '/OtherReptiles';
          const content = a.daysOverdue === 0
            ? `${a.name} is due for feeding today`
            : `${a.name} is ${a.daysOverdue} day${a.daysOverdue !== 1 ? 's' : ''} overdue for feeding`;
          // Claim the dedup slot BEFORE the network call so a concurrent
          // poll can't race past shouldNotify() while we're awaiting the
          // insert. We roll it back on failure so the next poll can retry.
          markNotified(a.id, a.lastFedDate);
          try {
            await Notification.create({
              user_email: user.email,
              type: 'feeding_due',
              content,
              link: linkPath,
              metadata: {
                entity_type: a.type,
                entity_id: a.entityId,
                days_overdue: a.daysOverdue,
              },
              is_read: false,
            });
          } catch (err) {
            // Don't break the toast UI if notification creation fails.
            console.warn('feeding_due notification failed:', err);
            try { localStorage.removeItem(dedupKey(a.id, a.lastFedDate)); } catch {}
          }
        }
      } catch (error) {
        console.error('Failed to load feeding alerts:', error);
      } finally {
        loadingRef.current = false;
      }
    };

    loadAlerts();
    const interval = setInterval(loadAlerts, 5 * 60 * 1000); // Refresh every 5 minutes
    return () => clearInterval(interval);
  }, [user?.email, enabled, lateReminders]);

  const handleFed = async (alert) => {
    try {
      const today = todayLocalISO();

      if (alert.type === 'feedingGroup') {
        await FeedingGroup.update(alert.entityId, { last_fed_date: today });
      } else {
        await OtherReptile.update(alert.entityId, { last_fed_date: today });
      }

      setAlerts(alerts.filter(a => a.id !== alert.id));
    } catch (error) {
      console.error('Failed to log feeding:', error);
    }
  };

  const handleDismiss = (alertId) => {
    setDismissedAlerts(new Set([...dismissedAlerts, alertId]));
  };

  const visibleAlerts = alerts.filter(a => !dismissedAlerts.has(a.id));

  if (!enabled || visibleAlerts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 max-w-sm z-40">
      <style>{`
        @keyframes feeding-glow-yellow {
          0%, 100% { box-shadow: 0 0 15px rgba(234, 179, 8, 0.3), inset 0 0 10px rgba(234, 179, 8, 0.1); }
          50% { box-shadow: 0 0 25px rgba(234, 179, 8, 0.6), inset 0 0 15px rgba(234, 179, 8, 0.2); }
        }
        @keyframes feeding-glow-orange {
          0%, 100% { box-shadow: 0 0 15px rgba(249, 115, 22, 0.4), inset 0 0 10px rgba(249, 115, 22, 0.1); }
          50% { box-shadow: 0 0 25px rgba(249, 115, 22, 0.7), inset 0 0 15px rgba(249, 115, 22, 0.2); }
        }
        @keyframes feeding-glow-red {
          0%, 100% { box-shadow: 0 0 15px rgba(239, 68, 68, 0.5), inset 0 0 10px rgba(239, 68, 68, 0.1); }
          50% { box-shadow: 0 0 25px rgba(239, 68, 68, 0.8), inset 0 0 15px rgba(239, 68, 68, 0.2); }
        }
        .glow-yellow { animation: feeding-glow-yellow 2s infinite; }
        .glow-orange { animation: feeding-glow-orange 2s infinite; }
        .glow-red { animation: feeding-glow-red 2s infinite; }
      `}</style>

      <AnimatePresence mode="popLayout">
        {visibleAlerts.map(alert => (
          <motion.div
            key={alert.id}
            layout
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className={`p-4 rounded-lg border backdrop-blur-sm mb-2 ${getGlowClass(alert.color)} ${
              alert.color === 'red'
                ? 'bg-red-950/50 border-red-700'
                : alert.color === 'orange'
                ? 'bg-orange-950/50 border-orange-700'
                : 'bg-yellow-950/50 border-yellow-700'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 flex-1">
                <Clock className={`w-5 h-5 flex-shrink-0 ${
                  alert.color === 'red'
                    ? 'text-red-400'
                    : alert.color === 'orange'
                    ? 'text-orange-400'
                    : 'text-yellow-400'
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-100 truncate">{alert.name}</p>
                  <p className={`text-sm ${
                    alert.color === 'red'
                      ? 'text-red-300'
                      : alert.color === 'orange'
                      ? 'text-orange-300'
                      : 'text-yellow-300'
                  }`}>
                    {alert.daysOverdue === 0
                      ? `Due today (every ${alert.intervalDays} days)`
                      : `${alert.daysOverdue} day${alert.daysOverdue !== 1 ? 's' : ''} overdue (every ${alert.intervalDays} days)`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleDismiss(alert.id)}
                className="text-slate-400 hover:text-slate-200 flex-shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex gap-2 mt-3">
              <Button
                onClick={() => handleFed(alert)}
                size="sm"
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-sm"
              >
                <CheckCircle2 className="w-4 h-4 mr-1" />
                Mark Fed
              </Button>
              <Button
                onClick={() => handleDismiss(alert.id)}
                variant="outline"
                size="sm"
                className="border-slate-600 text-slate-300 hover:bg-slate-800 text-sm"
              >
                Dismiss
              </Button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}