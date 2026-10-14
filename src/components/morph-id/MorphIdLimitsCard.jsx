import { Link } from 'react-router-dom';
import { GitBranch, ShieldAlert } from 'lucide-react';
import { PHOTO_LIMITS } from './morphTaxonomy';

/**
 * What Morph ID cannot do, shown before upload. Many different morphs look
 * the same in a photo; recorded lineage is what tells them apart.
 */
export default function MorphIdLimitsCard() {
  return (
    <section className="rounded-xl border border-amber-800/70 bg-amber-950/20 p-4 md:p-5">
      <div className="flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-amber-300 shrink-0 mt-0.5" />
        <div>
          <h2 className="font-semibold text-amber-100">What a photo can't tell you</h2>
          <p className="text-sm text-amber-100/80 mt-1">
            Morph ID reads what is visible. Many different crested geckos look the same in a photo, so treat the result as a starting point, not a genetic test.
          </p>
        </div>
      </div>

      <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
        {PHOTO_LIMITS.map((item) => (
          <li key={item.title} className="rounded-lg border border-amber-900/60 bg-slate-950/30 p-3">
            <p className="text-sm font-medium text-slate-100">{item.title}</p>
            <p className="text-xs text-slate-400 mt-1">{item.body}</p>
          </li>
        ))}
      </ul>

      <div className="mt-4 rounded-lg border border-emerald-800/70 bg-emerald-950/20 p-3 flex items-start gap-3">
        <GitBranch className="w-4 h-4 text-emerald-300 shrink-0 mt-0.5" />
        <p className="text-xs text-emerald-100/90">
          <strong className="text-emerald-100">Lineage settles what photos can't.</strong>{' '}
          When every gecko is recorded with its sire, dam and proven genes, you know which version of a gene it carries, which hets it may hold, and which pairings are safe.{' '}
          <Link to="/pedigree-tracker" className="underline text-emerald-300 hover:text-emerald-200">How lineage tracking works</Link>
        </p>
      </div>
    </section>
  );
}
