import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowRight, Check, Download, Loader2, PanelTop, RotateCcw, ShoppingCart, Sticker, Upload, Wand2 } from 'lucide-react';
import StoreLayout from './StoreLayout';
import StickerPreview from './StickerThemePreviews';
import StickerMockup from './StickerMockup';
import StickerPhotoEditor from './StickerPhotoEditor';
import CardDetails, { ChoiceField, TextField } from './StickerFormFields';
import Seo from '@/components/seo/Seo';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabaseClient';
import { uploadFile } from '@/lib/uploadFile';
import { convertHeicForUpload } from '@/lib/imageResize';
import { addToCart } from '@/lib/store/cart';
import { formatCents } from '@/lib/store/format';
import { STORE_CHECKOUT_ENABLED } from '@/lib/store/checkoutFlags';
import { captureEvent } from '@/lib/posthog';
import { SUPPORT_EMAIL_URL } from '@/lib/supportContact';
import { SITE_URL } from '@/lib/organization-schema';
import { STICKER_EXAMPLES, exampleAsStartingDesign } from '@/lib/store/stickerExamples';
import { STICKER_THEMES, THEME_FIELD_META, THEME_FIELD_LIMITS, isCardTheme, stickerTheme } from '@/lib/store/stickerThemes';
import { designFromGecko } from '@/lib/store/stickerGecko';
import { downloadSticker } from '@/lib/store/stickerExport';
import { CARD_LAYOUTS, CUSTOM_STICKER_SLUG, CUSTOM_STICKER_PRICE_CENTS, CUSTOM_STICKER_SHIPPING_CENTS, FIELD_LIMITS, PLAQUE_STYLES, STICKER_SIZES, createDefaultDesign, serializeDesign, stickerDimensions, validateDesign } from '@/lib/store/customSticker';

const SAMPLE = { ...createDefaultDesign(), ...STICKER_EXAMPLES[2].design, layout: 'modern', name: 'Luna' };
const PLAQUE_SAMPLE = { ...createDefaultDesign(), theme: 'enclosure_plaque', name: 'Moonlight', hatch_label: '2024' };
const STEPS = ['Choose a style', 'Make it yours', 'Review your proof'];
const cardSurface = 'rounded-2xl border border-slate-800 bg-slate-900/35 p-5 md:p-6';

function freshDesign(location) {
  const theme = new URLSearchParams(location.search).get('theme');
  return location.state?.stickerGecko ? designFromGecko(location.state.stickerGecko, theme) : {
    ...createDefaultDesign(), ...(theme === 'enclosure_plaque' ? { theme } : {}),
  };
}

function ExampleCard({ example, onChoose }) {
  const [imageOk, setImageOk] = useState(Boolean(example.image));
  return <figure className="flex flex-col gap-3">
    <div className="flex aspect-[4/5] items-center justify-center rounded-xl border border-emerald-900/40 bg-[#064e3b] p-5 sm:p-6">
      <div className="w-full max-w-[240px] aspect-[2.5/3.5] flex items-center justify-center">
        {imageOk ? <img src={example.image} alt={`${example.design.name}, keeper-created card example`} className="w-full h-full object-contain" loading="lazy" onError={() => setImageOk(false)} /> : <StickerPreview design={example.design} />}
      </div>
    </div>
    <figcaption className="text-xs leading-relaxed text-slate-400"><span className="font-semibold text-slate-100">{example.design.name}.</span> {example.note}</figcaption>
    <Button variant="outline" className="mt-auto w-full" onClick={() => onChoose(example)} aria-label={`Start from ${example.design.name}`}><Wand2 className="h-4 w-4 mr-2" />Use this style</Button>
  </figure>;
}

export default function CustomStickerStudio() {
  const location = useLocation();
  const [design, setDesign] = useState(() => freshDesign(location));
  const [step, setStep] = useState(location.state?.stickerGecko ? 1 : 0);
  const [product, setProduct] = useState(null);
  const [loadingProduct, setLoadingProduct] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const [approved, setApproved] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [view, setView] = useState('design');
  const [story, setStory] = useState('card');
  const builderRef = useRef(null);
  const proofRef = useRef(null);
  const placementRef = useRef(null);
  const objectUrlRef = useRef(null);
  const uploadRevisionRef = useRef(0);
  const fileInputRef = useRef(null);
  const draftInputRef = useRef(null);
  const previousLocationRef = useRef(location.key);

  // A second collection action can navigate to this same mounted route.
  useEffect(() => {
    if (previousLocationRef.current === location.key) return;
    previousLocationRef.current = location.key;
    uploadRevisionRef.current += 1;
    setDesign(freshDesign(location)); setApproved(false); setAdded(false);
    setStep(location.state?.stickerGecko ? 1 : 0); setError(''); setNotice(''); setUploading(false);
  }, [location]);

  useEffect(() => {
    captureEvent('custom_sticker_studio_viewed', {});
    let cancelled = false;
    async function load() {
      try {
        const { data, error: queryError } = await supabase.from('store_products')
          .select('id, slug, name, our_price_cents, fulfillment_mode, vendor_id, status')
          .eq('slug', CUSTOM_STICKER_SLUG).eq('status', 'active').maybeSingle();
        if (queryError) throw queryError;
        if (!cancelled) setProduct(data || null);
      } catch { if (!cancelled) setProduct(null); }
      finally { if (!cancelled) setLoadingProduct(false); }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => () => {
    uploadRevisionRef.current += 1;
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
  }, []);

  const patch = useCallback((updates) => {
    setDesign((current) => ({ ...current, ...updates })); setApproved(false); setAdded(false); setNotice('');
  }, []);

  function goToStep(index) {
    setStep(index); setNotice('');
    if (index === 2) captureEvent('custom_sticker_proof_opened', { theme: design.theme, layout: design.layout });
    builderRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function handleFile(file, treatment = 'original') {
    if (!file) return;
    const revision = ++uploadRevisionRef.current;
    setError(''); setUploading(true); setApproved(false); setAdded(false);
    try {
      if (file.size > 50 * 1024 * 1024) throw new Error('Choose a photo smaller than 50 MB.');
      if (!/^image\/(jpeg|png|webp|gif|avif|heic|heif)$/.test(file.type) && !/\.hei[cf]$/i.test(file.name)) throw new Error('Choose a JPEG, PNG, WebP, GIF, AVIF, or HEIC photo.');
      const safeFile = await convertHeicForUpload(file);
      if (revision !== uploadRevisionRef.current) return;
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      const local = URL.createObjectURL(safeFile); objectUrlRef.current = local;
      patch({ photo_url: local, photo_path: '', photo_crop: { x: 50, y: 50, zoom: 1 }, photo_treatment: treatment });
      // Designing works before sign-in. A permanent upload is required only
      // when a real order is possible, not while playing with the builder.
      const { data: { user } } = await supabase.auth.getUser();
      if (revision !== uploadRevisionRef.current) return;
      if (user) {
        const { file_url, path } = await uploadFile({ file: safeFile, folder: 'sticker-uploads' });
        if (revision !== uploadRevisionRef.current) return;
        patch({ photo_url: file_url, photo_path: path });
        URL.revokeObjectURL(local); objectUrlRef.current = null;
      } else setNotice('Your photo is previewed on this device. Sign in before ordering to save it securely.');
      captureEvent('custom_sticker_photo_uploaded', { treatment, persisted: Boolean(user) });
    } catch (e) {
      if (revision === uploadRevisionRef.current) { setError(e.message || 'The photo could not be uploaded. Please try again.'); }
      throw e;
    } finally { if (revision === uploadRevisionRef.current) setUploading(false); }
  }

  function useExample(example) {
    const personal = { name: design.name, morph_line: design.morph_line, species_name: design.species_name, scientific_name: design.scientific_name, native_range: design.native_range, habitat: design.habitat, hatch_label: design.hatch_label, plaque_style: design.plaque_style, photo_url: design.photo_url, photo_path: design.photo_path, photo_crop: design.photo_crop, photo_treatment: design.photo_treatment };
    patch({ ...createDefaultDesign(), ...exampleAsStartingDesign(example), ...personal, version: createDefaultDesign().version });
    captureEvent('custom_sticker_template_selected', { template: example.id }); goToStep(1);
  }

  function reset() {
    uploadRevisionRef.current += 1; setUploading(false);
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = null;
    setDesign(createDefaultDesign()); setApproved(false); setAdded(false); setError(''); setNotice(''); setStep(0);
  }

  const isPlaque = design.theme === 'enclosure_plaque';
  const isCard = isCardTheme(design.theme);
  const dimensions = stickerDimensions(design);
  const problems = useMemo(() => validateDesign(design), [design]);
  const unitPrice = product?.our_price_cents ?? CUSTOM_STICKER_PRICE_CENTS;
  const total = unitPrice + CUSTOM_STICKER_SHIPPING_CENTS;
  const storedPhoto = !design.photo_url || Boolean(design.photo_path) || /^https?:\/\//.test(design.photo_url);
  const canAdd = STORE_CHECKOUT_ENABLED && !!product && !uploading && problems.length === 0 && approved && storedPhoto;
  const heroDesign = isPlaque ? PLAQUE_SAMPLE : SAMPLE;
  const jsonLd = { '@type': 'Product', '@id': `${SITE_URL}/Store/stickers#product`, name: 'Custom gecko stickers and enclosure name plaques', url: `${SITE_URL}/Store/stickers`, image: `${SITE_URL}/store/custom-stickers/sticker-social.png`, description: 'Create an original collector-card sticker or an elegant enclosure species label with your gecko’s own details.', brand: { '@type': 'Brand', name: 'Geck Inspect' }, ...(STORE_CHECKOUT_ENABLED && product ? { offers: { '@type': 'Offer', price: (unitPrice / 100).toFixed(2), priceCurrency: 'USD', availability: 'https://schema.org/InStock' } } : {}) };

  async function exportImage(placement = false) {
    setExporting(true); setError('');
    try {
      await downloadSticker(placement ? placementRef.current : proofRef.current, design.name, placement ? 'placement-mockup' : 'proof');
      captureEvent('custom_sticker_proof_downloaded', { theme: design.theme, placement });
    } catch (e) { setError(e.message || 'The preview could not be downloaded.'); }
    finally { setExporting(false); }
  }

  function saveDraft() {
    const payload = serializeDesign(design);
    // Local object URLs do not survive reloads. Do not claim the photo is saved.
    if (payload.photo_url.startsWith('blob:')) { payload.photo_url = ''; payload.photo_path = ''; }
    const blob = new Blob([JSON.stringify({ ...payload, draft_version: 1 }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const link = document.createElement('a');
    link.href = url; link.download = 'my-gecko-sticker-design.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice(payload.photo_url || isPlaque ? 'Design saved. Use “Resume a saved design” to reopen it.' : 'Design saved. Add your photo again when you reopen it; local photos are not included in the file.');
  }

  async function resumeDraft(file) {
    if (!file) return;
    try {
      if (file.size > 200000) throw new Error('That design file is too large.');
      const data = JSON.parse(await file.text());
      if (data.kind !== 'custom_sticker' || data.draft_version !== 1) throw new Error('Choose a design file saved by this sticker builder.');
      const cleaned = serializeDesign({ ...createDefaultDesign(), ...data });
      if (cleaned.photo_url && !/^https?:\/\//.test(cleaned.photo_url)) { cleaned.photo_url = ''; cleaned.photo_path = ''; }
      uploadRevisionRef.current += 1; setUploading(false); patch({ ...createDefaultDesign(), ...cleaned }); setError(''); goToStep(1);
    } catch (e) { setError(e.message || 'That design could not be opened.'); }
  }

  async function handleAdd() {
    if (!canAdd || adding) return;
    setAdding(true); setError('');
    try {
      const payload = serializeDesign(design);
      await addToCart(product, 1, payload);
      captureEvent('store_add_to_cart', { product_id: product.id, product_name: product.name, unit_price_cents: unitPrice, quantity: 1, customized: true, sticker_layout: payload.layout, sticker_theme: payload.theme });
      setAdded(true);
    } catch (e) { setError(e.message || 'Could not add your sticker to the cart.'); }
    finally { setAdding(false); }
  }

  return <StoreLayout breadcrumbs={[{ label: 'Shop', to: '/Store' }, { label: 'Stickers & enclosure plaques' }]}>
    <Seo title="Your gecko, made collectible · custom stickers & enclosure plaques" description="Create a personal collector sticker or an elegant enclosure name plaque. Start from your gecko’s photo and details, customize the design, and review your proof." path="/Store/stickers" jsonLd={[jsonLd]} />

    <section className="grid lg:grid-cols-[1fr_1fr] gap-8 items-center rounded-3xl border border-emerald-800/40 bg-gradient-to-br from-emerald-950/60 via-slate-950 to-slate-950 p-6 md:p-10 mb-10">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-300">A little tribute to your favorite gecko</p>
        <h1 className="mt-4 text-4xl md:text-5xl font-bold leading-[1.05] tracking-tight text-stone-100">{isPlaque ? 'An enclosure with their name on it.' : 'Your gecko. Your collectible.'}</h1>
        <p className="mt-5 max-w-lg text-sm md:text-base leading-relaxed text-slate-300">{isPlaque ? 'A quiet, beautifully typeset name plaque with their species and the corner of the world they come from. Made as a vinyl sticker for the outside of an enclosure.' : 'The dramatic leap. The tiny toes. The oversized personality. Turn the pet you love into a collector sticker that could only be theirs.'}</p>
        <div className="flex flex-wrap gap-3 mt-6"><Button className="bg-emerald-500 text-emerald-950 hover:bg-emerald-400 min-h-11" onClick={() => goToStep(0)}>Make yours <ArrowRight className="h-4 w-4 ml-2" /></Button><button className="min-h-11 px-2 text-sm text-emerald-200 underline underline-offset-4" onClick={() => { patch({ theme: isPlaque ? 'trading_card' : 'enclosure_plaque' }); goToStep(0); }}>{isPlaque ? 'Explore collector stickers' : 'Make an enclosure plaque'}</button></div>
        <p className="mt-5 text-sm text-slate-300"><strong className="text-stone-100">{formatCents(unitPrice)}</strong> per sticker · {formatCents(CUSTOM_STICKER_SHIPPING_CENTS)} flat shipping per stickers-only order</p>
        <p className="mt-2 text-xs text-slate-500">{STORE_CHECKOUT_ENABLED ? 'Your preview is free. Order when it feels just right.' : 'The designer is open. Ordering opens after checkout is ready.'}</p>
      </div>
      <div className="space-y-3">
        <div className="flex gap-1 rounded-full border border-slate-700 p-1 w-max mx-auto" role="group" aria-label="See the transformation">
          {['photo', 'card', 'placement'].map((value, i) => <button key={value} aria-pressed={story === value} onClick={() => setStory(value)} className={`rounded-full px-3 py-2 text-xs min-h-10 ${story === value ? 'bg-emerald-200 text-emerald-950' : 'text-slate-300'}`}>{i + 1}. {value === 'photo' ? 'Your starting point' : value === 'card' ? 'Your design' : 'On display'}</button>)}
        </div>
        {story === 'placement' ? <StickerMockup design={heroDesign} /> : <div className="min-h-[350px] rounded-2xl bg-[#064e3b] p-7 flex items-center justify-center"><div className={isPlaque ? 'w-full' : 'w-[235px]'}>{story === 'photo' && !isPlaque ? <img src={SAMPLE.photo_url} alt="Illustrated sample gecko artwork" className="rounded-xl w-full" /> : <StickerPreview design={heroDesign} />}</div></div>}
        <p className="text-center text-[10px] text-slate-500">{isPlaque ? 'Sample plaque. Every word is editable.' : 'Illustrated demo. Your own photo replaces the sample artwork.'}</p>
      </div>
    </section>

    <section ref={builderRef} id="sticker-builder" className="scroll-mt-24 mb-12" aria-labelledby="builder-title">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-5"><div><p className="text-xs uppercase tracking-[0.15em] text-emerald-400">Make something personal</p><h2 id="builder-title" className="mt-1 text-2xl font-bold text-stone-100">Your design studio</h2></div><button className="text-xs text-slate-400 underline min-h-11" onClick={() => draftInputRef.current?.click()}>Resume a saved design</button><input ref={draftInputRef} className="hidden" type="file" accept="application/json,.json" aria-label="Resume a saved design file" onChange={(e) => { resumeDraft(e.target.files?.[0]); e.target.value = ''; }} /></div>
      <nav aria-label="Sticker creation steps" className="grid grid-cols-3 gap-2 mb-6">
        {STEPS.map((label, index) => <button key={label} onClick={() => goToStep(index)} aria-current={step === index ? 'step' : undefined} className={`rounded-xl border px-2 md:px-4 py-3 min-h-14 text-left text-xs md:text-sm ${step === index ? 'border-emerald-500 bg-emerald-950/50 text-emerald-100' : 'border-slate-800 text-slate-400'}`}><span className="mr-2 font-bold">0{index + 1}</span>{label}</button>)}
      </nav>
      <div className="grid lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_380px] gap-6 items-start">
        <div className={`${cardSurface} space-y-6 min-w-0`}>
          {step > 0 && <div className="lg:hidden sticky top-3 z-10 rounded-xl border border-slate-700 bg-slate-950/95 p-3 flex gap-4 items-center shadow-xl"><div className={isPlaque ? 'w-[180px] shrink-0' : 'w-[100px] shrink-0'}><StickerPreview design={design} /></div><div className="min-w-0 text-xs text-slate-400"><p className="font-semibold text-emerald-200">Your live preview</p><p className="mt-2">{dimensions.label}</p><p className="mt-1">Changes appear as you make them.</p></div></div>}
          {step === 0 && <>
            <h3 className="text-xl font-semibold text-stone-100">What are we making?</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              {[
                ['trading_card', 'Collector sticker', 'A little legend with their own signature moves.', Sticker],
                ['enclosure_plaque', 'Enclosure name plaque', 'An elegant name and species label for their home.', PanelTop],
              ].map(([value, label, description, Icon]) => <button key={value} aria-pressed={design.theme === value} className={`rounded-xl border p-4 text-left ${design.theme === value ? 'border-emerald-400 bg-emerald-950/40' : 'border-slate-700 hover:border-slate-500'}`} onClick={() => patch({ theme: value })}><Icon className="h-5 w-5 text-emerald-300 mb-3" /><span className="block font-semibold text-stone-100">{label}</span><span className="block mt-1 text-xs leading-relaxed text-slate-400">{description}</span></button>)}
            </div>
            {isCard && <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {CARD_LAYOUTS.map((layout) => <button key={layout.value} aria-pressed={design.layout === layout.value} className={`rounded-xl border p-2 sm:p-3 text-left ${design.layout === layout.value ? 'border-emerald-400' : 'border-slate-800 hover:border-slate-500'}`} onClick={() => { patch({ layout: layout.value }); captureEvent('custom_sticker_layout_selected', { layout: layout.value }); }}><StickerPreview design={{ ...SAMPLE, ...((design.photo_url && design.name) ? design : {}), layout: layout.value }} /><span className="block mt-3 text-[11px] sm:text-sm font-semibold text-stone-100">{layout.label}</span><span className="hidden sm:block mt-1 text-xs leading-relaxed text-slate-400">{layout.blurb}</span></button>)}
            </div>}
            {isPlaque && <><div className="rounded-xl bg-stone-950 p-5"><StickerPreview design={{ ...PLAQUE_SAMPLE, ...design, name: design.name || PLAQUE_SAMPLE.name }} /></div><ChoiceField label="Plaque palette" value={design.plaque_style} options={PLAQUE_STYLES} onChange={(plaque_style) => patch({ plaque_style })} /><p className="text-xs text-slate-400">A landscape vinyl label, not a rigid or engraved plaque. Designed to sit neatly on the outside of the glass.</p></>}
            <details className="border-t border-slate-800 pt-4"><summary className="cursor-pointer text-sm text-slate-400">Explore five more sticker formats</summary><div className="mt-4"><ChoiceField label="Other sticker formats" value={isCard || isPlaque ? '' : design.theme} options={[{ value: '', label: 'Choose another format' }, ...STICKER_THEMES.filter((t) => !['trading_card', 'enclosure_plaque'].includes(t.value))]} onChange={(theme) => { if (theme) patch({ theme }); }} /></div></details>
            <Button onClick={() => goToStep(1)} className="w-full bg-emerald-600 hover:bg-emerald-500">Make it yours <ArrowRight className="h-4 w-4 ml-2" /></Button>
          </>}

          {step === 1 && <>
            <div><h3 className="text-xl font-semibold text-stone-100">Meet the star of the sticker.</h3><p className="mt-2 text-sm text-slate-400">{isPlaque ? 'Check the species information, then give the plaque a personal touch.' : 'A photo and a name are enough to get started. The rest is yours to play with.'}</p></div>
            {!isPlaque && <div className="rounded-xl border border-dashed border-slate-700 p-4">
              <input ref={fileInputRef} type="file" className="hidden" accept="image/jpeg,image/png,image/webp,image/gif,image/avif,image/heic,image/heif,.heic,.heif" aria-label="Upload your gecko photo" onChange={(e) => { handleFile(e.target.files?.[0]).catch(() => {}); e.target.value = ''; }} />
              <Button variant="outline" disabled={uploading} onClick={() => fileInputRef.current?.click()}>{uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}{uploading ? 'Saving photo…' : design.photo_url ? 'Replace photo' : 'Add your photo'}</Button>
              <p className="mt-2 text-xs text-slate-500">One animal, good light, room around the toes and tail. JPEG, PNG, WebP, GIF, AVIF or HEIC. Use a photo you own.</p>
              {design.photo_url && <StickerPhotoEditor design={design} disabled={uploading} onChange={patch} onSaveCutout={(file) => handleFile(file, 'cutout')} />}
            </div>}
            <div className="grid sm:grid-cols-2 gap-4"><TextField label="Their name" value={design.name} maxLength={FIELD_LIMITS.name} placeholder="Moonlight" onChange={(name) => patch({ name })} />{!isPlaque && <TextField label="Morph or a short subtitle (optional)" value={design.morph_line} maxLength={FIELD_LIMITS.morph_line} placeholder="Lavender Extreme Harlequin" onChange={(morph_line) => patch({ morph_line })} />}</div>
            {isPlaque && <>
              <div className="grid sm:grid-cols-2 gap-4">{['species_name', 'scientific_name', 'native_range', 'habitat', 'hatch_label'].map((key) => <TextField key={key} label={THEME_FIELD_META[key].label} hint={THEME_FIELD_META[key].hint} placeholder={THEME_FIELD_META[key].placeholder} value={design[key]} maxLength={THEME_FIELD_LIMITS[key]} onChange={(value) => patch({ [key]: value })} />)}</div>
              <ChoiceField label="Plaque palette" value={design.plaque_style} options={PLAQUE_STYLES} onChange={(plaque_style) => patch({ plaque_style })} />
              <p className="text-xs text-slate-500">Native range refers to the species’ wild home. Crested gecko facts are prefilled; other species need you to confirm their scientific name and range.</p>
            </>}
            {isCard && <details className="rounded-xl border border-slate-700 p-4"><summary className="cursor-pointer text-sm font-semibold text-emerald-200">Customize moves, colors, and collection details</summary><div className="mt-5"><CardDetails design={design} onChange={patch} /></div></details>}
            {!isCard && !isPlaque && <div className="grid sm:grid-cols-2 gap-4">{stickerTheme(design.theme).fields.map((key) => <TextField key={key} label={THEME_FIELD_META[key]?.label || key} value={design[key]} maxLength={THEME_FIELD_LIMITS[key] || FIELD_LIMITS[key] || 60} onChange={(value) => patch({ [key]: value })} />)}</div>}
            <div><h4 className="text-sm text-stone-100 font-semibold mb-3">Choose your size</h4><div className="grid grid-cols-3 gap-2">{STICKER_SIZES.map((size) => <button key={size.value} aria-pressed={design.size === size.value} onClick={() => patch({ size: size.value })} className={`rounded-lg border py-3 px-2 text-sm ${design.size === size.value ? 'border-emerald-400 bg-emerald-950/30 text-emerald-100' : 'border-slate-700 text-slate-400'}`}>{size.label}</button>)}</div><p className="text-xs text-slate-500 mt-2">Longest edge. Your {isPlaque ? 'plaque' : 'sticker'} measures {dimensions.label}.</p></div>
            <Button className="w-full bg-emerald-600 hover:bg-emerald-500" onClick={() => goToStep(2)}>Review my proof <ArrowRight className="h-4 w-4 ml-2" /></Button>
          </>}

          {step === 2 && <>
            <h3 className="text-xl font-semibold text-stone-100">One last look. Every detail is yours.</h3>
            <p className="text-sm text-slate-400">Check the spelling, photo crop, and smallest text. The saved design and crop travel with your order.</p>
            <div className="max-w-sm mx-auto rounded-xl bg-[#064e3b] p-6"><StickerPreview design={design} /></div>
            <dl className="grid grid-cols-2 gap-3 text-sm text-slate-300"><div><dt className="text-xs text-slate-500">Design</dt><dd>{isCard ? CARD_LAYOUTS.find((l) => l.value === design.layout)?.label : stickerTheme(design.theme).label}</dd></div><div><dt className="text-xs text-slate-500">Size</dt><dd>{dimensions.label}</dd></div><div><dt className="text-xs text-slate-500">Material & finish</dt><dd>Glossy vinyl sticker</dd></div><div><dt className="text-xs text-slate-500">Delivery</dt><dd>{STORE_CHECKOUT_ENABLED ? 'Confirm timing before ordering' : 'Available when ordering opens'}</dd></div></dl>
            {problems.length > 0 && <div role="status" className="rounded-lg border border-amber-700/40 bg-amber-950/20 p-4"><p className="text-sm text-amber-200 mb-2">Finish these details first:</p><ul className="list-disc pl-5 text-xs text-amber-100/80 space-y-1">{problems.map((problem) => <li key={problem}>{problem}</li>)}</ul><button className="text-sm mt-3 underline text-emerald-200 min-h-11" onClick={() => goToStep(1)}>Return to my details</button></div>}
            <label className="flex gap-3 items-start text-sm leading-relaxed text-slate-300"><input type="checkbox" className="mt-1 h-4 w-4 accent-emerald-400" checked={approved} onChange={(e) => setApproved(e.target.checked)} />I’ve checked this proof and have permission to use the photo. This is the design I want printed.</label>
            <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={exporting || uploading} onClick={() => exportImage()}><Download className="h-4 w-4 mr-2" />{exporting ? 'Preparing…' : 'Download proof'}</Button><Button variant="outline" onClick={saveDraft}>Save design</Button><Button variant="outline" onClick={() => goToStep(1)}>Edit details</Button></div>
            <p className="text-xs text-slate-500">The download is a screen proof. Print color and finish may vary. Check the final size; tiny text is easiest to read at 3 or 4 inches.</p>
          </>}
          {error && <p role="alert" className="rounded-lg border border-rose-800/40 bg-rose-950/20 p-3 text-sm text-rose-200">{error}</p>}
          {notice && <p role="status" className="text-sm text-emerald-200">{notice}</p>}
          <button type="button" className="inline-flex items-center gap-2 text-xs text-slate-500 hover:text-slate-300 min-h-11" onClick={reset}><RotateCcw className="h-3 w-3" />Start a fresh design</button>
        </div>

        <aside className="lg:sticky lg:top-20 space-y-4 min-w-0">
          <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
            <div className="flex gap-1 mb-4" role="group" aria-label="Preview view">{[['design', 'Your design'], ['placement', 'On display'], ['scale', 'Size guide']].map(([value, label]) => <button key={value} aria-pressed={view === value} className={`rounded-lg flex-1 px-2 py-2 min-h-10 text-xs ${view === value ? 'bg-emerald-950 text-emerald-200' : 'text-slate-400'}`} onClick={() => setView(value)}>{label}</button>)}</div>
            <div ref={proofRef} style={view === 'design' ? {} : { position: 'absolute', left: '-10000px', width: '340px' }} aria-hidden={view !== 'design'}><StickerPreview design={design} /></div>
            {view === 'placement' && <div ref={placementRef}><StickerMockup design={design} /></div>}
            {view === 'scale' && <StickerMockup design={design} scale />}
            <p className="mt-3 text-center text-[11px] text-slate-500">{dimensions.label} · glossy vinyl · {isPlaque ? 'landscape name plaque' : 'die-cut sticker'}</p>
            {view === 'placement' && <button disabled={exporting} className="w-full text-xs mt-3 text-emerald-200 underline min-h-10" onClick={() => exportImage(true)}>Download this placement mockup</button>}
          </div>
          <div className={`${cardSurface} space-y-3`}>
            <h3 className="font-semibold text-stone-100">Made just for {design.name || 'your gecko'}</h3>
            <div className="flex justify-between text-sm text-slate-400"><span>One {isPlaque ? 'plaque sticker' : 'sticker'}</span><span className="text-slate-100">{formatCents(unitPrice)}</span></div>
            <div className="flex justify-between text-sm text-slate-400"><span>Flat shipping</span><span className="text-slate-100">{formatCents(CUSTOM_STICKER_SHIPPING_CENTS)}</span></div>
            <div className="flex justify-between border-t border-slate-800 pt-3 text-sm font-semibold text-slate-100"><span>Sticker + shipping</span><span>{formatCents(total)}</span></div>
            <p className="text-[11px] text-slate-500">One shipping charge for a stickers-only order, even with several designs. Any applicable tax is shown at checkout.</p>
            {!STORE_CHECKOUT_ENABLED ? <p className="rounded-lg bg-amber-950/20 border border-amber-800/30 p-3 text-xs text-amber-200">Design and download today. Ordering is not open yet; payment and delivery timing will be available when checkout opens.</p> : loadingProduct ? <p className="text-xs text-slate-400">Loading availability…</p> : !product ? <p className="text-xs text-amber-200">This product is not available to order yet.</p> : null}
            {STORE_CHECKOUT_ENABLED && <><Button disabled={!canAdd || adding || added} onClick={handleAdd} className="w-full bg-emerald-600 hover:bg-emerald-500">{adding ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : added ? <Check className="h-4 w-4 mr-2" /> : <ShoppingCart className="h-4 w-4 mr-2" />}{adding ? 'Adding…' : added ? 'Added to cart' : 'Add my design to cart'}</Button>{!storedPhoto && <Link className="text-xs text-emerald-200 underline block" to={`/AuthPortal?redirect=${encodeURIComponent('/Store/stickers')}`}>Sign in, then upload your photo to save it for printing.</Link>}{!approved && <button className="text-xs text-emerald-200 underline min-h-10" onClick={() => goToStep(2)}>Review and approve your proof first</button>}{added && <Link to="/Store/cart" className="block text-center text-sm text-emerald-200 underline min-h-11 pt-2">Go to cart</Link>}</>}
            <a href={SUPPORT_EMAIL_URL} className="text-xs text-slate-400 underline block pt-1">Questions about your design or delivery?</a>
          </div>
        </aside>
      </div>
    </section>

    <section className="mb-12" aria-labelledby="examples-title"><h2 id="examples-title" className="text-2xl font-semibold text-stone-100">A collection of personalities.</h2><p className="text-sm text-slate-400 mt-2 mb-5">Three illustrated starting points, followed by Moonlight and Bat Geck—the original keeper-created references. Your photo, name, and crop stay with you when you switch templates.</p><div className="grid grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">{STICKER_EXAMPLES.map((example) => <ExampleCard key={example.id} example={example} onChoose={useExample} />)}</div></section>

    <section className="mb-12" aria-labelledby="sticker-demo-title"><h2 id="sticker-demo-title" className="text-2xl font-semibold text-stone-100 mb-4">From one personality to a whole collection.</h2><video controls playsInline preload="none" poster="/store/custom-stickers/sticker-social.png" className="w-full max-w-xl mx-auto rounded-2xl" aria-label="Nine-second illustrated demonstration of a gecko sticker and name plaque"><source src="/store/custom-stickers/sticker-demo.webm" type="video/webm" /></video><p className="mt-3 text-xs text-center text-slate-400">Illustrated demonstration and digital mockups. Your finished design uses your own gecko photo.</p></section>

    <section className="grid md:grid-cols-3 gap-4 mb-12" aria-label="Made personal, from photo to print">
      {[
        ['Your photo, your personality', 'Start with the real animal you love. We keep their photo recognizable; the frame, words, and details make it collectible.'],
        ['A home with their name on it', 'Pair a playful collector sticker with a quiet species plaque. Botanical green, museum ivory, or midnight slate.'],
        ['A gift with a story', 'Make one for a keeper friend, or build a matching set for your collection. Different geckos can share a palette and collection code.'],
      ].map(([title, text]) => <div key={title} className={cardSurface}><h3 className="font-semibold text-stone-100">{title}</h3><p className="text-sm leading-relaxed mt-3 text-slate-400">{text}</p></div>)}
    </section>

    <section className="mb-8" aria-labelledby="sticker-faq-title"><h2 id="sticker-faq-title" className="text-xl font-semibold text-stone-100 mb-4">A few things before you make yours.</h2><div className="space-y-2">{[
      ['Is the enclosure plaque a hard sign?', 'It’s a landscape vinyl sticker with an elegant plaque design, not engraved metal or a rigid board. Apply it to a clean, dry surface on the outside of the enclosure.'],
      ['Will my gecko be turned into generated art?', 'Your uploaded photo is used in the design. The illustrated templates are samples; they do not redraw your gecko. The cutout editor lets you erase the background yourself.'],
      ['What size should I choose?', 'Sizes refer to the longest edge. The preview shows the exact width and height. Pick 3 or 4 inches if your design has detailed moves or species information.'],
      ['When will it arrive?', 'Ordering is currently closed. Production and delivery timing must be confirmed before sales open; we do not promise a date from a digital preview.'],
      ['Can I save a design or make a set?', 'Yes. Save a design file to reopen later, or download a proof. Start another design for the next gecko and reuse the collection code for a matching set. Unsaved local photos need to be added again when you resume.'],
    ].map(([question, answer]) => <details key={question} className="rounded-xl border border-slate-800 p-4"><summary className="cursor-pointer text-sm font-medium text-slate-200">{question}</summary><p className="mt-3 text-sm leading-relaxed text-slate-400">{answer}</p></details>)}</div></section>
  </StoreLayout>;
}
