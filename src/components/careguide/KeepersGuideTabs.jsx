import GuideSlideshow from './GuideSlideshow';
import { BookOpen, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { CATEGORY_TO_GUIDE, GUIDE_SPACE, useKeepersGuide } from './keepersGuides';

const BOX = 'rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-slate-900/70 to-slate-950 p-4 md:p-6';

// Which guide a category shows, and how the guides load, is in
// ./keepersGuides.js. Categories without a guide render nothing here.
export default function KeepersGuideTabs({ categoryId }) {
  const { guide, waiting } = useKeepersGuide(categoryId);

  // Still downloading on a slow connection: hold the guide's space so the
  // topic below stays put when it arrives.
  if (waiting) {
    return (
      <section
        aria-busy="true"
        className={`${BOX} ${GUIDE_SPACE[CATEGORY_TO_GUIDE[categoryId]] || ''}`}
      >
        <div className="flex items-center gap-2 text-emerald-300">
          <BookOpen className="w-4 h-4" />
          <span className="text-xs font-bold uppercase tracking-wider">The Keeper&apos;s Guide Series</span>
        </div>
        <p role="status" className="mt-3 text-sm text-slate-400">Loading this topic&apos;s guide…</p>
      </section>
    );
  }

  if (!guide) return null;

  return (
    <section
      id="keepers-guide-series"
      className={BOX}
    >
      <header className="mb-5">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-2">
          <div className="flex items-center gap-2 text-emerald-300">
            <BookOpen className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider">
              The Keeper&apos;s Guide Series &middot; Guide {guide.number}
            </span>
          </div>
          <Link
            to="/CareGuide/series"
            className="touch:min-h-11 inline-flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-emerald-300"
          >
            All five guides
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        <h2 className="font-serif text-2xl md:text-3xl font-bold text-slate-100">
          {guide.title}
        </h2>
        {guide.description && (
          <p className="text-slate-400 mt-1 max-w-2xl">{guide.description}</p>
        )}
      </header>

      <GuideSlideshow guide={guide} />
    </section>
  );
}
