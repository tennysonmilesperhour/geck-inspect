import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarRange, Lock } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { formatSellDays } from '@/lib/sellTime';
import {
  DEFAULT_HATCH_RATE,
  DEFAULT_MONTHLY_UPKEEP,
  DEFAULT_SEASON_EGGS,
  LISTING_AGES,
  chanceAtLeast,
  listingAgeAdvice,
  outcomeSeasonOdds,
  percentileValue,
  priceOutcomes,
  seasonSellTime,
  simulateSeason,
} from '@/lib/seasonProjection';
import { upgradePromptClicked } from '@/lib/activation';
import { createPageUrl } from '@/utils';

const money = (n) => `${n < 0 ? '-' : ''}$${Math.abs(Math.round(Number(n) || 0)).toLocaleString('en-US')}`;
const pct = (p) => {
  const v = p * 100;
  if (v > 0 && v < 1) return '<1%';
  if (v < 100 && v > 99) return '>99%';
  return `${Math.round(v)}%`;
};

function NumberField({ label, value, onChange, min, max, step = 1, suffix }) {
  return (
    <label className="flex flex-col gap-1 text-[11px] text-slate-500">
      {label}
      <span className="flex items-center gap-1">
        <Input
          type="number"
          inputMode="decimal"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)));
          }}
          className="h-8 w-20 text-sm"
        />
        {suffix && <span className="text-slate-500">{suffix}</span>}
      </span>
    </label>
  );
}

/**
 * Season projection for one pairing (Pairing Planner card): what a
 * season of eggs is worth as a range, the chance of each outcome, how
 * fast the hatchlings sell (Enterprise) and the age to list them at.
 * The math is in src/lib/seasonProjection.js.
 *
 * sellModel: the time to sell model, { allowed: false } for plans
 * without Enterprise, or null while it loads.
 */
export default function SeasonProjectionPanel({ phenotypes, priceIndex, seed, sellModel }) {
  const [eggs, setEggs] = useState(DEFAULT_SEASON_EGGS);
  const [hatchPct, setHatchPct] = useState(Math.round(DEFAULT_HATCH_RATE * 100));
  const [upkeep, setUpkeep] = useState(DEFAULT_MONTHLY_UPKEEP);
  const [ageChoice, setAgeChoice] = useState(null); // null = follow the advice
  const [mode, setMode] = useState('value'); // value | outcome
  const [valuePos, setValuePos] = useState(50);
  const [outcomePos, setOutcomePos] = useState(0);

  const hatchRate = hatchPct / 100;
  const enterprise = !!sellModel?.allowed;

  const outcomes = useMemo(() => priceOutcomes(phenotypes, priceIndex), [phenotypes, priceIndex]);
  const advice = useMemo(
    () => listingAgeAdvice(outcomes, { monthlyUpkeep: upkeep, sellModel: enterprise ? sellModel : null, index: priceIndex }),
    [outcomes, upkeep, enterprise, sellModel, priceIndex],
  );
  const ageKey = ageChoice || advice?.best.key || 'hatchling';
  const age = LISTING_AGES.find((a) => a.key === ageKey);
  const sim = useMemo(
    () => simulateSeason(outcomes, { eggs, hatchRate, ageKey, monthlyUpkeep: upkeep, seed }),
    [outcomes, eggs, hatchRate, ageKey, upkeep, seed],
  );
  const sell = useMemo(
    () => (enterprise ? seasonSellTime(outcomes, sellModel, priceIndex, ageKey) : null),
    [enterprise, outcomes, sellModel, priceIndex, ageKey],
  );

  if (!priceIndex) {
    return <p className="text-xs text-slate-500">Listing prices did not load, so there is no season projection.</p>;
  }
  if (!advice || outcomes.length === 0) {
    return <p className="text-xs text-slate-500">No predicted outcomes to project for this pairing.</p>;
  }

  const low = percentileValue(sim, 10);
  const high = percentileValue(sim, 90);
  const atValue = percentileValue(sim, valuePos);
  const ranked = outcomes; // most likely first
  const outcome = ranked[Math.min(outcomePos, ranked.length - 1)];
  const odds = outcomeSeasonOdds(outcome, { eggs, hatchRate });
  const expectedHatchlings = sim.hatchlings.reduce((s, n) => s + n, 0) / (sim.hatchlings.length || 1);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <NumberField label="Eggs this season" value={eggs} onChange={setEggs} min={1} max={40} />
        <NumberField label="Hatch rate" value={hatchPct} onChange={setHatchPct} min={5} max={100} step={5} suffix="%" />
        <NumberField label="Upkeep per gecko" value={upkeep} onChange={setUpkeep} min={0} max={100} suffix="$/mo" />
      </div>

      <div>
        <p className="text-[11px] uppercase tracking-wide text-slate-500 mb-1.5">List them as</p>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Age to list at">
          {LISTING_AGES.map((a) => {
            const active = a.key === ageKey;
            const best = a.key === advice.best.key;
            return (
              <button
                key={a.key}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setAgeChoice(a.key)}
                className={`touch:min-h-11 rounded-full border px-3 py-1 text-xs transition-colors ${active
                  ? 'border-emerald-500 bg-emerald-900/50 text-emerald-100'
                  : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500'}`}
              >
                {a.label}{best ? ' (best)' : ''}
              </button>
            );
          })}
        </div>
      </div>

      {/* Season value */}
      <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="text-[11px] uppercase tracking-wide text-slate-500">Season worth, sold as {age.label.toLowerCase()}s</p>
          <div className="flex rounded-md border border-slate-700 overflow-hidden text-[11px]" role="tablist">
            {[['value', 'By value'], ['outcome', 'By outcome']].map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={mode === key}
                onClick={() => setMode(key)}
                className={`touch:min-h-11 px-2.5 py-1 ${mode === key ? 'bg-slate-700 text-slate-100' : 'text-slate-400 hover:text-slate-200'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <p className="text-sm text-slate-300">
          Likely <strong className="text-emerald-300 tabular-nums">{money(low)}</strong> to{' '}
          <strong className="text-emerald-300 tabular-nums">{money(high)}</strong>
          <span className="text-slate-500"> (8 seasons in 10), from about {expectedHatchlings.toFixed(1)} hatchlings. Average {money(sim.mean)}.</span>
        </p>

        {mode === 'value' ? (
          <div className="space-y-2">
            <Slider
              value={[valuePos]}
              min={0}
              max={100}
              step={1}
              onValueChange={([v]) => setValuePos(v)}
              aria-label="Season value, lowest to highest"
            />
            <div className="flex justify-between text-[11px] text-slate-500">
              <span>Lowest</span>
              <span>Highest</span>
            </div>
            <p className="text-sm text-slate-200">
              <strong className="tabular-nums">{money(atValue)}</strong> or more:{' '}
              <strong className="text-violet-200">{pct(chanceAtLeast(sim, atValue))} chance</strong>
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <Slider
              value={[Math.min(outcomePos, ranked.length - 1)]}
              min={0}
              max={Math.max(0, ranked.length - 1)}
              step={1}
              onValueChange={([v]) => setOutcomePos(v)}
              aria-label="Outcome, most likely to least likely"
              disabled={ranked.length < 2}
            />
            <div className="flex justify-between text-[11px] text-slate-500">
              <span>Most likely</span>
              <span>Least likely</span>
            </div>
            <div className="text-sm text-slate-200 space-y-0.5">
              <p className={`font-medium ${outcome.lethal ? 'text-rose-300' : ''}`}>{outcome.label || 'Wild-type'}</p>
              <p className="text-xs text-slate-400">
                {pct(outcome.probability)} of eggs.{' '}
                {outcome.lethal
                  ? 'This combination does not survive.'
                  : <>About {odds.expected.toFixed(1)} a season, a <strong className="text-violet-200">{pct(odds.atLeastOne)} chance</strong> of at least one, {money(outcome.prices[ageKey])} each as a {age.label.toLowerCase()}.</>}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Time to sell */}
      <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3 space-y-1">
        <p className="text-[11px] uppercase tracking-wide text-slate-500">How fast it sells</p>
        {sellModel == null ? (
          <div className="h-4 w-2/3 rounded bg-slate-800 animate-pulse" />
        ) : !enterprise ? (
          <p className="text-xs text-slate-400 flex items-start gap-1.5">
            <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
            <span>
              How long a season like this takes to sell, from real MorphMarket sales, is part of Enterprise.{' '}
              <Link
                to={createPageUrl('Membership')}
                onClick={() => upgradePromptClicked('market_intelligence', 'season_projection')}
                className="text-amber-300 hover:text-amber-200 font-medium"
              >
                See Enterprise
              </Link>
            </span>
          </p>
        ) : sell ? (
          <p className="text-sm text-slate-200">
            Listed as {age.label.toLowerCase()}s, half sell within <strong className="text-violet-200">{formatSellDays(sell.halfDays)}</strong> and
            most (8 in 10) within <strong className="text-violet-200">{formatSellDays(sell.mostDays)}</strong>.
          </p>
        ) : (
          <p className="text-xs text-slate-500">Not enough sales data for these outcomes.</p>
        )}
      </div>

      {/* Listing age advice */}
      <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3 space-y-2">
        <p className="text-[11px] uppercase tracking-wide text-slate-500 flex items-center gap-1.5">
          <CalendarRange className="w-3.5 h-3.5" /> When to list
        </p>
        <p className="text-sm text-slate-200">
          List them as <strong className="text-emerald-300">{advice.best.label.toLowerCase()}s</strong> (about {advice.best.months} months old):
          about <strong className="tabular-nums">{money(advice.best.net)}</strong> each after upkeep.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-500">
                <th className="text-left font-medium py-1">Age</th>
                <th className="text-right font-medium py-1">Sells for</th>
                <th className="text-right font-medium py-1">Upkeep</th>
                <th className="text-right font-medium py-1">Each, after</th>
                {enterprise && <th className="text-right font-medium py-1">Half sold</th>}
              </tr>
            </thead>
            <tbody>
              {advice.ages.map((a) => (
                <tr key={a.key} className={`border-t border-slate-800 ${a.key === advice.best.key ? 'text-emerald-200' : 'text-slate-300'}`}>
                  <td className="py-1">{a.label} <span className="text-slate-500">({a.months} mo)</span></td>
                  <td className="py-1 text-right tabular-nums">{money(a.price)}</td>
                  <td className="py-1 text-right tabular-nums text-slate-500">{money(a.upkeep)}</td>
                  <td className="py-1 text-right tabular-nums font-medium">{money(a.net)}</td>
                  {enterprise && <td className="py-1 text-right text-slate-400">{a.sell ? formatSellDays(a.sell.halfDays) : '-'}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-[11px] text-slate-500 leading-relaxed">
        Played out {sim.totals.length.toLocaleString()} times from the genetics odds: each egg hatches or not, then
        becomes one outcome, priced at the median MorphMarket asking price for its traits at that age. Upkeep
        {enterprise ? ' includes the typical wait for a buyer. ' : ' covers the months you keep each one. '}
        Asking prices, not sale prices, and pattern quality moves the price most.
      </p>
    </div>
  );
}
