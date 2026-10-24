/**
 * FTC affiliate disclosure component.
 *
 * Required by 16 CFR Part 255 wherever we render an affiliate link.
 * Two variants:
 *   - inline: short footnote on a product card or PDP
 *   - block: full sentence at the top of any page that contains
 *            affiliate items
 */

import { Info } from 'lucide-react';

export function FtcDisclosureInline() {
  return (
    <span className="text-[10px] text-slate-500">
      Affiliate link, we may earn a commission, at no extra cost to you.
    </span>
  );
}

export function FtcDisclosureBlock() {
  return (
    <div className="flex items-start gap-2 rounded-md border border-slate-800 bg-slate-900/40 px-3 py-2 text-xs text-slate-400">
      <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-slate-500" />
      <div className="space-y-1.5">
        <p>
          As an Amazon Associate, Geck Inspect earns from qualifying purchases.
          We may also earn commissions from other affiliate links, at no extra
          cost to you. Check the seller’s listing for current details and whether
          an item suits your animal.
        </p>
        <p>
          Check Amazon for current product photos, packaging, price, and
          availability. Search links may include different sizes, pack counts,
          or variants.
        </p>
      </div>
    </div>
  );
}

export default FtcDisclosureBlock;
