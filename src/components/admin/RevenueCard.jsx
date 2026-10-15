import { useEffect, useMemo, useState } from 'react';
import { DollarSign, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/lib/supabaseClient';
import {
  cancellationWhy, formatCents, lifecycleLabel, planLabel, shortDate, summarizeRevenue,
} from '@/lib/revenueSummary';

function isMissingFunction(error) {
  const text = `${error?.code || ''} ${error?.message || ''}`;
  return /PGRST202|42883|could not find the function|does not exist/i.test(text);
}

function Figure({ label, value, sublabel, tone = 'text-white' }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-800/40 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${tone}`}>{value}</p>
      {sublabel && <p className="text-xs text-slate-500 mt-1">{sublabel}</p>}
    </div>
  );
}

/**
 * Revenue from the Stripe payment ledger: monthly recurring revenue,
 * all-time revenue after refunds, and the members who have cancelled but
 * keep access until their paid month runs out. From
 * public.admin_revenue_summary(), which only answers admins.
 */
export default function RevenueCard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    supabase.rpc('admin_revenue_summary').then(({ data: payload, error: err }) => {
      if (cancelled) return;
      if (err) setError(err);
      else setData(payload || {});
    });
    return () => { cancelled = true; };
  }, []);

  const s = useMemo(() => summarizeRevenue(data), [data]);

  const header = (
    <CardHeader className="pb-2">
      <CardTitle className="text-slate-100 text-base flex items-center gap-2">
        <DollarSign className="w-4 h-4 text-slate-400" />
        Revenue
      </CardTitle>
      <p className="text-xs text-slate-500">
        Stripe payments recorded by the webhook. Monthly revenue counts each subscription still billing at its plan
        price (yearly plans divided by twelve). App Store purchases are not included.
      </p>
    </CardHeader>
  );

  if (error) {
    return (
      <Card>
        {header}
        <CardContent>
          {isMissingFunction(error) ? (
            <p className="text-sm text-amber-200/90">
              Revenue needs the database function in migration 20261016130000_stripe_ledger.sql. It has not been
              applied yet, so there is nothing to show.
            </p>
          ) : (
            <p className="text-sm text-red-300">Could not load: {error.message}</p>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      {header}
      <CardContent>
        {data === null ? (
          <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Figure
                label="Monthly recurring"
                value={formatCents(s.mrrCents)}
                sublabel={`${s.payingSubscriptions} paying subscription${s.payingSubscriptions === 1 ? '' : 's'}${
                  s.mrrByTier.length
                    ? ` · ${s.mrrByTier.map((t) => `${t.subscriptions} ${planLabel(t.tier)}`).join(', ')}`
                    : ''}`}
                tone="text-emerald-300"
              />
              <Figure
                label="All-time revenue"
                value={formatCents(s.revenueCents)}
                sublabel={`${s.chargedInvoices} charged invoice${s.chargedInvoices === 1 ? '' : 's'}${
                  s.lifetimePurchases ? ` · ${s.lifetimePurchases} lifetime (${formatCents(s.lifetimeCents)})` : ''}${
                  s.refundedCents ? ` · ${formatCents(s.refundedCents)} refunded` : ''}${
                  s.disputedCents ? ` · ${formatCents(s.disputedCents)} in dispute` : ''}`}
              />
              <Figure
                label="Cancellations scheduled"
                value={s.cancellationsScheduled}
                sublabel={s.cancellationsScheduled
                  ? `${formatCents(s.atRiskCents)} a month ends when they run out`
                  : `${s.cancelled30d} ended in the last 30 days`}
                tone={s.cancellationsScheduled ? 'text-amber-300' : 'text-white'}
              />
            </div>

            {s.scheduled.length > 0 && (
              <div>
                <p className="text-[11px] uppercase tracking-wider text-slate-500 mb-1">Waiting to cancel</p>
                <ul className="space-y-1.5">
                  {s.scheduled.map((row) => (
                    <li
                      key={`${row.email}-${row.cancel_at}`}
                      className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-sm"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-x-3">
                        <span className="text-slate-200 truncate">{row.email}</span>
                        <span className="text-xs text-slate-400 shrink-0">
                          {planLabel(row.tier, row.cycle)} · ends {shortDate(row.cancel_at) || 'at period end'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {cancellationWhy(row)} · cancelled {shortDate(row.cancelled_on)}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {s.recent.length > 0 && (
              <div>
                <p className="text-[11px] uppercase tracking-wider text-slate-500 mb-1">Recent cancellations</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <tbody>
                      {s.recent.map((row) => (
                        <tr key={`${row.email}-${row.at}-${row.kind}`} className="border-t border-slate-800 text-slate-300">
                          <td className="py-1.5 pr-3 whitespace-nowrap text-slate-500">{shortDate(row.at)}</td>
                          <td className="py-1.5 pr-3 truncate max-w-[14rem]">{row.email}</td>
                          <td className="py-1.5 pr-3 whitespace-nowrap">{lifecycleLabel(row)}</td>
                          <td className="py-1.5 text-slate-500">{cancellationWhy(row)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <p className="text-[11px] text-slate-500">
              {s.paidInvoices} paid invoice{s.paidInvoices === 1 ? '' : 's'} in the ledger, $0 ones (trial starts,
              coupons, plan switches) included.
              {s.lastPaymentAt ? ` Last payment ${shortDate(s.lastPaymentAt)}.` : ''}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
