import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { REVENUE_CATEGORIES } from '@/lib/businessLedger';
import { todayLocalISO } from '@/lib/dateUtils';

/**
 * Sold price, sale type and date, asked for whenever a gecko is marked
 * sold, so Business Tools counts what it actually sold for instead of the
 * asking price.
 */
export function initialSaleDetails(gecko, defaultCategory = '') {
  const asking = Number(gecko?.asking_price);
  return {
    sold_price: gecko?.sold_price ?? (asking > 0 ? String(asking) : ''),
    sale_category: gecko?.sale_category || defaultCategory || '',
    sale_date: todayLocalISO(),
  };
}

/** Gecko fields to save from the form. A blank price stays blank. */
export function saleDetailsPatch(details) {
  const price = details?.sold_price === '' || details?.sold_price == null ? null : Number(details.sold_price);
  return {
    sold_price: Number.isFinite(price) ? price : null,
    sale_category: details?.sale_category || null,
    archived_date: details?.sale_date || todayLocalISO(),
  };
}

export default function SaleDetailsFields({ value, onChange }) {
  const set = (patch) => onChange({ ...value, ...patch });
  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <Label className="text-xs text-slate-400">Sold for ($)</Label>
        <Input
          type="number"
          step="0.01"
          min="0"
          value={value.sold_price}
          onChange={(e) => set({ sold_price: e.target.value })}
          placeholder="0.00"
          className="bg-slate-800 border-slate-600 text-slate-100 h-9 text-sm mt-1"
        />
      </div>
      <div>
        <Label className="text-xs text-slate-400">Sale type</Label>
        <select
          value={value.sale_category}
          onChange={(e) => set({ sale_category: e.target.value })}
          className="w-full h-9 mt-1 rounded-md bg-slate-800 border border-slate-600 text-slate-100 text-sm px-2"
        >
          <option value="">Not set</option>
          {REVENUE_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </div>
      <div className="col-span-2">
        <Label className="text-xs text-slate-400">Sale date</Label>
        <Input
          type="date"
          value={value.sale_date}
          onChange={(e) => set({ sale_date: e.target.value })}
          className="bg-slate-800 border-slate-600 text-slate-100 h-9 text-sm mt-1"
        />
      </div>
      <p className="col-span-2 text-xs text-slate-500">
        Business Tools counts this price as revenue. Leave it blank if you are not sure yet; you can fill it in there.
      </p>
    </div>
  );
}
