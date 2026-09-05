import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Shirt, Upload, Check, Loader2, CircleAlert, RotateCcw, ShoppingCart } from 'lucide-react';
import Seo from '@/components/seo/Seo';
import StoreLayout from '@/components/store/StoreLayout';
import ShirtPreview from '@/components/store/ShirtPreview';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabaseClient';
import { uploadFile } from '@/lib/uploadFile';
import { addToCart } from '@/lib/store/cart';
import { formatCents } from '@/lib/store/format';
import { captureEvent } from '@/lib/posthog';
import { SITE_URL } from '@/lib/organization-schema';
import {
  CUSTOM_SHIRT_SLUG,
  CUSTOM_SHIRT_PRICE_CENTS,
  SHIRT_COLORS,
  SHIRT_SIZES,
  SHIRT_FITS,
  PRINT_PLACEMENTS,
  PRINT_STYLES,
  SHIRT_FIELD_LIMITS,
  createDefaultShirtDesign,
  validateShirtDesign,
  serializeShirtDesign,
} from '@/lib/store/customShirt';
import { MORPH_LINE_SUGGESTIONS } from '@/lib/store/customSticker';

/**
 * Custom gecko tee builder. Sibling of CustomStickerStudio: upload a photo
 * of your own crested gecko, choose the shirt and the print, watch the
 * preview, add it to the cart. The design travels as the `customization`
 * blob on the cart line, exactly like a sticker does.
 */

const JSON_LD = [
  {
    '@type': 'Product',
    '@id': `${SITE_URL}/Store/tees#product`,
    name: 'Custom crested gecko tee',
    description:
      'A T-shirt printed with your own crested gecko. Upload a photo, pick the shirt colour, size and print style, and we print and ship it.',
    brand: { '@type': 'Brand', name: 'Geck Inspect' },
    url: `${SITE_URL}/Store/tees`,
    offers: {
      '@type': 'Offer',
      price: (CUSTOM_SHIRT_PRICE_CENTS / 100).toFixed(2),
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
      url: `${SITE_URL}/Store/tees`,
    },
  },
  {
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
      { '@type': 'ListItem', position: 2, name: 'Supplies', item: `${SITE_URL}/Store` },
      { '@type': 'ListItem', position: 3, name: 'Custom gecko tee', item: `${SITE_URL}/Store/tees` },
    ],
  },
];

const inputClass =
  'w-full rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-sm text-slate-100 ' +
  'placeholder:text-slate-500 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600/40';

function Section({ title, hint, children }) {
  return (
    <section className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
      <h3 className="text-sm font-bold text-slate-100">{title}</h3>
      {hint && <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{hint}</p>}
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-slate-300">{label}</span>
      {hint && <span className="block text-[11px] text-slate-500 mt-0.5">{hint}</span>}
      <div className="mt-1">{children}</div>
    </label>
  );
}

function ChipGroup({ value, onChange, options, columns = 3 }) {
  return (
    <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            title={o.blurb || o.label}
            className={`rounded-md border px-2 py-1.5 text-xs font-semibold transition-colors text-left ${
              active
                ? 'border-emerald-500 bg-emerald-500/15 text-emerald-100'
                : 'border-slate-700 bg-slate-950 text-slate-300 hover:border-slate-600'
            }`}
          >
            <span className="flex items-center gap-1.5">
              {o.hex && <span className="w-3 h-3 rounded-full border border-black/40 shrink-0" style={{ background: o.hex }} />}
              <span className="truncate">{o.label}</span>
            </span>
            {o.blurb && <span className="block text-[10px] font-normal text-slate-500 mt-0.5 leading-snug">{o.blurb}</span>}
          </button>
        );
      })}
    </div>
  );
}

export default function CustomShirtStudio() {
  const [product, setProduct] = useState(null);
  const [loadingProduct, setLoadingProduct] = useState(true);
  const [design, setDesign] = useState(createDefaultShirtDesign);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const objectUrlRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const { data } = await supabase
          .from('store_products')
          .select('id, slug, name, short_description, our_price_cents, images, fulfillment_mode, vendor_id, status')
          .eq('slug', CUSTOM_SHIRT_SLUG)
          .eq('status', 'active')
          .maybeSingle();
        if (!cancelled) setProduct(data || null);
      } catch (e) {
        console.warn('custom tee product load failed', e);
      } finally {
        if (!cancelled) setLoadingProduct(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => () => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
  }, []);

  const patch = useCallback((updates) => {
    setDesign((d) => ({ ...d, ...updates }));
    setAdded(false);
  }, []);

  async function handleFile(file) {
    if (!file) return;
    setUploadError(null);
    setUploading(true);
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const localUrl = URL.createObjectURL(file);
    objectUrlRef.current = localUrl;
    patch({ photo_url: localUrl, photo_path: '' });
    try {
      const { file_url, path } = await uploadFile({ file, folder: 'sticker-uploads' });
      patch({ photo_url: file_url, photo_path: path });
      if (objectUrlRef.current === localUrl) {
        URL.revokeObjectURL(localUrl);
        objectUrlRef.current = null;
      }
      captureEvent('custom_tee_photo_uploaded', {});
    } catch (e) {
      console.error('tee photo upload failed', e);
      setUploadError(e?.message || 'That photo would not upload. Try a JPEG or PNG under 10 MB, or sign in and try again.');
      patch({ photo_url: '', photo_path: '' });
      if (objectUrlRef.current === localUrl) {
        URL.revokeObjectURL(localUrl);
        objectUrlRef.current = null;
      }
    } finally {
      setUploading(false);
    }
  }

  const problems = useMemo(() => validateShirtDesign(design), [design]);
  const unitPrice = product?.our_price_cents ?? CUSTOM_SHIRT_PRICE_CENTS;
  const canAdd = problems.length === 0 && !uploading && !!product && !!design.photo_path;

  async function handleAdd() {
    if (!product) return;
    setAdding(true);
    try {
      const payload = serializeShirtDesign(design);
      await addToCart(product, 1, payload);
      captureEvent('store_add_to_cart', {
        product_id: product.id,
        product_name: product.name,
        fulfillment_mode: product.fulfillment_mode,
        unit_price_cents: unitPrice,
        quantity: 1,
        customized: true,
        tee_color: payload.color,
        tee_style: payload.style,
        tee_placement: payload.placement,
      });
      setAdded(true);
    } catch (e) {
      console.error('add custom tee to cart failed', e);
      setUploadError(e?.message || 'Could not add that tee to your cart.');
    } finally {
      setAdding(false);
    }
  }

  return (
    <StoreLayout breadcrumbs={[{ label: 'Supplies', to: '/Store' }, { label: 'Custom gecko tee' }]}>
      <Seo
        title="Custom crested gecko T-shirt, Geck Inspect"
        description="Put your own crested gecko on a T-shirt. Upload a photo, choose the shirt colour, size, print placement and style, and we print and ship it."
        path="/Store/tees"
        keywords={['custom gecko shirt', 'crested gecko t-shirt', 'pet photo shirt', 'gecko gift', 'reptile apparel']}
        jsonLd={JSON_LD}
      />

      <section className="relative rounded-2xl border border-emerald-700/30 bg-gradient-to-br from-emerald-950/60 via-slate-950 to-slate-950 p-6 md:p-8 mb-8 overflow-hidden">
        <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-emerald-300 border border-emerald-700/50 rounded-full px-2.5 py-0.5 mb-4">
          <Shirt className="w-3.5 h-3.5" /> New in the store
        </div>
        <h1 className="text-2xl md:text-4xl font-bold text-emerald-100 max-w-2xl">
          Your crested gecko, on a shirt.
        </h1>
        <p className="text-slate-300 mt-3 max-w-2xl text-sm md:text-base leading-relaxed">
          Upload a photo of your own animal, pick the shirt colour and size,
          decide where the print sits and what it says, and we print it and
          ship it. The name and morph line go on the shirt exactly as you
          type them.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-4">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-emerald-200">{formatCents(unitPrice)}</span>
            <span className="text-sm text-slate-400">per shirt, any size</span>
          </div>
          <div className="text-sm text-slate-400">Standard store shipping applies.</div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 items-start">
        <div className="space-y-4 order-2 lg:order-1">
          <Section
            title="Your photo"
            hint="One animal, filling most of the frame, in even light. JPEG, PNG, WebP, GIF, or AVIF up to 10 MB. Upload a photo you own the rights to."
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
              className="hidden"
              onChange={(e) => {
                handleFile(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
                className="bg-emerald-600 hover:bg-emerald-500 text-white"
              >
                {uploading ? (
                  <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Uploading</>
                ) : (
                  <><Upload className="w-4 h-4 mr-1.5" /> {design.photo_path ? 'Replace photo' : 'Upload photo'}</>
                )}
              </Button>
              {design.photo_path && !uploading && (
                <span className="inline-flex items-center gap-1 text-xs text-emerald-300">
                  <Check className="w-3.5 h-3.5" /> Photo saved
                </span>
              )}
            </div>
            {uploadError && (
              <div className="flex items-start gap-2 rounded-md border border-rose-700/50 bg-rose-950/40 px-3 py-2 text-xs text-rose-200">
                <CircleAlert className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{uploadError}</span>
              </div>
            )}
          </Section>

          <Section title="The shirt" hint="Heavyweight ring-spun cotton. Colours are shown as printed.">
            <Field label="Colour">
              <ChipGroup value={design.color} onChange={(v) => patch({ color: v })} options={SHIRT_COLORS} columns={3} />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Size">
                <ChipGroup value={design.size} onChange={(v) => patch({ size: v })} options={SHIRT_SIZES} columns={6} />
              </Field>
              <Field label="Fit">
                <ChipGroup value={design.fit} onChange={(v) => patch({ fit: v })} options={SHIRT_FITS} columns={3} />
              </Field>
            </div>
          </Section>

          <Section title="The print" hint="Where it sits and how it is laid out.">
            <Field label="Placement">
              <ChipGroup value={design.placement} onChange={(v) => patch({ placement: v })} options={PRINT_PLACEMENTS} columns={3} />
            </Field>
            <Field label="Style">
              <ChipGroup value={design.style} onChange={(v) => patch({ style: v })} options={PRINT_STYLES} columns={2} />
            </Field>
          </Section>

          <Section title="The words" hint="Printed exactly as typed. Leave a line blank to drop it.">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Name">
                <input
                  type="text"
                  className={inputClass}
                  value={design.headline}
                  maxLength={SHIRT_FIELD_LIMITS.headline}
                  placeholder="Moonlight"
                  onChange={(e) => patch({ headline: e.target.value })}
                />
              </Field>
              <Field label="Morph line" hint="Lilly White, Dark Base Harlequin, Axanthic Phantom.">
                <input
                  type="text"
                  className={inputClass}
                  value={design.subline}
                  maxLength={SHIRT_FIELD_LIMITS.subline}
                  placeholder="Lavender Extreme Harlequin"
                  list="tee-morph-suggestions"
                  onChange={(e) => patch({ subline: e.target.value })}
                />
                <datalist id="tee-morph-suggestions">
                  {MORPH_LINE_SUGGESTIONS.map((m) => <option key={m} value={m} />)}
                </datalist>
              </Field>
              {design.style === 'poster' && (
                <Field label="Fine print" hint="The small line at the bottom of the poster.">
                  <input
                    type="text"
                    className={inputClass}
                    value={design.fine_print}
                    maxLength={SHIRT_FIELD_LIMITS.fine_print}
                    placeholder="Est. 2024"
                    onChange={(e) => patch({ fine_print: e.target.value })}
                  />
                </Field>
              )}
            </div>
          </Section>

          <button
            type="button"
            onClick={() => { setDesign(createDefaultShirtDesign()); setAdded(false); setUploadError(null); }}
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Start over
          </button>
        </div>

        <aside className="order-1 lg:order-2 lg:sticky lg:top-20 space-y-3">
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
            <ShirtPreview design={design} />
          </div>
          <p className="text-[11px] text-slate-500 text-center leading-relaxed">
            Live preview. The print is direct-to-garment, so photo colours come
            out close to the screen; the shirt drawing is a guide to placement.
          </p>

          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-slate-300">One shirt</span>
              <span className="text-lg font-bold text-emerald-200">{formatCents(unitPrice)}</span>
            </div>
            {problems.length > 0 && (
              <ul className="text-xs text-amber-300 space-y-1">
                {problems.map((p) => <li key={p}>{p}</li>)}
              </ul>
            )}
            {uploading && <p className="text-xs text-amber-300">Waiting on the photo upload to finish.</p>}
            {!loadingProduct && !product && (
              <p className="text-xs text-rose-300">The custom tee is not on sale right now.</p>
            )}
            {added ? (
              <Link to="/Store/cart" className="block">
                <Button className="w-full bg-emerald-600 hover:bg-emerald-500 text-white">
                  <ShoppingCart className="w-4 h-4 mr-1.5" /> In your cart. View cart
                </Button>
              </Link>
            ) : (
              <Button
                type="button"
                disabled={!canAdd || adding}
                onClick={handleAdd}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50"
              >
                {adding ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <ShoppingCart className="w-4 h-4 mr-1.5" />}
                Add to cart
              </Button>
            )}
          </div>
        </aside>
      </div>
    </StoreLayout>
  );
}
