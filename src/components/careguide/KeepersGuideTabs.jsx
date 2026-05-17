import { useMemo } from 'react';
import { KEEPERS_GUIDES } from '@/data/keepers-guides';
import GuideSlideshow from './GuideSlideshow';
import { BookOpen, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

// Each care category gets at most one Keeper's Guide, based on which
// guide actually covers that category's subject matter. Categories
// without a clean mapping (Handling, Health, Life Stages) render
// nothing here, the long-form section cards below cover them.
const CATEGORY_TO_GUIDE = {
  overview: 'handbook',
  housing: 'setup',
  feeding: 'feeding',
  breeding: 'breeding',
};

export default function KeepersGuideTabs({ categoryId }) {
  const guide = useMemo(() => {
    const guideId = CATEGORY_TO_GUIDE[categoryId];
    if (!guideId) return null;
    return KEEPERS_GUIDES.find((g) => g.id === guideId) || null;
  }, [categoryId]);

  if (!guide) return null;

  return (
    <section
      id="keepers-guide-series"
      className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-slate-900/70 to-slate-950 p-4 md:p-6"
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
            className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-emerald-300"
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
