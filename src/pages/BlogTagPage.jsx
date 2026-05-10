import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight, Tag, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Seo from '@/components/seo/Seo';
import PublicPageShell from '@/components/public/PublicPageShell';
import { breadcrumbSchema } from '@/lib/organization-schema';
import {
  useBlogContent,
  postsForTagSlug,
} from '@/lib/blog-data-source';

export default function BlogTagPage() {
  const { slug } = useParams();
  const { posts, tags, settings, loading } = useBlogContent();

  const tag = useMemo(
    () => tags.find((t) => t.slug === slug) || null,
    [tags, slug]
  );
  const visible = useMemo(() => postsForTagSlug(posts, slug), [posts, slug]);

  const blogEnabled = settings ? settings.blog_enabled !== false : true;
  const path = `/blog/tag/${slug || ''}`;

  if (loading && !tag) {
    return (
      <PublicPageShell>
        <div className="flex justify-center py-20">
          <Loader2 className="w-6 h-6 text-slate-500 animate-spin" />
        </div>
      </PublicPageShell>
    );
  }

  // For tag pages we accept any tag that has at least one visible post,
  // even if the tag entity itself isn't in the active tags list ,  that
  // keeps slug-only static-post tags from 404ing.
  const tagName = tag?.name || (visible[0]?.tags || []).find((t) => t.slug === slug)?.name || slug;

  if (!blogEnabled || (!tag && visible.length === 0)) {
    return (
      <PublicPageShell>
        <Seo
          title="Tag not found"
          description="That tag does not exist."
          path={path}
          noIndex
        />
        <section className="max-w-3xl mx-auto px-6 py-20 text-center">
          <h1 className="text-3xl font-bold text-slate-100 mb-3">Tag not found</h1>
          <p className="text-slate-400 mb-6">
            We couldn't find a blog tag for "{slug}".
          </p>
          <Link to="/blog">
            <Button className="bg-emerald-700 hover:bg-emerald-800 text-white font-semibold">
              Back to the blog
            </Button>
          </Link>
        </section>
      </PublicPageShell>
    );
  }

  const jsonLd = [
    breadcrumbSchema([
      { name: 'Home', path: '/' },
      { name: 'Blog', path: '/blog' },
      { name: `#${tagName}`, path },
    ]),
  ];

  return (
    <PublicPageShell>
      <Seo
        title={`#${tagName} · Crested Gecko Blog`}
        description={`Posts tagged ${tagName}.`}
        path={path}
        type="website"
        jsonLd={jsonLd}
      />

      <article className="max-w-5xl mx-auto px-6 pt-6 pb-16">
        <div className="flex items-center gap-2 text-xs text-slate-500 mb-4">
          <Link to="/" className="hover:text-slate-300">Home</Link>
          <span>/</span>
          <Link to="/blog" className="hover:text-slate-300">Blog</Link>
          <span>/</span>
          <span className="text-slate-400">#{tagName}</span>
        </div>

        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300 mb-4">
          <Tag className="w-3.5 h-3.5" />
          Tag
        </div>

        <h1 className="text-3xl md:text-5xl font-bold tracking-tight leading-[1.1] mb-8 bg-gradient-to-b from-white to-emerald-200 bg-clip-text text-transparent">
          #{tagName}
        </h1>

        {visible.length === 0 ? (
          <p className="text-slate-500 italic">No posts with this tag yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {visible.map((post) => (
              <Link
                key={post.slug}
                to={`/blog/${post.slug}`}
                className="group block rounded-2xl border border-slate-800 bg-slate-900/50 hover:border-emerald-500/30 hover:bg-slate-900 p-5 transition-colors"
              >
                <div className="text-xs uppercase tracking-wider text-emerald-300 mb-2">
                  {post.heroEyebrow || post.category?.label || 'Article'}
                </div>
                <h3 className="text-lg md:text-xl font-bold text-slate-100 leading-snug mb-2 group-hover:text-emerald-200">
                  {post.title}
                </h3>
                <p className="text-sm text-slate-400 leading-relaxed mb-4 line-clamp-3">
                  {post.description || post.excerpt}
                </p>
                <span className="inline-flex items-center gap-1 text-xs text-emerald-300 group-hover:translate-x-0.5 transition-transform">
                  Read <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </Link>
            ))}
          </div>
        )}
      </article>
    </PublicPageShell>
  );
}
