import { useEffect, useState } from 'react';
import { Testimonial } from '@/entities/all';
import { Quote } from 'lucide-react';

/**
 * Public testimonials section for the landing page.
 *
 * Renders nothing at all until at least MIN_TESTIMONIALS approved
 * rows exist in the `testimonials` table. This is intentional: a
 * section labeled "What our users say" with one quote in it reads
 * worse than no section at all, and we want the landing page to
 * grow into the section organically as real quotes come in.
 *
 * Data source is the public RLS policy on `testimonials` ,  the anon
 * client can read rows where `approved = true`. No admin curation
 * happens in this component; that's in TestimonialsAdmin.
 */
const MIN_TESTIMONIALS = 3;

function instagramHandle(handle) {
  if (!handle) return null;
  return handle.startsWith('@') ? handle : `@${handle}`;
}

function authorUrl(t) {
  if (t.author_url) return t.author_url;
  if (t.author_handle) {
    const h = t.author_handle.replace(/^@/, '');
    return `https://www.instagram.com/${h}/`;
  }
  return null;
}

export default function Testimonials() {
  const [items, setItems] = useState(null);

  useEffect(() => {
    let cancelled = false;
    Testimonial.filter({ approved: true }, 'sort_order')
      .then((rows) => {
        if (cancelled) return;
        setItems(Array.isArray(rows) ? rows : []);
      })
      .catch(() => {
        if (cancelled) return;
        // Fail silent ,  testimonials are optional. We never want a
        // landing-page render to depend on this query succeeding.
        setItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // While loading, render nothing (no skeleton ,  keeps the page tall
  // even when items eventually = 0). When loaded but below threshold,
  // also render nothing.
  if (!items || items.length < MIN_TESTIMONIALS) return null;

  return (
    <section className="relative z-10 max-w-6xl mx-auto px-6 pb-24">
      <div className="text-center mb-12">
        <h2 className="text-3xl md:text-4xl font-bold mb-3">
          From keepers using it daily
        </h2>
        <p className="text-slate-400 max-w-2xl mx-auto">
          Real quotes from breeders and hobbyists running their collection in
          Geck Inspect.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {items.map((t) => {
          const url = authorUrl(t);
          const handle = instagramHandle(t.author_handle);
          return (
            <div
              key={t.id}
              className="gecko-card backdrop-blur p-6 flex flex-col"
            >
              <Quote className="w-6 h-6 text-emerald-400 mb-3 opacity-70" />
              <p className="text-slate-200 leading-relaxed flex-1 italic">
                &ldquo;{t.quote}&rdquo;
              </p>
              <div className="mt-5 flex items-center gap-3">
                {t.avatar_url ? (
                  <img
                    src={t.avatar_url}
                    alt={t.author_name}
                    className="w-10 h-10 rounded-full object-cover border border-emerald-500/30"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-sm font-bold text-emerald-300">
                    {(t.author_name || '?').charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="leading-tight">
                  {url ? (
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-semibold text-white hover:text-emerald-300 transition-colors"
                    >
                      {t.author_name}
                    </a>
                  ) : (
                    <div className="text-sm font-semibold text-white">
                      {t.author_name}
                    </div>
                  )}
                  {(t.author_role || handle) && (
                    <div className="text-xs text-slate-500">
                      {[t.author_role, handle].filter(Boolean).join(' · ')}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
