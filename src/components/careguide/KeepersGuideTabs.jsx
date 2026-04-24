import { useState } from 'react';
import { KEEPERS_GUIDES } from '@/data/keepers-guides';
import GuideSlideshow from './GuideSlideshow';
import { BookOpen } from 'lucide-react';

export default function KeepersGuideTabs() {
  const [activeId, setActiveId] = useState(KEEPERS_GUIDES[0].id);
  const activeGuide = KEEPERS_GUIDES.find((g) => g.id === activeId) || KEEPERS_GUIDES[0];

  return (
    <section
      id="keepers-guide-series"
      className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-slate-900/70 to-slate-950 p-4 md:p-6"
    >
      <header className="mb-5">
        <div className="flex items-center gap-2 text-emerald-300 mb-2">
          <BookOpen className="w-4 h-4" />
          <span className="text-xs font-bold uppercase tracking-wider">
            The Keeper's Guide Series
          </span>
        </div>
        <h2 className="font-serif text-2xl md:text-3xl font-bold text-slate-100">
          Five in-depth guides
        </h2>
        <p className="text-slate-400 mt-1 max-w-2xl">
          Click through each slide. Keyboard arrows work too. Written for
          keepers at every level - from your first gecko to a full breeding
          project.
        </p>
      </header>

      {/* Tab bar */}
      <div
        role="tablist"
        aria-label="Keeper's Guide Series"
        className="mb-6 flex overflow-x-auto -mx-1 px-1 pb-2 gap-2 scrollbar-thin"
      >
        {KEEPERS_GUIDES.map((g) => {
          const active = g.id === activeId;
          return (
            <button
              key={g.id}
              role="tab"
              aria-selected={active}
              type="button"
              onClick={() => setActiveId(g.id)}
              className={`flex-shrink-0 rounded-xl border px-3 md:px-4 py-2.5 text-left transition-colors min-w-[160px] md:min-w-[190px] ${
                active
                  ? 'border-emerald-500/50 bg-emerald-600/15 text-emerald-100'
                  : 'border-slate-800 bg-slate-900/60 text-slate-300 hover:border-slate-700 hover:bg-slate-900'
              }`}
            >
              <div
                className={`text-[10px] font-bold uppercase tracking-widest mb-0.5 ${
                  active ? 'text-emerald-300' : 'text-slate-500'
                }`}
              >
                Guide {g.number}
              </div>
              <div className="text-sm font-semibold truncate">{g.shortTitle}</div>
            </button>
          );
        })}
      </div>

      <GuideSlideshow guide={activeGuide} />
    </section>
  );
}
