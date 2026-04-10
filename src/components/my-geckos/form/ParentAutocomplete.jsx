import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ChevronDown } from 'lucide-react';

const DEFAULT_THUMB = 'https://i.imgur.com/sw9gnDp.png';

/**
 * Controlled autocomplete input for picking a gecko's sire or dam from the
 * current user's collection. Previously this was two copy-pasted blocks in
 * GeckoForm; both are now collapsed into a single component.
 *
 * Props:
 *   id            — DOM id for the input (for label htmlFor)
 *   label         — visible label ("Sire (Father)" / "Dam (Mother)")
 *   placeholder   — placeholder text
 *   value         — current typed text (controlled)
 *   onChange      — (value) => void, called on every keystroke. Parent is
 *                   responsible for also updating the linked FK id.
 *   onSelect      — (gecko) => void, called when a suggestion is clicked
 *   geckos        — full list of candidate geckos (filtered by sex + self)
 *   disabled      — locks the input when the gecko is archived
 */
export default function ParentAutocomplete({
  id,
  label,
  placeholder,
  value,
  onChange,
  onSelect,
  geckos,
  disabled = false,
}) {
  const [showSuggestions, setShowSuggestions] = useState(false);

  const filtered = geckos.filter((g) => {
    if (!value) return true;
    const v = value.toLowerCase();
    return (
      g.name.toLowerCase().includes(v) ||
      g.gecko_id_code?.toLowerCase().includes(v)
    );
  });

  return (
    <div className="relative">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative flex items-center">
        <Input
          id={id}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setShowSuggestions(true);
          }}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          placeholder={placeholder}
          disabled={disabled}
          className="bg-slate-800 border-slate-600 text-slate-100 pr-8 disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <ChevronDown className="w-4 h-4 absolute right-2 text-slate-400 pointer-events-none" />
      </div>
      {showSuggestions && filtered.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-600 rounded-lg shadow-2xl z-[99999] max-h-48 overflow-y-auto">
          {filtered.map((g) => (
            <button
              key={g.id}
              type="button"
              className="w-full text-left px-3 py-2 text-sm text-slate-200 hover:bg-slate-700 flex items-center gap-2"
              onMouseDown={() => {
                onSelect(g);
                setShowSuggestions(false);
              }}
            >
              <img
                src={g.image_urls?.[0] || DEFAULT_THUMB}
                alt={g.name}
                className="w-6 h-6 rounded object-cover flex-shrink-0"
              />
              <span>{g.name}</span>
              {g.gecko_id_code && (
                <span className="text-slate-400 text-xs ml-auto">
                  {g.gecko_id_code}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
