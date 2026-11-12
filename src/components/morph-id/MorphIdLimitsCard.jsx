import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, GitBranch, ShieldAlert } from 'lucide-react';
import { PHOTO_LIMITS } from './morphTaxonomy';

// The one sentence that stays in sight wherever Morph ID asks for photos
// or shows an answer.
export const VISIBLE_NOT_PROVEN = 'Morph ID reads what is visible. A photo cannot prove a gene.';

const LIMITS_TITLE = "What a photo can't tell you";

/** The four cautions and the lineage line, the same words wherever they show. */
function LimitsBody() {
  return (
    <>
      <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {PHOTO_LIMITS.map((item) => (
          <li key={item.title} className="rounded-lg border border-amber-900/60 bg-slate-950/30 p-3">
            <p className="text-sm font-medium text-slate-100">{item.title}</p>
            <p className="text-xs text-slate-400 mt-1">{item.body}</p>
          </li>
        ))}
      </ul>

      <div className="mt-4 rounded-lg border border-emerald-800/70 bg-emerald-950/20 p-3 flex items-start gap-3">
        <GitBranch className="w-4 h-4 text-emerald-300 shrink-0 mt-0.5" aria-hidden="true" />
        <p className="text-xs text-emerald-100/90">
          <strong className="text-emerald-100">Lineage settles what photos can't.</strong>{' '}
          When every gecko is recorded with its sire, dam and proven genes, you know which version of a gene it carries, which hets it may hold, and which pairings are safe.{' '}
          <Link to="/pedigree-tracker" className="underline text-emerald-300 hover:text-emerald-200">How lineage tracking works</Link>
        </p>
      </div>
    </>
  );
}

const LIMITS_INTRO =
  'Many different crested geckos look the same in a photo, so treat the result as a starting point, not a genetic test.';

/**
 * What Morph ID cannot do, in full: shown beside a result, where it
 * changes how the result is read. Many different morphs look the same in a
 * photo; recorded lineage is what tells them apart.
 */
export default function MorphIdLimitsCard() {
  return (
    <section className="rounded-xl border border-amber-800/70 bg-amber-950/20 p-4 md:p-5" data-testid="morph-id-limits-full">
      <div className="flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-amber-300 shrink-0 mt-0.5" aria-hidden="true" />
        <div>
          <h2 className="font-semibold text-amber-100">{LIMITS_TITLE}</h2>
          <p className="text-sm text-amber-100/80 mt-1">
            Morph ID reads what is visible. {LIMITS_INTRO}
          </p>
        </div>
      </div>
      <div className="mt-4">
        <LimitsBody />
      </div>
    </section>
  );
}

/**
 * The same cautions above the upload control, folded to one line so the
 * photo slots are on the first screen of a phone (they used to sit under
 * the full card, about 1,500 px down). The sentence is always in sight;
 * the link unfolds the four cautions, word for word.
 */
export function MorphIdLimitsDisclosure() {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  return (
    <section
      aria-label="What Morph ID can and cannot tell"
      className="rounded-xl border border-amber-800/60 bg-amber-950/20 px-3 py-2.5"
      data-testid="morph-id-limits-line"
    >
      <p className="text-sm text-amber-100 flex items-start gap-2">
        <ShieldAlert className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" aria-hidden="true" />
        <span>
          {VISIBLE_NOT_PROVEN}{' '}
          <button
            type="button"
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => setOpen((value) => !value)}
            className="relative touch-hit inline-flex items-center gap-0.5 font-medium text-amber-300 underline underline-offset-2 hover:text-amber-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded-sm"
          >
            {LIMITS_TITLE}
            <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
          </button>
        </span>
      </p>
      {/* Always in the page, folded with `hidden`, so the link's
          aria-controls target exists before it is opened. */}
      <div id={panelId} hidden={!open} className="mt-3 pb-1">
        <p className="text-sm text-amber-100/80 mb-3">{LIMITS_INTRO}</p>
        <LimitsBody />
      </div>
    </section>
  );
}

/**
 * The sentence again at the top of a result, with a jump to the full
 * cautions under it. onShowAll scrolls there.
 */
export function MorphIdLimitsLine({ onShowAll }) {
  return (
    <p className="text-sm text-amber-100 flex items-start gap-2" data-testid="morph-id-result-limits-line">
      <ShieldAlert className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" aria-hidden="true" />
      <span>
        {VISIBLE_NOT_PROVEN}{' '}
        <button
          type="button"
          onClick={onShowAll}
          className="relative touch-hit font-medium text-amber-300 underline underline-offset-2 hover:text-amber-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded-sm"
        >
          {LIMITS_TITLE}
        </button>
      </span>
    </p>
  );
}
