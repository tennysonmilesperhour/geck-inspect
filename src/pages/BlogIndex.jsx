import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, Search, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import Seo from '@/components/seo/Seo';
import PublicPageShell from '@/components/public/PublicPageShell';
import { BLOG_POSTS as STATIC_BLOG_POSTS } from '@/data/blog-posts';
import {
  breadcrumbSchema,
  ORG_ID,
  SITE_URL,
} from '@/lib/organization-schema';
import { authorSchema, editorialFor } from '@/lib/editorial';
import { useBlogContent } from '@/lib/blog-data-source';

/**
 * Blog index — renders the merged dataset (static-prerendered editorial
 * content + admin-published DB posts) with search, category/tag filters,
 * and pagination governed by the BlogSettings.posts_per_page value.
 *
 * The JSON-LD payload is built from STATIC_BLOG_POSTS only so the
 * prerendered HTML the build step produces stays stable for crawlers
 * (DB posts are added client-side after hydration).
 */
export default function BlogIndex() {
  const { posts, categories, tags, settings, loading } = useBlogContent();

  const [search, setSearch] = useState('');
  const [categorySlug, setCategorySlug] = useState('all');
  const [tagSlug, setTagSlug] = useState('all');
  const [page, setPage] = useState(1);

  const blogEnabled = settings ? settings.blog_enabled !== false : true;
  const perPage = settings?.posts_per_page || 12;
  const blogName = settings?.blog_name || 'Crested Gecko Blog';
  const blogDescription = settings?.blog_description
    || 'Long-form crested gecko genetics, breeding, and care articles from the Geck Inspect editorial team — built on the Foundation Genetics consensus.';

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return posts.filter((p) => {
      if (categorySlug !== 'all' && p.category?.slug !== categorySlug) return false;
      if (tagSlug !== 'all' && !(p.tags || []).some((t) => t.slug === tagSlug)) return false;
      if (!q) return true;
      const hay = [p.title, p.description, p.excerpt, p.keyphrase, p.targetKeyword]
        .filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [posts, search, categorySlug, tagSlug]);

  const visible = filtered.slice(0, page * perPage);
  const hasMore = visible.length < filtered.length;

  const path = '/blog';
  const url = `${SITE_URL}${path}`;
  const editorial = editorialFor(path);

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'Blog',
      '@id': `${url}#blog`,
      name: blogName,
      description: blogDescription,
      url,
      inLanguage: 'en-US',
      publisher: { '@id': ORG_ID },
      author: authorSchema(),
      datePublished: editorial.published,
      dateModified: editorial.modified,
      blogPost: STATIC_BLOG_POSTS.map((p) => ({
        '@type': 'BlogPosting',
        '@id': `${SITE_URL}/blog/${p.slug}#article`,
        headline: p.title,
        url: `${SITE_URL}/blog/${p.slug}`,
        datePublished: p.datePublished,
        dateModified: p.dateModified || p.datePublished,
      })),
    },
    breadcrumbSchema([
      { name: 'Home', path: '/' },
      { name: 'Blog', path: '/blog' },
    ]),
  ];

  if (!blogEnabled) {
    return (
      <PublicPageShell>
        <Seo
          title="Blog"
          description="The blog is currently unavailable."
          path={path}
          noIndex
        />
        <section className="max-w-3xl mx-auto px-6 py-20 text-center">
          <h1 className="text-3xl font-bold text-slate-100 mb-3">Blog unavailable</h1>
          <p className="text-slate-400">
            The blog is currently disabled. Please check back later.
          </p>
        </section>
      </PublicPageShell>
    );
  }

  return (
    <PublicPageShell>
      <Seo
        title={blogName}
        description={blogDescription}
        path={path}
        type="website"
        keywords={[
          'crested gecko blog',
          'crested gecko genetics',
          'crested gecko breeding',
          'foundation genetics',
        ]}
        jsonLd={jsonLd}
      />

      <article className="max-w-5xl mx-auto px-6 pt-6 pb-16">
        <div className="flex items-center gap-2 text-xs text-slate-500 mb-4">
          <Link to="/" className="hover:text-slate-300">Home</Link>
          <span>/</span>
          <span className="text-slate-400">Blog</span>
        </div>

        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300 mb-4">
          <BookOpen className="w-3.5 h-3.5" />
          Geck Inspect Editorial
        </div>

        <h1 className="text-3xl md:text-5xl font-bold tracking-tight leading-[1.1] mb-4 bg-gradient-to-b from-white to-emerald-200 bg-clip-text text-transparent">
          {blogName}
        </h1>
        <p className="text-slate-400 text-base md:text-lg max-w-3xl mb-8 leading-relaxed">
          {blogDescription}
        </p>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-8">
          <div className="relative md:col-span-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <Input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search posts…"
              className="pl-9 bg-slate-900/60 border-slate-800 text-slate-100"
            />
          </div>
          <Select
            value={categorySlug}
            onValueChange={(v) => { setCategorySlug(v); setPage(1); }}
          >
            <SelectTrigger className="bg-slate-900/60 border-slate-800 text-slate-100">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.slug} value={c.slug}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={tagSlug}
            onValueChange={(v) => { setTagSlug(v); setPage(1); }}
          >
            <SelectTrigger className="bg-slate-900/60 border-slate-800 text-slate-100">
              <SelectValue placeholder="All tags" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All tags</SelectItem>
              {tags.length === 0 && (
                <SelectItem value="__none__" disabled>(no tags yet)</SelectItem>
              )}
              {tags.map((t) => (
                <SelectItem key={t.slug} value={t.slug}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {loading && posts.length === 0 ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 text-slate-500 animate-spin" />
          </div>
        ) : visible.length === 0 ? (
          <p className="text-slate-500 italic">
            {posts.length === 0
              ? 'New posts publishing soon. Check back shortly.'
              : 'No posts match the current filter.'}
          </p>
        ) : (
          <>
            {/* Featured = first post */}
            <FeaturedCard post={visible[0]} />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
              {visible.slice(1).map((post) => (
                <PostCard key={post.slug} post={post} />
              ))}
            </div>

            {hasMore && (
              <div className="flex justify-center mt-10">
                <Button
                  variant="outline"
                  onClick={() => setPage((p) => p + 1)}
                  className="border-emerald-500/30 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20"
                >
                  Load more
                </Button>
              </div>
            )}
          </>
        )}
      </article>
    </PublicPageShell>
  );
}

function FeaturedCard({ post }) {
  return (
    <Link
      to={`/blog/${post.slug}`}
      className="group block rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/30 via-slate-900/60 to-slate-900/60 hover:border-emerald-400/50 p-6 transition-colors"
    >
      <div className="flex flex-col md:flex-row gap-5">
        {post.featuredImageUrl && (
          <img
            src={post.featuredImageUrl}
            alt={post.featuredImageAlt || post.title}
            className="md:w-72 w-full aspect-[16/9] object-cover rounded-xl border border-slate-800"
            loading="lazy"
          />
        )}
        <div className="flex-1 min-w-0">
          <div className="text-xs uppercase tracking-wider text-emerald-300 mb-2">
            {post.heroEyebrow || post.category?.label || 'Article'}
          </div>
          <h2 className="text-2xl md:text-3xl font-bold text-slate-100 leading-tight mb-2 group-hover:text-emerald-200">
            {post.title}
          </h2>
          <p className="text-sm md:text-base text-slate-400 leading-relaxed mb-4 line-clamp-3">
            {post.description || post.excerpt}
          </p>
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>
              {post.dateModified ? `Updated ${post.dateModified}` : post.datePublished}
              {post.readingTimeMinutes ? ` · ${post.readingTimeMinutes} min read` : ''}
            </span>
            <span className="inline-flex items-center gap-1 text-emerald-300 group-hover:translate-x-0.5 transition-transform">
              Read <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

function PostCard({ post }) {
  return (
    <Link
      to={`/blog/${post.slug}`}
      className="group block rounded-2xl border border-slate-800 bg-slate-900/50 hover:border-emerald-500/30 hover:bg-slate-900 p-5 transition-colors"
    >
      {post.featuredImageUrl && (
        <img
          src={post.featuredImageUrl}
          alt={post.featuredImageAlt || post.title}
          className="w-full aspect-[16/9] object-cover rounded-lg border border-slate-800 mb-3"
          loading="lazy"
        />
      )}
      <div className="text-xs uppercase tracking-wider text-emerald-300 mb-2">
        {post.heroEyebrow || post.category?.label || 'Article'}
      </div>
      <h3 className="text-lg md:text-xl font-bold text-slate-100 leading-snug mb-2 group-hover:text-emerald-200">
        {post.title}
      </h3>
      <p className="text-sm text-slate-400 leading-relaxed mb-4 line-clamp-3">
        {post.description || post.excerpt}
      </p>
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>
          {post.dateModified || post.datePublished || ''}
        </span>
        <span className="inline-flex items-center gap-1 text-emerald-300 group-hover:translate-x-0.5 transition-transform">
          Read <ArrowRight className="w-3.5 h-3.5" />
        </span>
      </div>
    </Link>
  );
}
