import { useEffect, useRef, useState } from 'react';
import { Monitor, Smartphone, ArrowUp, ArrowDown, Plus, Trash2, Undo2, Redo2, Palette, Layers, Type } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { normalizeWebsite, WEBSITE_TEMPLATES, DEFAULT_WEBSITE } from '@/lib/storeWebsite';
import { normalizeContactUrl } from '@/lib/storeWebsite';
import StorefrontWebsite from './StorefrontWebsite';

const inputClass = 'bg-slate-950 border-slate-700 text-slate-100';
function Field({ label, id, children }) {
  return <div className="space-y-2"><Label htmlFor={id} className="text-slate-300 text-xs">{label}</Label>{children}</div>;
}
function UrlField({ id, value, onChange }) {
  const [draft, setDraft] = useState(value || '');
  useEffect(() => { setDraft(value || ''); }, [value]);
  return <Input id={id} className={inputClass} type="url" placeholder="https://…" value={draft}
    onChange={e => setDraft(e.target.value)} onBlur={() => onChange(draft)} />;
}
function ImageUpload({ label, onChange }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  return <div className="space-y-2">
    <Label className="inline-flex items-center rounded-md border border-slate-700 px-3 py-2 text-xs text-slate-200 cursor-pointer">
      {uploading ? 'Uploading image…' : `Upload ${label}`}
      <input type="file" className="sr-only" aria-label={`Upload ${label}`} accept="image/jpeg,image/png,image/webp,image/gif,image/avif,image/heic,image/heif,.heic,.heif"
        disabled={uploading} onChange={async e => {
          const file = e.target.files?.[0]; e.target.value = '';
          if (!file) return;
          setUploading(true); setError('');
          try {
            const { uploadFile } = await import('@/lib/uploadFile');
            const { file_url } = await uploadFile({ file, folder: 'storefront' });
            onChange(file_url);
          } catch (err) { setError(err.message || 'Could not upload this image.'); }
          finally { setUploading(false); }
        }} />
    </Label>
    {error && <p role="alert" className="text-xs text-rose-300">{error}</p>}
  </div>;
}
function Picker({ label, name, value, choices, onChange }) {
  return <Field label={label} id={`website-${name}`}><select id={`website-${name}`} value={value} onChange={e => onChange(e.target.value)} className={`${inputClass} w-full rounded-md border p-2 text-sm min-h-10`}>
    {choices.map(([key, text]) => <option key={key} value={key}>{text}</option>)}
  </select></Field>;
}
function Range({ label, name, value, min, max, step = 1, unit = '', onChange }) {
  return <Field id={`website-${name}`} label={`${label}: ${value}${unit}`}><input id={`website-${name}`} type="range" className="w-full accent-emerald-500" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))} /></Field>;
}

export default function WebsiteBuilder({ settings, onChange, form, onFormChange, profile, geckos, plans, waitlist }) {
  const w = normalizeWebsite(settings.website);
  const latest = useRef(w);
  latest.current = w;
  const [tab, setTab] = useState('design');
  const [device, setDevice] = useState('desktop');
  const [selected, setSelected] = useState('about');
  const [history, setHistory] = useState({ past: [], future: [] });
  const update = patch => {
    const current = latest.current;
    setHistory(h => ({ past: [...h.past.slice(-29), current], future: [] }));
    onChange({ website: normalizeWebsite({ ...current, ...patch }) });
  };
  const travel = direction => {
    const list = history[direction];
    if (!list.length) return;
    const target = list[list.length - 1];
    setHistory(h => direction === 'past'
      ? { past: h.past.slice(0, -1), future: [...h.future, w] }
      : { past: [...h.past, w], future: h.future.slice(0, -1) });
    onChange({ website: target });
  };
  const section = w.sections.find(s => s.id === selected);
  const editSection = patch => update({ sections: latest.current.sections.map(s => s.id === selected ? { ...s, ...patch } : s) });
  const move = (index, offset) => {
    const next = [...w.sections];
    [next[index], next[index + offset]] = [next[index + offset], next[index]];
    update({ sections: next });
  };
  const customCount = w.sections.filter(s => s.id.startsWith('custom-')).length;
  const previewGeckos = form.featured_gecko_ids.length
    ? form.featured_gecko_ids.map(id => geckos.find(g => g.id === id && g.is_public)).filter(Boolean)
    : geckos.filter(g => g.is_public && /sale/i.test(g.status || '')).slice(0, 12);
  const previewPlans = form.featured_breeding_plan_ids.map(id => plans.find(p => p.id === id && p.is_public)).filter(Boolean)
    .map(p => ({ ...p, sire: geckos.find(g => g.id === p.sire_id), dam: geckos.find(g => g.id === p.dam_id) }));
  return <section className="rounded-xl border border-slate-700 overflow-hidden bg-slate-900" aria-label="Website builder">
    <div className="px-5 py-4 border-b border-slate-700 flex flex-wrap justify-between items-center gap-3">
      <div><h2 className="text-lg font-semibold text-slate-100">Website builder</h2>
        <p className="text-xs text-slate-400 mt-1">Make it yours. Changes go live when you save your store.</p></div>
      <div className="flex items-center gap-1">
        <Button type="button" size="icon" variant="ghost" aria-label="Undo design change" disabled={!history.past.length} onClick={() => travel('past')}><Undo2 className="w-4 h-4" /></Button>
        <Button type="button" size="icon" variant="ghost" aria-label="Redo design change" disabled={!history.future.length} onClick={() => travel('future')}><Redo2 className="w-4 h-4" /></Button>
        <Button type="button" variant="outline" size="sm" onClick={() => update({ ...DEFAULT_WEBSITE, sections: w.sections, logoUrl: w.logoUrl, announcement: w.announcement })}>Reset design</Button>
      </div>
    </div>
    <div className="grid lg:grid-cols-[320px_minmax(0,1fr)]">
      <div className="p-5 space-y-5 lg:border-r border-slate-700">
        <div className="flex gap-1" aria-label="Builder controls">
          {[['design', Palette, 'Design'], ['sections', Layers, 'Sections'], ['brand', Type, 'Brand']].map(([key, Icon, label]) => <button type="button" key={key} onClick={() => setTab(key)} aria-pressed={tab === key} className={`flex-1 flex items-center justify-center gap-1.5 rounded-md px-2 py-2.5 text-xs ${tab === key ? 'bg-emerald-500/15 text-emerald-300' : 'text-slate-400 hover:bg-slate-800'}`}><Icon className="w-3.5 h-3.5" />{label}</button>)}
        </div>
        {tab === 'design' && <div className="space-y-5">
          <Field label="Start with a template"><div className="space-y-2">{Object.entries(WEBSITE_TEMPLATES).map(([key, preset]) => <button key={key} type="button" aria-pressed={w.template === key} onClick={() => { const { label: _label, description: _description, ...style } = preset; update({ ...style, template: key, background: '' }); }} className={`w-full text-left rounded-lg border p-3 ${w.template === key ? 'border-emerald-400 bg-emerald-500/5' : 'border-slate-700'}`}>
            <span className="inline-block w-3 h-3 rounded-full mr-2" style={{ background: preset.accent }} /><span className="text-sm font-medium text-slate-100">{preset.label}</span><p className="text-xs text-slate-400 mt-1">{preset.description}</p>
          </button>)}</div></Field>
          <Picker label="Surface" name="mode" value={w.mode} choices={[[ 'dark', 'Dark'], ['light', 'Light']]} onChange={mode => update({ mode, background: '' })} />
          {[['accent', 'Brand color', '#10b981'], ['background', 'Page background', w.mode === 'light' ? '#faf7f2' : '#0b1210']].map(([key, label, fallback]) => <Field key={key} label={label} id={`website-${key}`}>
            <div className="flex gap-2 items-center"><input id={`website-${key}`} type="color" value={w[key] || fallback} onChange={e => update({ [key]: e.target.value })} className="h-10 w-12 bg-transparent rounded" /><span className="text-xs font-mono text-slate-400">{w[key] || fallback}</span></div>
          </Field>)}
          <Picker label="Heading font" name="font" value={w.font} choices={[[ 'modern', 'Modern sans'], ['editorial', 'Editorial serif'], ['rounded', 'Friendly rounded']]} onChange={font => update({ font })} />
          <Picker label="Hero layout" name="heroLayout" value={w.heroLayout} choices={[[ 'left', 'Left aligned'], ['center', 'Centered'], ['split', 'Split with image']]} onChange={heroLayout => update({ heroLayout })} />
          {[
            ['heroHeight', 'Hero height', 280, 720, 20, 'px'], ['imagePosition', 'Image focal point', 0, 100, 1, '%'],
            ['overlay', 'Image darkening', 0, 90, 5, '%'], ['radius', 'Corner roundness', 0, 32, 2, 'px'],
            ['spacing', 'Section spacing', 24, 112, 8, 'px'], ['width', 'Site width', 800, 1440, 40, 'px'],
            ['columns', 'Gallery columns', 2, 4, 1, ''],
          ].map(([key, label, min, max, step, unit]) => <Range key={key} name={key} label={label} min={min} max={max} step={step} unit={unit} value={w[key]} onChange={value => update({ [key]: value })} />)}
        </div>}
        {tab === 'sections' && <div className="space-y-4">
          <p className="text-xs text-slate-400">Reorder, rename, or hide sections. Empty sections appear once you add content.</p>
          <div className="space-y-2">{w.sections.map((s, i) => <div key={s.id} className={`flex items-center gap-1 rounded-lg border p-2 ${selected === s.id ? 'border-emerald-500' : 'border-slate-700'}`}>
            <input type="checkbox" checked={s.visible} aria-label={`Show ${s.title}`} onChange={e => update({ sections: w.sections.map(row => row.id === s.id ? { ...row, visible: e.target.checked } : row) })} className="accent-emerald-500" />
            <button type="button" className={`text-xs flex-1 text-left px-1 min-h-9 ${s.visible ? 'text-slate-200' : 'text-slate-500'}`} onClick={() => setSelected(s.id)}>{s.title}</button>
            <button type="button" className="p-2 text-slate-400 disabled:opacity-25" disabled={i === 0} aria-label={`Move ${s.title} up`} onClick={() => move(i, -1)}><ArrowUp className="w-3.5 h-3.5" /></button>
            <button type="button" className="p-2 text-slate-400 disabled:opacity-25" disabled={i === w.sections.length - 1} aria-label={`Move ${s.title} down`} onClick={() => move(i, 1)}><ArrowDown className="w-3.5 h-3.5" /></button>
          </div>)}</div>
          <Button type="button" variant="outline" className="w-full" disabled={customCount >= 8} onClick={() => {
            const id = `custom-${crypto.randomUUID()}`;
            update({ sections: [...w.sections, { id, title: 'New section', body: '', imageUrl: '', visible: true }] }); setSelected(id);
          }}><Plus className="w-4 h-4 mr-2" />Add content section ({customCount}/8)</Button>
          {section && <div className="border-t border-slate-700 pt-4 space-y-4">
            <Field label="Section heading" id="website-section-title"><Input id="website-section-title" className={inputClass} maxLength={80} value={section.title} onChange={e => editSection({ title: e.target.value })} /></Field>
            {['about', 'policies'].includes(section.id) && <Field label="Section content" id="website-section-body"><Textarea id="website-section-body" className={inputClass} rows={6} value={form[section.id === 'about' ? 'description' : 'policies']} onChange={e => onFormChange(section.id === 'about' ? 'description' : 'policies', e.target.value)} /></Field>}
            {section.id.startsWith('custom-') && <>
              <Field label="Content" id="website-section-body"><Textarea id="website-section-body" className={inputClass} rows={6} maxLength={6000} value={section.body} onChange={e => editSection({ body: e.target.value })} /></Field>
              <Field label="Image URL (optional)" id="website-section-image"><UrlField key={section.id} id="website-section-image" value={section.imageUrl} onChange={imageUrl => editSection({ imageUrl })} /><ImageUpload label="section image" onChange={imageUrl => editSection({ imageUrl })} /></Field>
              <Button type="button" variant="ghost" className="text-rose-300" onClick={() => { update({ sections: w.sections.filter(s => s.id !== selected) }); setSelected('about'); }}><Trash2 className="w-4 h-4 mr-2" />Remove section</Button>
            </>}
            {['available', 'pairings', 'waitlist', 'reviews'].includes(section.id) && <p className="text-xs text-slate-400">{({ available: 'Choose your featured geckos below. Only public animals appear.', pairings: 'Choose public featured pairings below.', waitlist: 'Choose an open waitlist below.', reviews: 'Verified purchase reviews sync automatically. Reviews cannot be written in the builder.' })[section.id]}</p>}
          </div>}
        </div>}
        {tab === 'brand' && <div className="space-y-4">
          {[['title', 'Business name'], ['tagline', 'Hero tagline'], ['header_image_url', 'Hero image URL'], ['contact_link', 'Contact email or link']].map(([key, label]) => <Field key={key} label={label} id={`website-brand-${key}`}><Input id={`website-brand-${key}`} className={inputClass} value={form[key]} onChange={e => onFormChange(key, e.target.value)} />{key === 'header_image_url' && <ImageUpload label="hero image" onChange={url => onFormChange(key, url)} />}</Field>)}
          {[['logoUrl', 'Logo image URL'], ['announcement', 'Announcement bar'], ['buttonLabel', 'Contact button text']].map(([key, label]) => <Field key={key} label={label} id={`website-${key}`}>{key === 'logoUrl' ? <UrlField id={`website-${key}`} value={w[key]} onChange={logoUrl => update({ logoUrl })} /> : <Input id={`website-${key}`} className={inputClass} value={w[key]} maxLength={key === 'announcement' ? 240 : 60} onChange={e => update({ [key]: e.target.value })} />}{key === 'logoUrl' && <ImageUpload label="logo" onChange={logoUrl => update({ logoUrl })} />}</Field>)}
          <p className="text-xs text-slate-400">Upload an image or use a direct image link. Your name, bio, policies, and featured animals stay connected to the store fields below.</p>
        </div>}
      </div>
      <div className="min-w-0 p-3 md:p-5 bg-slate-950/70">
        <div className="lg:sticky lg:top-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs text-slate-400">Live preview · unsaved changes</span>
            <div className="flex gap-1">{[['desktop', Monitor], ['mobile', Smartphone]].map(([key, Icon]) => <Button key={key} type="button" size="sm" variant={device === key ? 'secondary' : 'ghost'} aria-pressed={device === key} onClick={() => setDevice(key)}><Icon className="w-4 h-4 mr-1.5" />{key === 'desktop' ? 'Desktop' : 'Mobile'}</Button>)}</div>
          </div>
          <div className="mx-auto overflow-y-auto max-h-[760px] border border-slate-700 rounded-xl" style={{ maxWidth: device === 'mobile' ? 390 : '100%' }} onClickCapture={e => {
            // Preview must not navigate away or submit a real inquiry.
            if (e.target.closest('a,button')) e.preventDefault();
            const target = e.target.closest('[id^="website-"]');
            if (target) { setSelected(target.id.replace('website-', '')); setTab('sections'); }
          }}>
            <StorefrontWebsite preview page={{ ...form, contact_link: normalizeContactUrl(form.contact_link) }} profile={{ ...profile, specialty_morphs: String(profile.specialty_morphs || '').split(',').map(s => s.trim()).filter(Boolean) }} settings={settings} geckos={previewGeckos} plans={previewPlans} waitlist={waitlist} onInquire={() => {}} />
          </div>
          <p className="text-[11px] text-slate-500">Uses your public animals and content. Verified reviews and trust records load on the live site.</p>
        </div>
      </div>
    </div>
  </section>;
}
