import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import GeckoRecord from '@/components/gecko/record/GeckoRecord';
import useModalOverlay from '@/hooks/useModalOverlay';

/**
 * The gecko record as a window over My Geckos, opened by tapping a card.
 *
 * It shows the same record as the /GeckoDetail page (GeckoRecord), so
 * weights, feedings, sheds, vet visits, lineage, value and passport are
 * all here, one tap from the card. A window rather than a page change
 * keeps it fast on a phone: the gecko is already loaded, and closing it
 * returns to the same spot in the list. On a phone it fills the screen;
 * on a wider screen it is a centred panel.
 *
 * Props are My Geckos' own flows: onEdit opens the edit form, onArchive
 * and onMarkSold the archive dialog, onDelete deletes (shown only to the
 * owner or an admin). `canEdit` comes from canWriteGecko (the owner or a
 * collection editor). Everyone who can open this window belongs to the
 * gecko's collection, so the private care history shows to all of them.
 */
export default function GeckoDetailModal({
  gecko,
  onClose,
  onUpdate,
  onEdit,
  onArchive,
  onMarkSold,
  onDelete,
  allGeckos = [],
  currentUser = null,
  canEdit = false,
}) {
  // Dialog role, Escape to close, focus, and the hook the floating-widget
  // hide rule needs. Called before the early return, as hooks must be.
  const overlay = useModalOverlay(onClose);
  if (!gecko) return null;

  return (
    <div
      {...overlay}
      aria-label={gecko.name || 'Gecko record'}
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex sm:items-center sm:justify-center sm:p-4"
    >
      {/* No close on a click outside: a stray click would throw away a
          half-typed weigh-in or vet visit. Close and Escape close it. */}
      {/* The outer panel keeps clear of the notch and home bar; the inner
          one scrolls, so the record's sticky bar stays below the notch. */}
      <div className="flex flex-col w-full h-[100dvh] sm:h-auto sm:max-h-[92vh] sm:max-w-5xl bg-slate-950 sm:bg-slate-900 sm:rounded-xl sm:border sm:border-slate-700 overflow-hidden pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] sm:pt-0 sm:pb-0">
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
          {/* Keyed by gecko, so a different gecko starts from a clean record
              instead of showing the last one's parents while it loads. */}
          <GeckoRecord
            key={gecko.id}
            gecko={gecko}
            currentUser={currentUser}
            canEdit={canEdit}
            isMember
            allGeckos={allGeckos}
            variant="modal"
            leading={(
              <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close the record">
                <X className="w-5 h-5 text-slate-300" />
              </Button>
            )}
            onUpdate={onUpdate}
            onEdit={onEdit}
            onArchive={onArchive}
            onMarkSold={onMarkSold}
            onDelete={onDelete}
          />
        </div>
      </div>
    </div>
  );
}
