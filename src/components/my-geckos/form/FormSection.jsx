import { ChevronDown } from 'lucide-react';

/**
 * One headed section of the gecko form (experience review D2). The
 * heading is a button that folds the section away, which is what keeps
 * the form short on a phone; the fields stay mounted while folded, so
 * nothing typed is lost and the browser can still check them.
 *
 * Props:
 *   id        the section's key; also written to data-form-section so the
 *             form can open the section that holds a field with an error
 *   title     the heading
 *   summary   one short line shown beside the heading while folded, so a
 *             folded section still says what is in it
 *   open, onToggle
 */
export default function FormSection({ id, title, summary = '', open, onToggle, children }) {
  const headingId = `gecko-form-${id}-heading`;
  const panelId = `gecko-form-${id}-panel`;
  return (
    <section data-form-section={id} aria-labelledby={headingId} className="border-t border-slate-700 first:border-t-0">
      {/* data-no-dirty: folding a section is not a change to the gecko. */}
      <h3 id={headingId} data-no-dirty>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={panelId}
          className="flex w-full min-h-11 items-center gap-3 py-2 text-left rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
        >
          <span className="shrink-0 text-base font-semibold text-slate-100">{title}</span>
          <span className="min-w-0 flex-1 truncate text-right text-xs text-slate-400">{open ? '' : summary}</span>
          <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
        </button>
      </h3>
      {/* The label rules give every field the same small gap under its
          label without touching each field's own markup. */}
      <div
        id={panelId}
        hidden={!open}
        className="space-y-4 pb-5 pt-1 [&_label+input]:mt-1.5 [&_label+textarea]:mt-1.5 [&_label+button]:mt-1.5 [&_label+div]:mt-1.5"
      >
        {children}
      </div>
    </section>
  );
}
