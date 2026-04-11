import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { User, Gecko } from '@/entities/all';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Crown, MapPin, ChevronRight, Sparkles } from 'lucide-react';

/**
 * Featured Breeders dashboard widget.
 *
 * Shows up to 6 Breeder-tier users who have opted in via Settings
 * ("Feature me on the Dashboard"). Clicking a card takes you to their
 * public profile. Displays their avatar, display name, location, and a
 * rough count of how many geckos they currently have listed for sale so
 * the card has real signal instead of being a vanity list.
 *
 * Uses Gecko.list() to bucket sale counts client-side — the table is
 * small enough that a single fetch is fine. When it grows we can move
 * this to a materialized view.
 */

const DEFAULT_AVATAR = 'https://i.imgur.com/sw9gnDp.png';

export default function FeaturedBreeders() {
  const [breeders, setBreeders] = useState([]);
  const [saleCounts, setSaleCounts] = useState({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      try {
        const [users, geckos] = await Promise.all([
          User.filter({ is_featured_breeder: true }).catch(() => []),
          Gecko.list().catch(() => []),
        ]);

        // Shuffle + cap at 6 so the rotation feels fresh on reloads.
        const shuffled = [...users].sort(() => Math.random() - 0.5).slice(0, 6);
        setBreeders(shuffled);

        // Bucket geckos for sale by created_by email
        const counts = {};
        for (const g of geckos) {
          if (g.for_sale && g.created_by) {
            counts[g.created_by] = (counts[g.created_by] || 0) + 1;
          }
        }
        setSaleCounts(counts);
      } catch (err) {
        console.error('Featured breeders load failed:', err);
      }
      setIsLoading(false);
    })();
  }, []);

  if (!isLoading && breeders.length === 0) return null;

  return (
    <Card className="gecko-card border-emerald-500/20 bg-gradient-to-br from-emerald-950/40 via-slate-900/60 to-slate-900/40">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-gecko-text flex items-center gap-2">
            <Crown className="w-5 h-5 text-emerald-400" />
            Featured Breeders
          </CardTitle>
          <span className="text-[10px] uppercase tracking-wider text-emerald-300/70">
            Breeder tier
          </span>
        </div>
        <p className="text-xs text-slate-400 mt-1">
          Curated breeders from the Geck Inspect community. Click any card to visit their public profile.
        </p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="h-24 rounded-lg border border-slate-800 bg-slate-800/40 animate-pulse"
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {breeders.map((b) => {
              const sales = saleCounts[b.email] || 0;
              const displayName = b.business_name || b.full_name || b.email.split('@')[0];
              return (
                <Link
                  key={b.id || b.email}
                  to={`/PublicProfile?email=${encodeURIComponent(b.email)}`}
                  className="group flex items-start gap-3 rounded-lg border border-slate-800 bg-slate-800/40 hover:bg-slate-800 hover:border-emerald-500/40 p-3 transition-colors"
                >
                  <img
                    src={b.profile_image_url || DEFAULT_AVATAR}
                    alt={displayName}
                    className="w-12 h-12 rounded-md object-cover shrink-0"
                    loading="lazy"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-semibold text-slate-100 truncate group-hover:text-emerald-300">
                        {displayName}
                      </p>
                      <Sparkles className="w-3 h-3 text-emerald-400 shrink-0" />
                    </div>
                    {b.location && (
                      <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5 truncate">
                        <MapPin className="w-2.5 h-2.5" />
                        {b.location}
                      </p>
                    )}
                    <p className="text-[11px] text-slate-400 mt-1">
                      {sales > 0 ? `${sales} listed for sale` : 'No active listings'}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-emerald-400 shrink-0 mt-1" />
                </Link>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
