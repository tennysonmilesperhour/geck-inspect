import { useMemo } from 'react';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { CONFIDENCE_PRESETS } from './morphTaxonomy';

function closestPreset(v) {
  let best = CONFIDENCE_PRESETS[0];
  let bestDist = Math.abs(best.value - v);
  for (let i = 1; i < CONFIDENCE_PRESETS.length; i += 1) {
    const d = Math.abs(CONFIDENCE_PRESETS[i].value - v);
    if (d < bestDist) { best = CONFIDENCE_PRESETS[i]; bestDist = d; }
  }
  return best;
}

export default function ConfidenceSlider({
  value = 75,
  onChange,
  label = 'Confidence in this classification',
}) {
  const preset = useMemo(() => closestPreset(value), [value]);

  return (
    <div className="space-y-2">
      <Label className="text-slate-300 font-medium">
        {label} — <span className="text-emerald-300">{value}%</span>
      </Label>
      <Slider
        value={[value]}
        onValueChange={(v) => onChange(v[0])}
        min={0}
        max={100}
        step={5}
      />
      <div className="flex flex-wrap gap-2">
        {CONFIDENCE_PRESETS.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => onChange(p.value)}
            className={`text-xs px-2 py-1 rounded-full transition-colors ${
              value === p.value
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            {p.value}%
          </button>
        ))}
      </div>
      <p className="text-xs text-slate-400 italic">{preset.label}</p>
    </div>
  );
}
