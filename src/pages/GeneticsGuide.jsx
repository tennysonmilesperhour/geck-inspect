import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dna, ArrowUp, Search, Download } from 'lucide-react';
import Seo from '@/components/seo/Seo';
import { Subsection } from '@/components/genetics/GeneticsHelpers';
import { GENETICS_GUIDE_JSON_LD, GENETICS_GUIDE_PUBLISHED, GENETICS_GUIDE_MODIFIED } from "@/data/genetics-jsonld";
import { bylineText } from '@/lib/editorial';
import { SECTIONS } from "@/data/genetics-sections.jsx";
import { GLOSSARY_GROUPS, GLOSSARY } from "@/data/genetics-glossary";

// ── Content data ──────────────────────────────────────────────────────────────
//
// Content organized by experience level — only TWO levels now:
//
//   Beginner: Foundations + Punnett squares + Morphs-vs-Polygenic basics
//   Advanced: Proven Mendelian morphs, lethal alleles, proving genetics
//
// Each level is shown as a tab on the page. Within a level, sections are
// laid out as a vertical "DNA strand" — numbered nodes on the left rail
// linked by a gradient backbone, with content cards on the right. There's
// no level filter, no prev/next slideshow buttons, and nothing is hidden
// behind collapsibles that chop off the flow.

const LEVEL_META = {
  Beginner: {
    label: 'Beginner',
    subtitle: 'Start here — what genes, alleles, and inheritance actually are.',
    accent: 'from-emerald-500 to-teal-400',
    badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
    nodeClass: 'bg-emerald-500 text-white ring-emerald-400/30',
  },
  Advanced: {
    label: 'Advanced',
    subtitle: 'Proven morphs, lethal alleles, and the ethics of serious breeding.',
    accent: 'from-purple-500 to-fuchsia-400',
    badgeClass: 'bg-purple-500/15 text-purple-300 border-purple-500/40',
    nodeClass: 'bg-purple-500 text-white ring-purple-400/30',
  },
};

// Decorative DNA helix illustration for the page header. Pure SVG,
// animated rungs, zero images.
function DnaHelix() {
  return (
    <svg
      viewBox="0 0 300 80"
      className="w-full h-20 opacity-80"
      role="presentation"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="helix-grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#10b981" />
          <stop offset="50%" stopColor="#14b8a6" />
          <stop offset="100%" stopColor="#a855f7" />
        </linearGradient>
      </defs>
      {/* Two sinusoidal strands */}
      <path
        d="M0,40 Q37.5,5 75,40 T150,40 T225,40 T300,40"
        stroke="url(#helix-grad)"
        strokeWidth="2.5"
        fill="none"
      />
      <path
        d="M0,40 Q37.5,75 75,40 T150,40 T225,40 T300,40"
        stroke="url(#helix-grad)"
        strokeWidth="2.5"
        fill="none"
      />
      {/* Base-pair rungs */}
      {[15, 45, 75, 105, 135, 165, 195, 225, 255, 285].map((x, i) => {
        // Compute y offset along the sine wave at this x for the rung start/end
        const freq = Math.PI / 37.5;
        const top = 40 + Math.sin((x - 0) * freq) * 20;
        const bot = 40 - Math.sin((x - 0) * freq) * 20;
        return (
          <line
            key={x}
            x1={x}
            y1={top}
            x2={x}
            y2={bot}
            stroke={i % 2 === 0 ? '#34d399' : '#a78bfa'}
            strokeWidth="1.5"
            strokeLinecap="round"
            opacity="0.7"
          />
        );
      })}
    </svg>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function GeneticsGuide() {
  const [activeLevel, setActiveLevel] = useState('Beginner');
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [glossarySearch, setGlossarySearch] = useState('');
  const sectionRefs = useRef({});

  useEffect(() => {
    const onScroll = () => setShowBackToTop(window.scrollY > 400);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });
  const scrollToSection = (id) => {
    sectionRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const levelSections = (level) => SECTIONS.filter((s) => s.level === level);

  const filteredGlossary = GLOSSARY.filter(
    (g) =>
      g.term.toLowerCase().includes(glossarySearch.toLowerCase()) ||
      g.def.toLowerCase().includes(glossarySearch.toLowerCase())
  );

  return (
    <>
      <Seo
        title="Crested Gecko Genetics Guide"
        description="Interactive crested gecko (Correlophus ciliatus) genetics reference: dominant, recessive, and incomplete-dominant inheritance explained with Punnett squares and diagrams. Covers proven morphs (Lilly White, Axanthic, Cappuccino, Soft Scale, White Wall), polygenic traits (harlequin, pinstripe, dalmatian, flame), lethal alleles, pigment biology, selective breeding strategy, and 80+ glossary terms."
        path="/GeneticsGuide"
        type="article"
        author="Geck Inspect"
        publishedTime={GENETICS_GUIDE_PUBLISHED}
        modifiedTime={GENETICS_GUIDE_MODIFIED}
        imageAlt="Crested gecko DNA double helix illustration"
        keywords={[
          'crested gecko genetics',
          'Correlophus ciliatus breeding',
          'Lilly White gecko',
          'axanthic crested gecko',
          'cappuccino gecko',
          'frappuccino gecko',
          'soft scale gecko',
          'white wall gecko',
          'harlequin crested gecko',
          'pinstripe gecko',
          'dalmatian gecko',
          'extreme harlequin',
          'Punnett square gecko',
          'polygenic traits reptile',
          'incomplete dominant',
          'recessive gecko morph',
          'proven het',
          'possible het',
          'selective breeding gecko',
          'reptile genetics beginner',
          'crested gecko breeding guide',
          'reptile inheritance patterns',
          'xanthophore iridophore melanophore',
          'crested gecko chromatophore',
          'super lilly white lethal',
        ]}
        jsonLd={GENETICS_GUIDE_JSON_LD}
      />
      <div className="min-h-screen bg-slate-950">
        {/* Hero with DNA helix */}
        <div className="relative overflow-hidden border-b border-slate-800 bg-gradient-to-br from-slate-950 via-emerald-950/30 to-purple-950/20">
          <div className="absolute inset-0 gecko-scale-pattern opacity-[0.04] pointer-events-none" />
          <div className="relative max-w-6xl mx-auto px-4 md:px-8 py-10 md:py-14">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-11 h-11 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                <Dna className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <h1 className="text-3xl md:text-5xl font-bold bg-gradient-to-b from-white to-emerald-200 bg-clip-text text-transparent tracking-tight">
                  Crested Gecko Genetics Guide
                </h1>
                <p className="text-sm md:text-base text-slate-400 mt-1">
                  An interactive educational reference for understanding crested gecko
                  genetics, morphs, and selective breeding.
                </p>
                <p className="text-xs text-slate-500 mt-2">{bylineText('/GeneticsGuide')}</p>
              </div>
            </div>
            <div className="mt-6">
              <DnaHelix />
            </div>
            <div className="mt-4">
              <a
                href="/downloads/geck-inspect-genetics-guide.pdf"
                download
                className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 px-4 py-2 text-sm font-semibold text-emerald-200 transition-colors"
              >
                <Download className="w-4 h-4" />
                Download Genetics Guide as PDF
              </a>
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-4 md:px-8 py-8">
          <Tabs defaultValue="guide">
            <TabsList className="bg-slate-900 border border-slate-800 mb-6">
              <TabsTrigger
                value="guide"
                className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white"
              >
                Guide
              </TabsTrigger>
              <TabsTrigger
                value="glossary"
                className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white"
              >
                Glossary
              </TabsTrigger>
            </TabsList>

            {/* Guide Tab */}
            <TabsContent value="guide">
              {/* Level toggles */}
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                <div className="flex items-center gap-2 p-1 rounded-xl border border-slate-800 bg-slate-900 self-start">
                  {Object.keys(LEVEL_META).map((level) => {
                    const meta = LEVEL_META[level];
                    const isActive = activeLevel === level;
                    return (
                      <button
                        key={level}
                        type="button"
                        onClick={() => {
                          setActiveLevel(level);
                          window.scrollTo({ top: 280, behavior: 'smooth' });
                        }}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                          isActive
                            ? `bg-gradient-to-r ${meta.accent} text-white shadow-md`
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {meta.label}
                      </button>
                    );
                  })}
                </div>
                <p className="text-sm text-slate-400 max-w-md md:text-right">
                  {LEVEL_META[activeLevel].subtitle}
                </p>
              </div>

              {/* Section quick-jump chips */}
              {(() => {
                const sections = levelSections(activeLevel);
                if (sections.length <= 1) return null;
                return (
                  <div className="flex flex-wrap gap-2 mb-6">
                    {sections.map((section, i) => (
                      <button
                        key={section.id}
                        type="button"
                        onClick={() => scrollToSection(section.id)}
                        className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-900/80 hover:bg-slate-800 hover:border-emerald-500/40 px-3 py-1 text-xs text-slate-300 transition-colors"
                      >
                        <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-slate-800 text-[10px] font-bold text-emerald-400">
                          {i + 1}
                        </span>
                        {section.title}
                      </button>
                    ))}
                  </div>
                );
              })()}

              {/* DNA-strand section layout */}
              <div className="relative">
                {/* Vertical DNA backbone — decorative gradient line on the left
                    rail, connecting every section's numbered node. */}
                <div className="absolute left-[19px] md:left-[23px] top-6 bottom-6 w-0.5 bg-gradient-to-b from-emerald-500/60 via-teal-400/40 to-purple-500/60 pointer-events-none" />

                <div className="space-y-8">
                  {levelSections(activeLevel).map((section, sectionIdx) => {
                    const Icon = section.icon;
                    const meta = LEVEL_META[section.level];
                    return (
                      <div
                        key={section.id}
                        ref={(el) => (sectionRefs.current[section.id] = el)}
                        className="relative pl-12 md:pl-14"
                      >
                        {/* Node on the strand */}
                        <div className="absolute left-0 top-5">
                          <div
                            className={`relative w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ring-4 ${meta.nodeClass}`}
                          >
                            {sectionIdx + 1}
                            <span className="absolute inset-0 rounded-full animate-ping opacity-20 bg-emerald-400" />
                          </div>
                        </div>

                        {/* Section card */}
                        <Card className="bg-slate-900/70 border-slate-800">
                          <CardHeader className="pb-3">
                            <div className="flex items-start gap-3 flex-wrap">
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <Icon className="w-5 h-5 text-emerald-400 shrink-0" />
                                <h2 className="text-xl md:text-2xl font-bold text-slate-100 truncate">
                                  {section.title}
                                </h2>
                              </div>
                              <Badge
                                variant="outline"
                                className={`text-[10px] uppercase tracking-wider border ${meta.badgeClass}`}
                              >
                                {meta.label}
                              </Badge>
                            </div>
                            <p className="text-slate-400 text-sm leading-relaxed mt-2">
                              {section.intro}
                            </p>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            {section.subsections.map((sub) => (
                              <Subsection key={sub.title} title={sub.title}>
                                {sub.content}
                              </Subsection>
                            ))}
                          </CardContent>
                        </Card>
                      </div>
                    );
                  })}
                </div>
              </div>
            </TabsContent>

            {/* Glossary Tab */}
            <TabsContent value="glossary">
              <div className="max-w-4xl">
                <div className="relative mb-5">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    placeholder="Search glossary..."
                    value={glossarySearch}
                    onChange={(e) => setGlossarySearch(e.target.value)}
                    className="pl-9 bg-slate-900 border-slate-700 text-slate-100"
                  />
                  <p className="text-xs text-slate-500 mt-2">
                    {GLOSSARY.length} terms across {GLOSSARY_GROUPS.length} categories
                  </p>
                </div>

                {glossarySearch.trim() ? (
                  // Flat search results
                  <div className="rounded-lg overflow-hidden border border-slate-800">
                    <div className="grid grid-cols-[200px_1fr] bg-emerald-900/40 px-4 py-2">
                      <span className="text-emerald-300 text-xs font-bold uppercase tracking-wider">
                        Term
                      </span>
                      <span className="text-emerald-300 text-xs font-bold uppercase tracking-wider">
                        Definition
                      </span>
                    </div>
                    {filteredGlossary.map((row, i) => (
                      <div
                        key={row.term}
                        className={`grid grid-cols-[200px_1fr] px-4 py-3 gap-4 border-t border-slate-800 ${i % 2 === 0 ? 'bg-slate-900' : 'bg-slate-900/40'}`}
                      >
                        <div>
                          <div className="text-emerald-300 font-semibold text-sm">
                            {row.term}
                          </div>
                          <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">
                            {row.category}
                          </div>
                        </div>
                        <span className="text-slate-300 text-sm leading-relaxed">
                          {row.def}
                        </span>
                      </div>
                    ))}
                    {filteredGlossary.length === 0 && (
                      <div className="px-4 py-8 text-center text-sm text-slate-500 bg-slate-900">
                        No glossary entries match that search.
                      </div>
                    )}
                  </div>
                ) : (
                  // Grouped by category when no search is active
                  <div className="space-y-6">
                    {GLOSSARY_GROUPS.map((group) => (
                      <div
                        key={group.category}
                        className="rounded-lg overflow-hidden border border-slate-800"
                      >
                        <div className="bg-gradient-to-r from-emerald-900/50 via-slate-900 to-slate-900 px-4 py-3 border-b border-slate-800">
                          <h3 className="text-emerald-300 text-sm font-bold uppercase tracking-wider">
                            {group.category}
                          </h3>
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            {group.entries.length} terms
                          </p>
                        </div>
                        {group.entries.map((row, i) => (
                          <div
                            key={row.term}
                            className={`grid grid-cols-[200px_1fr] px-4 py-3 gap-4 border-t border-slate-800 ${i % 2 === 0 ? 'bg-slate-900/60' : 'bg-slate-900/30'}`}
                          >
                            <span className="text-emerald-300 font-semibold text-sm">
                              {row.term}
                            </span>
                            <span className="text-slate-300 text-sm leading-relaxed">
                              {row.def}
                            </span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {showBackToTop && (
          <button
            onClick={scrollToTop}
            className="fixed right-6 z-50 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full p-3 shadow-lg transition-all"
            style={{ bottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}
            aria-label="Back to top"
          >
            <ArrowUp className="w-5 h-5" />
          </button>
        )}
      </div>
    </>
  );
}