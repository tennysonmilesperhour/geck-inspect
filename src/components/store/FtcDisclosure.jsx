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
      Affiliate link — we may earn a commission, at no extra cost to you.
    </span>
  );
}

export function FtcDisclosureBlock() {
  return (
    <div className="flex items-start gap-2 rounded-md border border-slate-800 bg-slate-900/40 px-3 py-2 text-xs text-slate-400">
      <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-slate-500" />
      <p>
        Some products on this page are sold by partners we receive a commission
        from. That doesn't change the price you pay or whether we recommend
        something — every item is here because it's a real pick by the breeders
        running this site.
      </p>
    </div>
  );
}

export default FtcDisclosureBlock;
