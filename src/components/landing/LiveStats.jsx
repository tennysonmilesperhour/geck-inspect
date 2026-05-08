import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Users, BookOpen, GitBranch } from 'lucide-react';

/**
 * Live stats strip for the public landing page.
 *
 * Calls the public.landing_stats() RPC, which is a SECURITY DEFINER
 * function that returns aggregate counts only (no row data). The
 * function is callable by the anon role.
 *
 * Honesty rule: if any of the three numbers falls below MIN_DISPLAY,
 * the entire strip self-hides. INTENT.md is explicit that small,
 * specific, believable proof beats large, vague proof. A stat like
 * "3 pairings logged" reads worse than no stat at all.
 */
const MIN_DISPLAY = 10;

function formatCount(n) {
  if (n == null) return null;
  return Number(n).toLocaleString();
}

export default function LiveStats() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    let cancelled = false;
    supabase
      .rpc('landing_stats')
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data) {
          setStats({ error: true });
          return;
        }
        setStats(data);
      })
      .catch(() => {
        if (cancelled) return;
        setStats({ error: true });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!stats) return null;
  if (stats.error) return null;

  const { keepers, geckos, pairings } = stats;
  if (
    keepers == null ||
    geckos == null ||
    pairings == null ||
    keepers < MIN_DISPLAY ||
    geckos < MIN_DISPLAY ||
    pairings < MIN_DISPLAY
  ) {
    return null;
  }

  return (
    <section className="relative z-10 max-w-4xl mx-auto px-6 pb-20 -mt-6">
      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-950/20 backdrop-blur p-6 md:p-8">
        <p className="text-center text-xs uppercase tracking-widest text-emerald-300/70 mb-6 font-semibold">
          A real platform, with real keepers
        </p>
        <div className="grid grid-cols-3 gap-4 md:gap-8 text-center">
          <div>
            <div className="flex items-center justify-center mb-2">
              <Users className="w-5 h-5 text-emerald-300" />
            </div>
            <div className="text-3xl md:text-4xl font-bold text-white tabular-nums">
              {formatCount(keepers)}
            </div>
            <div className="text-xs md:text-sm text-slate-400 mt-1">
              keepers signed up
            </div>
          </div>
          <div>
            <div className="flex items-center justify-center mb-2">
              <BookOpen className="w-5 h-5 text-emerald-300" />
            </div>
            <div className="text-3xl md:text-4xl font-bold text-white tabular-nums">
              {formatCount(geckos)}
            </div>
            <div className="text-xs md:text-sm text-slate-400 mt-1">
              crested geckos tracked
            </div>
          </div>
          <div>
            <div className="flex items-center justify-center mb-2">
              <GitBranch className="w-5 h-5 text-emerald-300" />
            </div>
            <div className="text-3xl md:text-4xl font-bold text-white tabular-nums">
              {formatCount(pairings)}
            </div>
            <div className="text-xs md:text-sm text-slate-400 mt-1">
              pairings logged
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
