// Versioned, bounded data only. Public sites never execute member HTML or CSS.
export const WEBSITE_SECTIONS = [
  ['about', 'About'], ['available', 'Collection'], ['pairings', 'Pairings'],
  ['waitlist', 'Waitlist'], ['policies', 'Policies'], ['reviews', 'Reviews'], ['contact', 'Contact'],
];
export const WEBSITE_FONTS = {
  modern: 'Inter, ui-sans-serif, system-ui, sans-serif',
  editorial: 'Georgia, "Times New Roman", serif',
  rounded: '"Trebuchet MS", ui-sans-serif, sans-serif',
};
export const WEBSITE_TEMPLATES = {
  studio: { label: 'Studio', description: 'Clean, confident, generous space', mode: 'dark', font: 'modern', heroLayout: 'left', heroHeight: 480, radius: 18, spacing: 64, columns: 3, accent: '#10b981' },
  editorial: { label: 'Editorial', description: 'Warm paper and elegant type', mode: 'light', font: 'editorial', heroLayout: 'center', heroHeight: 560, radius: 4, spacing: 88, columns: 2, accent: '#84643d' },
  botanical: { label: 'Botanical', description: 'Soft shapes and forest tones', mode: 'dark', font: 'rounded', heroLayout: 'split', heroHeight: 420, radius: 28, spacing: 48, columns: 4, accent: '#84cc16' },
};
export const DEFAULT_WEBSITE = {
  version: 1, template: 'studio', mode: 'dark', accent: '', background: '',
  font: 'modern', heroLayout: 'left', heroHeight: 480, imagePosition: 50,
  overlay: 55, radius: 18, spacing: 64, width: 1120, columns: 3,
  logoUrl: '', announcement: '', buttonLabel: 'Contact breeder',
  sections: WEBSITE_SECTIONS.map(([id, title]) => ({ id, title, visible: true })),
};
const string = (v, limit = 200) => typeof v === 'string' ? v.slice(0, limit) : '';
const color = v => /^#[0-9a-f]{6}$/i.test(v || '') ? v : '';
const choice = (v, values, fallback) => values.includes(v) ? v : fallback;
const number = (v, min, max, fallback) => typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;
export function safeWebsiteUrl(value, contact = false) {
  const raw = string(value, 2048).trim();
  if (!raw) return '';
  try {
    const url = new URL(raw);
    return (contact ? ['https:', 'http:', 'mailto:', 'tel:'] : ['https:', 'http:']).includes(url.protocol) && !url.username && !url.password ? raw : '';
  } catch { return ''; }
}
export function normalizeWebsite(value) {
  const v = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const sections = [];
  const seen = new Set();
  for (const row of Array.isArray(v.sections) ? v.sections.slice(0, 15) : []) {
    if (!row || typeof row !== 'object') continue;
    const known = WEBSITE_SECTIONS.find(([id]) => id === row.id);
    const custom = typeof row.id === 'string' && /^custom-[a-z0-9-]{1,60}$/.test(row.id);
    if ((!known && !custom) || seen.has(row.id) || (custom && sections.filter(s => s.id.startsWith('custom-')).length >= 8)) continue;
    seen.add(row.id);
    sections.push({ id: row.id, title: string(row.title, 80) || known?.[1] || 'New section', visible: row.visible !== false,
      ...(custom ? { body: string(row.body, 6000), imageUrl: safeWebsiteUrl(row.imageUrl) } : {}) });
  }
  for (const [id, title] of WEBSITE_SECTIONS) if (!seen.has(id)) sections.push({ id, title, visible: true });
  return {
    version: 1,
    template: choice(v.template, Object.keys(WEBSITE_TEMPLATES), 'studio'),
    mode: choice(v.mode, ['dark', 'light'], 'dark'), accent: color(v.accent), background: color(v.background),
    font: choice(v.font, Object.keys(WEBSITE_FONTS), 'modern'),
    heroLayout: choice(v.heroLayout, ['left', 'center', 'split'], 'left'),
    heroHeight: number(v.heroHeight, 280, 720, 480), imagePosition: number(v.imagePosition, 0, 100, 50),
    overlay: number(v.overlay, 0, 90, 55), radius: number(v.radius, 0, 32, 18),
    spacing: number(v.spacing, 24, 112, 64), width: number(v.width, 800, 1440, 1120),
    columns: number(v.columns, 2, 4, 3), logoUrl: safeWebsiteUrl(v.logoUrl),
    announcement: string(v.announcement, 240), buttonLabel: string(v.buttonLabel, 60) || 'Contact breeder', sections,
  };
}
export function websitePalette(value, themeAccent = '#10b981') {
  const w = normalizeWebsite(value);
  const bg = w.background || (w.mode === 'light' ? '#faf7f2' : '#0b1210');
  const luminance = hex => {
    const rgb = hex.slice(1).match(/../g).map(x => parseInt(x, 16) / 255).map(x => x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4);
    return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
  };
  const dark = luminance(bg) < .179;
  const accent = w.accent || color(themeAccent) || '#10b981';
  return { background: bg, text: dark ? '#f5f5f0' : '#1c241f', muted: dark ? '#b2bcb5' : '#535c55',
    panel: dark ? '#17221c' : '#ffffff', border: dark ? '#35433a' : '#d7ddd5', accent,
    buttonText: luminance(accent) > .179 ? '#07110a' : '#ffffff' };
}

export function normalizeContactUrl(value) {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return '';
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) return safeWebsiteUrl(`mailto:${raw}`, true);
  return safeWebsiteUrl(/^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`, true);
}
