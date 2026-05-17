import { useState, useMemo } from 'react';
import { Link, useParams, Navigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, BookOpen } from 'lucide-react';
import Seo from '@/components/seo/Seo';
import { KEEPERS_GUIDES } from '@/data/keepers-guides';
import GuideSlideshow from '@/components/careguide/GuideSlideshow';

const SERIES_PATH = '/CareGuide/series';

function GuideCard({ guide }) {
  return (
    <Link
      to={`${SERIES_PATH}/${guide.id}`}
      className="group rounded-2xl border border-slate-800 bg-slate-900/40 hover:border-emerald-500/40 hover:bg-slate-900 transition-colors p-5 md:p-6 flex flex-col"
    >
      <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-300 mb-2">
        Guide {guide.number}
      </div>
      <h3 className="font-serif text-xl md:text-2xl font-bold text-slate-100 mb-2 group-hover:text-emerald-200">
        {guide.title}
      </h3>
      <p className="text-sm text-slate-400 leading-relaxed flex-1">
        {guide.description}
      </p>
      <div className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-emerald-400 group-hover:text-emerald-300">
        Start guide
        <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
      </div>
    </Link>
  );
}

function SeriesIndex() {
  return (
    <>
      <Seo
        title="The Keeper's Guide Series | Crested Gecko"
        description="Five in-depth slide-based guides for crested gecko keepers: feeding troubleshooting, setup and the first 30 days, the handbook of things they don't tell you, morph and genetics, and the complete breeding arc."
        path={SERIES_PATH}
        imageAlt="The Keeper's Guide Series"
      />
      <div className="min-h-screen bg-slate-950 text-slate-100">
        <section className="relative border-b border-slate-800/50 bg-gradient-to-br from-emerald-950/40 via-slate-900 to-slate-950">
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />
          </div>
          <div className="relative max-w-5xl mx-auto px-6 py-12 md:py-16">
            <Link
              to="/CareGuide"
              className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-emerald-300 mb-6"
            >
              <ArrowLeft className="w-4 h-4" />
              Care Guide
            </Link>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300 mb-5">
              <BookOpen className="w-3.5 h-3.5" />
              The Keeper&apos;s Guide Series
            </div>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight leading-[1.05] mb-4 bg-gradient-to-b from-white to-emerald-200 bg-clip-text text-transparent">
              Five in-depth guides
            </h1>
            <p className="text-lg md:text-xl text-slate-300 max-w-3xl leading-relaxed">
              Slide-based deep dives for keepers at every level. Each guide is self-contained, click through with the keyboard or the next button.
            </p>
          </div>
        </section>

        <section className="max-w-5xl mx-auto px-4 md:px-6 py-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {KEEPERS_GUIDES.map((g) => (
              <GuideCard key={g.id} guide={g} />
            ))}
          </div>
        </section>
      </div>
    </>
  );
}

function SeriesGuide({ guideId }) {
  const guide = useMemo(
    () => KEEPERS_GUIDES.find((g) => g.id === guideId) || null,
    [guideId],
  );
  const [navOpen, setNavOpen] = useState(false);

  if (!guide) {
    return <Navigate to={SERIES_PATH} replace />;
  }

  return (
    <>
      <Seo
        title={`${guide.title} | Keeper's Guide`}
        description={guide.description}
        path={`${SERIES_PATH}/${guide.id}`}
        imageAlt={`${guide.title} reference slideshow`}
      />
      <div className="min-h-screen bg-slate-950 text-slate-100">
        <div className="max-w-5xl mx-auto px-4 md:px-6 py-8 md:py-10">
          <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
            <Link
              to={SERIES_PATH}
              className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-emerald-300"
            >
              <ArrowLeft className="w-4 h-4" />
              All five guides
            </Link>
            <button
              type="button"
              onClick={() => setNavOpen((v) => !v)}
              className="text-xs text-slate-400 hover:text-emerald-300"
            >
              {navOpen ? 'Hide' : 'Jump to'} other guides
            </button>
          </div>

          {navOpen && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-6">
              {KEEPERS_GUIDES.map((g) => (
                <Link
                  key={g.id}
                  to={`${SERIES_PATH}/${g.id}`}
                  className={`rounded-lg border px-3 py-2 text-sm ${
                    g.id === guide.id
                      ? 'border-emerald-500/40 bg-emerald-600/15 text-emerald-200'
                      : 'border-slate-800 bg-slate-900/40 text-slate-300 hover:border-emerald-500/30'
                  }`}
                >
                  <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-300 block mb-0.5">
                    Guide {g.number}
                  </span>
                  {g.shortTitle}
                </Link>
              ))}
            </div>
          )}

          <header className="mb-6">
            <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-300 mb-2">
              Guide {guide.number}
            </div>
            <h1 className="font-serif text-3xl md:text-4xl font-bold text-slate-100 mb-2">
              {guide.title}
            </h1>
            <p className="text-slate-400 max-w-3xl">{guide.description}</p>
          </header>

          <GuideSlideshow guide={guide} />
        </div>
      </div>
    </>
  );
}

export default function CareGuideSeriesPage() {
  const { guideId } = useParams();
  if (!guideId) return <SeriesIndex />;
  return <SeriesGuide guideId={guideId} />;
}
