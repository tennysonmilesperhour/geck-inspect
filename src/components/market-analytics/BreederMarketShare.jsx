/**
 * Breeder Market Share
 *
 * Who's moving volume in each market. Shows:
 *   - Top breeders ranked by revenue share
 *   - Concentration score (HHI ,  Herfindahl-Hirschman Index)
 *   - Tier distribution (OG / named / regional / hobby)
 *   - Release cadence implied by transaction dates
 *
 * Research note: we borrow the HHI concentration index from antitrust
 * economics because it maps beautifully onto the "can any one breeder
 * move prices?" question ,  <1500 = competitive, >2500 = concentrated.
 */

import { useEffect, useState } from 'react';
import { Users, Award, Layers3 } from 'lucide-react';
import { queryBreederShare } from '@/lib/marketAnalytics/queries';
import { LINEAGE_TIERS } from '@/lib/marketAnalytics/taxonomy';
import {
  SectionHeader, ConfidenceChip, MethodologyPopover,
} from './shared';

const TIER_LABEL = Object.fromEntries(LINEAGE_TIERS.map((t) => [t.code, t.label]));
const TIER_COLOR = {
  og_line:         'bg-purple-500/15 text-purple-300 border-purple-500/40',
  named:           'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
  regional_known:  'bg-sky-500/15 text-sky-300 border-sky-500/40',
  hobby:           'bg-slate-500/15 text-slate-300 border-slate-500/40',
  unknown:         'bg-slate-500/15 text-slate-400 border-slate-500/40',
};

export default function BreederMarketShare({ filters }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    let mounted = true;
    queryBreederShare({ regions: filters.regions, timeframe: filters.timeframe }).then((r) => {
      if (mounted) setData(r);
    });
    return () => { mounted = false; };
  }, [filters.regions, filters.timeframe]);

  if (!data) return <div className="rounded-xl border border-slate-800 bg-slate-900/40 animate-pulse h-64" />;

  const top10 = data.breeders.slice(0, 10);
  const top10Share = top10.reduce((s, b) => s + b.share_pct, 0);

  // Tier aggregation
  const tierAgg = {};
  data.breeders.forEach((b) => {
    tierAgg[b.tier] = tierAgg[b.tier] || { revenue: 0, count: 0 };
    tierAgg[b.tier].revenue += b.revenue;
    tierAgg[b.tier].count += 1;
  });
  const tierRows = Object.entries(tierAgg)
    .map(([tier, v]) => ({
      tier,
      revenue: v.revenue,
      count: v.count,
      share_pct: (v.revenue / (data.breeders.reduce((s, b) => s + b.revenue, 0) || 1)) * 100,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <SectionHeader
          icon={Users}
          title="Market concentration (HHI)"
          subtitle="Can any one breeder move the market? Higher = yes."
          right={
            <MethodologyPopover title="Herfindahl-Hirschman Index">
              <p>HHI = sum of (market-share %)², range 0–10,000. Below 1,500 is a competitive market; 1,500–2,500 is moderately concentrated; above 2,500 is highly concentrated.</p>
              <p>We compute HHI on revenue share inside the current region and timeframe filters. In a concentrated segment a single breeder's release calendar meaningfully moves prices ,  watch those events closely.</p>
            </MethodologyPopover>
          }
        />
        <div className="flex flex-wrap items-end gap-6">
          <div>
            <div className="text-3xl font-bold text-slate-100 tabular-nums">{data.hhi.toLocaleString()}</div>
            <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">HHI score</div>
          </div>
          <div>
            <div className="text-base font-semibold text-emerald-300 capitalize">{data.concentration_label}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Top 10 breeders = {top10Share.toFixed(1)}% of revenue</div>
          </div>
          <div className="ml-auto">
            <ConfidenceChip
              confidence={data.confidence}
              sampleSize={data.sample_size}
              sources={['estimated.blend']}
            />
          </div>
        </div>
        <HHIBar hhi={data.hhi} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <SectionHeader icon={Award} title="Top breeders by revenue" />
          <div className="space-y-2">
            {top10.map((b) => (
              <div key={b.breeder_id} className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-100 truncate">{b.name}</span>
                    <span className={`text-[10px] border rounded px-1.5 py-0.5 ${TIER_COLOR[b.tier] ?? TIER_COLOR.unknown}`}>
                      {TIER_LABEL[b.tier] ?? b.tier}
                    </span>
                    <span className="text-[10px] text-slate-500">{b.region}</span>
                  </div>
                  <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden mt-1">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500/60"
                      style={{ width: `${Math.min(100, b.share_pct * 3)}%` }}
                    />
                  </div>
                </div>
                <div className="text-right w-20 tabular-nums">
                  <div className="text-xs text-slate-100 font-semibold">{b.share_pct.toFixed(1)}%</div>
                  <div className="text-[10px] text-slate-500">${(b.revenue / 1000).toFixed(1)}k</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <SectionHeader
            icon={Layers3}
            title="Revenue by lineage tier"
            subtitle="How much of the market the named & OG lines actually own"
          />
          <div className="space-y-3">
            {tierRows.map((t) => (
              <div key={t.tier}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className={`inline-flex items-center rounded border px-1.5 py-0.5 ${TIER_COLOR[t.tier] ?? TIER_COLOR.unknown}`}>
                    {TIER_LABEL[t.tier] ?? t.tier}
                  </span>
                  <span className="text-slate-300 tabular-nums">{t.share_pct.toFixed(1)}%</span>
                </div>
                <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-400/70" style={{ width: `${t.share_pct}%` }} />
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">{t.count} breeders · ${(t.revenue / 1000).toFixed(1)}k volume</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function HHIBar({ hhi }) {
  const pct = Math.min(100, (hhi / 4000) * 100);  // render clipped at 4000 for readability
  return (
    <div className="mt-3 relative">
      <div className="w-full h-2 rounded-full bg-gradient-to-r from-emerald-400 via-amber-400 to-red-400 opacity-70" />
      <div
        className="absolute top-[-2px] w-1 h-3 bg-white rounded-full shadow-[0_0_4px_rgba(255,255,255,0.6)]"
        style={{ left: `${pct}%`, transform: 'translateX(-50%)' }}
      />
      <div className="flex justify-between text-[9px] text-slate-500 mt-1">
        <span>0 competitive</span>
        <span>1,500</span>
        <span>2,500</span>
        <span>4,000+ concentrated</span>
      </div>
    </div>
  );
}
