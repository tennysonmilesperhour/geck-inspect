import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronRight, Scale, Sparkles, Utensils, Wrench } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useAuth } from '@/lib/AuthContext';
import { isGuestMode } from '@/lib/guestMode';
import { fieldModeQueryKey, loadWritableGeckos } from '@/lib/fieldModeData';
import { collectionLogLinks, todayQueryKey } from '@/lib/today';
import { captureEvent } from '@/lib/posthog';

/**
 * The phone's Log tab (review item E3 25): what to log, then the one-tap
 * log page (/log) for the collection, or Field Mode for everything else
 * (notes, another day, a different weight scale). The collection is the
 * copy Field Mode keeps on the phone, so this works with no signal.
 */
export default function LogSheet({ open, onOpenChange }) {
  const { user, isGuest } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const guest = Boolean(isGuest) || isGuestMode();
  const email = guest ? null : user?.email;

  const geckoQuery = useQuery({
    queryKey: fieldModeQueryKey(email),
    enabled: open && Boolean(email),
    queryFn: () => loadWritableGeckos(user),
  });

  // Come back to the page the tab was tapped on, except the log itself.
  const here = `${location.pathname}${location.search}`;
  const links = collectionLogLinks({
    geckos: geckoQuery.data || [],
    todayData: email ? queryClient.getQueryData(todayQueryKey(email)) : null,
    from: location.pathname === '/log' ? null : here,
  });

  const go = (kind, to) => {
    captureEvent('log_tab', { action: 'choose', kind });
    onOpenChange(false);
    navigate(to);
  };

  const options = [
    { kind: 'feeding', label: 'Feeding', hint: 'Fed or refused, one tap each', Icon: Utensils, to: links.feeding },
    { kind: 'weight', label: 'Weigh-in', hint: 'Type the grams and save', Icon: Scale, to: links.weight },
    { kind: 'shed', label: 'Shed', hint: 'One tap for a shed today', Icon: Sparkles, to: links.shed },
    { kind: 'field_mode', label: 'Field Mode', hint: 'Notes, another day, or one gecko at a time', Icon: Wrench, to: '/FieldMode' },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-2xl border-slate-700 bg-slate-950 px-4 pt-5 pb-[calc(1rem+env(safe-area-inset-bottom))] text-slate-100"
      >
        <SheetHeader className="text-left">
          <SheetTitle className="text-lg text-slate-100">Log</SheetTitle>
          <SheetDescription className="text-slate-400">
            {guest ? 'This is the demo, so nothing is saved.' : 'Saved for today. Works with no signal.'}
          </SheetDescription>
        </SheetHeader>
        <ul className="mt-4 space-y-2">
          {options.map(({ kind, label, hint, Icon, to }) => (
            <li key={kind}>
              <button
                type="button"
                onClick={() => go(kind, to)}
                className="flex w-full min-h-14 items-center gap-3 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-left hover:border-emerald-600/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60"
              >
                <Icon className="h-5 w-5 shrink-0 text-emerald-300" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block text-base font-semibold">{label}</span>
                  <span className="block text-sm text-slate-400">{hint}</span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      </SheetContent>
    </Sheet>
  );
}
