import { Link } from 'react-router-dom';
import { Mail, Sparkles, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DEFAULT_GECKO_IMAGE } from '@/lib/constants';

// ---------------------------------------------------------------------------
// Mini-site settings storage
//
// breeder_store_pages has no theme, availability, or waitlist columns, so the
// per-page settings ride along inside the external_links jsonb array as
// reserved entries whose `kind` starts with an underscore:
//
//   { kind: '_theme',          value: 'violet',  url: 'geck:violet' }
//   { kind: '_show_available', value: false,     url: 'geck:false' }
//   { kind: '_waitlist_id',    value: '<uuid>',  url: 'geck:<uuid>' }
//
// Rules for anything that touches external_links:
//   1. Link rendering must ignore entries whose kind starts with '_'
//      (use publicExternalLinks below).
//   2. The `url` field mirrors the value behind a 'geck:' scheme. MyStore's
//      save pipeline normalizes every url and drops url-less rows, and url
//      values that already carry a scheme pass through untouched, so this
//      keeps the reserved entries intact across a MyStore save.
//   3. Readers prefer `value` and fall back to parsing the 'geck:' url.
// ---------------------------------------------------------------------------

export const RESERVED_LINK_PREFIX = '_';

export const DEFAULT_STORE_SETTINGS = {
  theme: 'emerald',
  showAvailable: true,
  waitlistId: null,
};

// Accent presets. Every Tailwind class used here is written out in full so
// the JIT compiler picks it up; do not build these class names dynamically.
export const STORE_THEMES = {
  emerald: {
    key: 'emerald',
    label: 'Emerald',
    swatchHex: '#10b981',
    text: 'text-emerald-300',
    icon: 'text-emerald-400',
    badge: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-200',
    solidBtn: 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/20',
    outlineBtn: 'border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-200',
    hoverBorder: 'hover:border-emerald-500/40',
    panel: 'border-emerald-500/30 from-emerald-950/40',
    price: 'text-emerald-300',
    bannerGradient: 'linear-gradient(135deg, #064e3b, #022c22)',
  },
  violet: {
    key: 'violet',
    label: 'Violet',
    swatchHex: '#8b5cf6',
    text: 'text-violet-300',
    icon: 'text-violet-400',
    badge: 'border-violet-500/25 bg-violet-500/10 text-violet-200',
    solidBtn: 'bg-violet-600 hover:bg-violet-500 shadow-violet-500/20',
    outlineBtn: 'border-violet-500/40 bg-violet-500/10 hover:bg-violet-500/20 text-violet-200',
    hoverBorder: 'hover:border-violet-500/40',
    panel: 'border-violet-500/30 from-violet-950/40',
    price: 'text-violet-300',
    bannerGradient: 'linear-gradient(135deg, #4c1d95, #2e1065)',
  },
  amber: {
    key: 'amber',
    label: 'Amber',
    swatchHex: '#f59e0b',
    text: 'text-amber-300',
    icon: 'text-amber-400',
    badge: 'border-amber-500/25 bg-amber-500/10 text-amber-200',
    solidBtn: 'bg-amber-600 hover:bg-amber-500 shadow-amber-500/20',
    outlineBtn: 'border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-200',
    hoverBorder: 'hover:border-amber-500/40',
    panel: 'border-amber-500/30 from-amber-950/40',
    price: 'text-amber-300',
    bannerGradient: 'linear-gradient(135deg, #92400e, #451a03)',
  },
  rose: {
    key: 'rose',
    label: 'Rose',
    swatchHex: '#f43f5e',
    text: 'text-rose-300',
    icon: 'text-rose-400',
    badge: 'border-rose-500/25 bg-rose-500/10 text-rose-200',
    solidBtn: 'bg-rose-600 hover:bg-rose-500 shadow-rose-500/20',
    outlineBtn: 'border-rose-500/40 bg-rose-500/10 hover:bg-rose-500/20 text-rose-200',
    hoverBorder: 'hover:border-rose-500/40',
    panel: 'border-rose-500/30 from-rose-950/40',
    price: 'text-rose-300',
    bannerGradient: 'linear-gradient(135deg, #9f1239, #4c0519)',
  },
};

export function themeFor(key) {
  return STORE_THEMES[key] || STORE_THEMES.emerald;
}

export function isReservedLink(entry) {
  return String(entry?.kind || '').startsWith(RESERVED_LINK_PREFIX);
}

// The external links that should actually render as links. Every consumer of
// breeder_store_pages.external_links should map over this, never the raw
// array, so reserved settings entries stay invisible.
export function publicExternalLinks(externalLinks) {
  return (Array.isArray(externalLinks) ? externalLinks : []).filter((l) => !isReservedLink(l));
}

function reservedValue(entry) {
  if (entry?.value !== undefined && entry.value !== null) return entry.value;
  const url = String(entry?.url || '');
  return url.startsWith('geck:') ? url.slice(5) : url;
}

export function readStoreSettings(externalLinks) {
  const settings = { ...DEFAULT_STORE_SETTINGS };
  for (const entry of Array.isArray(externalLinks) ? externalLinks : []) {
    if (!isReservedLink(entry)) continue;
    const v = reservedValue(entry);
    if (entry.kind === '_theme' && STORE_THEMES[v]) settings.theme = v;
    if (entry.kind === '_show_available') settings.showAvailable = !(v === false || v === 'false');
    if (entry.kind === '_waitlist_id' && v) settings.waitlistId = String(v);
  }
  return settings;
}

function reservedEntry(kind, value) {
  return { kind, label: kind, value, url: `geck:${value}` };
}

// Returns a new external_links array: real links preserved as-is, reserved
// settings entries rewritten from `settings`.
export function applyStoreSettings(externalLinks, settings) {
  const out = publicExternalLinks(externalLinks);
  out.push(reservedEntry('_theme', themeFor(settings?.theme).key));
  out.push(reservedEntry('_show_available', settings?.showAvailable !== false));
  if (settings?.waitlistId) out.push(reservedEntry('_waitlist_id', settings.waitlistId));
  return out;
}

// ---------------------------------------------------------------------------
// Shared render pieces for the public breeder page
// ---------------------------------------------------------------------------

export function geckoDetailHref(gecko) {
  return gecko?.passport_code
    ? `/passport/${gecko.passport_code}`
    : `/GeckoDetail?id=${gecko?.id}`;
}

function MorphTags({ morphs, theme }) {
  const tags = String(morphs || '')
    .split(/[,/]+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 3);
  if (tags.length === 0) {
    return <p className="text-xs text-slate-500 truncate mt-1">Crested gecko</p>;
  }
  return (
    <div className="flex flex-wrap gap-1 mt-1.5">
      {tags.map((t) => (
        <span
          key={t}
          className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${theme.badge}`}
        >
          {t}
        </span>
      ))}
    </div>
  );
}

function AvailableTile({ gecko, theme, onInquire }) {
  return (
    <div
      className={`group relative rounded-xl overflow-hidden border border-slate-800 bg-slate-900/60 ${theme.hoverBorder} transition-colors flex flex-col`}
    >
      <Link to={geckoDetailHref(gecko)} className="block flex-1">
        <div className="aspect-square bg-slate-800">
          <img
            src={gecko.image_urls?.[0] || DEFAULT_GECKO_IMAGE}
            alt={gecko.name || 'Crested gecko for sale'}
            className="w-full h-full object-cover group-hover:opacity-90 transition-opacity"
            loading="lazy"
            decoding="async"
          />
        </div>
        <div className="p-3">
          <p className="text-sm font-semibold text-slate-100 truncate">
            {gecko.name || 'Unnamed gecko'}
          </p>
          <MorphTags morphs={gecko.morphs_traits} theme={theme} />
          {gecko.asking_price != null && (
            <p className={`text-sm font-bold mt-1.5 ${theme.price}`}>${gecko.asking_price}</p>
          )}
        </div>
      </Link>
      {onInquire && (
        <button
          type="button"
          onClick={() => onInquire(gecko)}
          className={`mx-3 mb-3 inline-flex items-center justify-center gap-1.5 rounded-lg border ${theme.outlineBtn} text-xs font-semibold py-2 transition-colors`}
        >
          <Mail className="w-3.5 h-3.5" />
          Inquire / reserve
        </button>
      )}
    </div>
  );
}

// "Available now" grid, auto-synced with the breeder's live public For Sale
// geckos. Hides itself entirely when there is nothing to show.
export function AvailableNowSection({ geckos, theme, onInquire }) {
  if (!Array.isArray(geckos) || geckos.length === 0) return null;
  return (
    <section className="max-w-6xl mx-auto px-6 pb-16">
      <div className="flex items-end justify-between mb-5">
        <div>
          <p className={`text-[11px] uppercase tracking-[0.25em] font-semibold mb-1 ${theme.text}`}>
            Current offerings
          </p>
          <h2 className="text-xl md:text-2xl font-bold text-white">Available now</h2>
        </div>
        <span className="text-xs text-slate-500">{geckos.length} listed</span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {geckos.map((g) => (
          <AvailableTile key={g.id} gecko={g} theme={theme} onInquire={onInquire} />
        ))}
      </div>
    </section>
  );
}

// Waitlist call-to-action. Hides itself when no waitlist is attached or the
// attached waitlist is closed.
export function WaitlistCtaSection({ waitlist, theme }) {
  if (!waitlist?.slug) return null;
  const closed =
    !waitlist.is_open ||
    (waitlist.closes_at && new Date(waitlist.closes_at) < new Date());
  if (closed) return null;
  return (
    <section className="max-w-4xl mx-auto px-6 pb-16">
      <div
        className={`rounded-2xl border bg-gradient-to-br ${theme.panel} via-slate-900/60 to-slate-900/40 p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-5`}
      >
        <div className="space-y-2 max-w-xl">
          <p className={`text-[11px] uppercase tracking-[0.25em] font-semibold ${theme.text}`}>
            Waitlist open
          </p>
          <div className="flex items-center gap-2">
            <Sparkles className={`w-5 h-5 ${theme.icon}`} />
            <h2 className="text-lg font-bold text-white">{waitlist.title || 'Join the waitlist'}</h2>
          </div>
          <p className="text-slate-300 text-sm leading-relaxed">
            {waitlist.description
              ? `${waitlist.description.slice(0, 180)}${waitlist.description.length > 180 ? '...' : ''}`
              : 'Drop your name and email, and this breeder will reach out when the gecko or clutch is ready for a new home.'}
          </p>
        </div>
        <Link to={`/waitlist/${waitlist.slug}`}>
          <Button className={`${theme.solidBtn} text-white font-semibold whitespace-nowrap shadow-lg`}>
            Join the waitlist
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </Link>
      </div>
    </section>
  );
}

// The network-effect hook: a subtle line on every public breeder page that
// links back home.
export function BuiltOnGeckInspect({ className = '' }) {
  return (
    <p className={`text-xs text-slate-600 ${className}`}>
      Built on{' '}
      <Link to="/" className="text-slate-400 hover:text-emerald-300 underline underline-offset-2">
        Geck Inspect
      </Link>
      , the crested-gecko-first platform for breeders and keepers.
    </p>
  );
}
