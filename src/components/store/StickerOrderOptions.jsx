import { Sparkles } from 'lucide-react';
import { formatCents } from '@/lib/store/format';
import { STICKER_BULK_MINIMUM, STICKER_FINISHES, stickerUnitPriceCents } from '@/lib/store/stickerPricing';

/** Quantity belongs to the order; the printed artwork stays the same. */
export default function StickerOrderOptions({ quantities, onChange, cartQuantity = 0, added = false }) {
  const selected = quantities.glossy + quantities.holographic;
  const combined = cartQuantity + (added ? 0 : selected);
  const bulk = combined >= STICKER_BULK_MINIMUM;
  return <fieldset className="space-y-4">
    <legend className="font-semibold text-stone-100 mb-3">Choose your finishes & quantities</legend>
    <p className="text-xs leading-relaxed text-slate-400">Order this design in either finish, or mix both. Add another design to build your own collection.</p>
    <div className="flex flex-wrap gap-2" aria-label="Sticker quantity shortcuts">
      {[
        ['One standard', { glossy: 1, holographic: 0 }],
        ['One holographic', { glossy: 0, holographic: 1 }],
        ['20 standard', { glossy: 20, holographic: 0 }],
        ['10 of each', { glossy: 10, holographic: 10 }],
      ].map(([label, values]) => <button key={label} type="button" onClick={() => onChange(values)} className="rounded-full border border-slate-700 px-3 py-2 min-h-10 text-xs text-slate-300 hover:border-emerald-400 hover:text-emerald-200">{label}</button>)}
    </div>
    <div className="space-y-2">
      {STICKER_FINISHES.map(({ value, label }) => <div key={value} className={`flex items-center gap-3 rounded-xl border p-3 ${quantities[value] ? 'border-emerald-700/70 bg-emerald-950/20' : 'border-slate-800'}`}>
        <span aria-hidden="true" className={`h-10 w-8 shrink-0 rounded border border-white/20 ${value === 'holographic' ? 'bg-[linear-gradient(135deg,#b1dbed_0%,#e5c6ee_25%,#fce9a9_47%,#aff0d5_70%,#b6c3ef_100%)]' : 'bg-[linear-gradient(135deg,#f9f5e9_0%,#e4ded1_45%,#ffffff_50%,#f3ead8_60%,#d8d0c1_100%)]'}`} />
        <div className="flex-1 min-w-0"><label htmlFor={`sticker-quantity-${value}`} className="block text-sm font-medium text-stone-100">{label}</label><span className="block mt-0.5 text-xs text-slate-400">{formatCents(stickerUnitPriceCents(value, combined))} each{value === 'holographic' && !bulk ? ' · +$3' : ''}</span></div>
        <input id={`sticker-quantity-${value}`} aria-label={`${label} quantity`} type="number" inputMode="numeric" min="0" max="999999" step="1" value={quantities[value]} onChange={(event) => {
          const quantity = Number(event.target.value);
          if (Number.isSafeInteger(quantity) && quantity >= 0 && quantity <= 999999) onChange({ ...quantities, [value]: quantity });
        }} className="w-20 min-h-11 rounded-lg border border-slate-700 bg-slate-950 px-2 text-center text-sm text-stone-100 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400" />
      </div>)}
    </div>
    <div aria-live="polite" className={`rounded-xl border p-3 text-xs leading-relaxed ${bulk ? 'border-emerald-700/60 bg-emerald-950/40 text-emerald-100' : 'border-slate-700 bg-slate-950 text-slate-400'}`}>
      <p className="font-semibold flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5 shrink-0" />{bulk ? 'Bulk pricing unlocked' : `${Math.max(0, STICKER_BULK_MINIMUM - combined)} more to unlock bulk pricing`}</p>
      <p className="mt-1">20+ stickers: $5 standard, $7 holographic each. Mix designs, sizes, and finishes in one order.</p>
      {cartQuantity > 0 && <p className="mt-1">{cartQuantity} sticker{cartQuantity === 1 ? '' : 's'} already in your cart{!added && selected > 0 ? ` + ${selected} in this design` : ''}.</p>}
    </div>
    {selected === 0 && <p role="status" className="text-xs text-amber-200">Choose at least one sticker to see your total.</p>}
    <p className="text-[11px] leading-relaxed text-slate-500">Holographic is a physical finish. The color swatch is illustrative; your screen proof shows the printed artwork.</p>
  </fieldset>;
}
