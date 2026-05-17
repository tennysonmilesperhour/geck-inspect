// Typed external links surfaced on a breeder's store page. Each kind
// renders with its own icon + accent color in the storefront footer so
// the row reads as platform buttons, not a wall of generic URLs.
//
// Storage shape (jsonb on breeder_store_pages.external_links):
//   [{ kind: 'morphmarket', label: 'My MorphMarket', url: 'https://...' }, ...]
//
// 'other' is the escape hatch for platforms we don't have an icon for.

export const LINK_KINDS = [
    {
        key: 'morphmarket',
        label: 'MorphMarket',
        placeholder: 'https://www.morphmarket.com/stores/your-store',
        accent: 'border-emerald-600/50 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20',
    },
    {
        key: 'palmstreet',
        label: 'PalmStreet',
        placeholder: 'https://palm.st/your-handle',
        accent: 'border-lime-600/50 bg-lime-500/10 text-lime-200 hover:bg-lime-500/20',
    },
    {
        key: 'instagram',
        label: 'Instagram',
        placeholder: 'https://instagram.com/your-handle',
        accent: 'border-pink-500/50 bg-pink-500/10 text-pink-200 hover:bg-pink-500/20',
    },
    {
        key: 'tiktok',
        label: 'TikTok',
        placeholder: 'https://tiktok.com/@your-handle',
        accent: 'border-slate-400/50 bg-slate-500/10 text-slate-100 hover:bg-slate-500/20',
    },
    {
        key: 'youtube',
        label: 'YouTube',
        placeholder: 'https://youtube.com/@your-channel',
        accent: 'border-red-500/50 bg-red-500/10 text-red-200 hover:bg-red-500/20',
    },
    {
        key: 'facebook',
        label: 'Facebook',
        placeholder: 'https://facebook.com/your-page',
        accent: 'border-blue-500/50 bg-blue-500/10 text-blue-200 hover:bg-blue-500/20',
    },
    {
        key: 'twitter',
        label: 'X / Twitter',
        placeholder: 'https://x.com/your-handle',
        accent: 'border-slate-500/50 bg-slate-700/30 text-slate-100 hover:bg-slate-600/30',
    },
    {
        key: 'website',
        label: 'Website',
        placeholder: 'https://your-website.com',
        accent: 'border-amber-500/50 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20',
    },
    {
        key: 'other',
        label: 'Other',
        placeholder: 'https://...',
        accent: 'border-slate-500/50 bg-slate-700/30 text-slate-200 hover:bg-slate-600/30',
    },
];

export const LINK_KIND_BY_KEY = Object.fromEntries(LINK_KINDS.map((k) => [k.key, k]));

export function linkKindMeta(kind) {
    return LINK_KIND_BY_KEY[kind] || LINK_KIND_BY_KEY.other;
}

// Days a user must wait between slug renames AFTER their first change.
// First change is free so they can correct an auto-filled slug they
// don't like, subsequent changes are rate-limited so external backlinks
// (MorphMarket store URLs, Instagram bios) don't get broken weekly.
export const SLUG_COOLDOWN_DAYS = 30;

export function slugCooldownRemaining(page) {
    if (!page) return 0;
    if (!page.slug_change_count || page.slug_change_count < 1) return 0;
    if (!page.slug_changed_at) return 0;
    const last = new Date(page.slug_changed_at).getTime();
    const elapsedDays = (Date.now() - last) / (1000 * 60 * 60 * 24);
    return Math.max(0, Math.ceil(SLUG_COOLDOWN_DAYS - elapsedDays));
}

export function normalizeSlug(raw) {
    return (raw || '')
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
}

export const SLUG_RE = /^[a-z0-9-]+$/;
