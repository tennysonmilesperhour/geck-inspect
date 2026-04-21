import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen } from 'lucide-react';
import Seo from '@/components/seo/Seo';
import PublicPageShell from '@/components/public/PublicPageShell';
import {
  BLOG_POSTS,
  postsByCategory,
  recentPosts,
} from '@/data/blog-posts';
import {
  breadcrumbSchema,
  ORG_ID,
  SITE_URL,
} from '@/lib/organization-schema';
import { authorSchema, editorialFor } from '@/lib/editorial';

/**
 * Blog index page — lists every published post grouped by category and
 * highlights the newest few. Acts as the topic-cluster hub linking out
 * to every individual /blog/<slug> spoke page.
 */
export default function BlogIndex() {
  const grouped = postsByCategory();
  const recent = recentPosts(6);

  const path = '/blog';
  const url = `${SITE_URL}${path}`;
  const editorial = editorialFor(path);

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'Blog',
      '@id': `${url}#blog`,
      name: 'Geck Inspect Blog',
      description:
        'Long-form crested gecko genetics, breeding, and care articles from the Geck Inspect editorial team — sourced from the Foundation Genetics consensus and the wider hobby.',
      url,
      inLanguage: 'en-US',
      publisher: { '@id': ORG_ID },
      author: authorSchema(),
      datePublished: editorial.published,
      dateModified: editorial.modified,
      blogPost: BLOG_POSTS.map((p) => ({
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

  return (
    <PublicPageShell>
      <Seo
        title="Crested Gecko Blog"
        description="Long-form crested gecko genetics, breeding, and care articles from the Geck Inspect editorial team — built on the Foundation Genetics consensus."
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
          Crested Gecko Blog
        </h1>
        <p className="text-slate-400 text-base md:text-lg max-w-3xl mb-10 leading-relaxed">
          Long-form articles on crested gecko (<em>Correlophus ciliatus</em>) genetics,
          breeding, and care. Every post is grounded in the{' '}
          <a
            href="https://lmreptiles.com/fg-overview/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-emerald-300 hover:underline"
          >
            Foundation Genetics
          </a>{' '}
          consensus and links back to the relevant pages in our{' '}
          <Link to="/MorphGuide" className="text-emerald-300 hover:underline">
            Morph Guide
          </Link>{' '}
          and{' '}
          <Link to="/CareGuide" className="text-emerald-300 hover:underline">
            Care Guide
          </Link>.
        </p>

        {recent.length > 0 && (
          <section className="mb-14">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-4">
              Latest
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {recent.map((post) => (
                <PostCard key={post.slug} post={post} highlight />
              ))}
            </div>
          </section>
        )}

        {grouped.map(({ category, posts }) => (
          <section key={category.id} className="mb-12">
            <h2 className="text-2xl font-bold text-slate-100 mb-2">{category.label}</h2>
            <p className="text-slate-400 text-sm mb-5 max-w-3xl">
              {category.description}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {posts.map((post) => (
                <PostCard key={post.slug} post={post} />
              ))}
            </div>
          </section>
        ))}

        {BLOG_POSTS.length === 0 && (
          <p className="text-slate-500 italic">
            New posts publishing soon. Check back shortly.
          </p>
        )}
      </article>
    </PublicPageShell>
  );
}

function PostCard({ post, highlight }) {
  return (
    <Link
      to={`/blog/${post.slug}`}
      className={`group block rounded-2xl border p-5 transition-colors ${
        highlight
          ? 'border-emerald-500/30 bg-gradient-to-br from-emerald-950/30 via-slate-900/60 to-slate-900/60 hover:border-emerald-400/50'
          : 'border-slate-800 bg-slate-900/50 hover:border-emerald-500/30 hover:bg-slate-900'
      }`}
    >
      <div className="text-xs uppercase tracking-wider text-emerald-300 mb-2">
        {post.heroEyebrow || 'Article'}
      </div>
      <h3 className="text-lg md:text-xl font-bold text-slate-100 leading-snug mb-2 group-hover:text-emerald-200">
        {post.title}
      </h3>
      <p className="text-sm text-slate-400 leading-relaxed mb-4 line-clamp-3">
        {post.description}
      </p>
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>Updated {post.dateModified || post.datePublished}</span>
        <span className="inline-flex items-center gap-1 text-emerald-300 group-hover:translate-x-0.5 transition-transform">
          Read <ArrowRight className="w-3.5 h-3.5" />
        </span>
      </div>
    </Link>
  );
}
