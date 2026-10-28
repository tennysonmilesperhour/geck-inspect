import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';

/**
 * Loads the offline sync badge (src/components/shared/OfflineSyncStatus.jsx)
 * only once a member is signed in. It brings the offline queue and the code
 * that sends queued logs, which a signed-out visitor has no use for, so
 * they stay out of the startup script every visitor downloads.
 *
 * A failed download (opened with no signal before the file was ever saved
 * on this device) shows nothing and tries again when the connection is
 * back, instead of blanking the app or reloading it.
 */
export default function MemberOfflineSync() {
  const { isAuthenticated } = useAuth();
  const [Status, setStatus] = useState(null);

  useEffect(() => {
    if (!isAuthenticated || Status) return undefined;
    let cancelled = false;
    const load = () => {
      import('@/components/shared/OfflineSyncStatus')
        .then((mod) => { if (!cancelled) setStatus(() => mod.default); })
        .catch(() => {});
    };
    load();
    window.addEventListener('online', load);
    return () => {
      cancelled = true;
      window.removeEventListener('online', load);
    };
  }, [isAuthenticated, Status]);

  return isAuthenticated && Status ? <Status /> : null;
}
