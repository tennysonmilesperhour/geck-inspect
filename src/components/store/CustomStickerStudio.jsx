import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Sticker, Upload, Plus, Trash2, ShoppingCart, Check, RotateCcw,
  CircleAlert, Loader2, Wand2,
} from 'lucide-react';
import StoreLayout from '@/components/store/StoreLayout';
import StickerCardPreview from '@/components/store/StickerCardPreview';
import Seo from '@/components/seo/Seo';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabaseClient';
import { uploadFile } from '@/lib/uploadFile';
import { addToCart } from '@/lib/store/cart';
import { formatCents } from '@/lib/store/format';
import { captureEvent } from '@/lib/posthog';
import { SITE_URL } from '@/lib/organization-schema';
import { STICKER_EXAMPLES, exampleAsStartingDesign } from '@/lib/store/stickerExamples';
import {
  CUSTOM_STICKER_SLUG,
  CUSTOM_STICKER_PRICE_CENTS,
  CUSTOM_STICKER_SHIPPING_CENTS,
  CARD_TYPES,
  CARD_STAGES,
  CARD_LAYOUTS,
  BORDER_COLORS,
  RARITIES,
  WEAKNESS_MULTIPLIERS,
  RESISTANCE_AMOUNTS,
  STICKER_SIZES,
  STICKER_FINISHES,
  MORPH_LINE_SUGGESTIONS,
  MAX_ATTACKS,
  FIELD_LIMITS,
  createDefaultDesign,
  addAttack,
  removeAttack,
  updateAttack,
  stageEvolves,
  validateDesign,
  serializeDesign,
} from '@/lib/store/customSticker';

const JSON_LD = [
  {
    '@type': 'Product',
    '@id': `${SITE_URL}/Store/stickers#product`,
    name: 'Custom pet trading card sticker',
    description:
      'Upload a photo of your crested gecko and build a die-cut trading card sticker around it. Choose the card type, HP, stage, attacks, weakness, resistance, retreat cost, rarity, and morph line.',
    url: `${SITE_URL}/Store/stickers`,
    brand: { '@type': 'Brand', name: 'Geck Inspect' },
    offers: {
      '@type': 'Offer',
      price: (CUSTOM_STICKER_PRICE_CENTS / 100).toFixed(2),
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
      shippingDetails: {
        '@type': 'OfferShippingDetails',
        shippingRate: {
          '@type': 'MonetaryAmount',
          value: (CUSTOM_STICKER_SHIPPING_CENTS / 100).toFixed(2),
          currency: 'USD',
        },
      },
    },
  },
  {
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
      { '@type': 'ListItem', position: 2, name: 'Supplies', item: `${SITE_URL}/Store` },
      { '@type': 'ListItem', position: 3, name: 'Custom pet stickers', item: `${SITE_URL}/Store/stickers` },
    ],
  },
];

// ---------------------------------------------------------------------------
// Small form primitives, kept local so the studio stays self-contained
// ---------------------------------------------------------------------------

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

const inputClass =
  'w-full rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-sm text-slate-100 ' +
  'placeholder:text-slate-500 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600/40';

function TextInput(props) {
  return <input type="text" className={inputClass} {...props} />;
}

function Select({ value, onChange, options, ...rest }) {
  return (
    <select className={inputClass} value={value} onChange={onChange} {...rest}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

function ChipGroup({ value, onChange, options, columns = 3 }) {
  return (
    <div className={`grid gap-1.5`} style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
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
              {o.swatch && (
                <span
                  className="w-3 h-3 rounded-full border border-black/40 shrink-0"
                  style={{ background: o.swatch }}
                />
              )}
              <span className="truncate">{o.label}</span>
            </span>
            {o.blurb && <span className="block text-[10px] font-normal text-slate-500 mt-0.5 leading-snug">{o.blurb}</span>}
          </button>
        );
      })}
    </div>
  );
}

/**
 * One example card. Shows the printed sticker if the image file is
 * present, otherwise renders the same design through the live preview so
 * the page still demonstrates every option.
 */
function ExampleCard({ example, onUseAsStart }) {
  const [imageOk, setImageOk] = useState(true);
  return (
    <figure className="flex flex-col gap-2">
      <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
        {imageOk ? (
          <img
            src={example.image}
            alt={`${example.design.name} custom sticker example`}
            className="w-full rounded-lg"
            loading="lazy"
            decoding="async"
            onError={() => setImageOk(false)}
          />
        ) : (
          <StickerCardPreview design={example.design} />
        )}
      </div>
      <figcaption className="text-xs text-slate-400 leading-relaxed">
        <span className="font-semibold text-slate-200">{example.design.name}.</span>{' '}
        {example.note}
      </figcaption>
      <Button
        size="sm"
        variant="outline"
        className="w-max border-slate-700 text-slate-200 hover:bg-slate-800"
        onClick={() => onUseAsStart(example)}
      >
        <Wand2 className="w-3.5 h-3.5 mr-1.5" />
        Start from this layout
      </Button>
    </figure>
  );
}

// ---------------------------------------------------------------------------

export default function CustomStickerStudio() {
  const [design, setDesign] = useState(createDefaultDesign);
  const [product, setProduct] = useState(null);
  const [loadingProduct, setLoadingProduct] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const objectUrlRef = useRef(null);
  const fileInputRef = useRef(null);
  const builderRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const { data } = await supabase
          .from('store_products')
          .select('id, slug, name, short_description, our_price_cents, images, fulfillment_mode, vendor_id, status')
          .eq('slug', CUSTOM_STICKER_SLUG)
          .eq('status', 'active')
          .maybeSingle();
        if (!cancelled) setProduct(data || null);
      } catch (e) {
        console.warn('custom sticker product load failed', e);
      } finally {
        if (!cancelled) setLoadingProduct(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  // Release the local preview URL when the component goes away.
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

    // Show the photo immediately from a local URL, swap in the stored URL
    // once the upload lands. Production prints from the stored URL.
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
      captureEvent('custom_sticker_photo_uploaded', {});
    } catch (e) {
      console.error('sticker photo upload failed', e);
      setUploadError(
        e?.message ||
          'That photo would not upload. Try a JPEG or PNG under 10 MB, or sign in and try again.'
      );
      patch({ photo_url: '', photo_path: '' });
      if (objectUrlRef.current === localUrl) {
        URL.revokeObjectURL(localUrl);
        objectUrlRef.current = null;
      }
    } finally {
      setUploading(false);
    }
  }

  function handleUseExample(example) {
    setDesign(exampleAsStartingDesign(example));
    setAdded(false);
    builderRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const problems = useMemo(() => validateDesign(design), [design]);
  const unitPrice = product?.our_price_cents ?? CUSTOM_STICKER_PRICE_CENTS;
  const canAdd = problems.length === 0 && !uploading && !!product && !!design.photo_path;

  async function handleAdd() {
    if (!product) return;
    setAdding(true);
    try {
      const payload = serializeDesign(design);
      await addToCart(product, 1, payload);
      captureEvent('store_add_to_cart', {
        product_id: product.id,
        product_name: product.name,
        fulfillment_mode: product.fulfillment_mode,
        unit_price_cents: unitPrice,
        quantity: 1,
        customized: true,
        sticker_layout: payload.layout,
        sticker_type: payload.type,
      });
      setAdded(true);
    } catch (e) {
      console.error('add custom sticker to cart failed', e);
      setUploadError(e?.message || 'Could not add that sticker to your cart.');
    } finally {
      setAdding(false);
    }
  }

  const typeOptions = CARD_TYPES.map((t) => ({ value: t.value, label: t.label, swatch: t.color }));
  const typeOptionsWithNone = [{ value: '', label: 'None' }, ...typeOptions];

  return (
    <StoreLayout breadcrumbs={[{ label: 'Supplies', to: '/Store' }, { label: 'Custom pet stickers' }]}>
      <Seo
        title="Custom crested gecko trading card stickers, Geck Inspect"
        description="Upload a photo of your gecko and build a die-cut trading card sticker. Pick the type, HP, stage, attacks, weakness, retreat cost, and rarity. $10 each plus $5 flat shipping."
        path="/Store/stickers"
        keywords={[
          'custom pet sticker',
          'crested gecko sticker',
          'custom trading card sticker',
          'pet trading card',
          'gecko gift',
        ]}
        jsonLd={JSON_LD}
      />

      {/* ------------------------------ Hero ------------------------------ */}
      <section className="relative rounded-2xl border border-emerald-700/30 bg-gradient-to-br from-emerald-950/60 via-slate-950 to-slate-950 p-6 md:p-10 mb-8">
        <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-emerald-300 border border-emerald-700/40 rounded-full px-2.5 py-1 mb-3">
          <Sticker className="w-3.5 h-3.5" /> New in the store
        </div>
        <h1 className="text-2xl md:text-4xl font-bold text-emerald-100 max-w-2xl">
          Turn your gecko into a trading card sticker.
        </h1>
        <p className="text-slate-300 mt-3 max-w-2xl text-sm md:text-base leading-relaxed">
          Upload a photo of your own animal, then build the card around it. You
          pick the stage, the HP, the type, up to two attacks with their own
          damage and flavor text, the weakness, the retreat cost, the rarity,
          and the morph line printed along the bottom. We print it die-cut on
          weatherproof vinyl and ship it to you.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-4">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-emerald-200">
              {formatCents(unitPrice)}
            </span>
            <span className="text-sm text-slate-400">per sticker</span>
          </div>
          <div className="text-sm text-slate-400">
            plus <strong className="text-slate-200">{formatCents(CUSTOM_STICKER_SHIPPING_CENTS)}</strong> flat
            shipping on a stickers-only order
          </div>
        </div>
      </section>

      {/* ---------------------------- Examples ---------------------------- */}
      <section className="mb-10">
        <h2 className="text-lg font-bold text-slate-100 mb-1">Two we made</h2>
        <p className="text-sm text-slate-400 mb-4 max-w-3xl leading-relaxed">
          Same option set, two different looks. Pick either as a starting
          point and swap in your own photo and stats.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-3xl">
          {STICKER_EXAMPLES.map((ex) => (
            <ExampleCard key={ex.id} example={ex} onUseAsStart={handleUseExample} />
          ))}
        </div>
      </section>

      {/* ----------------------------- Builder ---------------------------- */}
      <div ref={builderRef} className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 items-start">
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
                  <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Uploading…</>
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

          <Section title="Layout" hint="How the photo and the stats sit on the card.">
            <ChipGroup
              value={design.layout}
              onChange={(v) => patch({ layout: v })}
              options={CARD_LAYOUTS}
              columns={2}
            />
            <Field label="Border color">
              <ChipGroup
                value={design.border_color}
                onChange={(v) => patch({ border_color: v })}
                options={BORDER_COLORS.map((b) => ({ value: b.value, label: b.label, swatch: b.hex }))}
                columns={5}
              />
            </Field>
          </Section>

          <Section title="Name plate" hint="The top of the card.">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Card name">
                <TextInput
                  value={design.name}
                  maxLength={FIELD_LIMITS.name}
                  placeholder="Moonlight"
                  onChange={(e) => patch({ name: e.target.value })}
                />
              </Field>
              <Field label="HP" hint={`${FIELD_LIMITS.hp_min} to ${FIELD_LIMITS.hp_max}`}>
                <input
                  type="number"
                  className={inputClass}
                  min={FIELD_LIMITS.hp_min}
                  max={FIELD_LIMITS.hp_max}
                  step={10}
                  value={design.hp}
                  onChange={(e) => patch({ hp: e.target.value })}
                />
              </Field>
            </div>
            <Field label="Stage">
              <ChipGroup
                value={design.stage}
                onChange={(v) => patch({ stage: v })}
                options={CARD_STAGES}
                columns={3}
              />
            </Field>
            {stageEvolves(design.stage) && (
              <Field label="Evolves from" hint="Printed under the name, the way a Stage 1 card reads.">
                <TextInput
                  value={design.evolves_from}
                  maxLength={FIELD_LIMITS.evolves_from}
                  placeholder="starlight"
                  onChange={(e) => patch({ evolves_from: e.target.value })}
                />
              </Field>
            )}
            <Field label="Type" hint="Sets the card color and the energy symbol on the attacks.">
              <ChipGroup
                value={design.type}
                onChange={(v) => patch({ type: v })}
                options={typeOptions}
                columns={4}
              />
            </Field>
          </Section>

          {design.layout === 'classic' && (
            <Section title="Info bar" hint="The small strip under the photo. Leave any of these blank to drop them.">
              <div className="grid grid-cols-3 gap-3">
                <Field label="No.">
                  <TextInput
                    value={design.dex_number}
                    maxLength={FIELD_LIMITS.dex_number}
                    placeholder="1"
                    onChange={(e) => patch({ dex_number: e.target.value })}
                  />
                </Field>
                <Field label="Height">
                  <TextInput
                    value={design.height}
                    maxLength={FIELD_LIMITS.measurement}
                    placeholder="12"
                    onChange={(e) => patch({ height: e.target.value })}
                  />
                </Field>
                <Field label="Weight (lbs)">
                  <TextInput
                    value={design.weight}
                    maxLength={FIELD_LIMITS.measurement}
                    placeholder="12"
                    onChange={(e) => patch({ weight: e.target.value })}
                  />
                </Field>
              </div>
            </Section>
          )}

          <Section
            title="Attacks"
            hint={`Up to ${MAX_ATTACKS}. Cost is how many energy symbols print to the left of the name. On a full art card the attack block is left off, but we keep what you wrote.`}
          >
            {(design.attacks || []).map((a, i) => (
              <div key={i} className="rounded-md border border-slate-800 bg-slate-950/60 p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300">Attack {i + 1}</span>
                  {(design.attacks || []).length > 1 && (
                    <button
                      type="button"
                      className="text-rose-300 hover:text-rose-200"
                      onClick={() => { setDesign((d) => removeAttack(d, i)); setAdded(false); }}
                      aria-label={`Remove attack ${i + 1}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_90px_90px] gap-3">
                  <Field label="Name">
                    <TextInput
                      value={a.name}
                      maxLength={FIELD_LIMITS.attack_name}
                      placeholder="Bark"
                      onChange={(e) => { setDesign((d) => updateAttack(d, i, { name: e.target.value })); setAdded(false); }}
                    />
                  </Field>
                  <Field label="Cost">
                    <Select
                      value={String(a.cost ?? 0)}
                      onChange={(e) => { setDesign((d) => updateAttack(d, i, { cost: Number(e.target.value) })); setAdded(false); }}
                      options={[0, 1, 2, 3, 4].map((n) => ({ value: String(n), label: String(n) }))}
                    />
                  </Field>
                  <Field label="Damage">
                    <TextInput
                      value={a.damage}
                      maxLength={FIELD_LIMITS.attack_damage}
                      placeholder="10"
                      onChange={(e) => { setDesign((d) => updateAttack(d, i, { damage: e.target.value })); setAdded(false); }}
                    />
                  </Field>
                </div>
                <Field label="Flavor text" hint={`What the attack does. Up to ${FIELD_LIMITS.attack_text} characters.`}>
                  <textarea
                    className={`${inputClass} resize-none`}
                    rows={2}
                    maxLength={FIELD_LIMITS.attack_text}
                    value={a.text}
                    placeholder="Super cute, not very effective."
                    onChange={(e) => { setDesign((d) => updateAttack(d, i, { text: e.target.value })); setAdded(false); }}
                  />
                </Field>
              </div>
            ))}
            {(design.attacks || []).length < MAX_ATTACKS && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-slate-700 text-slate-200 hover:bg-slate-800"
                onClick={() => { setDesign(addAttack); setAdded(false); }}
              >
                <Plus className="w-3.5 h-3.5 mr-1.5" /> Add a second attack
              </Button>
            )}
          </Section>

          <Section title="Bottom bar" hint="Weakness, resistance, and retreat cost.">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Weakness type">
                <Select
                  value={design.weakness_type}
                  onChange={(e) => patch({ weakness_type: e.target.value })}
                  options={typeOptionsWithNone}
                />
              </Field>
              <Field label="Weakness multiplier">
                <Select
                  value={design.weakness_multiplier}
                  onChange={(e) => patch({ weakness_multiplier: e.target.value })}
                  options={WEAKNESS_MULTIPLIERS.map((m) => ({ value: m, label: m }))}
                  disabled={!design.weakness_type}
                />
              </Field>
              <Field label="Resistance type">
                <Select
                  value={design.resistance_type}
                  onChange={(e) => patch({ resistance_type: e.target.value })}
                  options={typeOptionsWithNone}
                />
              </Field>
              <Field label="Resistance amount">
                <Select
                  value={design.resistance_amount}
                  onChange={(e) => patch({ resistance_amount: e.target.value })}
                  options={RESISTANCE_AMOUNTS.map((m) => ({ value: m, label: m }))}
                  disabled={!design.resistance_type}
                />
              </Field>
            </div>
            <Field label="Retreat cost" hint="How many colorless symbols print in the retreat box.">
              <ChipGroup
                value={String(design.retreat_cost)}
                onChange={(v) => patch({ retreat_cost: Number(v) })}
                options={[0, 1, 2, 3, 4].map((n) => ({ value: String(n), label: String(n) }))}
                columns={5}
              />
            </Field>
          </Section>

          <Section title="Set line" hint="The fine print along the bottom edge.">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Field label="Set code">
                <TextInput
                  value={design.set_code}
                  maxLength={FIELD_LIMITS.set_code}
                  placeholder="GI1"
                  onChange={(e) => patch({ set_code: e.target.value })}
                />
              </Field>
              <Field label="Card no.">
                <TextInput
                  value={design.card_number}
                  maxLength={FIELD_LIMITS.card_number}
                  placeholder="1"
                  onChange={(e) => patch({ card_number: e.target.value })}
                />
              </Field>
              <Field label="Set total">
                <TextInput
                  value={design.set_total}
                  maxLength={FIELD_LIMITS.set_total}
                  placeholder="150"
                  onChange={(e) => patch({ set_total: e.target.value })}
                />
              </Field>
              <Field label="Rarity">
                <Select
                  value={design.rarity}
                  onChange={(e) => patch({ rarity: e.target.value })}
                  options={RARITIES.map((r) => ({ value: r.value, label: `${r.symbol} ${r.label}` }))}
                />
              </Field>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Illustrator" hint="Printed as “Illus. yourname”. Leave blank to drop it.">
                <TextInput
                  value={design.illustrator}
                  maxLength={FIELD_LIMITS.illustrator}
                  placeholder="tennyson"
                  onChange={(e) => patch({ illustrator: e.target.value })}
                />
              </Field>
              <Field label="Morph line" hint="Bottom right. This is where the morph goes.">
                <TextInput
                  value={design.morph_line}
                  maxLength={FIELD_LIMITS.morph_line}
                  placeholder="Lilly White"
                  list="sticker-morph-suggestions"
                  onChange={(e) => patch({ morph_line: e.target.value })}
                />
                <datalist id="sticker-morph-suggestions">
                  {MORPH_LINE_SUGGESTIONS.map((m) => <option key={m} value={m} />)}
                </datalist>
              </Field>
            </div>
          </Section>

          <Section title="The physical sticker" hint="Every size and finish is the same price.">
            <Field label="Size">
              <ChipGroup
                value={design.size}
                onChange={(v) => patch({ size: v })}
                options={STICKER_SIZES}
                columns={3}
              />
            </Field>
            <Field label="Finish">
              <ChipGroup
                value={design.finish}
                onChange={(v) => patch({ finish: v })}
                options={STICKER_FINISHES}
                columns={3}
              />
            </Field>
          </Section>

          <button
            type="button"
            onClick={() => { setDesign(createDefaultDesign()); setAdded(false); setUploadError(null); }}
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Start over
          </button>
        </div>

        {/* --------------------------- Live preview --------------------------- */}
        <aside className="order-1 lg:order-2 lg:sticky lg:top-20 space-y-3">
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
            <StickerCardPreview design={design} />
          </div>
          <p className="text-[11px] text-slate-500 text-center leading-relaxed">
            Live preview. Print colors run slightly warmer than the screen, and
            the sticker is die-cut to the card outline.
          </p>

          <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Sticker</span>
              <span className="text-slate-200 font-semibold">{formatCents(unitPrice)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Shipping</span>
              <span className="text-slate-200 font-semibold">{formatCents(CUSTOM_STICKER_SHIPPING_CENTS)}</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Shipping is a flat {formatCents(CUSTOM_STICKER_SHIPPING_CENTS)} per order, however many
              stickers you order. Add stickers to a supplies order and they ship
              inside it at no extra charge.
            </p>

            {loadingProduct ? (
              <div className="text-xs text-slate-500 py-2">Loading…</div>
            ) : !product ? (
              <div className="rounded-md border border-amber-700/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                Custom stickers are not switched on in the catalog yet. Build your
                design now, the add-to-cart button turns on as soon as the product
                goes live.
              </div>
            ) : null}

            {problems.length > 0 && (
              <ul className="text-xs text-slate-400 space-y-1 pt-1">
                {problems.map((p) => (
                  <li key={p} className="flex items-start gap-1.5">
                    <CircleAlert className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-400" />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            )}
            {problems.length === 0 && !design.photo_path && !uploading && (
              <p className="text-xs text-amber-300">Waiting on the photo upload to finish.</p>
            )}

            <Button
              disabled={!canAdd || adding}
              onClick={handleAdd}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white"
            >
              {adding ? (
                <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Adding…</>
              ) : added ? (
                <><Check className="w-4 h-4 mr-1.5" /> Added to cart</>
              ) : (
                <><ShoppingCart className="w-4 h-4 mr-1.5" /> Add to cart</>
              )}
            </Button>

            {added && (
              <div className="flex flex-col gap-2 pt-1">
                <Link to="/Store/cart">
                  <Button variant="outline" className="w-full border-emerald-700/50 text-emerald-200 hover:bg-emerald-500/10">
                    Go to cart
                  </Button>
                </Link>
                <button
                  type="button"
                  onClick={() => { setDesign(createDefaultDesign()); setAdded(false); }}
                  className="text-xs text-slate-400 hover:text-slate-200"
                >
                  Build another one
                </button>
              </div>
            )}
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-900/30 p-4 text-[11px] text-slate-400 leading-relaxed space-y-1.5">
            <p>
              <strong className="text-slate-300">Turnaround.</strong> About a week
              from order to shipment. Each sticker is printed one at a time from
              the design you built.
            </p>
            <p>
              <strong className="text-slate-300">Your artwork.</strong> Upload a
              photo you own the rights to. We print your card as you built it and
              we do not print third-party logos, characters, or trademarks.
            </p>
          </div>
        </aside>
      </div>
    </StoreLayout>
  );
}
