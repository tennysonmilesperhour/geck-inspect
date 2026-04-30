import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Seo from '@/components/seo/Seo';
import ContentBlock from '@/components/careguide/ContentBlock';
import PublicPageShell from '@/components/public/PublicPageShell';
import { CARE_CATEGORIES } from '@/data/care-guide';
import { breadcrumbSchema, ORG_ID, SITE_URL } from '@/lib/organization-schema';
import { authorSchema, bylineText, editorialFor } from '@/lib/editorial';
import { createPageUrl } from '@/utils';

/**
 * Programmatic-SEO deep-link page for a single Care Guide topic.
 *
 * Every section in src/data/care-guide.js is eligible for its own URL
 * at /CareGuide/<sectionId>. This captures long-tail intent queries
 * like "crested gecko humidity", "crested gecko incubation temperature",
 * and "crested gecko picky eater" without the work of hand-writing a
 * separate article for each one — the content already lives in the
 * structured care-guide dataset.
 */

// Build a flat id → { section, category } map once per module load.
const SECTION_INDEX = (() => {
  const map = new Map();
  for (const cat of CARE_CATEGORIES) {
    for (const sec of cat.sections || []) {
      map.set(sec.id, { section: sec, category: cat });
    }
  }
  return map;
})();

// Flat ordered list for prev/next navigation between topic pages.
const FLAT_SECTIONS = CARE_CATEGORIES.flatMap((cat) =>
  (cat.sections || []).map((sec) => ({ id: sec.id, title: sec.title, category: cat })),
);

function sectionPlainText(section) {
  const chunks = [];
  for (const block of section.body || []) {
    if (block.type === 'p' && block.text) chunks.push(block.text);
    else if (block.type === 'ul' || block.type === 'ol') {
      if (Array.isArray(block.items)) chunks.push(block.items.join(' '));
    } else if (block.type === 'callout' && Array.isArray(block.items)) {
      chunks.push(block.items.join(' '));
    }
    if (chunks.join(' ').length > 280) break;
  }
  return chunks.join(' ').replace(/\s+/g, ' ').slice(0, 280).trim();
}

// If a care section contains an ordered-list block, treat that list as
// a HowTo procedure. Many topics like "How to set up an enclosure" or
// "How to handle a new arrival" are naturally step-based; emitting HowTo
// lets AI assistants read the procedure aloud and quote individual steps.
// Returns null when no ordered steps exist so the schema only ships
// where it's actually applicable.
function howToSchemaFor(section, url) {
  const ol = (section.body || []).find(
    (b) => b.type === 'ol' && Array.isArray(b.items) && b.items.length >= 2,
  );
  if (!ol) return null;
  const introBlock = (section.body || []).find((b) => b.type === 'p' && b.text);
  return {
    '@type': 'HowTo',
    '@id': `${url}#howto`,
    name: section.title,
    description: introBlock?.text?.slice(0, 250) || `${section.title} — crested gecko care procedure.`,
    step: ol.items.map((text, i) => ({
      '@type': 'HowToStep',
      position: i + 1,
      name: `Step ${i + 1}`,
      text,
    })),
  };
}

export default function CareGuideTopic() {
  const { topic } = useParams();
  const entry = topic ? SECTION_INDEX.get(topic) : null;

  const { section, category } = entry || {};

  const { prev, next } = useMemo(() => {
    if (!section) return { prev: null, next: null };
    const idx = FLAT_SECTIONS.findIndex((s) => s.id === section.id);
    return {
      prev: idx > 0 ? FLAT_SECTIONS[idx - 1] : null,
      next: idx >= 0 && idx < FLAT_SECTIONS.length - 1 ? FLAT_SECTIONS[idx + 1] : null,
    };
  }, [section]);

  if (!entry) {
    return (
      <PublicPageShell>
        <Seo
          title="Care Guide topic not found"
          description="That care guide topic could not be found."
          path={`/CareGuide/${topic || ''}`}
          noIndex
        />
        <section className="max-w-3xl mx-auto px-6 py-20 text-center">
          <h1 className="text-3xl font-bold text-slate-100 mb-3">Topic not found</h1>
          <p className="text-slate-400 mb-6">
            We couldn't find a care guide topic for "{topic}". Start from the full guide instead.
          </p>
          <Link to="/CareGuide">
            <Button className="bg-emerald-700 hover:bg-emerald-800 text-white font-semibold">
              <ArrowLeft className="w-4 h-4 mr-2" /> Back to the Care Guide
            </Button>
          </Link>
        </section>
      </PublicPageShell>
    );
  }

  const path = `/CareGuide/${section.id}`;
  const url = `${SITE_URL}${path}`;
  const description = sectionPlainText(section) ||
    `${section.title} — crested gecko care guide section from Geck Inspect.`;
  const editorial = editorialFor(path);

  const howTo = howToSchemaFor(section, url);
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'Article',
      '@id': `${url}#article`,
      headline: `${section.title} — Crested Gecko Care Guide`,
      description,
      url,
      articleSection: category?.label || 'Crested Gecko Care',
      about: {
        '@type': 'Thing',
        name: 'Crested gecko',
        alternateName: 'Correlophus ciliatus',
        sameAs: 'https://en.wikipedia.org/wiki/Crested_gecko',
      },
      isPartOf: {
        '@type': 'Article',
        '@id': 'https://geckinspect.com/CareGuide#article',
      },
      author: authorSchema(),
      reviewedBy: authorSchema(),
      datePublished: editorial.published,
      dateModified: editorial.modified,
      speakable: {
        '@type': 'SpeakableSpecification',
        cssSelector: ['h1', 'article p:first-of-type'],
      },
      publisher: { '@id': ORG_ID },
    },
    ...(howTo ? [howTo] : []),
    breadcrumbSchema([
      { name: 'Home', path: '/' },
      { name: 'Care Guide', path: '/CareGuide' },
      { name: category?.label || 'Topic', path: `/CareGuide#${category?.id || ''}` },
      { name: section.title, path },
    ]),
  ];

  return (
    <PublicPageShell>
      <Seo
        title={`${section.title} — Crested Gecko Care`}
        description={description}
        path={path}
        type="article"
        keywords={[
          'crested gecko care',
          `crested gecko ${section.title.toLowerCase()}`,
          category?.label?.toLowerCase(),
        ].filter(Boolean)}
        jsonLd={jsonLd}
      />

      <article className="max-w-3xl mx-auto px-6 pt-4 pb-16">
        <div className="flex items-center gap-2 text-xs text-slate-500 mb-4">
          <Link to="/" className="hover:text-slate-300">Home</Link>
          <span>/</span>
          <Link to="/CareGuide" className="hover:text-slate-300">Care Guide</Link>
          <span>/</span>
          <span className="text-slate-400">{section.title}</span>
        </div>

        {category && (
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300 mb-4">
            <BookOpen className="w-3.5 h-3.5" />
            {category.label} · Care Guide
          </div>
        )}

        <h1 className="text-3xl md:text-5xl font-bold tracking-tight leading-[1.1] mb-4 bg-gradient-to-b from-white to-emerald-200 bg-clip-text text-transparent">
          {section.title}
        </h1>

        <p className="text-slate-400 text-sm mb-2 max-w-2xl">
          Part of the Geck Inspect <Link to="/CareGuide" className="text-emerald-300 hover:underline">crested gecko care guide</Link>
          {category ? <> — <Link to={`/CareGuide#${category.id}`} className="text-emerald-300 hover:underline">{category.label} section</Link></> : null}.
        </p>
        <p className="text-xs text-slate-500 mb-8">{bylineText(path)}</p>

        <div className="space-y-5 text-slate-300 leading-relaxed">
          {(section.body || []).map((block, i) => (
            <ContentBlock key={i} block={block} />
          ))}
        </div>

        {/* Prev / next — keeps Googlebot traversing the topic chain and
            distributes internal link equity across all 30+ topic pages. */}
        <nav className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-3 border-t border-slate-800/60 pt-6">
          {prev ? (
            <Link
              to={`/CareGuide/${prev.id}`}
              className="group rounded-xl border border-slate-800 hover:border-emerald-500/30 bg-slate-900/60 hover:bg-slate-900 p-4 transition-colors"
            >
              <div className="text-xs text-slate-500 mb-1">← Previous</div>
              <div className="text-sm font-semibold text-slate-200 group-hover:text-emerald-200">
                {prev.title}
              </div>
            </Link>
          ) : <span />}
          {next ? (
            <Link
              to={`/CareGuide/${next.id}`}
              className="group rounded-xl border border-slate-800 hover:border-emerald-500/30 bg-slate-900/60 hover:bg-slate-900 p-4 text-right transition-colors"
            >
              <div className="text-xs text-slate-500 mb-1">Next →</div>
              <div className="text-sm font-semibold text-slate-200 group-hover:text-emerald-200">
                {next.title}
              </div>
            </Link>
          ) : <span />}
        </nav>

        <section className="mt-12 rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/40 via-slate-900/60 to-slate-900/40 p-6 md:p-8">
          <h2 className="text-xl md:text-2xl font-bold text-white mb-2">Track your crested gecko's {section.title.toLowerCase()} on Geck Inspect</h2>
          <p className="text-slate-300 mb-5 leading-relaxed">
            Log weights, enclosure temps, humidity, feeding schedule, and breeding events with one clean timeline per gecko. Free to use.
          </p>
          <Link to={createPageUrl('AuthPortal')}>
            <Button size="lg" className="bg-emerald-700 hover:bg-emerald-800 text-white font-semibold shadow-lg shadow-emerald-500/30">
              Create a free account <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </section>
      </article>
    </PublicPageShell>
  );
}

export { SECTION_INDEX, FLAT_SECTIONS };
