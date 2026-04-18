/**
 * BreedingSimulator — Monte Carlo breeding outcome visualization.
 *
 * Drop into any page that has sire + dam gecko objects.
 * Runs 1,000 virtual clutches and shows:
 *   - Phenotype distribution histogram
 *   - "At least one in clutch" probability per trait
 *   - Adjustable clutch size slider
 */
import { useState } from 'react';
import { useBreedingSimulator } from '@/hooks/useBreedingSimulator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { FlaskConical, Dna, AlertTriangle } from 'lucide-react';

const BAR_COLORS = [
  'bg-emerald-500', 'bg-purple-500', 'bg-blue-500', 'bg-amber-500',
  'bg-pink-500', 'bg-cyan-500', 'bg-rose-500', 'bg-teal-500',
];

export default function BreedingSimulator({ sire, dam }) {
  const [clutchSize, setClutchSize] = useState(6);
  const result = useBreedingSimulator(sire, dam, 1000, clutchSize);

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

  const { phenotypeDist, atLeastOneProb, warnings = [] } = result;
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
          Breeding Simulator
          <Badge variant="outline" className="ml-auto text-xs text-slate-400 border-slate-600">
            1,000 virtual clutches
          </Badge>
        </CardTitle>
        <p className="text-xs text-slate-500 mt-1">
          Monte Carlo simulation — randomized allele draws across {result.trials.toLocaleString()} clutches of {clutchSize} eggs each.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Safety warnings — always rendered first when present */}
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
                  {w.message}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Clutch size slider */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">Clutch size</span>
            <span className="text-emerald-400 font-mono font-bold">{clutchSize} eggs</span>
          </div>
          <Slider
            value={[clutchSize]}
            onValueChange={([v]) => setClutchSize(v)}
            min={1}
            max={12}
            step={1}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-slate-600">
            <span>1</span><span>6</span><span>12</span>
          </div>
        </div>

        {/* "At least one" probabilities */}
        {atLeastOneProb.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-slate-300 flex items-center gap-1.5">
              <Dna className="w-4 h-4 text-emerald-400" />
              Chance of at least one per clutch
            </h4>
            <div className="grid gap-1.5">
              {atLeastOneProb.map(({ trait, probability }) => (
                <div key={trait} className="flex items-center gap-3">
                  <span className="text-sm text-slate-300 w-40 truncate">{trait}</span>
                  <div className="flex-1 bg-slate-800 rounded-full h-5 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full transition-all duration-500 flex items-center justify-end pr-2"
                      style={{ width: `${Math.max(probability, 3)}%` }}
                    >
                      {probability >= 15 && (
                        <span className="text-[10px] font-bold text-white">{probability}%</span>
                      )}
                    </div>
                  </div>
                  {probability < 15 && (
                    <span className="text-xs text-slate-400 w-12 text-right">{probability}%</span>
                  )}
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
            <p className="text-xs text-slate-600 text-center mt-1">
              + {phenotypeDist.length - 10} more rare outcomes
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
