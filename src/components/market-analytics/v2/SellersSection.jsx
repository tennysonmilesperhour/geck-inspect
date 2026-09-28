/**
 * Sellers: how concentrated the crested gecko market is and who moves
 * the most volume. Keeps the v1 HHI concentration idea; the numbers
 * now come from real storefronts.
 */

import { Users, Award } from 'lucide-react';
import { SectionHeader, MethodologyPopover } from '../shared';

export default function SellersSection({ agg, anonymize = true }) {
  const s = agg.sellers;
  const maxBucket = Math.max(...s.size_buckets.map((b) => b.sellers), 1);
  const maxValue = Math.max(...s.top.map((t) => t.sold_value), 1);
  const label = s.hhi < 1500 ? 'Competitive' : s.hhi < 2500 ? 'Moderately concentrated' : 'Highly concentrated';

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Tile label="Sellers" value={s.total.toLocaleString()} sub={`${s.with_a_sale} made a sale in the window`} />
        <Tile label="Top 10 share" value={`${Math.round(s.top10_share * 100)}%`} sub="of observed sales value" />
        <Tile label="Top 50 share" value={`${Math.round(s.top50_share * 100)}%`} sub="of observed sales value" />
        <Tile label="Concentration" value={s.hhi.toLocaleString()} sub={`HHI, ${label.toLowerCase()}`} accent />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-2 min-w-0 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <SectionHeader
            icon={Users}
            title="Seller size"
            subtitle="Most crested gecko sellers are small. No one sets the price."
            right={
              <MethodologyPopover title="What HHI means">
                <p>The Herfindahl-Hirschman Index adds up the squares of every seller&apos;s market share. Under 1,500 is competitive, over 2,500 is concentrated. At {s.hhi}, no single breeder can move crested gecko prices on their own.</p>
              </MethodologyPopover>
            }
          />
          <div className="space-y-2.5">
            {s.size_buckets.map((b) => (
              <div key={b.label}>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-slate-300">{b.label}</span>
                  <span className="text-slate-400 tabular-nums">{b.sellers} sellers</span>
                </div>
                <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div className="h-full rounded-full bg-emerald-500/60" style={{ width: `${(b.sellers / maxBucket) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-slate-500 mt-3">{s.unattributed_listings.toLocaleString()} listings had no seller name on the scrape and are left out of this tab.</p>
        </div>

        <div className="lg:col-span-3 min-w-0 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <SectionHeader
            icon={Award}
            title="Top sellers by sales value"
            subtitle="Observed sales, valued at the last asking price"
            right={anonymize && (
              <span className="inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] leading-none bg-slate-500/15 text-slate-300 border-slate-500/40">Names hidden in demo</span>
            )}
          />
          <div className="overflow-x-auto -mx-4 px-4">
            <table className="w-full text-xs min-w-[420px]">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="text-left px-2 py-2 font-medium">Seller</th>
                  <th className="text-left px-2 py-2 font-medium w-[34%]">Sales value</th>
                  <th className="text-right px-2 py-2 font-medium">Sold</th>
                  <th className="text-right px-2 py-2 font-medium">Listed</th>
                  <th className="text-right px-2 py-2 font-medium">Median ask</th>
                </tr>
              </thead>
              <tbody>
                {s.top.map((t) => (
                  <tr key={t.rank} className="border-b border-slate-800/50">
                    <td className="px-2 py-2 text-slate-200">
                      <span className="text-slate-500 tabular-nums mr-2">{t.rank}</span>
                      {t.name || `Storefront ${String.fromCharCode(64 + t.rank)}`}
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                          <div className="h-full rounded-full bg-sky-400/70" style={{ width: `${(t.sold_value / maxValue) * 100}%` }} />
                        </div>
                        <span className="tabular-nums text-slate-300 w-14 text-right">${(t.sold_value / 1000).toFixed(1)}k</span>
                      </div>
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums text-slate-300">{t.sold}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-slate-500">{t.listings}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-slate-300">${t.median.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function Tile({ label, value, sub, accent }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-3.5 py-3 min-w-0">
      <div className="text-[11px] text-slate-400">{label}</div>
      <div className={`text-xl font-bold tabular-nums mt-1 ${accent ? 'text-emerald-300' : 'text-slate-100'}`}>{value}</div>
      <div className="text-[10px] text-slate-500 mt-0.5 truncate">{sub}</div>
    </div>
  );
}
