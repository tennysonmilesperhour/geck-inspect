import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import StoreLayout from '@/components/store/StoreLayout';
import AddToCartButton from '@/components/store/AddToCartButton';
import { FtcDisclosureBlock } from '@/components/store/FtcDisclosure';
import Seo from '@/components/seo/Seo';
import { SITE_URL } from '@/lib/organization-schema';
import { supabase } from '@/lib/supabaseClient';
import { formatCents, fulfillmentBadge } from '@/lib/store/format';
import { captureEvent } from '@/lib/posthog';

export default function StoreProduct() {
  const { slug } = useParams();
  const [product, setProduct] = useState(null);
  const [vendor, setVendor] = useState(null);
  const [category, setCategory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeImage, setActiveImage] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const { data: p } = await supabase
          .from('store_products')
          .select('*')
          .eq('slug', slug)
          .eq('status', 'active')
          .maybeSingle();
        if (cancelled) return;
        setProduct(p || null);
        if (p) {
          captureEvent('store_pdp_viewed', {
            product_id: p.id,
            product_name: p.name,
            fulfillment_mode: p.fulfillment_mode,
          });
          const [{ data: v }, { data: c }] = await Promise.all([
            p.vendor_id
              ? supabase.from('store_vendors').select('id, slug, name, homepage_url').eq('id', p.vendor_id).maybeSingle()
              : Promise.resolve({ data: null }),
            p.category_id
              ? supabase.from('store_categories').select('id, slug, name').eq('id', p.category_id).maybeSingle()
              : Promise.resolve({ data: null }),
          ]);
          if (cancelled) return;
          setVendor(v || null);
          setCategory(c || null);
        }
      } catch (e) {
        console.warn('store product load failed', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    if (slug) load();
    return () => { cancelled = true; };
  }, [slug]);

  const images = Array.isArray(product?.images) && product.images.length ? product.images : [];
  const main = images[activeImage] || images[0] || null;
  const badge = product ? fulfillmentBadge(product.fulfillment_mode, vendor?.name) : null;
  const isAffiliate = product?.fulfillment_mode === 'affiliate_redirect';

  const breadcrumbs = useMemo(() => {
    const out = [{ label: 'Supplies', to: '/Store' }];
    if (category) out.push({ label: category.name, to: `/Store/c/${category.slug}` });
    if (product) out.push({ label: product.name });
    return out;
  }, [category, product]);

  const jsonLd = useMemo(() => {
    if (!product) return null;
    const offer = {
      '@type': 'Offer',
      price: ((product.our_price_cents || 0) / 100).toFixed(2),
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
      url: `${SITE_URL}/Store/p/${product.slug}`,
    };
    return [
      {
        '@type': 'Product',
        name: product.name,
        description: product.short_description || product.long_description_md?.slice(0, 200) || product.name,
        image: images.map((i) => i.url).filter(Boolean),
        sku: product.vendor_sku || product.id,
        brand: vendor ? { '@type': 'Brand', name: vendor.name } : undefined,
        offers: offer,
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
  }, [product, vendor, images, breadcrumbs]);

  if (loading) {
    return (
      <StoreLayout breadcrumbs={[{ label: 'Supplies', to: '/Store' }]}>
        <div className="h-60 flex items-center justify-center text-slate-500 text-sm">
          Loading…
        </div>
      </StoreLayout>
    );
  }

  if (!product) {
    return (
      <StoreLayout breadcrumbs={[{ label: 'Supplies', to: '/Store' }, { label: 'Not found' }]}>
        <Seo title="Product not found ,  Geck Inspect" path={`/Store/p/${slug}`} description="" />
        <div className="text-center py-20">
          <h1 className="text-2xl font-bold text-slate-100">Product not found</h1>
          <p className="text-sm text-slate-400 mt-2">
            <Link to="/Store" className="text-emerald-300 hover:text-emerald-200">Back to Supplies</Link>
          </p>
        </div>
      </StoreLayout>
    );
  }

  return (
    <StoreLayout breadcrumbs={breadcrumbs}>
      <Seo
        title={`${product.name} ,  Geck Inspect Supplies`}
        description={product.short_description || ''}
        path={`/Store/p/${product.slug}`}
        jsonLd={jsonLd || undefined}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <div className="aspect-square rounded-lg overflow-hidden bg-slate-950 border border-slate-800">
            {main ? (
              <img
                src={main.url}
                alt={main.alt || product.name}
                loading="eager"
                decoding="async"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-700">
                No image
              </div>
            )}
          </div>
          {images.length > 1 && (
            <div className="mt-3 grid grid-cols-5 gap-2">
              {images.slice(0, 5).map((img, i) => (
                <button
                  key={i}
                  onClick={() => setActiveImage(i)}
                  className={`aspect-square overflow-hidden rounded border ${
                    i === activeImage ? 'border-emerald-500' : 'border-slate-800'
                  }`}
                >
                  <img
                    src={img.url}
                    alt={img.alt || `${product.name} ${i + 1}`}
                    loading="lazy"
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-100">{product.name}</h1>
            {product.short_description && (
              <p className="text-sm text-slate-400 mt-1">{product.short_description}</p>
            )}
          </div>

          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-bold text-emerald-200">
              {formatCents(product.our_price_cents)}
            </span>
            {product.compare_at_price_cents && product.compare_at_price_cents > product.our_price_cents && (
              <span className="text-sm text-slate-500 line-through">
                {formatCents(product.compare_at_price_cents)}
              </span>
            )}
          </div>

          {badge?.label && (
            <div className="text-xs text-slate-300">
              {badge.label}
            </div>
          )}

          <AddToCartButton product={product} />

          {isAffiliate && <FtcDisclosureBlock />}

          {product.long_description_md && (
            <div className="prose prose-invert prose-sm max-w-none pt-3 text-slate-300">
              <p className="whitespace-pre-wrap">{product.long_description_md}</p>
            </div>
          )}

          <div className="text-xs text-slate-500 pt-3 space-y-1">
            {product.shipping_class && product.shipping_class !== 'standard' && (
              <div>Shipping class: <span className="text-slate-400">{product.shipping_class}</span></div>
            )}
            {product.weight_grams && (
              <div>Weight: <span className="text-slate-400">{product.weight_grams}g</span></div>
            )}
            {product.lifecycle_stage_tags?.length > 0 && (
              <div>For: <span className="text-slate-400">{product.lifecycle_stage_tags.join(', ')}</span></div>
            )}
          </div>
        </div>
      </div>
    </StoreLayout>
  );
}
