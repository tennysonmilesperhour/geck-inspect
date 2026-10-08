import { useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { isNativePlatform } from '@/lib/revenuecat';
import { syncNativeCareReminders } from '@/lib/nativeCareReminders';

// Keeps on-device feeding and weigh-in reminders in step with the account
// when the app opens or comes back to the foreground. No permission prompt
// here: Settings is where the person turns phone reminders on.
export default function NativeCareSync() {
  const { user, isAuthenticated } = useAuth();
  const email = user?.email;
  const guest = Boolean(user?.is_guest);

  useEffect(() => {
    if (!isNativePlatform() || !isAuthenticated || !email || guest) return undefined;
    let stopped = false;
    const run = () => {
      if (!stopped) syncNativeCareReminders({ email }).catch(() => {});
    };
    run();
    let listener;
    import('@capacitor/app').then(({ App }) => App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) run();
    })).then((handle) => {
      listener = handle;
      if (stopped) handle.remove();
    }).catch(() => {});
    return () => {
      stopped = true;
      listener?.remove();
    };
  }, [email, guest, isAuthenticated]);

  return null;
}
