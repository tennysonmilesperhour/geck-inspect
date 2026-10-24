import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight, Check, Scale } from 'lucide-react';
import Seo from '@/components/seo/Seo';
import PublicPageShell from '@/components/public/PublicPageShell';
import ContentSignupPrompt from '@/components/public/ContentSignupPrompt';
import PriceIndexProof from '@/components/public/PriceIndexProof';
import PageNotFound from '@/lib/PageNotFound';
import { breadcrumbSchema, SITE_URL } from '@/lib/organization-schema';
import { captureEvent } from '@/lib/posthog';
import { rememberSignupCta } from '@/lib/attribution';
import { COMPARISON_FILL, fillComparison } from '@/lib/comparisonCopy';
import { COMPARISONS, COMPARISONS_CHECKED, comparisonBySlug } from '@/data/comparisons';

const fill = fillComparison;
const FILL = COMPARISON_FILL;

function useCompareViewed(slug) {
  useEffect(() => {
    captureEvent('compare_viewed', { slug });
  }, [slug]);
}

function StartFreeButton({ slug, label = 'Start free' }) {
  const cta = `compare-${slug}`;
  return (
    <Link
      to="/AuthPortal?mode=signup"
      onClick={() => {
        captureEvent('content_cta_clicked', { cta, page_type: 'compare', page: `/compare${slug === 'hub' ? '' : `/${slug}`}`, variant: 'hero', target: 'signup' });
        rememberSignupCta({ cta, page: `/compare${slug === 'hub' ? '' : `/${slug}`}`, pageType: 'compare' });
      }}
      className="touch:min-h-11 inline-flex items-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold rounded-lg px-4 py-2.5 transition-colors"
    >
      {label}
      <ArrowRight className="w-4 h-4" />
    </Link>
  );
}

function Hub() {
  useCompareViewed('hub');
  return (
    <PublicPageShell>
      <Seo
        title="Compare Crested Gecko Apps and Record Keeping Tools"
        description="How Geck Inspect compares with spreadsheets, MorphMarket Animal Manager, Breed Ledger, ReptiDex, Husbandry.Pro and asking ChatGPT, for crested gecko keepers and breeders. Where each one is the better pick."
        path="/compare"
        type="website"
        jsonLd={[breadcrumbSchema([{ name: 'Home', path: '/' }, { name: 'Compare', path: '/compare' }])]}
      />
      <section className="max-w-4xl mx-auto px-6 pt-4 pb-16">
        <div className="flex items-center gap-2 text-xs text-slate-500 mb-4">
          <Link to="/" className="hover:text-slate-300">Home</Link>
          <span>/</span>
          <span className="text-slate-400">Compare</span>
        </div>
        <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 md:p-8 space-y-4 mb-8">
          <div className="flex items-start gap-3">
            <Scale className="w-7 h-7 mt-0.5 text-emerald-400 flex-shrink-0" />
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-100">Compare Geck Inspect</h1>
          </div>
          <p className="text-slate-300 text-sm leading-relaxed">
            Geck Inspect is built for crested geckos only. Here is how it stacks up against the tools keepers and breeders weigh it against, including where the other tool is the better pick. Checked {COMPARISONS_CHECKED}.
          </p>
          <PriceIndexProof className="text-slate-400 text-sm" />
          <StartFreeButton slug="hub" />
        </div>
        <ul className="grid gap-3 sm:grid-cols-2">
          {COMPARISONS.map((c) => (
            <li key={c.slug}>
              <Link
                to={`/compare/${c.slug}`}
                className="block h-full rounded-xl border border-slate-700 bg-slate-900 p-4 hover:border-emerald-500/60 transition-colors"
              >
                <span className="block text-slate-100 font-semibold">Geck Inspect vs {c.name}</span>
                <span className="block text-slate-400 text-sm mt-1">{c.pickUs}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </PublicPageShell>
  );
}

function Detail({ c }) {
  useCompareViewed(c.slug);
  const path = `/compare/${c.slug}`;
  return (
    <PublicPageShell>
      <Seo
        title={c.metaTitle}
        description={c.metaDescription}
        path={path}
        type="article"
        jsonLd={[
          {
            '@type': 'WebPage',
            name: c.metaTitle,
            url: `${SITE_URL}${path}`,
            description: c.metaDescription,
            inLanguage: 'en-US',
            isPartOf: { '@id': `${SITE_URL}/#website` },
          },
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'Compare', path: '/compare' },
            { name: c.heading, path },
          ]),
        ]}
      />
      <section className="max-w-4xl mx-auto px-6 pt-4 pb-16">
        <div className="flex items-center gap-2 text-xs text-slate-500 mb-4">
          <Link to="/" className="hover:text-slate-300">Home</Link>
          <span>/</span>
          <Link to="/compare" className="hover:text-slate-300">Compare</Link>
          <span>/</span>
          <span className="text-slate-400">{c.short}</span>
        </div>

        <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 md:p-8 space-y-4 mb-8">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-100">{c.heading}</h1>
          <p className="text-slate-300 text-sm leading-relaxed">{fill(c.lead)}</p>
          <StartFreeButton slug={c.slug} label="Try Geck Inspect free" />
        </div>

        <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 md:p-6 mb-8">
          <h2 className="text-lg font-semibold text-slate-100 mb-4">Side by side</h2>
          {/* Phones: one card per row, so both answers are on screen together. */}
          <dl className="md:hidden divide-y divide-slate-800 text-sm">
            {c.rows.map(([label, us, them]) => (
              <div key={label} className="py-3 space-y-1">
                <dt className="font-medium text-slate-100">{label}</dt>
                <dd className="text-slate-200"><span className="text-emerald-300 font-semibold">Geck Inspect: </span>{fill(us)}</dd>
                <dd className="text-slate-400"><span className="text-slate-300 font-semibold">{c.short}: </span>{fill(them)}</dd>
              </div>
            ))}
          </dl>
          <div className="hidden md:block">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="text-slate-400 border-b border-slate-700">
                  <th scope="col" className="py-2 px-2 font-medium w-1/4"><span className="sr-only">Feature</span></th>
                  <th scope="col" className="py-2 px-2 font-semibold text-emerald-300">Geck Inspect</th>
                  <th scope="col" className="py-2 px-2 font-semibold text-slate-200">{c.short}</th>
                </tr>
              </thead>
              <tbody>
                {c.rows.map(([label, us, them]) => (
                  <tr key={label} className="border-b border-slate-800 align-top">
                    <th scope="row" className="py-2.5 px-2 font-medium text-slate-300">{label}</th>
                    <td className="py-2.5 px-2 text-slate-200">{fill(us)}</td>
                    <td className="py-2.5 px-2 text-slate-400">{fill(them)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-500 mt-3">
            {c.short} details checked {COMPARISONS_CHECKED} from their own pages{c.sources.length ? ' (sources below)' : ''}. Prices change; check their site before you decide.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 mb-8">
          {[
            [`Where ${c.short} is the better pick`, c.theyWin, 'text-slate-400'],
            ['Where Geck Inspect is the better pick', c.weWin, 'text-emerald-400'],
          ].map(([title, items, tone]) => (
            <div key={title} className="bg-slate-900 border border-slate-700 rounded-xl p-4 md:p-5">
              <h2 className="text-base font-semibold text-slate-100 mb-3">{title}</h2>
              <ul className="space-y-2">
                {items.map((item) => (
                  <li key={item} className="flex gap-2 text-sm text-slate-300">
                    <Check className={`w-4 h-4 mt-0.5 flex-shrink-0 ${tone}`} aria-hidden="true" />
                    {fill(item)}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 md:p-6 mb-8 space-y-2 text-sm">
          <h2 className="text-lg font-semibold text-slate-100">Which one should you pick?</h2>
          <p className="text-slate-300"><span className="font-semibold text-slate-100">Pick {c.name}</span> if {lowerFirst(fill(c.pickThem))}</p>
          <p className="text-slate-300"><span className="font-semibold text-slate-100">Pick Geck Inspect</span> if {lowerFirst(fill(c.pickUs))}</p>
          <PriceIndexProof className="text-slate-400 pt-2" />
        </div>

        <ContentSignupPrompt
          pageType="compare"
          ctaId={`compare-${c.slug}`}
          variant="panel"
          headline="Try it with your own geckos"
          body={`Add up to ${FILL.freeGeckos} geckos free, run one Morph ID a month, and see your clutch odds. Export everything whenever you like.`}
          secondary={{ label: 'See all comparisons', to: '/compare' }}
          className="mb-8"
        />

        {c.sources.length > 0 && (
          <div className="text-xs text-slate-500">
            <h2 className="font-semibold text-slate-400 mb-1">Sources</h2>
            <ul className="space-y-1">
              {c.sources.map((s) => (
                <li key={s.url}>
                  <a href={s.url} rel="nofollow noopener noreferrer" target="_blank" className="underline underline-offset-2 hover:text-slate-300 break-all">{s.label}</a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </PublicPageShell>
  );
}

const lowerFirst = (text) => text.charAt(0).toLowerCase() + text.slice(1);

export default function Compare() {
  const { slug } = useParams();
  if (!slug) return <Hub />;
  const c = comparisonBySlug(slug);
  return c ? <Detail c={c} /> : <PageNotFound />;
}
