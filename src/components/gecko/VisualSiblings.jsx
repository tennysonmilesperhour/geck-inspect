import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, Loader2, Crown, LogIn } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { createPageUrl } from '@/utils';
import { consumeFeatureCredit } from '@/lib/usageMeter';
import { findSimilar } from '@/lib/visualSearch';
import { labelFor } from '@/components/morph-id/morphTaxonomy';

/**
 * Visual siblings: "geckos that look like this one", powered by the
 * image-embedding index behind /recognition. Lazy by design: nothing is
 * searched (and no credit is consumed) until the keeper clicks the
 * button, so plain page views stay free.
 *
 * Props:
 *   gecko - gecko record; the first image_urls entry is the query photo
 *   user  - signed-in user or null/undefined for guests
 */
export default function VisualSiblings({ gecko, user }) {
  const [isSearching, setIsSearching] = useState(false);
  const [matches, setMatches] = useState(null);
  const [gate, setGate] = useState(null); // 'guest' | 'exhausted' | null
  const [usage, setUsage] = useState(null); // { remaining, included }

  const imageUrl = gecko?.image_urls?.[0];
  if (!imageUrl) return null;

  const handleSearch = async () => {
    if (isSearching) return;
    setGate(null);

    let credit;
    try {
      // Metered: one credit per search, charged before the expensive work.
      credit = await consumeFeatureCredit('visual_search', user);
    } catch {
      // Treat metering hiccups like an empty result, never an error wall.
      setMatches([]);
      return;
    }
    if (!credit.ok) {
      setGate(credit.guest ? 'guest' : 'exhausted');
      return;
    }
    setUsage({ remaining: credit.remaining, included: credit.included });

    setIsSearching(true);
    try {
      const results = await findSimilar(imageUrl, { count: 8 });
      setMatches(results);
    } catch {
      setMatches([]);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <Card className="bg-slate-900 border-slate-700">
      <CardContent className="p-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm uppercase tracking-wide text-slate-300">
              Lookalikes
            </h3>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSearch}
            disabled={isSearching}
          >
            {isSearching ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            {isSearching ? 'Searching...' : 'Find similar geckos'}
          </Button>
        </div>
        <p className="text-xs text-slate-400">
          Search the community photo index for geckos that visually resemble
          this one, matched on the photo itself, not the listed morph.
        </p>

        {gate === 'exhausted' && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 flex items-start gap-3">
            <Crown className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
            <div className="text-sm">
              <p className="text-amber-200 font-medium">
                You have used all of this month&apos;s visual searches.
              </p>
              <p className="text-slate-300 text-xs mt-1">
                Visual searches are limited per month on your current plan.
                Upgrade for a bigger monthly allotment.
              </p>
              <Link to={createPageUrl('Membership')} className="inline-block mt-2">
                <Button size="sm">View plans</Button>
              </Link>
            </div>
          </div>
        )}

        {gate === 'guest' && (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 flex items-start gap-3">
            <LogIn className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
            <div className="text-sm">
              <p className="text-emerald-200 font-medium">
                Sign in to search lookalikes
              </p>
              <p className="text-slate-300 text-xs mt-1">
                Visual search needs an account so we can track your monthly
                allotment.
              </p>
              <Link to={createPageUrl('AuthPortal')} className="inline-block mt-2">
                <Button size="sm">Sign in</Button>
              </Link>
            </div>
          </div>
        )}

        {!isSearching && matches && matches.length === 0 && (
          <p className="text-xs text-slate-500">
            No close visual matches yet. The index grows as the community adds
            photos, so check back after the next batch.
          </p>
        )}

        {matches && matches.length > 0 && (
          <div className="flex gap-3 overflow-x-auto pb-2">
            {matches.map((m) => (
              <div key={m.id} className="w-28 shrink-0 space-y-1">
                <a
                  href={m.image_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Open ${labelFor(m.primary_morph, 'gecko')} photo in a new tab`}
                >
                  <img
                    src={m.image_url}
                    alt={labelFor(m.primary_morph, 'Similar gecko')}
                    className="aspect-square w-full object-cover rounded-md border border-slate-700"
                    loading="lazy"
                  />
                </a>
                <Badge variant="secondary" className="text-[10px] bg-slate-800 text-slate-300">
                  {Math.round((m.similarity ?? 0) * 100)}% match
                </Badge>
                {m.primary_morph && (
                  <p className="text-xs font-medium text-slate-200 truncate">
                    {labelFor(m.primary_morph, m.primary_morph)}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {matches && usage && usage.remaining != null && (
          <p className="text-xs text-slate-500">
            {usage.remaining} of {usage.included} searches left this month.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
