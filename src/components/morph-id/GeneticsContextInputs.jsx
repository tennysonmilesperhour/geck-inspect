import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AGE_STAGES, SEX_OPTIONS, GENETIC_TRAITS } from './morphTaxonomy';

export default function GeneticsContextInputs({ value = {}, onChange }) {
  const set = (key, v) => onChange({ ...value, [key]: v });
  const hets = value.known_hets || [];

  const toggleHet = (id) => {
    if (hets.includes(id)) set('known_hets', hets.filter((h) => h !== id));
    else set('known_hets', [...hets, id]);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <Label className="text-slate-300 text-xs uppercase tracking-wide">Life stage</Label>
          <Select value={value.age_stage || 'unknown'} onValueChange={(v) => set('age_stage', v)}>
            <SelectTrigger className="bg-slate-800 border-slate-600 text-slate-100">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-600">
              {AGE_STAGES.map((a) => (
                <SelectItem key={a.id} value={a.id}>{a.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-slate-300 text-xs uppercase tracking-wide">Sex</Label>
          <Select value={value.sex || 'unknown'} onValueChange={(v) => set('sex', v)}>
            <SelectTrigger className="bg-slate-800 border-slate-600 text-slate-100">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-600">
              {SEX_OPTIONS.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <Label className="text-slate-300 text-xs uppercase tracking-wide">Sire (dad) morph</Label>
          <Input
            value={value.sire_morph || ''}
            onChange={(e) => set('sire_morph', e.target.value)}
            placeholder="e.g. Extreme Harlequin Pinstripe"
            className="bg-slate-800 border-slate-600 text-slate-100"
          />
        </div>
        <div>
          <Label className="text-slate-300 text-xs uppercase tracking-wide">Dam (mom) morph</Label>
          <Input
            value={value.dam_morph || ''}
            onChange={(e) => set('dam_morph', e.target.value)}
            placeholder="e.g. Harlequin het Axanthic"
            className="bg-slate-800 border-slate-600 text-slate-100"
          />
        </div>
      </div>

      <div>
        <Label className="text-slate-300 text-xs uppercase tracking-wide mb-2 block">
          Known hets / lines
        </Label>
        <div className="flex flex-wrap gap-2">
          {GENETIC_TRAITS.map((g) => {
            const on = hets.includes(g.id);
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => toggleHet(g.id)}
                title={g.notes}
                className={`px-3 py-1 rounded-full text-xs transition-colors border ${
                  on
                    ? 'bg-purple-600 text-white border-purple-500'
                    : 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
                }`}
              >
                het {g.label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <Label className="text-slate-300 text-xs uppercase tracking-wide">Breeder / line (optional)</Label>
        <Input
          value={value.line_name || ''}
          onChange={(e) => set('line_name', e.target.value)}
          placeholder="e.g. Altitude Exotics Lily line"
          className="bg-slate-800 border-slate-600 text-slate-100"
        />
      </div>
    </div>
  );
}
