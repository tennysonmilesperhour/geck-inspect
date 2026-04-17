import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { GitBranch, RotateCcw, User, Layers, Eye, HelpCircle } from 'lucide-react';
import { applyFormat } from '@/components/my-geckos/form/helpers';

// Rendered against both format strings so the user can see immediate
// feedback while editing. Sample numbers and parent names are fixed so
// the output is easy to compare between edits.
const SAMPLE_HATCHLINGS = [
  { label: 'Jeff × Mindy, clutch 1', sire: 'Jeff', dam: 'Mindy', num: 1, letter: 'a' },
  { label: 'Jeff × Mindy, clutch 2', sire: 'Jeff', dam: 'Mindy', num: 2, letter: 'b' },
  { label: 'Turner × Anna, clutch 1', sire: 'Turner', dam: 'Anna', num: 1, letter: 'a' },
];

const TOKEN_REFERENCE = [
  { token: '{PREFIX}', desc: 'Your breeder prefix (first 3 chars of breeder name / email, or the override below).' },
  { token: '{NUM}', desc: 'Offspring or founder sequence number (1, 2, 3 …).' },
  { token: '{NNN}', desc: 'Same as NUM but zero-padded to 3 digits (001, 002 …).' },
  { token: '{SIRE}', desc: 'First two letters of sire’s name, title-cased (e.g. "Je").' },
  { token: '{DAM}', desc: 'First two letters of dam’s name, title-cased (e.g. "Mi").' },
  { token: '{LETTER}', desc: 'Egg letter within the clutch (a, b, c …).' },
  { token: '{YY}', desc: '2-digit year of generation.' },
  { token: '{YYYY}', desc: '4-digit year of generation.' },
  { token: '{LINE}', desc: 'Prefix of the oldest ancestor on the side picked by your inheritance mode.' },
  { token: '{PARENT}', desc: 'Full ID of the direct parent (sire preferred).' },
  { token: '{SEX}', desc: 'm / f / u.' },
  { token: '{CLUTCH}', desc: 'Clutch number (same as NUM unless a clutch entity is present).' },
];

const PRESETS = [
  {
    id: 'default',
    label: 'Geck Inspect default',
    blurb: 'Breeder prefix + parent initials on hatchlings',
    settings: {
      founderFormat: '{PREFIX}{NUM}-{YY}',
      hatchlingFormat: '{SIRE}{DAM}{NUM}{LETTER}{YY}',
      prefix: '',
      inheritanceMode: 'breeder_prefix',
    },
  },
  {
    id: 'simple_numeric',
    label: 'Simple numeric',
    blurb: 'Just breeder prefix + an auto-incrementing number',
    settings: {
      founderFormat: '{PREFIX}-{NNN}',
      hatchlingFormat: '{PREFIX}-{NNN}',
      prefix: '',
      inheritanceMode: 'breeder_prefix',
    },
  },
  {
    id: 'sire_line',
    label: 'Line tracking',
    blurb: 'Hatchlings carry the paternal founder’s prefix',
    settings: {
      founderFormat: '{PREFIX}{NUM}-{YY}',
      hatchlingFormat: '{LINE}-{NUM}{LETTER}{YY}',
      prefix: '',
      inheritanceMode: 'sire_line',
    },
  },
  {
    id: 'year_first',
    label: 'Year first',
    blurb: 'IDs sort naturally by year, then by breeder/parents',
    settings: {
      founderFormat: '{YY}-{PREFIX}{NNN}',
      hatchlingFormat: '{YY}-{SIRE}{DAM}{NUM}{LETTER}',
      prefix: '',
      inheritanceMode: 'breeder_prefix',
    },
  },
];

const MODE_EXPLAINER = {
  breeder_prefix: 'Every gecko — founder or offspring — carries your own breeder prefix. Simplest option; lineage is tracked via the sire/dam links, not in the ID.',
  sire_line: 'A hatchling’s {LINE} token resolves to the prefix of the oldest paternal founder. Useful when you mainly track males as line anchors.',
  dam_line: 'A hatchling’s {LINE} token resolves to the prefix of the oldest maternal founder. Useful when females anchor your lines.',
  founder_origin: 'Tries the sire side first; if no paternal founder is recorded, falls back to the dam side, then your breeder prefix. Good for mixed collections.',
};

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

  const previewPrefix = (settings.prefix || 'Joh').substring(0, 4).toUpperCase();
  const yearNow = new Date().getFullYear();

  const previews = useMemo(() => {
    const founders = [1, 2, 3].map((n) => ({
      label: `Founder #${n}`,
      value: applyFormat(settings.founderFormat || DEFAULT_ID_SETTINGS.founderFormat, {
        prefix: previewPrefix,
        nnn: String(n).padStart(3, '0'),
        num: n,
        letter: 'a',
        yy: String(yearNow).slice(-2),
        yyyy: String(yearNow),
        line: previewPrefix,
        parent: '',
        sex: 'u',
        clutch: n,
      }),
    }));
    const hatchlings = SAMPLE_HATCHLINGS.map((s) => {
      const sireInit = s.sire.slice(0, 1).toUpperCase() + s.sire.slice(1, 2).toLowerCase();
      const damInit = s.dam.slice(0, 1).toUpperCase() + s.dam.slice(1, 2).toLowerCase();
      return {
        label: s.label,
        value: applyFormat(settings.hatchlingFormat || DEFAULT_ID_SETTINGS.hatchlingFormat, {
          prefix: previewPrefix,
          nnn: String(s.num).padStart(3, '0'),
          sire: sireInit,
          dam: damInit,
          num: s.num,
          letter: s.letter,
          yy: String(yearNow).slice(-2),
          yyyy: String(yearNow),
          line: previewPrefix,
          parent: `${sireInit}${damInit}1a${String(yearNow - 2).slice(-2)}`,
          sex: 'u',
          clutch: s.num,
        }),
      };
    });
    return { founders, hatchlings };
  }, [settings.founderFormat, settings.hatchlingFormat, previewPrefix, yearNow]);

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
        {/* Presets */}
        <div className="space-y-3">
          <Label className="text-slate-300">Start from a preset</Label>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onChange?.({ ...p.settings })}
                className="text-left rounded-lg border border-slate-700 bg-slate-800/40 hover:border-emerald-500/40 hover:bg-slate-800 px-3 py-2 transition-colors"
              >
                <p className="text-sm font-semibold text-slate-200">{p.label}</p>
                <p className="text-xs text-slate-500 mt-0.5 leading-snug">{p.blurb}</p>
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-500">
            Each preset overwrites the fields below. Already have your own format? Skip this and type it in directly.
          </p>
        </div>

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

        {/* Live preview */}
        <div className="space-y-3">
          <Label className="text-slate-300 flex items-center gap-2">
            <Eye className="w-4 h-4" /> Live preview
          </Label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-lg border border-slate-800 bg-slate-800/40 p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Founders</p>
              <div className="space-y-1">
                {previews.founders.map((row) => (
                  <div key={row.label} className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">{row.label}</span>
                    <span className="font-mono text-emerald-300">{row.value}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-800/40 p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Hatchlings</p>
              <div className="space-y-1">
                {previews.hatchlings.map((row) => (
                  <div key={row.label} className="flex items-center justify-between text-sm gap-3">
                    <span className="text-slate-500 truncate">{row.label}</span>
                    <span className="font-mono text-emerald-300 shrink-0">{row.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <p className="text-xs text-slate-500">
            Previews use <span className="font-mono">{previewPrefix}</span> as the breeder prefix and the current year.
            Your real IDs will use your own prefix and the parent data of each pairing.
          </p>
        </div>

        {/* How this works */}
        <div className="rounded-lg border border-slate-800 bg-slate-800/40 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-slate-400" />
            <p className="text-sm font-semibold text-slate-200">How this works</p>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            {MODE_EXPLAINER[settings.inheritanceMode] || MODE_EXPLAINER.breeder_prefix}
          </p>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Tokens</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1.5">
              {TOKEN_REFERENCE.map((t) => (
                <div key={t.token} className="flex items-start gap-2 text-xs">
                  <code className="text-emerald-300 shrink-0 w-20">{t.token}</code>
                  <span className="text-slate-400 leading-snug">{t.desc}</span>
                </div>
              ))}
            </div>
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
