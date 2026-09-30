import { useEffect, useState } from 'react';
import { Loader2, Repeat } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/lib/supabaseClient';

function weekLabel(day) {
  const [y, m, d] = String(day).split('-').map(Number);
  if (!y) return String(day);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

/**
 * The market habit number: of the signed-in members active each week, how
 * many opened something market-related (the Market page, the Today card's
 * market lines, Guess the Price, Market Pricing, the Portfolio, or the
 * Geck Data site) on two or more different days. This is the number the
 * Market page is meant to move. Weeks run Monday to Sunday, Denver time.
 * From public.market_habit_weekly(), which only answers admins.
 */
export default function MarketHabitCard() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    supabase.rpc('market_habit_weekly', { p_weeks: 8 }).then(({ data, error: err }) => {
      if (cancelled) return;
      if (err) setError(err);
      else setRows(data || []);
    });
    return () => { cancelled = true; };
  }, []);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-slate-100 text-base flex items-center gap-2">
          <Repeat className="w-4 h-4 text-slate-400" />
          Market habit
        </CardTitle>
        <p className="text-xs text-slate-500">
          Members who opened something market-related on 2 or more days in a week, out of the members
          active that week. Signed-in members only; Monday to Sunday, Denver time.
        </p>
      </CardHeader>
      <CardContent>
        {error ? (
          <p className="text-sm text-red-300">Could not load: {error.message}</p>
        ) : rows === null ? (
          <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wider text-slate-500 text-left">
                  <th className="py-1.5 pr-3 font-medium">Week of</th>
                  <th className="py-1.5 pr-3 font-medium text-right">Active</th>
                  <th className="py-1.5 pr-3 font-medium text-right">Opened market</th>
                  <th className="py-1.5 pr-3 font-medium text-right">2+ days</th>
                  <th className="py-1.5 font-medium text-right">Share</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.week_start} className="border-t border-slate-800 text-slate-200">
                    <td className="py-1.5 pr-3">{weekLabel(r.week_start)}</td>
                    <td className="py-1.5 pr-3 text-right">{r.active_members}</td>
                    <td className="py-1.5 pr-3 text-right">{r.market_members}</td>
                    <td className="py-1.5 pr-3 text-right">{r.habit_members}</td>
                    <td className="py-1.5 text-right">
                      {r.habit_share == null ? 'n/a' : `${Math.round(Number(r.habit_share) * 100)}%`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
