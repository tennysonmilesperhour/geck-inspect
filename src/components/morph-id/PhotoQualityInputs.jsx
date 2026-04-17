import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  PHOTO_ANGLES,
  LIGHTING_OPTIONS,
  FIRED_STATES,
  IMAGE_QUALITY_FLAGS,
} from './morphTaxonomy';

export default function PhotoQualityInputs({ value = {}, onChange }) {
  const set = (key, v) => onChange({ ...value, [key]: v });
  const flags = value.flags || [];

  const toggleFlag = (id) => {
    if (flags.includes(id)) set('flags', flags.filter((f) => f !== id));
    else set('flags', [...flags, id]);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <Label className="text-slate-300 text-xs uppercase tracking-wide">Angle</Label>
          <Select value={value.angle || ''} onValueChange={(v) => set('angle', v)}>
            <SelectTrigger className="bg-slate-800 border-slate-600 text-slate-100">
              <SelectValue placeholder="Pick angle" />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-600">
              {PHOTO_ANGLES.map((a) => (
                <SelectItem key={a.id} value={a.id}>{a.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-slate-300 text-xs uppercase tracking-wide">Lighting</Label>
          <Select value={value.lighting || ''} onValueChange={(v) => set('lighting', v)}>
            <SelectTrigger className="bg-slate-800 border-slate-600 text-slate-100">
              <SelectValue placeholder="Pick lighting" />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-600">
              {LIGHTING_OPTIONS.map((l) => (
                <SelectItem key={l.id} value={l.id}>{l.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-slate-300 text-xs uppercase tracking-wide">Fired state</Label>
          <Select value={value.fired_state || 'unknown'} onValueChange={(v) => set('fired_state', v)}>
            <SelectTrigger className="bg-slate-800 border-slate-600 text-slate-100">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-600">
              {FIRED_STATES.map((f) => (
                <SelectItem key={f.id} value={f.id} title={f.notes}>{f.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label className="text-slate-300 text-xs uppercase tracking-wide mb-2 block">
          Image quality flags
        </Label>
        <div className="flex flex-wrap gap-2">
          {IMAGE_QUALITY_FLAGS.map((flag) => {
            const on = flags.includes(flag.id);
            const tone = flag.positive
              ? on ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
              : on ? 'bg-amber-600 text-white' : 'bg-slate-800 text-slate-200 hover:bg-slate-700';
            return (
              <button
                key={flag.id}
                type="button"
                onClick={() => toggleFlag(flag.id)}
                className={`px-3 py-1 rounded-full text-xs transition-colors border border-slate-700 ${tone}`}
              >
                {flag.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
