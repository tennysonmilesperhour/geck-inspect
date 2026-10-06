import { useCallback, useEffect, useRef, useState } from 'react';
import { CloudOff, RefreshCw } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { syncNow, useOfflineQueue } from '@/lib/offlineSync';

const RETRY_MS = 60 * 1000;

/**
 * App-wide offline indicator. Shows "Offline" with no signal and
 * "N waiting to sync" while Field Mode logs made offline are still on the
 * device, and sends them as soon as the connection is back (also on app
 * open and once a minute while any are waiting).
 */
export default function OfflineSyncStatus() {
  const { pending, online } = useOfflineQueue();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  const run = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const result = await syncNow();
      if (result?.saved) {
        toast({ title: 'Synced', description: `${result.saved} offline log${result.saved === 1 ? '' : 's'} saved.` });
      }
      if (result?.failed?.length) {
        const n = result.failed.length;
        toast({
          title: 'Some offline logs could not be saved',
          description: `${n} log${n === 1 ? ' was' : 's were'} refused by the server (for example, the gecko was deleted). Log ${n === 1 ? 'it' : 'them'} again from the gecko's record.`,
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.warn('Offline sync failed:', error);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [toast]);

  const hasPending = pending > 0;
  useEffect(() => {
    if (online && hasPending) run();
  }, [online, hasPending, run]);

  useEffect(() => {
    if (!online || !hasPending) return undefined;
    const t = setInterval(run, RETRY_MS);
    return () => clearInterval(t);
  }, [online, hasPending, run]);

  if (online && !hasPending) return null;

  let label = 'Offline';
  if (!online && hasPending) label = `Offline, ${pending} waiting to sync`;
  else if (online && hasPending) label = busy ? `Syncing ${pending}` : `${pending} waiting to sync`;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-[calc(var(--bottom-bar-h)+1rem)] md:bottom-4 right-4 z-[9999] flex items-center gap-2 rounded-full border border-amber-500/40 bg-slate-900/95 px-3 py-1.5 text-xs font-semibold text-amber-200 shadow-lg"
    >
      {online ? (
        <RefreshCw className={`h-3.5 w-3.5 ${busy ? 'animate-spin' : ''}`} />
      ) : (
        <CloudOff className="h-3.5 w-3.5" />
      )}
      <span>{label}</span>
    </div>
  );
}
