import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, BookOpen, ExternalLink, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Seo from '@/components/seo/Seo';
import ContentBlock from '@/components/careguide/ContentBlock';
import PublicPageShell from '@/components/public/PublicPageShell';
import {
  blogPostingSchema,
  breadcrumbSchema,
} from '@/lib/organization-schema';
import { authorSchema, bylineText, editorialFor } from '@/lib/editorial';
import { createPageUrl } from '@/utils';
import {
  useBlogContent,
  findPostBySlug,
  relatedPosts as computeRelated,
} from '@/lib/blog-data-source';

/**
 * Single blog post page. Resolves the slug against the merged data
 * source (DB-published posts + static editorial), renders either a
 * legacy ContentBlock body (static) or sanitized markdown→html (DB),
 * and wires JSON-LD + breadcrumbs the same way for both.
 */
export default function BlogPost() {
  const { slug } = useParams();
  const { posts, settings, loading } = useBlogContent();

  const post = useMemo(() => findPostBySlug(posts, slug), [posts, slug]);

  const blogEnabled = settings ? settings.blog_enabled !== false : true;
  const showAuthorBox = settings ? settings.show_author_box !== false : true;
  const showRelatedPosts = settings ? settings.show_related_posts !== false : true;

  const { prev, next } = useMemo(() => {
    if (!post) return { prev: null, next: null };
    const idx = posts.findIndex((p) => p.slug === post.slug);
    return {
      prev: idx > 0 ? posts[idx - 1] : null,
      next: idx >= 0 && idx < posts.length - 1 ? posts[idx + 1] : null,
    };
  }, [post, posts]);

  const related = useMemo(
    () => (showRelatedPosts ? computeRelated(posts, post, 3) : []),
    [posts, post, showRelatedPosts]
  );

  // Initial render before posts have loaded — avoid the not-found flash
  // for valid slugs.
  if (loading && !post) {
    return (
      <PublicPageShell>
        <div className="flex justify-center py-20">
          <Loader2 className="w-6 h-6 text-slate-500 animate-spin" />
        </div>
      </PublicPageShell>
    );
  }

  if (!blogEnabled || !post) {
    return (
      <PublicPageShell>
        <Seo
          title={blogEnabled ? 'Blog post not found' : 'Blog'}
          description="That blog post could not be found."
          path={`/blog/${slug || ''}`}
          noIndex
        />
        <section className="max-w-3xl mx-auto px-6 py-20 text-center">
          <h1 className="text-3xl font-bold text-slate-100 mb-3">
            {blogEnabled ? 'Post not found' : 'Blog unavailable'}
          </h1>
          <p className="text-slate-400 mb-6">
            {blogEnabled
              ? <>We couldn't find a blog post for "{slug}". Browse the index instead.</>
              : 'The blog is currently disabled. Please check back later.'}
          </p>
          <Link to="/blog">
            <Button className="bg-emerald-700 hover:bg-emerald-800 text-white font-semibold">
              <ArrowLeft className="w-4 h-4 mr-2" /> Back to the blog
            </Button>
          </Link>
        </section>
      </PublicPageShell>
    );
  }

  const path = `/blog/${post.slug}`;
  const editorial = editorialFor(path);
  const editorialPost = {
    slug: post.slug,
    title: post.title,
    description: post.description || post.excerpt || '',
    keyphrase: post.keyphrase || post.targetKeyword || null,
    datePublished: editorial.published || post.datePublished,
    dateModified: editorial.modified || post.dateModified || post.datePublished,
  };

  const jsonLd = [
    ...blogPostingSchema({
      post: editorialPost,
      path,
      author: authorSchema(),
      faq: post.faq,
      keyphrase: editorialPost.keyphrase,
    }),
    breadcrumbSchema([
      { name: 'Home', path: '/' },
      { name: 'Blog', path: '/blog' },
      { name: post.title, path },
    ]),
  ];

  const keywordsList = [
    post.keyphrase,
    post.targetKeyword,
    ...(post.tags || []).map((t) => t.name),
  ].filter(Boolean);

  return (
    <PublicPageShell>
      <Seo
        title={post.metaTitle || post.title}
        description={post.metaDescription || post.description || post.excerpt}
        path={path}
        type="article"
        publishedTime={editorialPost.datePublished}
        modifiedTime={editorialPost.dateModified}
        keywords={keywordsList}
        jsonLd={jsonLd}
      />

      <article className="max-w-3xl mx-auto px-6 pt-4 pb-16">
        <div className="flex items-center gap-2 text-xs text-slate-500 mb-4">
          <Link to="/" className="hover:text-slate-300">Home</Link>
          <span>/</span>
          <Link to="/blog" className="hover:text-slate-300">Blog</Link>
          <span>/</span>
          <span className="text-slate-400 truncate">{post.title}</span>
        </div>

        {post.category && (
          <Link
            to={`/blog/category/${post.category.slug}`}
            className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300 mb-4 hover:bg-emerald-500/20"
          >
            <BookOpen className="w-3.5 h-3.5" />
            {post.category.label}
          </Link>
        )}

        <h1 className="text-3xl md:text-5xl font-bold tracking-tight leading-[1.1] mb-4 bg-gradient-to-b from-white to-emerald-200 bg-clip-text text-transparent">
          {post.title}
        </h1>

        {(post.description || post.excerpt) && (
          <p className="text-slate-300 text-base md:text-lg leading-relaxed max-w-2xl mb-3">
            {post.description || post.excerpt}
          </p>
        )}

        <p className="text-xs text-slate-500 mb-8">
          {post.source === 'static'
            ? bylineText(path)
            : (
              <>
                {post.authorName ? `By ${post.authorName}` : 'By Geck Inspect Editorial'}
                {post.datePublished && <> · {new Date(post.datePublished).toLocaleDateString()}</>}
                {post.readingTimeMinutes ? <> · {post.readingTimeMinutes} min read</> : null}
              </>
            )}
        </p>

        {post.featuredImageUrl && (
          <img
            src={post.featuredImageUrl}
            alt={post.featuredImageAlt || post.title}
            className="rounded-2xl border border-slate-800 w-full aspect-[16/9] object-cover mb-8"
            loading="lazy"
          />
        )}

        {Array.isArray(post.tldr) && post.tldr.length > 0 && (
          <div className="mb-8 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5 md:p-6">
            <div className="text-xs font-semibold uppercase tracking-wider text-emerald-300 mb-3">
              TL;DR
            </div>
            <ul className="space-y-2">
              {post.tldr.map((line, i) => (
                <li key={i} className="flex items-start gap-2.5 text-slate-200 leading-relaxed">
                  <span className="mt-2 w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Body: either static ContentBlocks or DB-rendered HTML. */}
        {Array.isArray(post.body) && post.body.length > 0 ? (
          <div className="space-y-5 text-slate-300 leading-relaxed">
            {post.body.map((block, i) => (
              <ContentBlock key={i} block={block} />
            ))}
          </div>
        ) : post.contentHtml ? (
          <div
            className="prose prose-invert prose-emerald max-w-none prose-headings:text-slate-100 prose-a:text-emerald-300 prose-strong:text-slate-100 prose-blockquote:border-emerald-500/40 prose-blockquote:text-slate-300 prose-code:text-emerald-200 prose-img:rounded-lg"
            dangerouslySetInnerHTML={{ __html: post.contentHtml }}
          />
        ) : (
          <p className="text-slate-400 italic">This post has no content yet.</p>
        )}

        {Array.isArray(post.faq) && post.faq.length > 0 && (
          <section className="mt-12">
            <h2 className="text-2xl font-bold text-slate-100 mb-4">Frequently asked questions</h2>
            <dl className="divide-y divide-slate-800 rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden">
              {post.faq.map((qa, i) => (
                <div key={i} className="px-5 py-4">
                  <dt className="font-semibold text-emerald-300 mb-1.5">{qa.question}</dt>
                  <dd className="text-slate-300 leading-relaxed">{qa.answer}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        {Array.isArray(post.internalLinks) && post.internalLinks.length > 0 && (
          <section className="mt-10">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-3">
              Keep reading on Geck Inspect
            </h2>
            <ul className="space-y-2">
              {post.internalLinks.map((link, i) => (
                <li key={i}>
                  <Link
                    to={link.path}
                    className="inline-flex items-center gap-1.5 text-emerald-300 hover:underline"
                  >
                    {link.label} <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {Array.isArray(post.externalCitations) && post.externalCitations.length > 0 && (
          <section className="mt-10">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-3">
              Sources & citations
            </h2>
            <ul className="space-y-2">
              {post.externalCitations.map((c, i) => (
                <li key={i}>
                  <a
                    href={c.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-slate-300 hover:text-emerald-300"
                  >
                    {c.label} <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}

        {Array.isArray(post.tags) && post.tags.length > 0 && (
          <div className="mt-8 flex flex-wrap gap-1.5">
            {post.tags.map((t) => (
              <Link
                key={t.slug}
                to={`/blog/tag/${t.slug}`}
                className="text-xs px-2.5 py-1 rounded-md bg-slate-800/70 border border-slate-700 text-slate-300 hover:border-emerald-500/30 hover:text-emerald-300"
              >
                #{t.name}
              </Link>
            ))}
          </div>
        )}

        {showAuthorBox && (post.authorName || post.authorBio) && (
          <section className="mt-10 rounded-2xl border border-slate-800 bg-slate-900/40 p-5 flex items-start gap-4">
            {post.authorAvatarUrl && (
              <img
                src={post.authorAvatarUrl}
                alt={post.authorName || 'Author'}
                className="w-14 h-14 rounded-full object-cover border border-slate-700"
                loading="lazy"
              />
            )}
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-100">
                {post.authorName || 'Geck Inspect Editorial'}
              </p>
              {post.authorBio && (
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">{post.authorBio}</p>
              )}
            </div>
          </section>
        )}

        <nav className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-3 border-t border-slate-800/60 pt-6">
          {prev ? (
            <Link
              to={`/blog/${prev.slug}`}
              className="group rounded-xl border border-slate-800 hover:border-emerald-500/30 bg-slate-900/60 hover:bg-slate-900 p-4 transition-colors"
            >
              <div className="text-xs text-slate-500 mb-1">← Previous post</div>
              <div className="text-sm font-semibold text-slate-200 group-hover:text-emerald-200">
                {prev.title}
              </div>
            </Link>
          ) : <span />}
          {next ? (
            <Link
              to={`/blog/${next.slug}`}
              className="group rounded-xl border border-slate-800 hover:border-emerald-500/30 bg-slate-900/60 hover:bg-slate-900 p-4 text-right transition-colors"
            >
              <div className="text-xs text-slate-500 mb-1">Next post →</div>
              <div className="text-sm font-semibold text-slate-200 group-hover:text-emerald-200">
                {next.title}
              </div>
            </Link>
          ) : <span />}
        </nav>

        {showRelatedPosts && related.length > 0 && (
          <section className="mt-12">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-3">
              Related reading
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {related.map((p) => (
                <Link
                  key={p.slug}
                  to={`/blog/${p.slug}`}
                  className="group rounded-xl border border-slate-800 hover:border-emerald-500/30 bg-slate-900/60 hover:bg-slate-900 p-4 transition-colors"
                >
                  <div className="text-xs text-emerald-300 mb-1">{p.heroEyebrow || p.category?.label || 'Article'}</div>
                  <div className="text-sm font-semibold text-slate-200 group-hover:text-emerald-200 leading-snug">
                    {p.title}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        <section className="mt-12 rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/40 via-slate-900/60 to-slate-900/40 p-6 md:p-8">
          <h2 className="text-xl md:text-2xl font-bold text-white mb-2">
            Track every gecko, pairing, and lineage on Geck Inspect
          </h2>
          <p className="text-slate-300 mb-5 leading-relaxed">
            Free collection management with breeding planning, AI morph identification,
            multi-generation lineage, and Punnett-square genetics calculation.
          </p>
          <Link to={createPageUrl('AuthPortal')}>
            <Button size="lg" className="bg-emerald-700 hover:bg-emerald-800 text-white font-semibold shadow-lg shadow-emerald-500/30">
              Create a free account <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </section>
      </article>
    </PublicPageShell>
  );
}
