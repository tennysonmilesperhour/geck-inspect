/**
 * Public-blog data source ,  merges the database-backed blog system with
 * the existing static src/data/blog-posts.js content. Static posts are
 * the editorial/genetics articles that ship with the codebase; DB posts
 * are everything created or AI-generated through the admin panel.
 *
 * Both sources are normalized to a common shape so BlogIndex / BlogPost
 * / category / tag pages can render them through one rendering path.
 *
 *   {
 *     source:               'static' | 'db'
 *     slug, title, description, excerpt
 *     category:             { id, label, slug } | null
 *     tags:                 [{ id?, name, slug }]
 *     datePublished, dateModified, publishedAt
 *     heroEyebrow:          string | null
 *     tldr:                 string[] | null
 *     // exactly one of these is present:
 *     body:                 ContentBlock[] | null    (static)
 *     contentHtml:          string | null            (db, sanitized markdown→html)
 *     // optional:
 *     featuredImageUrl, featuredImageAlt
 *     metaTitle, metaDescription, canonicalUrl
 *     readingTimeMinutes, wordCount
 *     authorName, authorBio, authorAvatarUrl
 *     keyphrase, targetKeyword
 *     internalLinks, externalCitations, faq
 *   }
 *
 * "published" filter rules (must match the public RLS policy):
 *   - DB posts: status === 'published' AND (published_at <= now())
 *   - static posts: always considered published
 */
import { useEffect, useState, useMemo } from 'react';
import { BlogPost, BlogCategory, BlogTag, BlogSettings } from '@/entities/all';
import { BLOG_POSTS as STATIC_BLOG_POSTS, BLOG_CATEGORIES as STATIC_BLOG_CATEGORIES } from '@/data/blog-posts';
import { markdownToHtml } from '@/lib/blog-helpers';

function normalizeStaticPost(post) {
  if (!post) return null;
  const cat = STATIC_BLOG_CATEGORIES.find((c) => c.id === post.category) || null;
  return {
    source: 'static',
    slug: post.slug,
    title: post.title,
    description: post.description,
    excerpt: post.description,
    category: cat ? { id: cat.id, label: cat.label, slug: cat.id } : null,
    tags: Array.isArray(post.tags)
      ? post.tags.map((t) => ({ id: null, name: t, slug: t }))
      : [],
    datePublished: post.datePublished || null,
    dateModified: post.dateModified || post.datePublished || null,
    publishedAt: post.datePublished || null,
    heroEyebrow: post.heroEyebrow || null,
    tldr: Array.isArray(post.tldr) ? post.tldr : null,
    body: Array.isArray(post.body) ? post.body : null,
    contentHtml: null,
    featuredImageUrl: null,
    featuredImageAlt: null,
    metaTitle: post.title,
    metaDescription: post.description,
    canonicalUrl: null,
    readingTimeMinutes: null,
    wordCount: null,
    authorName: null,
    authorBio: null,
    authorAvatarUrl: null,
    keyphrase: post.keyphrase || null,
    targetKeyword: post.keyphrase || null,
    internalLinks: post.internalLinks || [],
    externalCitations: post.externalCitations || [],
    faq: post.faq || [],
  };
}

function normalizeDbPost(post, categoriesById, tagsById) {
  if (!post) return null;
  const cat = post.category_id && categoriesById.get(post.category_id);
  const html = post.content_html
    || (post.content_markdown ? markdownToHtml(post.content_markdown) : null);
  return {
    source: 'db',
    id: post.id,
    slug: post.slug,
    title: post.title,
    description: post.excerpt || post.meta_description || '',
    excerpt: post.excerpt || '',
    category: cat ? { id: cat.id, label: cat.name, slug: cat.slug } : null,
    tags: (post.tag_ids || [])
      .map((id) => tagsById.get(id))
      .filter(Boolean)
      .map((t) => ({ id: t.id, name: t.name, slug: t.slug })),
    datePublished: post.published_at || post.created_date || null,
    dateModified: post.updated_date || post.published_at || null,
    publishedAt: post.published_at || null,
    heroEyebrow: cat ? cat.name : null,
    tldr: null,
    body: null,
    contentHtml: html,
    featuredImageUrl: post.featured_image_url || null,
    featuredImageAlt: post.featured_image_alt || null,
    metaTitle: post.meta_title || post.title,
    metaDescription: post.meta_description || post.excerpt || '',
    canonicalUrl: post.canonical_url || null,
    readingTimeMinutes: post.reading_time_minutes || null,
    wordCount: post.word_count || null,
    authorName: post.author_name || null,
    authorBio: post.author_bio || null,
    authorAvatarUrl: post.author_avatar_url || null,
    keyphrase: post.target_keyword || null,
    targetKeyword: post.target_keyword || null,
    internalLinks: [],
    externalCitations: [],
    faq: [],
  };
}

const STATIC_POSTS_NORMALIZED = STATIC_BLOG_POSTS
  .map(normalizeStaticPost)
  .filter(Boolean);

const STATIC_CATEGORIES = STATIC_BLOG_CATEGORIES.map((c) => ({
  id: c.id,
  name: c.label,
  slug: c.id,
  description: c.description,
  is_active: true,
  source: 'static',
}));

/**
 * useBlogContent ,  returns { posts, categories, tags, settings, loading }.
 *
 * The hook is a one-shot load; the public blog routes don't need realtime
 * updates, and a refresh on next navigation is fine. Errors fall back to
 * the static-only dataset so the public blog never goes blank because of
 * an RLS or network hiccup.
 */
export function useBlogContent() {
  const [dbPosts, setDbPosts] = useState([]);
  const [dbCategories, setDbCategories] = useState([]);
  const [dbTags, setDbTags] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [posts, cats, tags, sets] = await Promise.all([
          BlogPost.filter({ status: 'published' }, '-published_at').catch(() => []),
          BlogCategory.list().catch(() => []),
          BlogTag.list().catch(() => []),
          BlogSettings.list().catch(() => []),
        ]);
        if (cancelled) return;
        const nowMs = Date.now();
        // Mirror the public RLS rule client-side as a defense-in-depth
        // ,  a scheduled post should never appear on the public site even
        // if a misconfigured policy slipped through.
        const visiblePosts = (posts || []).filter(
          (p) => p.status === 'published'
                 && (!p.published_at || new Date(p.published_at).getTime() <= nowMs)
        );
        setDbPosts(visiblePosts);
        setDbCategories(cats || []);
        setDbTags(tags || []);
        setSettings((sets && sets[0]) || null);
      } catch (err) {
        console.error('[useBlogContent] load failed:', err);
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const merged = useMemo(() => {
    const categoriesById = new Map(dbCategories.map((c) => [c.id, c]));
    const tagsById = new Map(dbTags.map((t) => [t.id, t]));

    const normalizedDb = dbPosts
      .map((p) => normalizeDbPost(p, categoriesById, tagsById))
      .filter(Boolean);

    // DB posts win on slug collisions so admins can override a static post.
    const dbSlugs = new Set(normalizedDb.map((p) => p.slug));
    const allPosts = [
      ...normalizedDb,
      ...STATIC_POSTS_NORMALIZED.filter((p) => !dbSlugs.has(p.slug)),
    ].sort((a, b) => {
      const at = new Date(a.publishedAt || a.datePublished || 0).getTime();
      const bt = new Date(b.publishedAt || b.datePublished || 0).getTime();
      return bt - at;
    });

    // Categories: static first, then any DB-only categories that have
    // visible posts.
    const staticSlugs = new Set(STATIC_CATEGORIES.map((c) => c.slug));
    const dbVisibleCategorySlugs = new Set(
      normalizedDb.map((p) => p.category?.slug).filter(Boolean)
    );
    const dbExtraCategories = dbCategories
      .filter((c) => c.is_active !== false)
      .filter((c) => dbVisibleCategorySlugs.has(c.slug))
      .filter((c) => !staticSlugs.has(c.slug))
      .map((c) => ({
        id: c.id, name: c.name, slug: c.slug, description: c.description, is_active: true, source: 'db',
      }));
    const allCategories = [...STATIC_CATEGORIES, ...dbExtraCategories];

    // Tags: only the DB ones surface on the public site for now (static
    // posts don't have first-class tag pages).
    const dbVisibleTagSlugs = new Set();
    for (const p of normalizedDb) {
      for (const t of p.tags || []) dbVisibleTagSlugs.add(t.slug);
    }
    const allTags = dbTags
      .filter((t) => t.is_active !== false)
      .filter((t) => dbVisibleTagSlugs.has(t.slug));

    return { posts: allPosts, categories: allCategories, tags: allTags };
  }, [dbPosts, dbCategories, dbTags]);

  return {
    ...merged,
    settings,
    loading,
  };
}

export function findPostBySlug(posts, slug) {
  if (!Array.isArray(posts) || !slug) return null;
  return posts.find((p) => p.slug === slug) || null;
}

export function postsForCategorySlug(posts, slug) {
  if (!Array.isArray(posts) || !slug) return [];
  return posts.filter((p) => p.category?.slug === slug);
}

export function postsForTagSlug(posts, slug) {
  if (!Array.isArray(posts) || !slug) return [];
  return posts.filter(
    (p) => Array.isArray(p.tags) && p.tags.some((t) => t.slug === slug)
  );
}

export function relatedPosts(posts, current, limit = 3) {
  if (!Array.isArray(posts) || !current) return [];
  const sameCategory = posts.filter(
    (p) => p.slug !== current.slug && p.category?.slug === current.category?.slug
  );
  const fallback = posts.filter((p) => p.slug !== current.slug);
  const out = [];
  const seen = new Set();
  for (const p of [...sameCategory, ...fallback]) {
    if (seen.has(p.slug)) continue;
    seen.add(p.slug);
    out.push(p);
    if (out.length >= limit) break;
  }
  return out;
}
