import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Gift, Shirt, Sparkles, Wrench, Sticker } from 'lucide-react';
import StoreLayout from '@/components/store/StoreLayout';
import ProductCard from '@/components/store/ProductCard';
import FoodRunoutWidget from '@/components/store/FoodRunoutWidget';
import { FtcDisclosureBlock } from '@/components/store/FtcDisclosure';
import Seo from '@/components/seo/Seo';
import { SITE_URL } from '@/lib/organization-schema';
import { supabase } from '@/lib/supabaseClient';
import { fetchStoreCatalog } from '@/lib/store/catalog';

const HERO_TILES = [
  { to: '/Store/stickers',        label: 'Custom stickers',   Icon: Sticker,  blurb: 'Your gecko on a sticker, six themes. $10 each.' },
  { to: '/Store/tees',            label: 'Custom tee',        Icon: Shirt,    blurb: 'Your gecko on a shirt. Pick colour, size and print.' },
  { to: '/Store/c/apparel',       label: 'Apparel',           Icon: Shirt,    blurb: 'Original Geck Inspect tees, hoodies, hats.' },
  { to: '/Store/c/gifts',         label: 'Gift ideas',        Icon: Gift,     blurb: 'For keepers, breeders, and the people who love them.' },
  { to: '/Store/c/diet',          label: 'Diet',              Icon: Sparkles, blurb: 'CGD staples and species-specific food.' },
  { to: '/Store/c/enclosures',    label: 'Enclosures',        Icon: Wrench,   blurb: 'Tubs, glass, PVC, every life stage.' },
];

const LANDING_JSON_LD = [
  {
    '@type': 'CollectionPage',
    '@id': `${SITE_URL}/Store#collection`,
    name: 'Geck Inspect Supplies',
    url: `${SITE_URL}/Store`,
    description:
      'Reptile supplies, habitat equipment, original apparel and gift ideas. Sold by Geck Inspect, with select partner items.',
    isPartOf: { '@id': `${SITE_URL}/#website` },
  },
  {
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
      { '@type': 'ListItem', position: 2, name: 'Supplies', item: `${SITE_URL}/Store` },
    ],
  },
];

export default function StoreLanding() {
  const [products, setProducts] = useState([]);
  const [query, setQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(24);
  const [loadError, setLoadError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        setLoadError(false);
        const [catalog, categoriesResult] = await Promise.all([
          fetchStoreCatalog(supabase),
          supabase.from('store_categories').select('id, slug, name')
            .eq('is_active', true).is('parent_id', null)
            .order('display_order', { ascending: true }),
        ]);
        if (!cancelled) {
          setProducts(catalog);
          setCategories(categoriesResult.data || []);
        }
      } catch (e) {
        console.warn('store catalog load failed', e);
        if (!cancelled) setLoadError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [retry]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return products.filter((p) => !term || `${p.name} ${p.short_description || ''}`.toLowerCase().includes(term));
  }, [products, query]);

  return (
    <StoreLayout>
      <Seo
        title="Reptile supplies, gifts, and apparel, Geck Inspect"
        description="Shop reptile enclosures, lighting, heating, misting, substrate and feeding supplies, plus original Geck Inspect apparel and gifts."
        path="/Store"
        keywords={[
          'crested gecko supplies',
          'crested gecko gifts',
          'crested gecko store',
          'crested gecko diet',
          'reptile shirts',
        ]}
        jsonLd={LANDING_JSON_LD}
      />

      <section className="relative rounded-2xl border border-emerald-700/30 bg-gradient-to-br from-emerald-950/60 via-slate-950 to-slate-950 p-6 md:p-10 mb-8 overflow-hidden">
        <h1 className="text-2xl md:text-4xl font-bold text-emerald-100 max-w-2xl">
          Supplies for reptile keepers and breeders.
        </h1>
        <p className="text-slate-300 mt-3 max-w-2xl text-sm md:text-base leading-relaxed">
          Browse enclosures, lighting, feeding supplies and habitat equipment,
          alongside original Geck Inspect apparel. Check each product against
          your animal’s species, size and care requirements.
        </p>
        <div className="mt-5 flex gap-2 flex-wrap">
          <Link
            to="/Store/c/gifts"
            className="touch:min-h-11 inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold px-4 py-2 rounded-md"
          >
            <Gift className="w-4 h-4" /> Browse gifts
          </Link>
          <Link
            to="/Store/stickers"
            className="touch:min-h-11 inline-flex items-center gap-1.5 border border-slate-700 hover:bg-slate-800 text-slate-200 text-sm font-semibold px-4 py-2 rounded-md"
          >
            <Sticker className="w-4 h-4" /> Custom pet stickers
          </Link>
          <Link
            to="/Store/c/apparel"
            className="touch:min-h-11 inline-flex items-center gap-1.5 border border-slate-700 hover:bg-slate-800 text-slate-200 text-sm font-semibold px-4 py-2 rounded-md"
          >
            <Shirt className="w-4 h-4" /> Apparel
          </Link>
        </div>
      </section>

      <div className="mb-6">
        <FtcDisclosureBlock />
      </div>

      <div className="mb-6">
        <FoodRunoutWidget />
      </div>

      {categories.length > 0 && (
        <section className="mb-8" aria-labelledby="store-categories-heading">
          <h2 id="store-categories-heading" className="text-lg font-bold text-slate-100 mb-3">
            Shop by category
          </h2>
          <nav aria-label="Supply categories" className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <Link key={category.id} to={`/Store/c/${category.slug}`}
                className="touch:min-h-11 inline-flex items-center rounded-md border border-slate-700 px-3 py-2 text-sm text-emerald-200 hover:bg-slate-800">
                {category.name}
              </Link>
            ))}
          </nav>
        </section>
      )}

      <section className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-10">
        {HERO_TILES.map(({ to, label, blurb, Icon }) => (
          <Link
            key={to}
            to={to}
            className="rounded-lg border border-slate-800 bg-slate-900/40 hover:bg-slate-900 hover:border-slate-700 transition-colors p-4"
          >
            <Icon className="w-5 h-5 text-emerald-400 mb-2" />
            <div className="text-sm font-semibold text-slate-100">{label}</div>
            <div className="text-xs text-slate-400 mt-1 leading-relaxed">{blurb}</div>
          </Link>
        ))}
      </section>

      <section className="mb-10">
        <Link
          to="/Store/stickers"
          className="touch:min-h-11 group flex flex-col sm:flex-row items-start sm:items-center gap-4 rounded-xl border border-emerald-700/30 bg-gradient-to-r from-emerald-950/50 to-slate-950 p-5 hover:border-emerald-600/60 transition-colors"
        >
          <Sticker className="w-8 h-8 text-emerald-400 shrink-0" />
          <div className="flex-1">
            <h2 className="text-base font-bold text-emerald-100">
              Custom pet stickers
            </h2>
            <p className="text-sm text-slate-400 mt-1 leading-relaxed">
              Upload a photo of your gecko and pick a look: trading card,
              field-guide plate, passport, park badge, instant photo or show
              rosette. Die-cut and weatherproof, $10 each plus $5 flat shipping.
            </p>
          </div>
          <span className="text-sm font-semibold text-emerald-300 group-hover:text-emerald-200 shrink-0">
            Build one
          </span>
        </Link>
        <Link
          to="/Store/tees"
          className="touch:min-h-11 group mt-3 flex flex-col sm:flex-row items-start sm:items-center gap-4 rounded-xl border border-slate-700/60 bg-slate-900/40 hover:bg-slate-900 p-5 transition-colors"
        >
          <Shirt className="w-8 h-8 text-emerald-400 shrink-0" />
          <div className="flex-1">
            <h2 className="text-base font-bold text-slate-100">Custom gecko tee</h2>
            <p className="text-sm text-slate-400 mt-1 leading-relaxed">
              The same photo, on a heavyweight cotton shirt. Six colours, sizes
              S to 3XL, and four print styles with the name and morph line
              printed exactly as you type them.
            </p>
          </div>
          <span className="text-sm font-semibold text-emerald-300 group-hover:text-emerald-200 shrink-0">
            Build one
          </span>
        </Link>
      </section>

      <section className="mb-10">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-slate-100">All products</h2>
          <Link to="/Store/c/diet" className="inline-flex items-center touch:min-h-11 text-xs text-emerald-300 hover:text-emerald-200">
            Start with food →
          </Link>
        </div>
        <label className="block text-sm text-slate-300 mb-4">
          Search all products
          <input type="search" value={query} onChange={(event) => { setQuery(event.target.value); setVisibleCount(24); }}
            placeholder="Search supplies, brands or equipment"
            className="block mt-2 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 min-h-11 text-slate-100" />
        </label>
        {!loading && !loadError && <p role="status" className="text-sm text-slate-400 mb-3">Showing {Math.min(visibleCount, filtered.length)} of {filtered.length} products</p>}
        {loadError ? (
          <div role="alert" className="text-sm text-slate-300 py-6">
            Products couldn’t load. <button type="button" onClick={() => setRetry((n) => n + 1)} className="underline min-h-11">Try again</button>
          </div>
        ) : loading ? (
          <div className="h-40 flex items-center justify-center text-slate-500 text-sm">
            Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-700 bg-slate-900/20 p-8 text-center text-sm text-slate-400">
            {query ? 'No products match your search. Try a different name or brand.' : 'No products are available right now.'}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {filtered.slice(0, visibleCount).map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
        {!loading && !loadError && visibleCount < filtered.length && (
          <button type="button" onClick={() => setVisibleCount((n) => n + 24)}
            className="mt-5 min-h-11 rounded-md bg-emerald-600 hover:bg-emerald-500 px-5 py-2 font-semibold text-white">
            Load more products
          </button>
        )}
      </section>

      <section className="rounded-xl border border-slate-700 bg-slate-900 p-5 md:p-7">
        <h2 className="text-lg font-bold text-slate-100 mb-1">
          Why "Geck Inspect Supplies"?
        </h2>
        <p className="text-sm text-slate-400 leading-relaxed max-w-3xl">
          We're the breeders behind Geck Inspect: pedigree tracking, husbandry
          tools, and a working roster of crested geckos. The store brings
          reptile supplies and habitat equipment together by category. Partner
          listings link to the seller for current specifications, pricing and
          availability; inclusion is not a claim that an item suits every reptile.
        </p>
      </section>
    </StoreLayout>
  );
}
