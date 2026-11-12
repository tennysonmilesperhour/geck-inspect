import { toast } from '@/components/ui/use-toast';
import { ToastAction } from '@/components/ui/toast';

// How long the Undo button stays on screen.
export const UNDO_MS = 8000;

/**
 * A toast with an Undo button, for anything that can be put back.
 *
 * Use this instead of an "Are you sure?" box when the action is
 * reversible: do it at once, say what happened, and let the member take
 * it back for a few seconds. Keep confirmation dialogs (ConfirmDialog)
 * for things that cannot be undone.
 *
 *   undoToast({
 *     title: '2 eggs added',
 *     description: 'Onyx x Aria, laid today.',
 *     undo: async () => { await removeThem(); },   // put it back
 *     undone: 'Eggs removed',                      // said after Undo works
 *   });
 *
 * `undo` may be async. If it throws, the member is told the undo did not
 * work, so they are never left believing something was reversed when it
 * was not. Returns the toast handle ({ id, dismiss, update }).
 */
export function undoToast({ title, description, undo, undone = 'Undone', undoLabel = 'Undo', duration = UNDO_MS }) {
  let used = false;
  const handle = toast({
    title,
    description,
    duration,
    action: (
      <ToastAction
        altText={undoLabel}
        onClick={async () => {
          if (used) return;
          used = true;
          handle.dismiss();
          try {
            await undo();
            toast({ title: undone });
          } catch (error) {
            console.error('Undo failed:', error);
            toast({
              title: 'That could not be undone',
              description: 'Nothing was put back. Check it and change it by hand.',
              variant: 'destructive',
            });
          }
        }}
      >
        {undoLabel}
      </ToastAction>
    ),
  });
  return handle;
}
