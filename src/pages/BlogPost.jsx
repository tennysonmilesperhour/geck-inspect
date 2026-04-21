import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, BookOpen, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Seo from '@/components/seo/Seo';
import ContentBlock from '@/components/careguide/ContentBlock';
import PublicPageShell from '@/components/public/PublicPageShell';
import {
  BLOG_POSTS,
  getBlogPost,
  getBlogCategory,
  recentPosts,
} from '@/data/blog-posts';
import {
  blogPostingSchema,
  breadcrumbSchema,
} from '@/lib/organization-schema';
import { authorSchema, bylineText, editorialFor } from '@/lib/editorial';
import { createPageUrl } from '@/utils';

/**
 * Single blog post page. Renders the post body, FAQ block, internal /
 * external link list, prev/next navigation, and a closing CTA. Wires up
 * BlogPosting + FAQPage + BreadcrumbList JSON-LD via the shared schema
 * helpers in src/lib/organization-schema.js.
 */
export default function BlogPost() {
  const { slug } = useParams();
  const post = slug ? getBlogPost(slug) : null;
  const category = post ? getBlogCategory(post.category) : null;

  const { prev, next } = useMemo(() => {
    if (!post) return { prev: null, next: null };
    const idx = BLOG_POSTS.findIndex((p) => p.slug === post.slug);
    return {
      prev: idx > 0 ? BLOG_POSTS[idx - 1] : null,
      next: idx >= 0 && idx < BLOG_POSTS.length - 1 ? BLOG_POSTS[idx + 1] : null,
    };
  }, [post]);

  if (!post) {
    return (
      <PublicPageShell>
        <Seo
          title="Blog post not found"
          description="That blog post could not be found."
          path={`/blog/${slug || ''}`}
          noIndex
        />
        <section className="max-w-3xl mx-auto px-6 py-20 text-center">
          <h1 className="text-3xl font-bold text-slate-100 mb-3">Post not found</h1>
          <p className="text-slate-400 mb-6">
            We couldn't find a blog post for "{slug}". Browse the index instead.
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
    ...post,
    datePublished: editorial.published || post.datePublished,
    dateModified: editorial.modified || post.dateModified,
  };

  const jsonLd = [
    ...blogPostingSchema({
      post: editorialPost,
      path,
      author: authorSchema(),
      faq: post.faq,
      keyphrase: post.keyphrase,
    }),
    breadcrumbSchema([
      { name: 'Home', path: '/' },
      { name: 'Blog', path: '/blog' },
      { name: post.title, path },
    ]),
  ];

  const related = recentPosts(4).filter((p) => p.slug !== post.slug).slice(0, 3);

  return (
    <PublicPageShell>
      <Seo
        title={post.title}
        description={post.description}
        path={path}
        type="article"
        publishedTime={editorialPost.datePublished}
        modifiedTime={editorialPost.dateModified}
        keywords={[post.keyphrase, ...(post.tags || [])]}
        jsonLd={jsonLd}
      />

      <article className="max-w-3xl mx-auto px-6 pt-4 pb-16">
        <div className="flex items-center gap-2 text-xs text-slate-500 mb-4">
          <Link to="/" className="hover:text-slate-300">Home</Link>
          <span>/</span>
          <Link to="/blog" className="hover:text-slate-300">Blog</Link>
          <span>/</span>
          <span className="text-slate-400">{post.title}</span>
        </div>

        {category && (
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300 mb-4">
            <BookOpen className="w-3.5 h-3.5" />
            {category.label}
          </div>
        )}

        <h1 className="text-3xl md:text-5xl font-bold tracking-tight leading-[1.1] mb-4 bg-gradient-to-b from-white to-emerald-200 bg-clip-text text-transparent">
          {post.title}
        </h1>

        <p className="text-slate-300 text-base md:text-lg leading-relaxed max-w-2xl mb-3">
          {post.description}
        </p>
        <p className="text-xs text-slate-500 mb-8">{bylineText(path)}</p>

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

        <div className="space-y-5 text-slate-300 leading-relaxed">
          {(post.body || []).map((block, i) => (
            <ContentBlock key={i} block={block} />
          ))}
        </div>

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

        {related.length > 0 && (
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
                  <div className="text-xs text-emerald-300 mb-1">{p.heroEyebrow || 'Article'}</div>
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
