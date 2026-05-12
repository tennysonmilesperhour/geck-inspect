import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { User, Gecko } from '@/entities/all';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Crown, MapPin, ChevronRight, Sparkles } from 'lucide-react';
import { DEFAULT_GECKO_IMAGE as DEFAULT_AVATAR } from '@/lib/constants';

/**
 * Featured Breeders dashboard widget.
 *
 * Shows 2 Breeder-tier users who have opted in via Settings ("Feature
 * me on the Dashboard"). The pair rotates every 24h ,  the selection is
 * deterministic per UTC day so every visitor sees the same breeders on
 * the same day, and the rotation advances once a day rather than on
 * every refresh. Clicking a card takes you to their public profile.
 *
 * Uses Gecko.list() to bucket sale counts client-side ,  the table is
 * small enough that a single fetch is fine. When it grows we can move
 * this to a materialized view.
 */

const FEATURED_COUNT = 2;

// Small deterministic PRNG. Given the same seed it always produces the
// same sequence of floats in [0, 1). We use it to drive a Fisher-Yates
// shuffle that's stable for 24h ,  seeding from `days since epoch` means
// the pick only changes at UTC midnight.
function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle(arr, seed) {
  const rng = mulberry32(seed);
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

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

        // Deterministic 24h rotation: seed the shuffle with the current
        // UTC day index. Every visitor sees the same 2 breeders all day,
        // and the pick rolls over at UTC midnight.
        const todaySeed = Math.floor(Date.now() / 86400000);
        const shuffled = seededShuffle(users, todaySeed).slice(0, FEATURED_COUNT);
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[...Array(FEATURED_COUNT)].map((_, i) => (
              <div
                key={i}
                className="h-24 rounded-lg border border-slate-800 bg-slate-800/40 animate-pulse"
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
