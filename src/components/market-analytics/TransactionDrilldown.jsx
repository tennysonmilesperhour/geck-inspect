/**
 * Transaction Drilldown Modal
 *
 * The "two clicks to the underlying transaction" layer. Every chart in
 * the analytics module calls the container's `onDrillDown` with the
 * filter criteria for whatever cell/bar/row was clicked; the container
 * shows this modal with the matching transactions.
 *
 * Each row shows everything a serious buyer needs to audit the number:
 * price, combo, region, age class, lineage tier, breeder, time on
 * market, date, and source. Source badges are clickable — the user
 * can follow exactly where the data came from.
 */

import { useEffect, useState, useMemo } from 'react';
import { X, Download, ExternalLink } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { queryTransactions } from '@/lib/marketAnalytics/queries';
import { SourceBadge } from './shared';
import { HIGH_VALUE_COMBOS, REGIONS, AGE_CLASSES, LINEAGE_TIERS } from '@/lib/marketAnalytics/taxonomy';

const AGE_LABEL     = Object.fromEntries(AGE_CLASSES.map((a) => [a.code, a.label]));
const LINEAGE_LABEL = Object.fromEntries(LINEAGE_TIERS.map((t) => [t.code, t.label]));
const COMBO_LABEL   = Object.fromEntries(HIGH_VALUE_COMBOS.map((c) => [c.id, c.name]));
const REGION_LABEL  = Object.fromEntries(REGIONS.map((r) => [r.code, r.name]));

export default function TransactionDrilldown({ open, onClose, criteria }) {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    if (!open || !criteria) return;
    let mounted = true;
    queryTransactions({ ...criteria, limit: 100 }).then((r) => {
      if (mounted) setRows(r);
    });
    return () => { mounted = false; };
  }, [open, criteria]);

  const title = useMemo(() => {
    if (!criteria) return 'Transactions';
    const parts = [];
    if (criteria.combo_id) parts.push(COMBO_LABEL[criteria.combo_id] ?? criteria.combo_id);
    if (criteria.region)   parts.push(REGION_LABEL[criteria.region]  ?? criteria.region);
    if (criteria.timeframe) parts.push(criteria.timeframe);
    return parts.length ? parts.join(' — ') : 'Transactions';
  }, [criteria]);

  const handleExport = () => {
    if (!rows.length) return;
    const header = [
      'date','combo','region','age_class','lineage_tier','breeder','status',
      'ask_price','sold_price','time_on_market_days','source_id',
    ];
    const csv = [header.join(',')].concat(
      rows.map((r) => [
        r.date, safeCsv(r.combo_name), r.region, r.age_class, r.lineage_tier,
        safeCsv(r.breeder_name), r.status, r.ask_price, r.sold_price ?? '',
        r.time_on_market_days, r.source_id,
      ].join(','))
    ).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `transactions_${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose?.()}>
      <DialogContent className="bg-slate-950 border-slate-800 max-w-5xl w-[95vw] p-0 max-h-[85vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800">
          <div>
            <h2 className="text-base font-semibold text-slate-100">{title}</h2>
            <p className="text-[11px] text-slate-500">{rows.length} transaction{rows.length !== 1 ? 's' : ''} — latest first</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExport}
              disabled={!rows.length}
              className="inline-flex items-center gap-1 text-xs text-slate-300 hover:text-white disabled:opacity-40 border border-slate-700 bg-slate-900 hover:bg-slate-800 rounded px-2.5 py-1"
            >
              <Download className="w-3.5 h-3.5" />Export CSV
            </button>
            <button onClick={onClose} className="p-1 rounded hover:bg-slate-800 text-slate-400">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-slate-950 z-10">
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="text-left px-3 py-2 font-medium">Date</th>
                <th className="text-left px-3 py-2 font-medium">Combo</th>
                <th className="text-left px-3 py-2 font-medium">Region</th>
                <th className="text-left px-3 py-2 font-medium">Age</th>
                <th className="text-left px-3 py-2 font-medium">Lineage</th>
                <th className="text-left px-3 py-2 font-medium">Breeder</th>
                <th className="text-right px-3 py-2 font-medium">Ask</th>
                <th className="text-right px-3 py-2 font-medium">Sold</th>
                <th className="text-right px-3 py-2 font-medium">Days</th>
                <th className="text-left px-3 py-2 font-medium">Source</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-slate-800/50 hover:bg-slate-900/50">
                  <td className="px-3 py-1.5 text-slate-400 tabular-nums text-[11px]">{r.date}</td>
                  <td className="px-3 py-1.5 text-slate-100 font-medium">{r.combo_name}</td>
                  <td className="px-3 py-1.5 text-slate-300">{r.region}</td>
                  <td className="px-3 py-1.5 text-slate-400">{AGE_LABEL[r.age_class] ?? r.age_class}</td>
                  <td className="px-3 py-1.5 text-slate-400">{LINEAGE_LABEL[r.lineage_tier] ?? r.lineage_tier}</td>
                  <td className="px-3 py-1.5 text-slate-300">{r.breeder_name}</td>
                  <td className="px-3 py-1.5 text-right text-slate-300 tabular-nums">${r.ask_price.toLocaleString()}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums font-semibold">
                    {r.sold_price ? <span className="text-emerald-300">${r.sold_price.toLocaleString()}</span> : <span className="text-slate-600">listed</span>}
                  </td>
                  <td className="px-3 py-1.5 text-right text-slate-400 tabular-nums">{r.time_on_market_days}d</td>
                  <td className="px-3 py-1.5"><SourceBadge sourceId={r.source_id} size="xs" /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && (
            <div className="py-10 text-center text-xs text-slate-500">
              No transactions match those criteria.
            </div>
          )}
        </div>

        <div className="px-5 py-2 border-t border-slate-800 text-[10px] text-slate-500 flex items-center justify-between">
          <span>Transactions are capped at 100 rows. Export CSV for the full set.</span>
          <span className="inline-flex items-center gap-1">
            <ExternalLink className="w-3 h-3" />All prices in USD; regional figures converted at prior-quarter FX.
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function safeCsv(s) {
  if (s == null) return '';
  const str = String(s);
  if (/[,"\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}
