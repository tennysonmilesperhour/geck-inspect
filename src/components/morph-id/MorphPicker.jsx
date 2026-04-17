import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { PRIMARY_MORPHS, GENETIC_TRAITS, confusedWith, labelFor } from './morphTaxonomy';

export default function MorphPicker({
  primary,
  onPrimaryChange,
  genetics = [],
  onGeneticsChange,
}) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();

  const primaries = useMemo(() => {
    if (!q) return PRIMARY_MORPHS;
    return PRIMARY_MORPHS.filter(
      (m) => m.label.toLowerCase().includes(q) || m.id.includes(q),
    );
  }, [q]);

  const genes = useMemo(() => {
    if (!q) return GENETIC_TRAITS;
    return GENETIC_TRAITS.filter(
      (m) => m.label.toLowerCase().includes(q) || m.id.includes(q),
    );
  }, [q]);

  const toggleGenetic = (id) => {
    if (!onGeneticsChange) return;
    if (genetics.includes(id)) onGeneticsChange(genetics.filter((x) => x !== id));
    else onGeneticsChange([...genetics, id]);
  };

  const confused = confusedWith(primary);

  return (
    <div className="space-y-5">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search morphs / genetic traits…"
          className="pl-9 bg-slate-800 border-slate-600 text-slate-100"
        />
      </div>

      <div>
        <div className="flex items-baseline justify-between mb-2">
          <p className="text-xs uppercase tracking-wide text-slate-400">Primary morph (pattern)</p>
          {primary && (
            <button
              type="button"
              onClick={() => onPrimaryChange?.(null)}
              className="text-xs text-slate-500 hover:text-slate-300"
            >
              clear
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-64 overflow-y-auto pr-1">
          {primaries.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => onPrimaryChange?.(m.id)}
              title={m.notes}
              className={`text-left px-3 py-2 rounded-md text-sm transition-colors border ${
                primary === m.id
                  ? 'bg-emerald-600 text-white border-emerald-500'
                  : 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
              }`}
            >
              <div className="font-medium">{m.label}</div>
              <div className={`text-xs ${primary === m.id ? 'text-emerald-100' : 'text-slate-400'}`}>
                {m.inheritance}
              </div>
            </button>
          ))}
        </div>
        {primary && confused.length > 0 && (
          <p className="mt-2 text-xs text-amber-300">
            Often confused with: {confused.map(labelFor).join(', ')}
          </p>
        )}
      </div>

      {onGeneticsChange && (
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400 mb-2">
            Named genetic traits (co-expressed)
          </p>
          <div className="flex flex-wrap gap-2">
            {genes.map((g) => {
              const selected = genetics.includes(g.id);
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => toggleGenetic(g.id)}
                  title={g.notes}
                  className={`px-3 py-1.5 rounded-full text-xs transition-colors border ${
                    selected
                      ? 'bg-purple-600 text-white border-purple-500'
                      : 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
                  }`}
                >
                  {g.label}
                  <span className={`ml-2 ${selected ? 'text-purple-100' : 'text-slate-500'}`}>
                    · {g.inheritance.split(' ')[0]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
