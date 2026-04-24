import { useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { CareGuideSection } from '@/entities/all';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Heart,
  Home,
  Utensils,
  Hand,
  Info,
  BookOpen,
  Scale,
  Users,
  Search,
  ExternalLink,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import Seo from '@/components/seo/Seo';
import { CARE_CATEGORIES } from '@/data/care-guide';
import ContentBlock from '@/components/careguide/ContentBlock';
import KeepersGuideTabs from '@/components/careguide/KeepersGuideTabs';
import { authorSchema, bylineText, editorialFor } from '@/lib/editorial';

const CATEGORY_ICONS = {
  overview: Info,
  housing: Home,
  feeding: Utensils,
  handling: Hand,
  health: Heart,
  'life-stages': Scale,
  breeding: Users,
};

const LEVEL_STYLES = {
  beginner: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  intermediate: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  advanced: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
};

const CARE_GUIDE_EDITORIAL = editorialFor('/CareGuide');

const CARE_GUIDE_JSON_LD = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'BreadcrumbList',
      '@id': 'https://geckinspect.com/CareGuide#breadcrumbs',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://geckinspect.com/' },
        { '@type': 'ListItem', position: 2, name: 'Care Guide', item: 'https://geckinspect.com/CareGuide' },
      ],
    },
    {
      '@type': 'Article',
      '@id': 'https://geckinspect.com/CareGuide#article',
      headline: 'Crested Gecko Care Guide — Complete Beginner to Advanced Reference',
      description:
        'Comprehensive care guide for crested geckos (Correlophus ciliatus): housing, temperature and humidity, diet, handling, common health issues, shedding, tail loss, breeding, and hatchling care.',
      url: 'https://geckinspect.com/CareGuide',
      about: {
        '@type': 'Thing',
        name: 'Crested gecko',
        alternateName: 'Correlophus ciliatus',
        sameAs: 'https://en.wikipedia.org/wiki/Crested_gecko',
      },
      author: authorSchema(),
      reviewedBy: authorSchema(),
      datePublished: CARE_GUIDE_EDITORIAL.published,
      dateModified: CARE_GUIDE_EDITORIAL.modified,
      // speakable: picks out the intro paragraphs of the guide as
      // voice-assistant-friendly content. Google Assistant honors the
      // cssSelector form.
      speakable: {
        '@type': 'SpeakableSpecification',
        cssSelector: ['h1', 'article p:first-of-type', '.prose p:first-of-type'],
      },
      publisher: {
        '@type': 'Organization',
        name: 'Geck Inspect',
        url: 'https://geckinspect.com/',
      },
    },
    {
      '@type': 'FAQPage',
      '@id': 'https://geckinspect.com/CareGuide#faq',
      mainEntity: [
        {
          '@type': 'Question',
          name: 'How big of an enclosure does a crested gecko need?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'An adult crested gecko needs a minimum of an 18x18x24 inch vertical terrarium. Hatchlings should start in a 6-qt tub or 12x12x18 inch juvenile enclosure to reduce stress. Vertical height matters more than floor space because crested geckos are arboreal.',
          },
        },
        {
          '@type': 'Question',
          name: 'Do crested geckos need heat or UVB lighting?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Crested geckos thrive at room temperature (72-78°F) and usually do not need supplemental heat. They do not strictly require UVB because complete CGD contains vitamin D3, but low-level UVB is enriching and beneficial. Avoid temperatures above 82°F.',
          },
        },
        {
          '@type': 'Question',
          name: 'What do crested geckos eat?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'The primary diet is commercial Crested Gecko Diet (CGD) — a complete powdered food mixed with water. Popular brands include Pangea, Repashy, and Black Panther Zoological. Insects like dubia roaches or black soldier fly larvae can be offered 1–2 times per week as enrichment.',
          },
        },
        {
          '@type': 'Question',
          name: 'How long do crested geckos live?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'With proper care, crested geckos can live 15 to 20 years in captivity. They are a long-term commitment.',
          },
        },
        {
          '@type': 'Question',
          name: 'Do crested geckos regrow their tails?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'No. Crested geckos do not regrow their tails once dropped. Tail loss is a predator-escape response and is permanent. Tailless crested geckos live normal, healthy lives.',
          },
        },
        {
          '@type': 'Question',
          name: 'When can crested geckos be bred?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Females should not be bred until they reach 40 grams and at least 18 months of age to avoid calcium depletion and egg-binding. Males can breed earlier once they reach 25–30 grams at 12+ months.',
          },
        },
      ],
    },
  ],
};

function CategoryNav({ categories, activeId, onSelect, sectionCounts }) {
  return (
    <nav className="rounded-2xl border border-slate-800 bg-slate-900/60 p-2 sticky top-4">
      <div className="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        Care Topics
      </div>
      <div className="space-y-1">
        {categories.map((cat) => {
          const Icon = CATEGORY_ICONS[cat.id] || Info;
          const active = cat.id === activeId;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => onSelect(cat.id)}
              className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                active
                  ? 'bg-emerald-600/15 border border-emerald-500/30 text-emerald-200'
                  : 'border border-transparent text-slate-300 hover:bg-slate-800/60 hover:text-slate-100'
              }`}
            >
              <Icon
                className={`w-4 h-4 flex-shrink-0 ${active ? 'text-emerald-300' : 'text-slate-400'}`}
              />
              <span className="text-sm font-medium flex-1 truncate">{cat.label}</span>
              {sectionCounts[cat.id] > 0 && (
                <Badge
                  variant="outline"
                  className={`text-[10px] font-semibold ${
                    active
                      ? 'border-emerald-500/40 text-emerald-300'
                      : 'border-slate-700 text-slate-400'
                  }`}
                >
                  {sectionCounts[cat.id]}
                </Badge>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function QuickFactsGrid({ facts }) {
  if (!facts || facts.length === 0) return null;
  return (
    <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-950/30 to-slate-900/60 p-5 md:p-6">
      <div className="flex items-center gap-2 mb-4 text-emerald-300">
        <Sparkles className="w-4 h-4" />
        <span className="text-xs font-semibold uppercase tracking-wider">Quick facts</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {facts.map((fact, i) => (
          <div
            key={i}
            className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2.5"
          >
            <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-0.5">
              {fact.label}
            </div>
            <div className="text-sm font-semibold text-slate-100">{fact.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SectionCard({ section }) {
  const levelClass = LEVEL_STYLES[section.level] || LEVEL_STYLES.beginner;
  return (
    <article
      id={section.id}
      className="scroll-mt-24 rounded-2xl border border-slate-800 bg-slate-900/40 p-6 md:p-8"
    >
      <header className="mb-5 flex flex-wrap items-center gap-3">
        <h3 className="text-2xl md:text-[28px] font-bold text-slate-100">
          {/* Deep-link the heading to the topic's standalone page so
              crawlers find 34 new indexable URLs and human readers can
              share a link to the specific topic. The standalone page is
              rendered by src/pages/CareGuideTopic.jsx. */}
          <a
            href={`/CareGuide/${section.id}`}
            className="hover:text-emerald-300 transition-colors"
          >
            {section.title}
          </a>
        </h3>
        {section.level && (
          <span
            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold capitalize ${levelClass}`}
          >
            {section.level}
          </span>
        )}
      </header>
      <div className="space-y-5">
        {section.body.map((block, i) => (
          <ContentBlock key={i} block={block} />
        ))}
      </div>
      <footer className="mt-5 pt-4 border-t border-slate-800/60 text-xs text-slate-500">
        <a
          href={`/CareGuide/${section.id}`}
          className="text-emerald-300 hover:text-emerald-200 font-semibold"
        >
          Permalink: /CareGuide/{section.id} →
        </a>
      </footer>
    </article>
  );
}

function CommunitySection({ section }) {
  if (!section) return null;
  return (
    <article className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 md:p-8">
      <header className="mb-5 flex items-center gap-3">
        <h3 className="text-2xl font-bold text-slate-100">{section.title}</h3>
        <span className="inline-flex items-center rounded-full border border-slate-700 px-2.5 py-0.5 text-[11px] font-semibold text-slate-400">
          Community
        </span>
      </header>
      {section.image_urls?.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-5">
          {section.image_urls.map((url, i) => (
            <img
              key={i}
              src={url}
              alt={`${section.title} ${i + 1}`}
              className="rounded-lg border border-slate-700 object-cover w-full h-44"
              loading="lazy"
            />
          ))}
        </div>
      )}
      <div className="prose prose-invert max-w-none prose-p:text-slate-300 prose-li:text-slate-300 prose-headings:text-slate-100 prose-strong:text-slate-100">
        <ReactMarkdown>{section.content || ''}</ReactMarkdown>
      </div>
      {section.source_url && (
        <a
          href={section.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center gap-1.5 text-sm text-emerald-400 hover:text-emerald-300"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Source
        </a>
      )}
    </article>
  );
}

export default function CareGuidePage() {
  const [activeId, setActiveId] = useState(CARE_CATEGORIES[0].id);
  const [dbSections, setDbSections] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const fetched = await CareGuideSection.filter({ is_published: true });
        if (!cancelled) setDbSections(Array.isArray(fetched) ? fetched : []);
      } catch (err) {
        console.error('CareGuide DB fetch failed:', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Map DB sections into categories so they show up alongside the
  // authoritative local sections.
  const dbByCategory = useMemo(() => {
    const map = {};
    for (const s of dbSections) {
      const cat = (s.category || 'general').toLowerCase();
      const normalized = cat === 'general' ? 'overview' : cat;
      (map[normalized] ||= []).push(s);
    }
    for (const k of Object.keys(map)) {
      map[k].sort((a, b) => (a.order_position || 0) - (b.order_position || 0));
    }
    return map;
  }, [dbSections]);

  const sectionCounts = useMemo(() => {
    const counts = {};
    CARE_CATEGORIES.forEach((c) => {
      counts[c.id] = c.sections.length + (dbByCategory[c.id]?.length || 0);
    });
    return counts;
  }, [dbByCategory]);

  const activeCategory =
    CARE_CATEGORIES.find((c) => c.id === activeId) || CARE_CATEGORIES[0];

  // Search filtering: search across the active category's sections (local + DB).
  const q = searchTerm.trim().toLowerCase();
  const localSections = useMemo(() => {
    if (!q) return activeCategory.sections;
    return activeCategory.sections.filter((s) => {
      if (s.title.toLowerCase().includes(q)) return true;
      return s.body.some((block) => {
        if (block.type === 'p') return block.text?.toLowerCase().includes(q);
        if (block.type === 'ul' || block.type === 'ol')
          return block.items.some((it) => it.toLowerCase().includes(q));
        if (block.type === 'callout')
          return (
            block.title?.toLowerCase().includes(q) ||
            block.items.some((it) => it.toLowerCase().includes(q))
          );
        if (block.type === 'dl')
          return block.items.some(
            (it) =>
              it.term.toLowerCase().includes(q) ||
              it.def.toLowerCase().includes(q),
          );
        if (block.type === 'table')
          return block.rows.some((row) =>
            row.some((c) => String(c).toLowerCase().includes(q)),
          );
        return false;
      });
    });
  }, [activeCategory, q]);

  const communitySections = dbByCategory[activeCategory.id] || [];

  const totalLocalSections = useMemo(
    () => CARE_CATEGORIES.reduce((n, c) => n + c.sections.length, 0),
    [],
  );

  return (
    <>
      <Seo
        title="Crested Gecko Care Guide"
        description="Comprehensive crested gecko (Correlophus ciliatus) care guide — housing setups, temperature and humidity ranges, diet with CGD brand comparison, handling, common health issues, shedding, tail loss, breeding readiness, egg incubation, and hatchling care."
        path="/CareGuide"
        imageAlt="Crested gecko care and husbandry reference"
        keywords={[
          'crested gecko care',
          'crested gecko husbandry',
          'crestie care sheet',
          'Correlophus ciliatus care',
          'crested gecko diet',
          'Pangea CGD',
          'Repashy CGD',
          'crested gecko humidity',
          'crested gecko temperature',
          'crested gecko housing',
          'crested gecko enclosure',
          'crested gecko shedding',
          'crested gecko tail loss',
          'crested gecko hatchling care',
          'crested gecko breeding',
          'crested gecko lifespan',
        ]}
        jsonLd={CARE_GUIDE_JSON_LD}
      />
      <div className="min-h-screen bg-slate-950 text-slate-100">
        {/* Hero */}
        <section className="relative border-b border-slate-800/50 bg-gradient-to-br from-emerald-950/40 via-slate-900 to-slate-950">
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />
          </div>
          <div className="relative max-w-6xl mx-auto px-6 py-12 md:py-16">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300 mb-5">
              <BookOpen className="w-3.5 h-3.5" />
              Care Reference
            </div>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight leading-[1.05] mb-4 bg-gradient-to-b from-white to-emerald-200 bg-clip-text text-transparent">
              Crested Gecko Care Guide
            </h1>
            <p className="text-lg md:text-xl text-slate-300 max-w-3xl leading-relaxed">
              Every dimension of crested gecko husbandry, from your first
              hatchling to long-term breeding projects. Housing, diet, handling,
              health, life stages, breeding — written for beginners, deep enough
              for keepers with dozens of animals.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-2 text-xs text-slate-400">
              <span>{totalLocalSections} topics</span>
              <span>·</span>
              <span>7 categories</span>
            </div>
            <p className="mt-2 text-xs text-slate-500">{bylineText('/CareGuide')}</p>
          </div>
        </section>

        <section className="max-w-6xl mx-auto px-4 md:px-6 py-10">
          <div className="mb-6">
            <div className="relative max-w-xl">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <Input
                placeholder="Search within this topic..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-slate-900 border-slate-700 text-slate-200 placeholder:text-slate-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-8">
            {/* Nav */}
            <aside className="lg:block">
              <CategoryNav
                categories={CARE_CATEGORIES}
                activeId={activeId}
                onSelect={(id) => {
                  setActiveId(id);
                  setSearchTerm('');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                sectionCounts={sectionCounts}
              />
            </aside>

            {/* Content */}
            <main className="min-w-0 space-y-6">
              <header>
                <div className="flex items-center gap-2 text-xs text-slate-500 mb-3">
                  <span>Care Guide</span>
                  <ChevronRight className="w-3 h-3" />
                  <span className="text-slate-300">{activeCategory.label}</span>
                </div>
                <h2 className="text-3xl md:text-4xl font-bold text-slate-100 mb-2">
                  {activeCategory.label}
                </h2>
                <p className="text-slate-400 text-lg">{activeCategory.tagline}</p>
              </header>

              {activeCategory.quickFacts?.length > 0 && (
                <QuickFactsGrid facts={activeCategory.quickFacts} />
              )}

              <KeepersGuideTabs />

              {localSections.length === 0 && communitySections.length === 0 ? (
                <Card className="bg-slate-900/40 border-slate-800">
                  <CardContent className="py-10 text-center text-slate-400">
                    {q ? 'No topics match your search.' : 'No content yet for this category.'}
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-6">
                  {localSections.map((s) => (
                    <SectionCard key={s.id} section={s} />
                  ))}
                  {communitySections.map((s) => (
                    <CommunitySection key={s.id || s.title} section={s} />
                  ))}
                </div>
              )}

              {/* Cross-guide CTAs */}
              <div className="mt-10 rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
                <h3 className="text-lg font-semibold text-slate-100 mb-3">
                  Keep learning
                </h3>
                <div className="flex flex-wrap gap-2">
                  <a
                    href="/MorphGuide"
                    className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-900 hover:border-emerald-500/50 hover:text-emerald-200 px-3 py-1.5 text-sm text-slate-300 transition-colors"
                  >
                    Morph Guide
                    <ChevronRight className="w-3.5 h-3.5" />
                  </a>
                  <a
                    href="/GeneticsGuide"
                    className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-900 hover:border-emerald-500/50 hover:text-emerald-200 px-3 py-1.5 text-sm text-slate-300 transition-colors"
                  >
                    Genetics Guide
                    <ChevronRight className="w-3.5 h-3.5" />
                  </a>
                  <a
                    href="/Gallery"
                    className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-900 hover:border-emerald-500/50 hover:text-emerald-200 px-3 py-1.5 text-sm text-slate-300 transition-colors"
                  >
                    Community Gallery
                    <ChevronRight className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            </main>
          </div>
        </section>
      </div>
    </>
  );
}
