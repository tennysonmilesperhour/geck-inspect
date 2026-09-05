/**
 * BreedingSimulator, season-level Monte Carlo visualization.
 *
 * Drop into any page that has sire + dam gecko objects (with
 * morph_tags or a genotype_spec). Simulates 1,000 breeding seasons of
 * N clutches x 2 eggs (crestie biology, not an arbitrary clutch
 * slider) and shows:
 *   - Chance of at least one of each combo per clutch and per season
 *     (computed exactly, no sampling noise)
 *   - Offspring phenotype distribution histogram (sampled)
 */
import { useState } from 'react';
import { useBreedingSimulator } from '@/hooks/useBreedingSimulator';
import { displayText } from '@/lib/genetics';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { FlaskConical, Dna, AlertTriangle } from 'lucide-react';
import {
  DEFAULT_CLUTCHES_PER_SEASON,
  MAX_CLUTCHES_PER_SEASON,
} from '@/lib/genetics/clutchMath';

const BAR_COLORS = [
  'bg-emerald-500', 'bg-purple-500', 'bg-blue-500', 'bg-amber-500',
  'bg-pink-500', 'bg-cyan-500', 'bg-rose-500', 'bg-teal-500',
];

export default function BreedingSimulator({ sire, dam }) {
  const [clutchCount, setClutchCount] = useState(DEFAULT_CLUTCHES_PER_SEASON);
  const result = useBreedingSimulator(sire, dam, 1000, clutchCount);

  if (!sire || !dam) {
    return (
      <Card className="bg-slate-900 border-slate-700">
        <CardContent className="py-8 text-center text-slate-500">
          <FlaskConical className="w-8 h-8 mx-auto mb-2 opacity-40" />
          Select both parents to run the breeding simulator.
        </CardContent>
      </Card>
    );
  }

  if (!result) return null;

  const { phenotypeDist, atLeastOne, warnings = [], eggsPerSeason } = result;
  const maxPercent = Math.max(...phenotypeDist.map(d => d.percent), 1);

  function severityClasses(severity) {
    if (severity === 'critical') return 'bg-red-950/70 border-red-700 text-red-100';
    if (severity === 'caution')  return 'bg-amber-950/70 border-amber-700 text-amber-100';
    return 'bg-slate-800 border-slate-600 text-slate-200';
  }

  return (
    <Card className="bg-slate-900 border-slate-700">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2 text-slate-100">
          <FlaskConical className="w-5 h-5 text-purple-400" />
          Season Simulator
          <Badge variant="outline" className="ml-auto text-xs text-slate-400 border-slate-600">
            1,000 simulated seasons
          </Badge>
        </CardTitle>
        <p className="text-xs text-slate-500 mt-1">
          Crested geckos lay 2-egg clutches every 30 to 45 days. This simulates {result.trials.toLocaleString()} seasons
          of {clutchCount} clutches ({eggsPerSeason} eggs) each.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Safety warnings, always rendered first when present */}
        {warnings.length > 0 && (
          <div className="space-y-2">
            {warnings.map((w) => (
              <div
                key={w.code}
                className={'rounded-lg p-3 border flex items-start gap-2 ' + severityClasses(w.severity)}
              >
                <AlertTriangle
                  className={
                    w.severity === 'critical'
                      ? 'w-4 h-4 mt-0.5 flex-shrink-0 text-red-300'
                      : 'w-4 h-4 mt-0.5 flex-shrink-0 text-amber-300'
                  }
                />
                <div className="text-sm leading-snug">
                  <span className="font-semibold uppercase tracking-wide text-xs mr-1">{w.severity}</span>
                  {displayText(w.message)}
                  {w.conditional && (
                    <span className="text-xs opacity-80"> (applies only if the possible het proves out)</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Clutches-per-season slider */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">Clutches this season</span>
            <span className="text-emerald-400 font-mono font-bold">
              {clutchCount} clutches · {eggsPerSeason} eggs
            </span>
          </div>
          <Slider
            value={[clutchCount]}
            onValueChange={([v]) => setClutchCount(v)}
            min={1}
            max={MAX_CLUTCHES_PER_SEASON}
            step={1}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-slate-500">
            <span>1</span><span>{Math.round(MAX_CLUTCHES_PER_SEASON / 2)}</span><span>{MAX_CLUTCHES_PER_SEASON}</span>
          </div>
        </div>

        {/* At-least-one probabilities, per clutch and per season */}
        {atLeastOne.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-slate-300 flex items-center gap-1.5">
              <Dna className="w-4 h-4 text-emerald-400" />
              Chance of hatching at least one
            </h4>
            <div className="grid gap-1.5">
              {atLeastOne.map(({ trait, perClutch, perSeason }) => (
                <div key={trait} className="flex items-center gap-3">
                  <span className="text-sm text-slate-300 w-36 truncate" title={trait}>{trait}</span>
                  <div className="flex-1 bg-slate-800 rounded-full h-5 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full transition-all duration-500 flex items-center justify-end pr-2"
                      style={{ width: `${Math.max(perSeason, 3)}%` }}
                    >
                      {perSeason >= 20 && (
                        <span className="text-[10px] font-bold text-white">{perSeason}% this season</span>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-slate-400 w-28 text-right whitespace-nowrap">
                    {perSeason < 20 && <>{perSeason}% season · </>}{perClutch}%/clutch
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Phenotype distribution histogram */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-slate-300">Offspring phenotype distribution</h4>
          <div className="space-y-1.5">
            {phenotypeDist.slice(0, 10).map(({ phenotype, percent }, i) => (
              <div key={phenotype} className="flex items-center gap-2">
                <span className="text-xs text-slate-400 w-36 truncate" title={phenotype}>
                  {phenotype}
                </span>
                <div className="flex-1 bg-slate-800 rounded h-4 overflow-hidden">
                  <div
                    className={`h-full ${BAR_COLORS[i % BAR_COLORS.length]} rounded transition-all duration-500`}
                    style={{ width: `${(percent / maxPercent) * 100}%` }}
                  />
                </div>
                <span className="text-xs font-mono text-slate-300 w-14 text-right">{percent}%</span>
              </div>
            ))}
          </div>
          {phenotypeDist.length > 10 && (
            <p className="text-xs text-slate-500 text-center mt-1">
              + {phenotypeDist.length - 10} more rare outcomes
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
