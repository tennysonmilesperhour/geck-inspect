import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Gift, Shirt, Sparkles, Wrench } from 'lucide-react';
import StoreLayout from '@/components/store/StoreLayout';
import ProductCard from '@/components/store/ProductCard';
import FoodRunoutWidget from '@/components/store/FoodRunoutWidget';
import Seo from '@/components/seo/Seo';
import { SITE_URL } from '@/lib/organization-schema';
import { supabase } from '@/lib/supabaseClient';

const HERO_TILES = [
  { slug: 'apparel',      label: 'Apparel',           Icon: Shirt,    blurb: 'Original Geck Inspect tees, hoodies, hats.' },
  { slug: 'gifts',        label: 'Gift ideas',        Icon: Gift,     blurb: 'For keepers, breeders, and the people who love them.' },
  { slug: 'diet',         label: 'Diet (CGD)',        Icon: Sparkles, blurb: 'The brands we feed our own animals.' },
  { slug: 'enclosures',   label: 'Enclosures',        Icon: Wrench,   blurb: 'Tubs, glass, PVC — every life stage.' },
];

const LANDING_JSON_LD = [
  {
    '@type': 'CollectionPage',
    '@id': `${SITE_URL}/Store#collection`,
    name: 'Geck Inspect Supplies',
    url: `${SITE_URL}/Store`,
    description:
      'Crested gecko supplies, original apparel, curated gift ideas, and the tools real breeders use day to day. Sold by Geck Inspect, with select partner items.',
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
  const [featured, setFeatured] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const { data } = await supabase
          .from('store_products')
          .select(`
            id, slug, name, short_description, our_price_cents,
            compare_at_price_cents, images, fulfillment_mode, vendor_id,
            free_shipping_eligible, is_featured, status
          `)
          .eq('status', 'active')
          .eq('is_featured', true)
          .order('updated_date', { ascending: false })
          .limit(8);
        if (!cancelled) setFeatured(data || []);
      } catch (e) {
        console.warn('store landing featured load failed', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  return (
    <StoreLayout>
      <Seo
        title="Crested gecko supplies, gifts, and apparel — Geck Inspect"
        description="Crested gecko supplies hand-picked by breeders. Original Geck Inspect apparel, the diet brands we use ourselves, and gift ideas for the gecko person in your life."
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
          Supplies for crested gecko keepers and breeders.
        </h1>
        <p className="text-slate-300 mt-3 max-w-2xl text-sm md:text-base leading-relaxed">
          Hand-picked by people who actually keep these animals. Original Geck
          Inspect apparel, the diet and gear we use ourselves, and a curated
          set of partner products we trust enough to recommend.
        </p>
        <div className="mt-5 flex gap-2 flex-wrap">
          <Link
            to="/Store/c/gifts"
            className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold px-4 py-2 rounded-md"
          >
            <Gift className="w-4 h-4" /> Browse gifts
          </Link>
          <Link
            to="/Store/c/apparel"
            className="inline-flex items-center gap-1.5 border border-slate-700 hover:bg-slate-800 text-slate-200 text-sm font-semibold px-4 py-2 rounded-md"
          >
            <Shirt className="w-4 h-4" /> Apparel
          </Link>
        </div>
      </section>

      <div className="mb-6">
        <FoodRunoutWidget />
      </div>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
        {HERO_TILES.map(({ slug, label, blurb, Icon }) => (
          <Link
            key={slug}
            to={`/Store/c/${slug}`}
            className="rounded-lg border border-slate-800 bg-slate-900/40 hover:bg-slate-900 hover:border-slate-700 transition-colors p-4"
          >
            <Icon className="w-5 h-5 text-emerald-400 mb-2" />
            <div className="text-sm font-semibold text-slate-100">{label}</div>
            <div className="text-xs text-slate-400 mt-1 leading-relaxed">{blurb}</div>
          </Link>
        ))}
      </section>

      <section className="mb-10">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-slate-100">Featured</h2>
          <Link to="/Store/c/apparel" className="text-xs text-emerald-300 hover:text-emerald-200">
            See all →
          </Link>
        </div>
        {loading ? (
          <div className="h-40 flex items-center justify-center text-slate-500 text-sm">
            Loading…
          </div>
        ) : featured.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-700 bg-slate-900/20 p-8 text-center text-sm text-slate-400">
            We're seeding the catalog right now — check back in a day or two.
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {featured.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-900/30 p-5 md:p-7">
        <h2 className="text-lg font-bold text-slate-100 mb-1">
          Why "Geck Inspect Supplies"?
        </h2>
        <p className="text-sm text-slate-400 leading-relaxed max-w-3xl">
          We're the breeders behind Geck Inspect — pedigree tracking, husbandry
          tools, and a working roster of crested geckos. Everything in this
          store is here because we use it ourselves, our friends use it, or
          we'd give it to someone we know just got their first crestie. If we
          can't sell it directly, we link to the place we'd buy it from.
        </p>
      </section>
    </StoreLayout>
  );
}
