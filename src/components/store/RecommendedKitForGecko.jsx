import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingBag, Sparkles } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { formatCents } from '@/lib/store/format';

/**
 * RecommendedKitForGecko — small aside that turns the gecko-app context
 * into a personalized supplies recommendation. Mounted on MyGeckos and
 * GeckoDetail.
 *
 * Strategy:
 *  - Look at the gecko's lifecycle stage (hatchling | juvenile | sub_adult |
 *    adult | breeder | gravid_female), defaulting to adult if unknown.
 *  - Query store_products with a matching `lifecycle_stage_tags` value.
 *  - Render up to 4 picks. Sort active first, gift_friendly second.
 *
 * Stays quiet if the supplies tab is disabled (store_enabled = false) or
 * if there are no matching products yet — no empty card noise.
 */
export default function RecommendedKitForGecko({ gecko, compact = false }) {
  const [enabled, setEnabled] = useState(true);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Resolve a sensible stage tag from whatever shape the gecko has.
  const stage = (() => {
    if (!gecko) return 'adult';
    if (gecko.lifecycle_stage) return gecko.lifecycle_stage;
    if (gecko.is_breeder || gecko.status === 'Ready to Breed') return 'breeder';
    if (gecko.weight_grams && gecko.weight_grams < 5) return 'hatchling';
    if (gecko.weight_grams && gecko.weight_grams < 15) return 'juvenile';
    if (gecko.weight_grams && gecko.weight_grams < 35) return 'sub_adult';
    return 'adult';
  })();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const { data: setting } = await supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'store_enabled')
          .maybeSingle();
        if (cancelled) return;
        const isEnabled = Boolean(setting?.value);
        setEnabled(isEnabled);
        if (!isEnabled) {
          setLoading(false);
          return;
        }
        const { data } = await supabase
          .from('store_products')
          .select(`
            id, slug, name, short_description, our_price_cents, images,
            fulfillment_mode, lifecycle_stage_tags, status, is_featured
          `)
          .eq('status', 'active')
          .contains('lifecycle_stage_tags', [stage])
          .order('is_featured', { ascending: false })
          .limit(compact ? 3 : 4);
        if (!cancelled) setProducts(data || []);
      } catch (e) {
        console.warn('recommended kit load failed', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [stage, compact]);

  if (!enabled) return null;
  if (loading) return null;
  if (products.length === 0) return null;

  return (
    <aside className="rounded-xl border border-emerald-700/30 bg-gradient-to-br from-emerald-950/40 via-slate-950 to-slate-950 p-4 md:p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <h3 className="text-sm font-bold text-emerald-100 inline-flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            Picks for {gecko?.name || 'this gecko'}
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Based on a {stage.replace(/_/g, ' ')} {gecko?.species || 'crestie'}.
          </p>
        </div>
        <Link
          to="/Store"
          className="text-xs text-emerald-300 hover:text-emerald-200 inline-flex items-center gap-1"
        >
          <ShoppingBag className="w-3.5 h-3.5" /> Browse all
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {products.map((p) => {
          const primary =
            (Array.isArray(p.images) && p.images.find((i) => i.is_primary)) ||
            (Array.isArray(p.images) && p.images[0]);
          return (
            <Link
              key={p.id}
              to={`/Store/p/${p.slug}`}
              className="group rounded-md border border-slate-800 bg-slate-900/40 hover:border-slate-700 overflow-hidden"
            >
              <div className="aspect-square bg-slate-950">
                {primary?.url ? (
                  <img
                    src={primary.url}
                    alt={primary.alt || p.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : null}
              </div>
              <div className="p-2">
                <div className="text-[12px] font-semibold text-slate-100 line-clamp-2 leading-tight">
                  {p.name}
                </div>
                <div className="text-[11px] text-emerald-300 mt-0.5">
                  {formatCents(p.our_price_cents)}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </aside>
  );
}
