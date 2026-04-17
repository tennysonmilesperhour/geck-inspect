import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, X } from 'lucide-react';
import { TRAITS_BY_GROUP, SECONDARY_TRAITS, TRAIT_BY_ID } from './morphTaxonomy';

export default function TraitPicker({ value = [], onChange, compact = false }) {
  const [query, setQuery] = useState('');

  const filteredGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return TRAITS_BY_GROUP;
    return TRAITS_BY_GROUP
      .map((g) => ({
        ...g,
        traits: g.traits.filter(
          (t) => t.label.toLowerCase().includes(q) || t.id.includes(q),
        ),
      }))
      .filter((g) => g.traits.length > 0);
  }, [query]);

  const toggle = (id) => {
    if (value.includes(id)) {
      onChange(value.filter((v) => v !== id));
    } else {
      onChange([...value, id]);
    }
  };

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${SECONDARY_TRAITS.length} traits…`}
          className="pl-9 bg-slate-800 border-slate-600 text-slate-100"
        />
      </div>

      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((id) => (
            <Badge
              key={id}
              variant="secondary"
              className="bg-emerald-600/20 text-emerald-200 border border-emerald-600/40"
            >
              {TRAIT_BY_ID[id]?.label || id}
              <button
                type="button"
                onClick={() => toggle(id)}
                className="ml-2 hover:text-white"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      <div className={compact ? 'space-y-3 max-h-64 overflow-y-auto pr-1' : 'space-y-4'}>
        {filteredGroups.map((group) => (
          <div key={group.id}>
            <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">
              {group.label}
            </p>
            <div className="flex flex-wrap gap-2">
              {group.traits.map((trait) => {
                const selected = value.includes(trait.id);
                return (
                  <button
                    key={trait.id}
                    type="button"
                    onClick={() => toggle(trait.id)}
                    className={`px-3 py-1 rounded-full text-xs transition-colors ${
                      selected
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                    }`}
                  >
                    {trait.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {filteredGroups.length === 0 && (
          <p className="text-sm text-slate-500 text-center py-4">
            No traits match "{query}".
          </p>
        )}
      </div>
    </div>
  );
}
