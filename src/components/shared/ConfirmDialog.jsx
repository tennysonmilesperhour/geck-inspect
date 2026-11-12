import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

/**
 * The one "are you sure?" dialog, in place of the browser's own
 * confirm() box (which cannot be styled, reads as an error, and blocks
 * the page).
 *
 * Use it only for things that cannot be undone. For anything reversible,
 * do the action and offer Undo (src/lib/undoToast.jsx).
 *
 *   const [ask, setAsk] = useState(null);   // null, or what is being asked about
 *   ...
 *   <ConfirmDialog
 *     open={Boolean(ask)}
 *     onOpenChange={(open) => { if (!open) setAsk(null); }}
 *     title={`Delete ${ask?.name}?`}
 *     description="Its sign-ups go with it. This cannot be undone."
 *     confirmLabel="Delete"
 *     destructive
 *     onConfirm={() => remove(ask)}
 *   />
 *
 * Props:
 *   title, description   what is being asked, in plain words
 *   confirmLabel         the action's own verb ("Delete", "Remove"), never "OK"
 *   cancelLabel          defaults to "Cancel"
 *   destructive          red confirm button, for deletes
 *   busy                 disables both buttons while the action runs
 *   onConfirm            called on confirm; the caller closes the dialog
 */
export default function ConfirmDialog({
  open, onOpenChange, title, description, confirmLabel = 'Confirm', cancelLabel = 'Cancel',
  destructive = false, busy = false, onConfirm, children,
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="bg-slate-900 border-slate-700">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-slate-100">{title}</AlertDialogTitle>
          {description && (
            <AlertDialogDescription className="text-slate-400">{description}</AlertDialogDescription>
          )}
        </AlertDialogHeader>
        {children}
        <AlertDialogFooter>
          <AlertDialogCancel className="border-slate-600" disabled={busy}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            disabled={busy}
            className={destructive ? 'bg-red-700 hover:bg-red-600 text-white' : undefined}
            onClick={(event) => {
              // The caller decides when to close, so a failed action can
              // keep the dialog open with its message.
              event.preventDefault();
              onConfirm?.();
            }}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
