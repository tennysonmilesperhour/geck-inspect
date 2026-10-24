/**
 * OwnershipChain, the public chain-of-custody timeline for an animal passport.
 *
 * Renders the ownership_records for one gecko as a vertical timeline:
 * the breeder/origin record first, then every transfer in order. Renders
 * nothing at all when there are no records (the passport page decides
 * what to show in that case).
 *
 * Public-safe by design: only display names are shown. If a record's
 * owner_name was stored as an email address, we show the part before
 * the @ and never the full address. Empty names fall back to a generic
 * "Verified owner" label.
 */
import { format } from 'date-fns';
import { ShieldCheck } from 'lucide-react';
import { TRANSFER_METHOD_LABELS } from '@/lib/passportUtils';

/**
 * Mask anything that looks like an email. The public passport should
 * never expose a raw address, even if older records stored one in
 * owner_name.
 */
export function publicOwnerName(name) {
  if (!name || !String(name).trim()) return 'Verified owner';
  const trimmed = String(name).trim();
  if (trimmed.includes('@')) {
    const local = trimmed.split('@')[0].trim();
    return local || 'Verified owner';
  }
  return trimmed;
}

function sortRecords(records) {
  return [...records].sort((a, b) => {
    const da = new Date(a.acquired_date || a.created_date || 0);
    const db = new Date(b.acquired_date || b.created_date || 0);
    return da - db;
  });
}

export default function OwnershipChain({ records }) {
  if (!records || records.length === 0) return null;
  const chain = sortRecords(records);

  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-900 p-6">
      <h2 className="text-xl font-bold text-slate-100 mb-4 tracking-tight">
        Chain of Custody
      </h2>

      <div className="space-y-0">
        {chain.map((r, i) => {
          const isOrigin = i === 0;
          const displayName = publicOwnerName(r.owner_name);
          const methodLabel = r.transfer_method
            ? TRANSFER_METHOD_LABELS[r.transfer_method] || r.transfer_method
            : (isOrigin ? TRANSFER_METHOD_LABELS.original_breeder : null);
          return (
            <div key={r.id || i} className="flex gap-4 items-start">
              <div className="flex flex-col items-center self-stretch">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 border ${
                    isOrigin
                      ? 'bg-emerald-500 text-slate-950 border-emerald-500'
                      : 'bg-emerald-500/10 text-slate-100 border-transparent'
                  }`}
                  title={isOrigin ? 'Origin of this chain' : `Owner ${i + 1}`}
                >
                  {displayName[0].toUpperCase()}
                </div>
                {i < chain.length - 1 && (
                  <div className="w-px flex-1 my-1 bg-emerald-500/25" />
                )}
              </div>
              <div className="pb-6 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-slate-200">{displayName}</p>
                  {isOrigin && (
                    <span className="text-[10px] uppercase tracking-wider rounded-full px-2 py-0.5 font-semibold bg-emerald-500/10 text-emerald-400">
                      Origin
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="text-xs text-slate-400 tabular-nums">
                    {r.acquired_date
                      ? format(new Date(r.acquired_date), 'MMM d, yyyy')
                      : 'Date not recorded'}
                  </span>
                  {methodLabel && (
                    <span className="text-xs rounded-full px-2 py-0.5 bg-emerald-500/10 text-slate-200">
                      {methodLabel}
                    </span>
                  )}
                </div>
                {r.notes && <p className="text-xs mt-1 text-slate-400">{r.notes}</p>}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-start gap-2.5 rounded-lg px-3 py-2.5 mt-2 bg-emerald-500/10">
        <ShieldCheck size={16} className="shrink-0 mt-0.5 text-emerald-400" />
        <p className="text-xs leading-relaxed text-slate-400">
          <span className="text-slate-100 font-semibold">Verified on Geck Inspect.</span>{' '}
          Each entry above was timestamped in the Geck Inspect database the moment it
          was created. Later owners cannot backdate or rewrite earlier entries, so this
          chain reflects the animal&apos;s real history of custody.
        </p>
      </div>
    </div>
  );
}
