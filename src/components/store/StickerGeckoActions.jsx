import { Link } from 'react-router-dom';
import { Sticker, PanelTop } from 'lucide-react';
import { stickerGeckoLocation } from '@/lib/store/stickerGecko';
import { captureEvent } from '@/lib/posthog';
import { isPageRetired } from '@/lib/retiredPages';

export default function StickerGeckoActions({ gecko }) {
  if (!gecko) return null;
  // The sticker builders live in the supplies store, which is switched off
  // (review item E3 23, src/lib/retiredPages.js). Both links would only
  // land on the store's redirect, so the card shows nothing until the
  // store comes back.
  if (isPageRetired('Store')) return null;
  return <div className="rounded-xl border border-emerald-800/50 bg-emerald-950/20 p-4 space-y-3">
    <div><h3 className="text-sm font-semibold text-emerald-100">Made for {gecko.name || 'your gecko'}</h3><p className="text-xs text-slate-400 mt-1">Start with the name, species, and photo already on this record.</p></div>
    <div className="grid grid-cols-1 gap-2">
      {[
        ['trading_card', 'Make a sticker', Sticker], ['enclosure_plaque', 'Make an enclosure name plaque', PanelTop],
      ].map(([theme, label, Icon]) => {
        const destination = stickerGeckoLocation(gecko, theme);
        return <Link key={theme} to={{ pathname: destination.pathname, search: destination.search }} state={destination.state} className="min-h-11 flex items-center justify-center gap-2 rounded-lg border border-emerald-700/60 px-3 py-2 text-sm text-emerald-200 hover:bg-emerald-900/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-300" onClick={() => captureEvent('custom_sticker_collection_started', { theme })}><Icon className="h-4 w-4 shrink-0" />{label}</Link>;
      })}
    </div>
  </div>;
}
