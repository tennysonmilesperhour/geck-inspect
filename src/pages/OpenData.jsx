import { Link } from 'react-router-dom';
import { Database, Download, Bot, Quote } from 'lucide-react';
import Seo from '@/components/seo/Seo';
import PublicPageShell from '@/components/public/PublicPageShell';
import PriceIndexTable from '@/components/public/PriceIndexTable';
import { breadcrumbSchema } from '@/lib/organization-schema';
import { OPEN_DATASETS, MCP_URL, openDataJsonLd } from '@/data/open-datasets';

const LAST_UPDATED = '2026-10-07';

const JSON_LD = [
  ...openDataJsonLd(LAST_UPDATED).map((node) => ({ '@context': 'https://schema.org', ...node })),
  breadcrumbSchema([
    { name: 'Home', path: '/' },
    { name: 'Open data', path: '/data' },
  ]),
];

const card = 'bg-slate-900 border border-slate-700 rounded-xl p-4 md:p-6 mb-6';
const link = 'text-emerald-400 hover:text-emerald-300';

export default function OpenData() {
  return (
    <PublicPageShell>
      <Seo
        title="Crested Gecko Open Data: Price Index, Morphs and Genetics"
        description="Free crested gecko datasets from Geck Inspect: the Geck Inspect Price Index of asking prices by trait and market, every morph, the genetics engine data and the care guide, as JSON, CSV and markdown, plus an MCP server for AI agents."
        path="/data"
        modifiedTime={LAST_UPDATED}
        keywords={['crested gecko data', 'crested gecko price index', 'crested gecko dataset', 'crested gecko API']}
        jsonLd={JSON_LD}
      />

      <section className="max-w-4xl mx-auto px-4 md:px-6 pt-4 pb-16">
        <div className="flex items-center gap-2 text-xs text-slate-500 mb-4">
          <Link to="/" className="hover:text-slate-300">Home</Link>
          <span>/</span>
          <span className="text-slate-400">Open data</span>
        </div>

        <div className={card}>
          <div className="flex items-start gap-3 mb-3">
            <Database className="w-7 h-7 mt-0.5 text-emerald-400 flex-shrink-0" />
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-100">Crested gecko open data</h1>
          </div>
          <p className="text-slate-300 text-sm leading-relaxed">
            Geck Inspect publishes what it knows about crested geckos as free data: current asking prices by trait and
            market, every morph in the Morph Guide, the genetics behind the calculator, and the care guide. Researchers,
            breeders, developers and AI assistants can use it. Please credit Geck Inspect and link to the page you used.
          </p>
        </div>

        <div className={card} id="price-index">
          <h2 className="text-lg font-semibold text-slate-100 mb-1">Geck Inspect Price Index</h2>
          <p className="text-slate-400 text-sm mb-4">
            What sellers are asking for crested geckos right now, by trait, from public listings in the United States,
            South Korea, Japan and Europe. Updated with every catalog check.
          </p>
          <PriceIndexTable />
        </div>

        <div className={card}>
          <div className="flex items-center gap-2 mb-3">
            <Download className="w-5 h-5 text-sky-400" />
            <h2 className="text-lg font-semibold text-slate-100">Datasets</h2>
          </div>
          <div className="space-y-4">
            {OPEN_DATASETS.map((d) => (
              <div key={d.id} id={d.id} className="border border-slate-800 rounded-lg p-4">
                <h3 className="text-slate-100 font-semibold text-sm mb-1">{d.name}</h3>
                <p className="text-slate-400 text-sm leading-relaxed mb-2">{d.description}</p>
                <p className="text-sm flex flex-wrap gap-x-4 gap-y-1">
                  {d.files.map((f) => (
                    <a key={f.url} href={f.url} className={link}>{f.label}</a>
                  ))}
                  <span className="text-slate-500 text-xs self-center">
                    {d.license ? 'CC BY 4.0' : d.licenseNote}
                  </span>
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className={card}>
          <div className="flex items-center gap-2 mb-3">
            <Bot className="w-5 h-5 text-violet-400" />
            <h2 className="text-lg font-semibold text-slate-100">For AI assistants and developers</h2>
          </div>
          <ul className="text-slate-400 text-sm leading-relaxed space-y-2 list-disc pl-5">
            <li>
              <strong className="text-slate-200">MCP server:</strong> <code className="text-slate-200">{MCP_URL}</code>{' '}
              (Model Context Protocol, the standard AI assistants use to call outside tools). No key needed. Tools: search
              and read morphs, read care topics, look up prices, and predict the odds of a pairing.
            </li>
            <li>
              <strong className="text-slate-200">Markdown:</strong> add <code className="text-slate-200">.md</code> to any
              morph or care page address, for example{' '}
              <a href="/MorphGuide/lilly-white.md" className={link}>/MorphGuide/lilly-white.md</a>. The index of topic files
              is <a href="/llms.txt" className={link}>/llms.txt</a>.
            </li>
            <li>
              <strong className="text-slate-200">Catalog:</strong>{' '}
              <a href="/data/index.json" className={link}>/data/index.json</a> lists every dataset and file.
            </li>
          </ul>
        </div>

        <div className={card}>
          <div className="flex items-center gap-2 mb-3">
            <Quote className="w-5 h-5 text-amber-400" />
            <h2 className="text-lg font-semibold text-slate-100">How to cite and what the numbers mean</h2>
          </div>
          <ul className="text-slate-400 text-sm leading-relaxed space-y-2 list-disc pl-5">
            <li>Cite prices as &ldquo;Geck Inspect Price Index&rdquo; with a link to this page, and morphs or care topics with the page you used.</li>
            <li>Prices are asking prices on open listings, not what geckos sold for. Prices outside the US are converted to USD; shipping and import costs are not included.</li>
            <li>Only full catalog checks count, and a trait needs at least 5 listings to be shown. Trait names are the sellers&apos; labels, which do not prove genotype.</li>
            <li>The price, morph and genetics data are licensed CC BY 4.0. The care guide text is free to quote with a link, but please do not republish it in full.</li>
            <li>Found a mistake? <Link to="/Contact" className={link}>Tell us</Link>; corrections are welcome.</li>
          </ul>
        </div>
      </section>
    </PublicPageShell>
  );
}
