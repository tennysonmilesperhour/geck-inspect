import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import StoreLayout from '@/components/store/StoreLayout';
import ProductCard from '@/components/store/ProductCard';
import { FtcDisclosureBlock } from '@/components/store/FtcDisclosure';
import Seo from '@/components/seo/Seo';
import { SITE_URL } from '@/lib/organization-schema';
import { supabase } from '@/lib/supabaseClient';

/**
 * Category page ,  fetches the category by slug (supports nested slugs
 * like `gifts/under-25`), pulls active products in that category, and
 * renders a grid with optional SEO intro/outro markdown above and below.
 *
 * For gift categories we add ItemList + FAQPage schema so search engines
 * can pull rich results.
 */
export default function StoreCategory() {
  const params = useParams();
  // useParams's catch-all under `c/*` lives on key '*'. Decode + strip leading slashes.
  const rawSlug = (params['*'] || params.slug || '').replace(/^\/+|\/+$/g, '');
  const slug = decodeURIComponent(rawSlug);

  const [category, setCategory] = useState(null);
  const [subcategories, setSubcategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setNotFound(false);
      try {
        const { data: cat, error } = await supabase
          .from('store_categories')
          .select('*')
          .eq('slug', slug)
          .eq('is_active', true)
          .maybeSingle();
        if (error) throw error;
        if (!cat) {
          if (!cancelled) {
            setNotFound(true);
            setLoading(false);
          }
          return;
        }
        if (cancelled) return;
        setCategory(cat);

        const [{ data: subs }, { data: prods }] = await Promise.all([
          supabase
            .from('store_categories')
            .select('id, slug, name, description')
            .eq('parent_id', cat.id)
            .eq('is_active', true)
            .order('display_order', { ascending: true }),
          supabase
            .from('store_products')
            .select(`
              id, slug, name, short_description, our_price_cents,
              compare_at_price_cents, images, fulfillment_mode, vendor_id,
              free_shipping_eligible, is_featured, status, gift_friendly, price_tier
            `)
            .eq('status', 'active')
            .eq('category_id', cat.id)
            .order('is_featured', { ascending: false })
            .order('updated_date', { ascending: false })
            .limit(60),
        ]);
        if (cancelled) return;
        setSubcategories(subs || []);
        setProducts(prods || []);
      } catch (e) {
        console.warn('store category load failed', e);
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    if (slug) load();
    return () => { cancelled = true; };
  }, [slug]);

  const breadcrumbs = useMemo(() => {
    if (!category) return [{ label: 'Supplies', to: '/Store' }];
    const out = [{ label: 'Supplies', to: '/Store' }];
    if (slug.includes('/')) {
      const top = slug.split('/')[0];
      out.push({ label: top, to: `/Store/c/${top}` });
    }
    out.push({ label: category.name });
    return out;
  }, [category, slug]);

  const hasAffiliate = useMemo(
    () => products.some((p) => p.fulfillment_mode === 'affiliate_redirect'),
    [products]
  );

  const jsonLd = useMemo(() => {
    if (!category) return null;
    const list = products.slice(0, 30).map((p, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `${SITE_URL}/Store/p/${p.slug}`,
      name: p.name,
    }));
    return [
      {
        '@type': 'CollectionPage',
        '@id': `${SITE_URL}/Store/c/${slug}#collection`,
        name: category.name,
        description: category.seo_description || category.description || category.name,
        url: `${SITE_URL}/Store/c/${slug}`,
        isPartOf: { '@id': `${SITE_URL}/#website` },
        mainEntity: { '@type': 'ItemList', itemListElement: list },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: breadcrumbs.map((b, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: b.label,
          item: b.to ? `${SITE_URL}${b.to}` : undefined,
        })),
      },
    ];
  }, [category, products, slug, breadcrumbs]);

  if (notFound) {
    return (
      <StoreLayout breadcrumbs={[{ label: 'Supplies', to: '/Store' }, { label: 'Not found' }]}>
        <Seo title="Category not found ,  Geck Inspect" path={`/Store/c/${slug}`} description="" />
        <div className="text-center py-20">
          <h1 className="text-2xl font-bold text-slate-100">Category not found</h1>
          <p className="text-sm text-slate-400 mt-2">
            <Link to="/Store" className="text-emerald-300 hover:text-emerald-200">
              Back to Supplies
            </Link>
          </p>
        </div>
      </StoreLayout>
    );
  }

  return (
    <StoreLayout breadcrumbs={breadcrumbs}>
      <Seo
        title={category?.seo_title || (category ? `${category.name} ,  Geck Inspect Supplies` : 'Supplies ,  Geck Inspect')}
        description={category?.seo_description || category?.description || ''}
        path={`/Store/c/${slug}`}
        jsonLd={jsonLd || undefined}
      />

      <header className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-slate-100">
          {category?.name || 'Loading…'}
        </h1>
        {category?.description && (
          <p className="text-sm text-slate-400 mt-2 max-w-3xl leading-relaxed">
            {category.description}
          </p>
        )}
      </header>

      {hasAffiliate && (
        <div className="mb-4">
          <FtcDisclosureBlock />
        </div>
      )}

      {subcategories.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-6">
          {subcategories.map((sub) => (
            <Link
              key={sub.id}
              to={`/Store/c/${sub.slug}`}
              className="rounded-md border border-slate-800 bg-slate-900/40 hover:bg-slate-900 hover:border-slate-700 transition-colors px-3 py-2 text-sm text-slate-200"
            >
              {sub.name}
            </Link>
          ))}
        </div>
      )}

      {category?.seo_intro_md && (
        <div className="prose prose-invert prose-sm max-w-none mb-6 text-slate-300">
          {/* Phase 1: render plaintext until we wire react-markdown here. */}
          <p className="whitespace-pre-wrap">{category.seo_intro_md}</p>
        </div>
      )}

      {loading ? (
        <div className="h-40 flex items-center justify-center text-slate-500 text-sm">Loading…</div>
      ) : products.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-700 bg-slate-900/20 p-8 text-center text-sm text-slate-400">
          Nothing in this category yet ,  check back soon.
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}

      {category?.seo_outro_md && (
        <div className="prose prose-invert prose-sm max-w-none mt-10 text-slate-300">
          <p className="whitespace-pre-wrap">{category.seo_outro_md}</p>
        </div>
      )}
    </StoreLayout>
  );
}
