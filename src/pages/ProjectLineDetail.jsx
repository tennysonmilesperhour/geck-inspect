import { Link, useParams, Navigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  ShieldCheck,
  Eye,
  CheckCircle2,
  ExternalLink,
  AlertTriangle,
  Calendar,
  User,
} from 'lucide-react';
import Seo from '@/components/seo/Seo';
import { Button } from '@/components/ui/button';
import { PROJECT_LINES, LINE_CONFIDENCE, getProjectLine } from '@/data/project-lines';
import { getMorph } from '@/data/morph-guide';

const RARITY_LABELS = {
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
  very_rare: 'Very Rare',
};

const RARITY_COLORS = {
  common: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  uncommon: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  rare: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  very_rare: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
};

function Section({ icon: Icon, title, children }) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
      <div className="flex items-center gap-2 mb-4 text-emerald-300">
        <Icon className="w-4 h-4" />
        <h2 className="text-sm font-semibold uppercase tracking-wider">{title}</h2>
      </div>
      <div className="text-slate-200">{children}</div>
    </section>
  );
}

function BulletList({ items, accent = 'emerald' }) {
  const dotClass = accent === 'amber' ? 'text-amber-400' : 'text-emerald-400';
  return (
    <ul className="space-y-2.5">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2.5 text-sm leading-relaxed text-slate-300">
          <CheckCircle2 className={`w-4 h-4 ${dotClass} shrink-0 mt-0.5`} />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export default function ProjectLineDetailPage() {
  const { slug } = useParams();
  const line = getProjectLine(slug);

  if (!line) {
    return <Navigate to="/MorphGuide?tab=lines" replace />;
  }

  const confidence = LINE_CONFIDENCE[line.confidence] || LINE_CONFIDENCE['community-attributed'];
  const rarityLabel = RARITY_LABELS[line.rarity] || line.rarity;
  const rarityColor = RARITY_COLORS[line.rarity] || RARITY_COLORS.uncommon;

  const relatedMorphs = (line.relatedMorphs || [])
    .map((s) => getMorph(s))
    .filter(Boolean);

  const otherLines = PROJECT_LINES.filter((l) => l.slug !== line.slug).slice(0, 4);

  const jsonLd = [
    {
      '@type': 'Article',
      '@id': `https://geckinspect.com/MorphGuide/lines/${slug}#article`,
      headline: `${line.name} crested gecko project line`,
      description: line.summary,
      url: `https://geckinspect.com/MorphGuide/lines/${slug}`,
      isPartOf: { '@id': 'https://geckinspect.com/MorphGuide#collection' },
      mainEntityOfPage: `https://geckinspect.com/MorphGuide/lines/${slug}`,
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://geckinspect.com/' },
        { '@type': 'ListItem', position: 2, name: 'Morph Guide', item: 'https://geckinspect.com/MorphGuide' },
        { '@type': 'ListItem', position: 3, name: 'Project Lines', item: 'https://geckinspect.com/MorphGuide?tab=lines' },
        { '@type': 'ListItem', position: 4, name: line.name, item: `https://geckinspect.com/MorphGuide/lines/${slug}` },
      ],
    },
  ];

  return (
    <>
      <Seo
        title={`${line.name} | Crested Gecko Project Line`}
        description={line.summary}
        path={`/MorphGuide/lines/${slug}`}
        imageAlt={`${line.name} crested gecko line reference`}
        keywords={[
          `${line.name.toLowerCase()} crested gecko`,
          `${line.name.toLowerCase()} line`,
          'crested gecko project line',
          'crested gecko bloodline',
          ...(line.aliases || []).map((a) => a.toLowerCase()),
        ]}
        jsonLd={jsonLd}
      />
      <div className="min-h-screen bg-slate-950 text-slate-100">
        {/* Hero */}
        <section className="relative border-b border-slate-800/50 bg-gradient-to-br from-violet-950/30 via-slate-900 to-slate-950">
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-violet-500/10 rounded-full blur-3xl" />
          </div>
          <div className="relative max-w-5xl mx-auto px-6 py-10 md:py-14">
            <Link
              to="/MorphGuide?tab=lines"
              className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-emerald-300 mb-6"
            >
              <ArrowLeft className="w-4 h-4" />
              All project lines
            </Link>

            <div className="flex flex-wrap items-center gap-2 mb-4">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${confidence.color}`}
                title={confidence.description}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                {confidence.label}
              </span>
              <span
                className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${rarityColor}`}
              >
                {rarityLabel}
              </span>
              {line.priceRange && (
                <span className="inline-flex items-center rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-semibold text-slate-300">
                  {line.priceRange}
                </span>
              )}
            </div>

            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-3 bg-gradient-to-b from-white to-violet-200 bg-clip-text text-transparent">
              {line.name}
            </h1>
            {line.aliases && line.aliases.length > 0 && (
              <p className="text-sm text-slate-500 mb-4">
                Also known as: {line.aliases.join(', ')}
              </p>
            )}
            <p className="text-lg text-slate-300 leading-relaxed max-w-3xl">
              {line.summary}
            </p>

            <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-3 max-w-3xl">
              {line.founder && (
                <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                  <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-slate-500 mb-1">
                    <User className="w-3 h-3" />
                    Founder
                  </div>
                  <div className="text-sm text-slate-200 font-medium">
                    {line.founderUrl ? (
                      <a
                        href={line.founderUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-emerald-300 inline-flex items-center gap-1"
                      >
                        {line.founder}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : (
                      line.founder
                    )}
                  </div>
                </div>
              )}
              {line.origin && (
                <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                  <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-1">
                    Origin
                  </div>
                  <div className="text-sm text-slate-200 font-medium">{line.origin}</div>
                </div>
              )}
              {line.established && (
                <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                  <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-slate-500 mb-1">
                    <Calendar className="w-3 h-3" />
                    Established
                  </div>
                  <div className="text-sm text-slate-200 font-medium">{line.established}</div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Body */}
        <section className="max-w-5xl mx-auto px-4 md:px-6 py-10 space-y-6">
          {/* Reference image placeholder */}
          <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/30 p-8 text-center">
            <div className="text-xs uppercase tracking-wider text-slate-500 mb-2">Reference photos</div>
            <p className="text-sm text-slate-400 max-w-md mx-auto">
              Curated reference photos for this line are being collected. In the meantime, see current examples on MorphMarket below.
            </p>
            {line.morphMarketSearchUrl && (
              <a
                href={line.morphMarketSearchUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-300 hover:bg-emerald-500/20"
              >
                See live examples on MorphMarket
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>

          {/* Description */}
          <Section icon={BookOpen} title="About this line">
            <p className="text-sm leading-relaxed text-slate-300 whitespace-pre-line">
              {line.description}
            </p>
          </Section>

          {/* Visual identity */}
          {line.visualIdentity && line.visualIdentity.length > 0 && (
            <Section icon={Eye} title="What you'll see in the line">
              <BulletList items={line.visualIdentity} />
            </Section>
          )}

          {/* Identification tips */}
          {line.identificationTips && line.identificationTips.length > 0 && (
            <Section icon={CheckCircle2} title="How to identify it">
              <BulletList items={line.identificationTips} />
            </Section>
          )}

          {/* Verification advice (most important section for buyers) */}
          {line.verificationAdvice && line.verificationAdvice.length > 0 && (
            <section className="rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-6">
              <div className="flex items-center gap-2 mb-4 text-emerald-300">
                <ShieldCheck className="w-4 h-4" />
                <h2 className="text-sm font-semibold uppercase tracking-wider">
                  Buyer verification checklist
                </h2>
              </div>
              <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                Project lines don't have genetic tests. Verification is your responsibility.
                Run through these checks before paying a line premium.
              </p>
              <BulletList items={line.verificationAdvice} accent="emerald" />
            </section>
          )}

          {/* Caveats */}
          {line.caveats && line.caveats.length > 0 && (
            <section className="rounded-2xl border border-amber-500/30 bg-amber-950/10 p-6">
              <div className="flex items-center gap-2 mb-4 text-amber-300">
                <AlertTriangle className="w-4 h-4" />
                <h2 className="text-sm font-semibold uppercase tracking-wider">
                  Honest caveats
                </h2>
              </div>
              <BulletList items={line.caveats} accent="amber" />
            </section>
          )}

          {/* Related morphs */}
          {relatedMorphs.length > 0 && (
            <Section icon={BookOpen} title="Related morphs in the guide">
              <div className="flex flex-wrap gap-2">
                {relatedMorphs.map((m) => (
                  <Link
                    key={m.slug}
                    to={`/MorphGuide/${m.slug}`}
                    className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900 hover:border-emerald-500/40 hover:bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-emerald-200"
                  >
                    {m.name}
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                ))}
              </div>
            </Section>
          )}

          {/* Other lines */}
          {otherLines.length > 0 && (
            <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
              <div className="flex items-center gap-2 mb-4 text-slate-300">
                <BookOpen className="w-4 h-4 text-emerald-400" />
                <h2 className="text-sm font-semibold uppercase tracking-wider">
                  Other project lines
                </h2>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                {otherLines.map((l) => (
                  <Link
                    key={l.slug}
                    to={`/MorphGuide/lines/${l.slug}`}
                    className="group rounded-lg border border-slate-800 bg-slate-900/40 hover:border-emerald-500/40 hover:bg-slate-900 p-3 transition-colors"
                  >
                    <div className="text-sm font-semibold text-slate-200 group-hover:text-emerald-300">
                      {l.name}
                    </div>
                    <div className="text-xs text-slate-500 line-clamp-2 mt-1">{l.summary}</div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* CTA back to main guide */}
          <div className="pt-4 flex flex-wrap gap-3 justify-center">
            <Link to="/MorphGuide?tab=lines">
              <Button
                variant="outline"
                className="bg-white text-slate-900 hover:bg-slate-100 border-white/40 font-semibold"
              >
                All project lines
              </Button>
            </Link>
            <Link to="/MorphGuide">
              <Button
                variant="outline"
                className="bg-slate-900 text-slate-200 hover:bg-slate-800 border-slate-700 font-semibold"
              >
                Browse morphs
              </Button>
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}
