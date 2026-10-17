import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Wallet, CalendarRange, Lock, ArrowRight } from 'lucide-react';
import { Egg } from '@/entities/all';
import { MorphPriceCache } from '@/api/supabaseEntities';
import { getVisibleGeckos } from '@/lib/geckoAccess';
import { buildMorphAverages, valueGecko } from '@/lib/portfolioValue';
import { loadTraitValueIndex } from '@/lib/traitValueTable';
import { basicHatchlingValue } from '@/lib/traitValuation';
import { DEFAULT_HATCH_RATE } from '@/lib/seasonProjection';
import { homeSeasonCounts, homeSeasonValue } from '@/lib/homeProjection';
import { resolveTier } from '@/lib/tierLimits';
import usePageSettings from '@/hooks/usePageSettings';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { UpgradePlansLink } from '@/components/subscription/UpgradePlansButton';

const money = (value) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);

async function loadValues(user, year) {
  const [geckos, eggs, cache, index] = await Promise.all([
    // Page large collections rather than silently reporting the first 1,000 as the total.
    allPages((offset) => getVisibleGeckos(user, {}, 'id', 1000, offset)),
    allPages((offset) => Egg.filter({ created_by: user.email, lay_date: { $gte: `${year}-01-01`, $lt: `${year + 1}-01-01` } }, 'id', 1000, offset)),
    MorphPriceCache.filter({}, '-created_date', 1000),
    loadTraitValueIndex(),
  ]);
  const morphs = buildMorphAverages(cache);
  const valuations = geckos.filter((gecko) => !gecko.archived).map((gecko) => valueGecko(gecko, morphs, index));
  return {
    total: valuations.reduce((sum, row) => sum + row.value, 0),
    valued: valuations.filter((row) => row.basis !== 'unpriced').length,
    animals: valuations.length,
    season: homeSeasonCounts(eggs, year),
    averageValue: basicHatchlingValue(index),
  };
}

async function allPages(load) {
  const rows = [];
  for (let offset = 0; ; offset += 1000) {
    const page = await load(offset);
    rows.push(...page);
    if (page.length < 1000) return rows;
  }
}

function PaidHomeValues({ user }) {
  const year = new Date().getFullYear();
  const [showProjection, setShowProjection] = useState(false);
  const [assumptions, saveAssumptions] = usePageSettings(`home_projection_${user.id || user.email}_${year}`, {
    plannedEggs: 0, hatchRate: DEFAULT_HATCH_RATE * 100, averageValue: null,
  });
  const query = useQuery({
    queryKey: ['dashboard', 'values', user.email, year],
    queryFn: () => loadValues(user, year),
    staleTime: 60_000,
  });
  const data = query.data;
  const averageValue = assumptions.averageValue ?? data?.averageValue ?? 0;
  const projection = data ? homeSeasonValue({ ...data.season, ...assumptions, averageValue }) : null;

  if (query.isPending) return <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" aria-label="Loading collection and season values" aria-busy="true">
    {[0, 1].map((key) => <div key={key} className="h-28 rounded-xl bg-slate-900 border border-slate-700 animate-pulse" />)}
  </div>;
  if (query.isError) return <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-700 p-4" role="status">
    <p className="text-sm text-slate-300">Values could not be loaded. Your collection and care tools are still available.</p>
    <Button variant="outline" disabled={query.isFetching} onClick={() => query.refetch()}>Retry values</Button>
  </div>;

  return <>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" aria-label="Collection and season values">
      <Link to="/Portfolio" className="home-value-summary">
        <span className="flex items-center gap-2 text-sm font-medium"><Wallet className="h-4 w-4" />Collection estimated value</span>
        <strong className="block text-2xl text-slate-100 tabular-nums mt-2">{data.valued ? money(data.total) : 'Not yet valued'}</strong>
        <span className="block text-xs text-slate-300 mt-1">{data.valued} of {data.animals} animals valued · USD</span>
        <span className="flex items-center gap-1 text-xs text-emerald-300 mt-2">Open full Portfolio <ArrowRight className="h-3 w-3" /></span>
      </Link>
      <button type="button" className="home-value-summary text-left" onClick={() => setShowProjection(true)}>
        <span className="flex items-center gap-2 text-sm font-medium"><CalendarRange className="h-4 w-4" />Season projected value</span>
        <strong className="block text-2xl text-slate-100 tabular-nums mt-2">{projection == null ? 'Set your assumptions' : `≈ ${money(projection)}`}</strong>
        <span className="block text-xs text-slate-300 mt-1">{year} lay season · USD before costs</span>
        <span className="flex items-center gap-1 text-xs text-emerald-300 mt-2">Review assumptions <ArrowRight className="h-3 w-3" /></span>
      </button>
    </div>
    <Dialog open={showProjection} onOpenChange={setShowProjection}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{year} season projected value</DialogTitle>
          <DialogDescription>A planning estimate for eggs laid this year, plus additional eggs you expect to lay. Values are in USD.</DialogDescription>
        </DialogHeader>
        <div className="flex gap-6 text-sm text-slate-300">
          <p><strong className="block text-xl text-slate-100">{data.season.hatched}</strong>Already hatched</p>
          <p><strong className="block text-xl text-slate-100">{data.season.incubating}</strong>Incubating</p>
        </div>
        <div className="space-y-3">
          {[
            ['plannedEggs', 'Additional planned eggs', assumptions.plannedEggs, 0, 10000, 1],
            ['hatchRate', 'Expected hatch rate (%)', assumptions.hatchRate, 0, 100, 1],
            ['averageValue', 'Average hatchling value (USD)', averageValue || '', 0, 1000000, 1],
          ].map(([key, label, value, min, max, step]) => <label key={key} className="block text-sm text-slate-300">
            {label}
            <Input className="mt-1" type="number" min={min} max={max} step={step} value={value} onChange={(event) => {
              const number = event.target.valueAsNumber;
              if (Number.isFinite(number) && number >= min && number <= max) saveAssumptions({ [key]: number });
            }} />
          </label>)}
        </div>
        <p className="text-xs text-slate-300">{assumptions.averageValue == null
          ? 'Starting hatchling value uses the lower end of the least expensive well-sampled Geck Data hatchling trait. Replace it with an average appropriate to your pairings.'
          : 'Using your average hatchling value. Assumptions are saved on this device for this account and season.'}</p>
        <div className="border-t border-slate-700 pt-4 space-y-2" aria-live="polite">
          <p className="text-2xl font-semibold tabular-nums">{projection == null ? 'Enter a hatchling value' : `≈ ${money(projection)}`}</p>
          <p className="text-xs text-slate-300">({data.season.hatched} hatched + ({data.season.incubating} incubating + {assumptions.plannedEggs} planned) × {assumptions.hatchRate}%) × {money(averageValue)}</p>
          <p className="text-xs text-slate-300">Gross animal value before costs, fees, and later losses. It does not assume every animal sells. Animals can appear in both totals, so do not add this to your collection value.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild><Link to="/PairingPlanner">Explore pairing projections</Link></Button>
          <Button variant="outline" onClick={() => saveAssumptions({ plannedEggs: 0, hatchRate: DEFAULT_HATCH_RATE * 100, averageValue: null })}>Reset assumptions</Button>
        </div>
      </DialogContent>
    </Dialog>
  </>;
}

export default function HomeValues({ user }) {
  if (!user?.email) return null;
  if (resolveTier(user) === 'free') return <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4 flex flex-wrap items-center gap-3">
    <Lock className="h-4 w-4 text-amber-300 shrink-0" />
    <p className="text-sm text-slate-300 flex-1 min-w-0">Collection estimated value and season projected value on your homepage are included with paid plans.</p>
    <UpgradePlansLink limitType="home_values" surface="dashboard_values" className="text-sm text-emerald-300 underline touch:min-h-11 inline-flex items-center">Explore paid plans</UpgradePlansLink>
  </div>;
  return <PaidHomeValues key={user.id || user.email} user={user} />;
}
