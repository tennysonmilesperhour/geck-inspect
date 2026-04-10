import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight, GitBranch, MapPin, ShieldCheck, Sparkles } from 'lucide-react';
import Seo from '@/components/seo/Seo';
import { breederCanonical, breederDisplayName, breederSlug } from '@/lib/breederUtils';

const LOGO_URL =
  'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68929cdad944c572926ab6cb/2ba53d481_Inspect.png';
const DEFAULT_GECKO_IMAGE = 'https://i.imgur.com/sw9gnDp.png';

function GeckoTile({ gecko }) {
  return (
    <Link
      to={createPageUrl(`GeckoDetail?id=${gecko.id}`)}
      className="group relative rounded-xl overflow-hidden border border-slate-800 bg-slate-900/60 hover:border-emerald-500/40 transition-colors"
    >
      <div className="aspect-square bg-slate-800">
        <img
          src={gecko.image_urls?.[0] || DEFAULT_GECKO_IMAGE}
          alt={gecko.name || 'Crested gecko'}
          className="w-full h-full object-cover group-hover:opacity-90 transition-opacity"
          loading="lazy"
          decoding="async"
        />
      </div>
      <div className="p-3">
        <p className="text-sm font-semibold text-slate-100 truncate">
          {gecko.name || 'Unnamed gecko'}
        </p>
        <p className="text-xs text-slate-500 truncate">
          {gecko.status || gecko.sex || 'Tracked on Geck Inspect'}
        </p>
      </div>
    </Link>
  );
}

export default function Breeder() {
  const location = useLocation();
  const slug = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return (params.get('slug') || '').toLowerCase().trim();
  }, [location.search]);

  const [geckos, setGeckos] = useState([]);
  const [uniqueOwners, setUniqueOwners] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);

  const displayName = breederDisplayName(slug);
  const canonical = breederCanonical(slug);

  useEffect(() => {
    if (!slug) {
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      setErrorMsg(null);
      try {
        // Fuzzy match: the same breeder is referenced as
        // "Altitude Exotics", "Altitudeexotics.com", or free-text in
        // notes. We search the three likely columns using the first
        // word of the display name as a broad ILIKE filter, then
        // tighten the match client-side using canonicalized form.
        const firstWord = displayName.split(' ')[0]?.toLowerCase() || slug;
        const safe = firstWord.replace(/[%_\\]/g, '');
        const pattern = `%${safe}%`;
        const { data, error } = await supabase
          .from('geckos')
          .select(
            'id, name, sex, status, image_urls, dam_name, sire_name, notes, created_by'
          )
          .or(
            `dam_name.ilike.${pattern},sire_name.ilike.${pattern},notes.ilike.${pattern}`
          )
          .limit(500);
        if (error) throw error;
        if (cancelled) return;

        // Tighten: only keep geckos whose sire/dam/notes canonicalize
        // to include our target canonical form. This kills false
        // positives from partial word matches.
        const matches = (data || []).filter((g) => {
          const hay = [
            breederCanonical(g.dam_name),
            breederCanonical(g.sire_name),
            breederCanonical(g.notes),
          ]
            .filter(Boolean)
            .join(' ');
          return hay.includes(canonical);
        });

        setGeckos(matches);
        setUniqueOwners(new Set(matches.map((g) => g.created_by).filter(Boolean)).size);
      } catch (err) {
        if (!cancelled) setErrorMsg(err.message || 'Failed to load geckos');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, displayName, canonical]);

  // Invalid slug guard — rarely hit, but render a clean 404-ish page
  if (!slug) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-8">
        <div className="text-center space-y-4 max-w-md">
          <h1 className="text-2xl font-bold text-slate-100">No breeder specified</h1>
          <p className="text-slate-400">
            This page needs a <code>?slug=</code> query parameter — e.g.{' '}
            <code>/Breeder?slug=altitude-exotics</code>.
          </p>
          <Link to="/">
            <Button variant="outline" className="border-slate-600 text-slate-200">
              <ArrowLeft className="w-4 h-4 mr-2" /> Back to Geck Inspect
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: displayName,
    alternateName: slug,
    url: `https://geckinspect.com/Breeder?slug=${slug}`,
    description: `${displayName} is a crested gecko breeder referenced by keepers on Geck Inspect. ${geckos.length} gecko${
      geckos.length === 1 ? '' : 's'
    } in the Geck Inspect community trace their lineage back to ${displayName}.`,
    logo: LOGO_URL,
  };

  return (
    <>
      <Seo
        title={`${displayName} — Crested Gecko Breeder`}
        description={`${displayName} is a crested gecko breeder referenced across the Geck Inspect community. Explore geckos whose lineage traces back to ${displayName}.`}
        path={`/Breeder?slug=${slug}`}
        jsonLd={jsonLd}
      />

      <div className="min-h-screen bg-slate-950 text-slate-100">
        {/* Top nav — mirrors the landing page for a coherent public feel */}
        <header className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
            <img src={LOGO_URL} alt="Geck Inspect" className="h-10 w-10 rounded-xl" />
            <span className="text-xl font-bold tracking-tight">Geck Inspect</span>
          </Link>
          <Link to={createPageUrl('AuthPortal')}>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold">
              Sign In
            </Button>
          </Link>
        </header>

        {/* Hero */}
        <section className="max-w-5xl mx-auto px-6 pt-10 pb-12">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 mb-6"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Geck Inspect
          </Link>

          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-emerald-300 mb-5">
            <Sparkles className="w-3 h-3" />
            Breeder on Geck Inspect
          </div>

          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-4 bg-gradient-to-b from-white to-emerald-200 bg-clip-text text-transparent">
            {displayName}
          </h1>

          <p className="text-lg text-slate-300 leading-relaxed max-w-2xl">
            {displayName} is a crested gecko breeder referenced by keepers in the Geck Inspect
            community. This page is built automatically from attribution data in our database.
          </p>

          {/* Stats strip */}
          {!isLoading && (
            <div className="mt-8 flex flex-wrap gap-6 text-sm">
              <div className="flex items-center gap-2 text-slate-300">
                <GitBranch className="w-4 h-4 text-emerald-400" />
                <span className="font-semibold text-white">{geckos.length}</span>
                <span className="text-slate-400">
                  gecko{geckos.length === 1 ? '' : 's'} tracked
                </span>
              </div>
              {uniqueOwners > 0 && (
                <div className="flex items-center gap-2 text-slate-300">
                  <MapPin className="w-4 h-4 text-emerald-400" />
                  <span className="font-semibold text-white">{uniqueOwners}</span>
                  <span className="text-slate-400">
                    keeper{uniqueOwners === 1 ? '' : 's'}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Claim CTA */}
          <div className="mt-10 rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/40 via-slate-900/60 to-slate-900/40 p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
            <div className="space-y-2 max-w-xl">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <h2 className="text-xl font-bold text-white">Is this your breeding project?</h2>
              </div>
              <p className="text-slate-300 text-sm leading-relaxed">
                Create a free Geck Inspect account and claim{' '}
                <span className="text-white font-semibold">{displayName}</span> as your verified
                breeder page. Show off your lineages, connect with your customers, and let buyers
                trace every gecko back to you.
              </p>
            </div>
            <Link to={createPageUrl('AuthPortal')}>
              <Button
                size="lg"
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-lg shadow-emerald-500/20 whitespace-nowrap"
              >
                Claim this page
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        </section>

        {/* Gecko grid */}
        <section className="max-w-6xl mx-auto px-6 pb-24">
          <h2 className="text-2xl font-bold mb-6">
            Geckos tracked from {displayName}
          </h2>

          {isLoading && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {[...Array(8)].map((_, i) => (
                <div
                  key={i}
                  className="aspect-square rounded-xl bg-slate-900/60 border border-slate-800 animate-pulse"
                />
              ))}
            </div>
          )}

          {!isLoading && errorMsg && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-6 text-sm text-red-300">
              Couldn&rsquo;t load geckos: {errorMsg}
            </div>
          )}

          {!isLoading && !errorMsg && geckos.length === 0 && (
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-10 text-center">
              <p className="text-slate-400">
                No geckos in the Geck Inspect community are currently attributed to{' '}
                <span className="text-white">{displayName}</span>.
              </p>
              <p className="text-slate-500 text-sm mt-2">
                If that seems wrong, check the spelling of the slug in the URL.
              </p>
            </div>
          )}

          {!isLoading && !errorMsg && geckos.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {geckos.map((g) => (
                <GeckoTile key={g.id} gecko={g} />
              ))}
            </div>
          )}
        </section>

        {/* Footer */}
        <footer className="border-t border-slate-800/50">
          <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-slate-500">
            <div className="flex items-center gap-3">
              <img src={LOGO_URL} alt="Geck Inspect" className="h-6 w-6 rounded" />
              <span>© {new Date().getFullYear()} Geck Inspect · geckOS</span>
            </div>
            <div className="flex items-center gap-5">
              <Link to="/" className="hover:text-slate-300">Home</Link>
              <Link to={createPageUrl('MorphGuide')} className="hover:text-slate-300">
                Morph Guide
              </Link>
              <Link to={createPageUrl('AuthPortal')} className="hover:text-slate-300">
                Sign in
              </Link>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}

// Re-export utils so consumers can `import { breederSlug } from '@/pages/Breeder'`
// if they prefer a single import source.
export { breederSlug, breederCanonical, breederDisplayName };
