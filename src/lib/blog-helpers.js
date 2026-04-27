/**
 * Pure helpers shared between the admin blog editor, the AI generator,
 * the public blog routes, and the SEO checklist. Kept dependency-free so
 * unit logic stays easy to reason about.
 */

const SLUG_MAX = 80;

export function slugify(input) {
  if (!input || typeof input !== 'string') return '';
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['"`’]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_MAX)
    .replace(/-+$/g, '');
}

const HTML_TAG_RE = /<[^>]+>/g;
const WS_RE = /\s+/g;

export function stripHtml(html) {
  if (!html || typeof html !== 'string') return '';
  return html.replace(HTML_TAG_RE, ' ').replace(WS_RE, ' ').trim();
}

export function countWords(text) {
  if (!text) return 0;
  const stripped = stripHtml(typeof text === 'string' ? text : String(text));
  if (!stripped) return 0;
  return stripped.split(WS_RE).filter(Boolean).length;
}

// ~225 wpm is the conventional reading speed used by Medium / WordPress.
// Round up so a tiny post still reads as "1 min" not "0 min".
export function readingTimeMinutes(text) {
  const words = countWords(text);
  if (!words) return 0;
  return Math.max(1, Math.round(words / 225));
}

export function buildSeoChecklist(post) {
  if (!post) post = {};
  return [
    { id: 'title',          label: 'Title exists',                ok: !!String(post.title || '').trim() },
    { id: 'slug',           label: 'Slug exists',                 ok: !!String(post.slug || '').trim() },
    { id: 'meta_title',     label: 'Meta title exists',           ok: !!String(post.meta_title || '').trim() },
    { id: 'meta_desc',      label: 'Meta description exists',     ok: !!String(post.meta_description || '').trim() },
    { id: 'content',        label: 'Content exists',              ok: countWords(post.content_markdown || post.content_html) > 0 },
    { id: 'featured_alt',   label: 'Featured image alt text',     ok: !!String(post.featured_image_alt || '').trim() },
    { id: 'target_keyword', label: 'Target keyword set',          ok: !!String(post.target_keyword || '').trim() },
  ];
}

// Required for publishing (per the spec): title, slug, content. Everything
// else is recommended but not blocking.
export function canPublish(post) {
  if (!post) return false;
  const hasTitle = !!String(post.title || '').trim();
  const hasSlug = !!String(post.slug || '').trim();
  const hasContent = countWords(post.content_markdown || post.content_html) > 0;
  return hasTitle && hasSlug && hasContent;
}

// Naive-but-safe markdown→HTML for the public blog renderer. Handles the
// blocks the AI generator emits (headings, paragraphs, lists, blockquotes,
// inline emphasis, links, code spans). Not a full CommonMark parser — but
// the AI generator is constrained to this subset, and admins editing
// markdown by hand get a live HTML preview either way.
export function markdownToHtml(md) {
  if (!md || typeof md !== 'string') return '';

  const escape = (s) => s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const inline = (s) =>
    escape(s)
      // images: ![alt](url)
      .replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g,
        '<img src="$2" alt="$1" loading="lazy" class="rounded-lg my-4" />')
      // links: [text](url)
      .replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g,
        '<a href="$2" rel="noopener" target="_blank">$1</a>')
      // bold
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      // italic
      .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
      // inline code
      .replace(/`([^`]+)`/g, '<code>$1</code>');

  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // skip blank lines
    if (!line.trim()) { i += 1; continue; }

    // heading
    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      const level = heading[1].length;
      out.push(`<h${level}>${inline(heading[2].trim())}</h${level}>`);
      i += 1;
      continue;
    }

    // unordered list
    if (/^[-*+]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^[-*+]\s+/.test(lines[i])) {
        items.push(`<li>${inline(lines[i].replace(/^[-*+]\s+/, ''))}</li>`);
        i += 1;
      }
      out.push(`<ul>${items.join('')}</ul>`);
      continue;
    }

    // ordered list
    if (/^\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push(`<li>${inline(lines[i].replace(/^\d+\.\s+/, ''))}</li>`);
        i += 1;
      }
      out.push(`<ol>${items.join('')}</ol>`);
      continue;
    }

    // blockquote
    if (/^>\s?/.test(line)) {
      const buf = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        buf.push(lines[i].replace(/^>\s?/, ''));
        i += 1;
      }
      out.push(`<blockquote>${inline(buf.join(' '))}</blockquote>`);
      continue;
    }

    // paragraph (consume until blank line)
    const buf = [line];
    i += 1;
    while (i < lines.length && lines[i].trim() && !/^(#{1,6}\s|[-*+]\s|\d+\.\s|>\s?)/.test(lines[i])) {
      buf.push(lines[i]);
      i += 1;
    }
    out.push(`<p>${inline(buf.join(' '))}</p>`);
  }

  return out.join('\n');
}

export const BLOG_POST_STATUSES = ['draft', 'scheduled', 'published', 'archived'];

export const BLOG_LOG_EVENT_LABELS = {
  blog_settings_updated: 'Settings updated',
  post_created:          'Post created',
  post_updated:          'Post updated',
  post_ai_generated:     'Post generated with AI',
  post_scheduled:        'Post scheduled',
  post_published:        'Post published',
  post_archived:         'Post archived',
  post_publish_failed:   'Publishing failed',
};
