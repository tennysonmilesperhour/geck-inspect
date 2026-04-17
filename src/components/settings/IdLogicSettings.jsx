import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { GitBranch, RotateCcw, Users, User, Layers } from 'lucide-react';

/**
 * Default settings shape. Consumers should spread this over any stored
 * settings so older records without `inheritanceMode` still behave.
 */
export const DEFAULT_ID_SETTINGS = {
  founderFormat: '{PREFIX}{NUM}-{YY}',
  hatchlingFormat: '{SIRE}{DAM}{NUM}{LETTER}{YY}',
  prefix: '',
  inheritanceMode: 'breeder_prefix',
};

const MODES = [
  {
    id: 'breeder_prefix',
    label: 'Breeder prefix',
    blurb: 'All geckos trace back to your own prefix, regardless of lineage.',
    icon: User,
  },
  {
    id: 'sire_line',
    label: 'Sire line',
    blurb: 'Offspring inherit the paternal founder’s prefix, recursively.',
    icon: GitBranch,
  },
  {
    id: 'dam_line',
    label: 'Dam line',
    blurb: 'Offspring inherit the maternal founder’s prefix, recursively.',
    icon: GitBranch,
  },
  {
    id: 'founder_origin',
    label: 'Founder of origin',
    blurb: 'Prefer sire side, fall back to dam side — earliest ancestor wins.',
    icon: Layers,
  },
];

export default function IdLogicSettings({ value, onChange }) {
  const settings = { ...DEFAULT_ID_SETTINGS, ...(value || {}) };

  const set = (patch) => onChange?.({ ...settings, ...patch });
  const resetAll = () => onChange?.({ ...DEFAULT_ID_SETTINGS });

  return (
    <Card className="bg-slate-900 border-slate-800">
      <CardHeader>
        <CardTitle className="text-slate-100 flex items-center gap-2">
          <GitBranch className="w-5 h-5" /> Gecko ID Logic
        </CardTitle>
        <CardDescription className="text-slate-400">
          Pick how gecko IDs are built, and how offspring inherit lineage prefixes.
          Your existing IDs are never rewritten — this only affects new geckos.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Inheritance mode */}
        <div className="space-y-3">
          <Label className="text-slate-300">Inheritance mode</Label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {MODES.map((m) => {
              const active = settings.inheritanceMode === m.id;
              const Icon = m.icon;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => set({ inheritanceMode: m.id })}
                  className={`text-left rounded-xl border px-4 py-3 transition-colors ${
                    active
                      ? 'border-emerald-500/60 bg-emerald-500/10'
                      : 'border-slate-700 bg-slate-800/40 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Icon className={`w-4 h-4 ${active ? 'text-emerald-400' : 'text-slate-400'}`} />
                    <span className={`text-sm font-semibold ${active ? 'text-white' : 'text-slate-200'}`}>
                      {m.label}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1 leading-snug">{m.blurb}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Format strings */}
        <div className="space-y-3">
          <div>
            <Label className="text-slate-300">Founder format</Label>
            <Input
              value={settings.founderFormat}
              onChange={(e) => set({ founderFormat: e.target.value })}
              className="bg-slate-800 border-slate-600 text-slate-100 font-mono"
              placeholder={DEFAULT_ID_SETTINGS.founderFormat}
            />
            <p className="text-xs text-slate-500 mt-1">
              Used for geckos you add directly (no linked sire/dam).
            </p>
          </div>

          <div>
            <Label className="text-slate-300">Hatchling format</Label>
            <Input
              value={settings.hatchlingFormat}
              onChange={(e) => set({ hatchlingFormat: e.target.value })}
              className="bg-slate-800 border-slate-600 text-slate-100 font-mono"
              placeholder={DEFAULT_ID_SETTINGS.hatchlingFormat}
            />
            <p className="text-xs text-slate-500 mt-1">
              Used when the new gecko has a linked sire and dam.
            </p>
          </div>

          <div>
            <Label className="text-slate-300">Prefix override</Label>
            <Input
              value={settings.prefix}
              onChange={(e) => set({ prefix: e.target.value })}
              className="bg-slate-800 border-slate-600 text-slate-100 font-mono"
              placeholder="auto (from breeder name)"
            />
            <p className="text-xs text-slate-500 mt-1">
              Leave blank to auto-derive from your breeder name / email.
            </p>
          </div>
        </div>

        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={resetAll}
            className="border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
            Reset to defaults
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
