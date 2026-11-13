import { Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * The small "Saved" tick beside a setting. Settings save as they change
 * (useSettingsAutosave), so this is the only answer the member gets:
 * "Saving" while the request is out, "Saved" for a moment after.
 * Renders nothing when there is nothing to say.
 */
export function SaveTick({ status, className }) {
  if (status?.state !== 'saving' && status?.state !== 'saved') return null;
  const saving = status.state === 'saving';
  return (
    <span
      role="status"
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap text-xs font-medium',
        saving ? 'text-slate-400' : 'text-emerald-300',
        className,
      )}
    >
      {saving
        ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        : <Check className="h-3.5 w-3.5" aria-hidden="true" />}
      {saving ? 'Saving' : 'Saved'}
    </span>
  );
}

/**
 * A save that failed, said next to the control it belongs to. The
 * control has already gone back to its saved value; "Try again" sends
 * the member's choice once more. A value the page would not accept (an
 * empty display name) shows its own reason and has nothing to retry.
 */
export function SaveError({ status, onRetry, className }) {
  if (status?.state !== 'error') return null;
  const canRetry = status.canRetry && typeof onRetry === 'function';
  return (
    <p role="alert" className={cn('mt-2 text-sm text-red-300', className)}>
      {canRetry ? 'Could not save this, so it is back to what was saved.' : status.message}
      {canRetry && (
        <>
          {' '}
          <button
            type="button"
            onClick={onRetry}
            className="relative touch-hit font-medium text-red-200 underline underline-offset-2 hover:text-red-100"
          >
            Try again
          </button>
        </>
      )}
    </p>
  );
}
