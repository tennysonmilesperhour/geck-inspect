import { useEffect, useState } from 'react';
import { Bell, BellOff } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { isNativePlatform } from '@/lib/revenuecat';
import { enableNativeCareReminders, nativeCarePermission } from '@/lib/nativeCareReminders';

// On-device reminders. Hidden on the website, where email and web push
// already cover the same feeding and weigh-in events.
export default function PhoneRemindersCard({ email }) {
  const { toast } = useToast();
  const native = isNativePlatform();
  const [permission, setPermission] = useState(native ? 'loading' : 'unsupported');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!native) return undefined;
    let stopped = false;
    nativeCarePermission()
      .then((value) => { if (!stopped) setPermission(value); })
      .catch(() => { if (!stopped) setPermission('prompt'); });
    return () => { stopped = true; };
  }, [native]);

  if (!native) return null;

  const turnOn = async () => {
    if (!email || busy) return;
    setBusy(true);
    try {
      const result = await enableNativeCareReminders(email);
      setPermission(result.reason === 'ok' ? 'granted' : (result.reason || 'denied'));
      if (result.reason === 'ok') {
        toast({
          title: result.scheduled ? 'Phone reminders on' : 'Phone reminders on',
          description: result.scheduled
            ? `${result.scheduled} reminder${result.scheduled === 1 ? '' : 's'} scheduled on this phone.`
            : 'This phone will remind you when a feeding or weigh-in is due. None are due in the next month yet.',
        });
      } else if (result.reason === 'denied') {
        toast({
          title: 'Notifications are blocked',
          description: 'Allow notifications for Geck Inspect in the phone settings, then come back here.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({ title: 'Could not schedule reminders', description: error.message || 'Try again.', variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section id="phone-reminders">
      <Card>
        <CardHeader>
          <CardTitle className="text-slate-100 flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Phone reminders
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-300">
            Feeding and weigh-in reminders are scheduled on this phone, so they still arrive when the app is closed.
            They follow the feeding and weigh-in switches below. Email is separate and stays on the switches above.
          </p>
          <div className="flex items-start justify-between gap-3 rounded-lg border border-slate-700 bg-slate-800/40 px-4 py-3">
            <div className="flex items-start gap-3">
              {permission === 'granted' ? (
                <Bell className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
              ) : (
                <BellOff className="w-5 h-5 text-slate-500 flex-shrink-0 mt-0.5" />
              )}
              <div>
                <p className="text-sm font-medium text-slate-100">
                  {permission === 'granted' ? 'This phone can show care reminders' : 'This phone is not showing care reminders yet'}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  {permission === 'denied'
                    ? 'Notifications are blocked. Turn them on for Geck Inspect in the phone settings, then tap the button again.'
                    : 'The reminder is a local notification on this device. It is not a remote push.'}
                </p>
              </div>
            </div>
          </div>
          {permission !== 'granted' && (
            <Button type="button" onClick={turnOn} disabled={busy || !email} className="bg-emerald-600 hover:bg-emerald-500 text-white">
              {busy ? 'Asking the phone...' : 'Turn on phone reminders'}
            </Button>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
