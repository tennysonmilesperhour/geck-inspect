import { useState, useEffect } from 'react';
import { FeedingGroup, OtherReptile } from '@/entities/all';
import { Button } from '@/components/ui/button';
import { X, CheckCircle2, Clock } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

export default function FeedingAlertSystem({ user, enabled }) {
  const [alerts, setAlerts] = useState([]);
  const [dismissedAlerts, setDismissedAlerts] = useState(new Set());

  // Calculate days overdue
  const calculateDaysOverdue = (lastFedDate, intervalDays) => {
    if (!lastFedDate) return intervalDays;
    const lastFed = new Date(lastFedDate);
    const now = new Date();
    const daysElapsed = Math.floor((now - lastFed) / (1000 * 60 * 60 * 24));
    return Math.max(0, daysElapsed - intervalDays);
  };

  // Get color based on days overdue
  const getAlertColor = (daysOverdue) => {
    if (daysOverdue > 7) return 'yellow'; // yellow - 1+ week overdue
    if (daysOverdue > 14) return 'orange'; // orange - 2+ weeks overdue
    if (daysOverdue > 21) return 'red'; // red - 3+ weeks overdue
    return 'yellow'; // default yellow
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
    if (!user || !enabled) {
      setAlerts([]);
      return;
    }

    const loadAlerts = async () => {
      try {
        const [feedingGroups, otherReptiles] = await Promise.all([
          FeedingGroup.filter({ created_by: user.email }),
          OtherReptile.filter({ created_by: user.email, archived: false })
        ]);

        const newAlerts = [];

        // Check feeding groups
        feedingGroups.forEach(group => {
          const daysOverdue = calculateDaysOverdue(group.last_fed_date, group.interval_days);
          if (daysOverdue > 0) {
            newAlerts.push({
              id: `group-${group.id}`,
              type: 'feedingGroup',
              entityId: group.id,
              name: group.name || group.label,
              daysOverdue,
              intervalDays: group.interval_days,
              color: getAlertColor(daysOverdue),
              group
            });
          }
        });

        // Check other reptiles with feeding reminders enabled
        otherReptiles.forEach(reptile => {
          if (reptile.feeding_reminder_enabled) {
            const daysOverdue = calculateDaysOverdue(reptile.last_fed_date, reptile.feeding_interval_days || 7);
            if (daysOverdue > 0) {
              newAlerts.push({
                id: `reptile-${reptile.id}`,
                type: 'otherReptile',
                entityId: reptile.id,
                name: reptile.name,
                daysOverdue,
                intervalDays: reptile.feeding_interval_days || 7,
                color: getAlertColor(daysOverdue),
                reptile
              });
            }
          }
        });

        setAlerts(newAlerts);
      } catch (error) {
        console.error('Failed to load feeding alerts:', error);
      }
    };

    loadAlerts();
    const interval = setInterval(loadAlerts, 5 * 60 * 1000); // Refresh every 5 minutes
    return () => clearInterval(interval);
  }, [user, enabled]);

  const handleFed = async (alert) => {
    try {
      const today = new Date().toISOString().split('T')[0];

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
                    {alert.daysOverdue} day{alert.daysOverdue !== 1 ? 's' : ''} overdue (every {alert.intervalDays} days)
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