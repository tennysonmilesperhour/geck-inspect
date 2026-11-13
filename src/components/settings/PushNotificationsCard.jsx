import { isNativePlatform } from '@/lib/revenuecat';
import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Bell, BellOff, Smartphone, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import {
  isPushSupported,
  getPushStatus,
  subscribeToPush,
  unsubscribeFromPush,
} from '@/lib/webPush';

const isStandalone = () => {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  );
};

const isIOS = () => {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent || '') && !window.MSStream;
};

/**
 * Whether this browser can take web push at all. The Reminders tab shows
 * the Push column of the notices table, and the push master switch, only
 * when it can: the same rule this card used when it held those switches.
 */
export function pushControlsAvailable() {
  return isPushSupported() && !(isIOS() && !isStandalone());
}

/**
 * Settings, Reminders: push on this device.
 *
 * Shows the current browser's subscription state and the subscribe and
 * unsubscribe buttons. The push master switch and the per-kind switches
 * moved to the notices table on the same tab (NoticesTable.jsx), beside
 * their email twins. `onToggleEnabled(true)` runs after a successful
 * subscribe so the master switch comes on, and saves, with it.
 */
export default function PushNotificationsCard({ onToggleEnabled, userEmail }) {
  const { toast } = useToast();
  const [supported] = useState(isPushSupported());
  const [permission, setPermission] = useState('default');
  const [subscribedHere, setSubscribedHere] = useState(false);
  const [busy, setBusy] = useState(false);

  const refreshStatus = useCallback(async () => {
    const s = await getPushStatus();
    setPermission(s.permission);
    setSubscribedHere(s.subscribed);
  }, []);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  const handleSubscribe = async () => {
    if (!userEmail || busy) return;
    setBusy(true);
    try {
      const res = await subscribeToPush(userEmail);
      await refreshStatus();
      if (res.ok) {
        onToggleEnabled?.(true);
        toast({
          title: 'Push notifications enabled',
          description: 'This device will now receive alerts.',
        });
      } else if (res.reason === 'no-vapid-key') {
        toast({
          title: 'Push not configured',
          description:
            'The server is missing its VAPID key. Admin: set VITE_VAPID_PUBLIC_KEY in Vercel and redeploy.',
          variant: 'destructive',
        });
      } else if (res.reason === 'permission-denied') {
        toast({
          title: 'Permission denied',
          description:
            'Re-enable notifications for Geck Inspect in your device settings, then try again.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: "Couldn't subscribe",
          description: res.error?.message || 'Please try again in a moment.',
          variant: 'destructive',
        });
      }
    } finally {
      setBusy(false);
    }
  };

  const handleUnsubscribe = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await unsubscribeFromPush();
      await refreshStatus();
      toast({
        title: 'Push disabled on this device',
        description: 'Other devices you enabled will still get alerts.',
      });
    } finally {
      setBusy(false);
    }
  };

  // Block the UI behind the "install to home screen" gate on iOS, push
  // only works from the installed PWA on iPhone, so there's no point
  // pretending otherwise.
  const iosNeedsInstall = isIOS() && !isStandalone();

  return (
    <section id="push-notifications">
      <Card>
        <CardHeader>
          <CardTitle className="text-slate-100 flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Push on this device
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {isNativePlatform() && <p className="text-sm text-slate-300">Remote push is not used in the app. Phone reminders, in the next section, schedule feeding and weigh-in alerts on this device. Email preferences on this page still apply.</p>}
          {!supported && !isNativePlatform() && (
            <div className="flex items-start gap-3 rounded-lg border border-slate-700 bg-slate-800/40 px-4 py-3 text-sm text-slate-300">
              <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <p>
                Your browser doesn&apos;t support web push. Try the latest
                version of Chrome, Edge, Firefox, or Safari, and make sure
                you&apos;re on HTTPS.
              </p>
            </div>
          )}

          {supported && iosNeedsInstall && (
            <div className="flex items-start gap-3 rounded-lg border border-emerald-800/50 bg-emerald-900/20 px-4 py-3 text-sm text-slate-200">
              <Smartphone className="w-4 h-4 text-emerald-300 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-medium text-slate-100">
                  Add Geck Inspect to your Home Screen first
                </p>
                <p className="text-slate-400">
                  Apple only lets web apps send push notifications when
                  they&apos;re installed. Tap <strong>Share</strong> →{' '}
                  <strong>Add to Home Screen</strong>, then open the app from
                  your home screen and come back to this page.
                </p>
              </div>
            </div>
          )}

          {supported && !iosNeedsInstall && (
            <>
              <div className="flex items-start justify-between gap-3 rounded-lg border border-slate-700 bg-slate-800/40 px-4 py-3">
                <div className="flex items-start gap-3">
                  {subscribedHere ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                  ) : (
                    <BellOff className="w-5 h-5 text-slate-500 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium text-slate-100">
                      {subscribedHere
                        ? 'This device is receiving push notifications'
                        : 'This device is not subscribed'}
                    </p>
                    <p className="text-xs text-slate-400">
                      {subscribedHere
                        ? 'Tap Unsubscribe to stop pushes on this browser/device only.'
                        : permission === 'denied'
                        ? 'Notifications are blocked. Re-enable in device settings, then try again.'
                        : 'Tap Enable to start getting alerts on this device.'}
                    </p>
                  </div>
                </div>
                {subscribedHere ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleUnsubscribe}
                    disabled={busy}
                    className="border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 flex-shrink-0"
                  >
                    {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Unsubscribe'}
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={handleSubscribe}
                    disabled={busy || permission === 'denied'}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white flex-shrink-0"
                  >
                    {busy ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <>
                        <Bell className="w-3.5 h-3.5 mr-1.5" />
                        Enable
                      </>
                    )}
                  </Button>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
