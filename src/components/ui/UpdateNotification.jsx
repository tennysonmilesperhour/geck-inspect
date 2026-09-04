import { useState, useEffect, useRef } from 'react';
import { RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Ten minutes, and only while the tab is visible. The old 60 second timer
// re-downloaded the HTML shell in every open tab all day, which is real
// bandwidth (and Vercel edge requests) for a notice that can wait.
const CHECK_INTERVAL_MS = 10 * 60 * 1000;

async function fetchCurrentScriptHash() {
  try {
    const res = await fetch('/', { cache: 'no-store' });
    const html = await res.text();
    // Extract the main JS src hash (Vite injects a hash into the filename)
    const match = html.match(/src="\/assets\/index-([^"]+)\.js"/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

export default function UpdateNotification() {
  const [showBanner, setShowBanner] = useState(false);
  const initialHashRef = useRef(null);

  useEffect(() => {
    // Capture the initial hash on mount
    fetchCurrentScriptHash().then(hash => {
      initialHashRef.current = hash;
    });

    let stopped = false;
    let lastCheck = Date.now();
    const check = async () => {
      if (stopped || document.visibilityState !== 'visible') return;
      lastCheck = Date.now();
      const latestHash = await fetchCurrentScriptHash();
      if (
        latestHash &&
        initialHashRef.current &&
        latestHash !== initialHashRef.current
      ) {
        setShowBanner(true);
        stopped = true;
      }
    };
    const interval = setInterval(check, CHECK_INTERVAL_MS);
    // A tab that comes back after being hidden for a while checks at once.
    const onVisible = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastCheck > CHECK_INTERVAL_MS) check();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      stopped = true;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-4 left-4 z-[99999] flex items-center gap-3 max-w-md bg-slate-800 border border-emerald-500/50 text-slate-100 px-4 py-3 rounded-xl shadow-2xl shadow-black/50 animate-in slide-in-from-bottom-4 duration-300">
      <p className="text-sm text-slate-100 leading-snug">
        The app is shedding its old skin. Click Chomp to refresh and update to the new version.
      </p>
      <Button
        size="sm"
        className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs h-8 px-3 flex-shrink-0 gap-1.5"
        onClick={() => window.location.reload()}
      >
        <RefreshCw className="w-3.5 h-3.5" />
        Chomp
      </Button>
      <button
        onClick={() => setShowBanner(false)}
        className="text-slate-400 hover:text-slate-200 transition-colors flex-shrink-0"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}