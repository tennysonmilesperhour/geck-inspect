import { useId } from 'react';
import { Check, Shuffle } from 'lucide-react';
import GeckoPlaceholder from '@/components/shared/GeckoPlaceholder';
import { GECKO_ART_STYLES, geckoArtStyle, geckoPlaceholderProfile, normalizeGeckoArtStyle } from '@/lib/geckoPlaceholderProfiles';

export default function GeckoArtworkPicker({ gecko, onChange, disabled = false, collectionDefault = false }) {
  const id = useId();
  const selected = normalizeGeckoArtStyle(gecko?.placeholder_style);
  const profile = geckoPlaceholderProfile(gecko);
  const inherited = normalizeGeckoArtStyle(gecko?.inherited_placeholder_style);
  const defaultLabel = collectionDefault ? 'Automatic mix' : 'Collection default';
  const options = [{ id: null, label: defaultLabel, artStyle: collectionDefault ? geckoArtStyle(gecko).id : inherited || geckoArtStyle(gecko).id },
    ...GECKO_ART_STYLES.map(style => ({ ...style, artStyle: style.id }))];

  return <fieldset disabled={disabled} aria-describedby={`${id}-hint`} className="min-w-0 rounded-2xl border border-slate-700 bg-slate-800/40 p-3 sm:p-4">
    <legend className="px-2 text-sm font-semibold text-slate-200">{collectionDefault ? 'Collection artwork' : 'Placeholder artwork'}</legend>
    <div className="mb-4 flex items-center gap-4">
      <GeckoPlaceholder gecko={gecko} className="h-28 w-28 shrink-0 rounded-xl shadow-lg sm:h-32 sm:w-32" />
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-emerald-300">{collectionDefault ? 'Your collection, your style' : 'Their collection card'}</p>
        <p className="mt-1 text-base font-semibold text-slate-100" aria-live="polite" aria-atomic="true">
          {selected ? profile.style.label : defaultLabel}
        </p>
        <p id={`${id}-hint`} className="mt-2 max-w-md text-xs leading-relaxed text-slate-400">
          {collectionDefault
            ? 'Choose the default for all geckos you own, including new arrivals. Individual style choices take priority. Photos always appear first.'
            : 'Choose a style for this gecko, or follow your collection default. The artwork follows their recorded sex and age, and appears when a photo is missing.'}
        </p>
        {!selected && <p className="mt-2 text-xs text-slate-400">{!collectionDefault && inherited
          ? `Currently ${profile.style.label}. Change the default in Settings, Appearance.`
          : 'Automatic mix gives each gecko a consistent style from the five designs.'}</p>}
      </div>
    </div>
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
      {options.map(option => <label key={option.id || 'automatic'} className={`relative min-w-0 ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
        <input
          type="radio"
          name={`${id}-artwork`}
          value={option.id || 'automatic'}
          checked={selected === option.id}
          disabled={disabled}
          onChange={() => onChange(option.id)}
          aria-label={option.label}
          className="peer sr-only"
        />
        <div className="h-full rounded-xl border border-slate-600 bg-slate-900/60 p-1.5 transition-colors peer-checked:border-emerald-300 peer-checked:bg-emerald-950/50 peer-focus-visible:ring-2 peer-focus-visible:ring-emerald-300 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-slate-900 hover:border-slate-400">
          <GeckoPlaceholder gecko={gecko} artStyle={option.artStyle} aria-hidden="true" className="w-full rounded-lg" />
          <span className="mt-2 flex min-h-8 items-center justify-center px-0.5 text-center text-[11px] font-medium leading-tight text-slate-200">{option.label}</span>
          {option.id === null && <Shuffle aria-hidden="true" className="absolute left-2.5 top-2.5 h-5 w-5 rounded-full bg-slate-900/90 p-1 text-white" />}
          {selected === option.id && <Check aria-hidden="true" className="absolute right-2.5 top-2.5 h-5 w-5 rounded-full bg-emerald-300 p-1 text-emerald-950 shadow-sm" />}
        </div>
      </label>)}
    </div>
  </fieldset>;
}
