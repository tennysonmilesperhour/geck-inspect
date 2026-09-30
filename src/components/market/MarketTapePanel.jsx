import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Radio, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import ListingCard from '@/components/market/ListingCard';
import { MARKET_NAMES, loadMarketTape, markNewSince, timeAgo } from '@/lib/marketHabit';

const SCOPES = [
  { id: 'all', label: 'Everywhere' },
  { id: 'US', label: 'US' },
  { id: 'KR', label: 'Korea' },
  { id: 'JP', label: 'Japan' },
  { id: 'EU', label: 'Europe' },
];

const LAST_VISIT_KEY = 'market_tape_last_visit';
const REFRESH_MS = 2 * 60_000;

function readLastVisit() {
  try { return localStorage.getItem(LAST_VISIT_KEY); } catch { return null; }
}
function writeLastVisit(iso) {
  try { localStorage.setItem(LAST_VISIT_KEY, iso); } catch { /* private mode */ }
}

/**
 * The market as a feed: new listings and price cuts, newest first, from
 * MorphMarket and from Korea, Japan and Europe. Events since the member's
 * last visit are marked New. The feed checks for new events every two
 * minutes while the page is open; how often events arrive depends on how
 * often each marketplace is checked.
 */
export default function MarketTapePanel() {
  const [scope, setScope] = useState('all');
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(null);
  const lastVisit = useRef(readLastVisit());

  const load = useCallback(async (nextScope) => {
    setLoading(true);
    setError(null);
    try {
      const rows = await loadMarketTape({ scope: nextScope, limit: 40 });
      setEvents(markNewSince(rows || [], lastVisit.current));
      setDone((rows || []).length < 40);
    } catch (e) {
      setError(e);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(scope); }, [scope, load]);

  // Remember this visit when the member leaves the page, so the next
  // visit marks only what arrived after it.
  useEffect(() => {
    const save = () => writeLastVisit(new Date().toISOString());
    const onHide = () => { if (document.visibilityState === 'hidden') save(); };
    document.addEventListener('visibilitychange', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      save();
    };
  }, []);

  // Pull in anything newer while the page stays open.
  useEffect(() => {
    const id = setInterval(async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const rows = await loadMarketTape({ scope, limit: 40 });
        setEvents((prev) => {
          const seen = new Set(prev.map((e) => e.event_id));
          const fresh = (rows || []).filter((e) => !seen.has(e.event_id)).map((e) => ({ ...e, isNew: true }));
          return fresh.length ? [...fresh, ...prev] : prev;
        });
      } catch {
        // A missed refresh is fine; the next one tries again.
      }
    }, REFRESH_MS);
    return () => clearInterval(id);
  }, [scope]);

  const loadMore = async () => {
    const last = events[events.length - 1];
    if (!last) return;
    setLoadingMore(true);
    try {
      const rows = await loadMarketTape({ scope, before: last.at, beforeId: last.event_id, limit: 40 });
      const seen = new Set(events.map((e) => e.event_id));
      const more = markNewSince((rows || []).filter((e) => !seen.has(e.event_id)), lastVisit.current);
      setEvents((prev) => [...prev, ...more]);
      setDone((rows || []).length < 40);
    } catch (e) {
      setError(e);
    }
    setLoadingMore(false);
  };

  const newCount = events.filter((e) => e.isNew).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Radio className="w-4 h-4 text-emerald-400" />
          {newCount > 0 ? `${newCount} new since your last visit` : 'New listings and price cuts, newest first'}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {SCOPES.map((s) => (
            <Button
              key={s.id}
              size="sm"
              variant={scope === s.id ? 'default' : 'outline'}
              className={scope === s.id ? 'bg-emerald-600 hover:bg-emerald-500 text-white h-8' : 'h-8'}
              onClick={() => setScope(s.id)}
            >
              {s.label}
            </Button>
          ))}
          <Button size="sm" variant="outline" className="h-8 touch:min-w-11" onClick={() => load(scope)} aria-label="Refresh">
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-slate-400 py-10 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading the tape
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-200">
          The tape could not load. Try again in a minute.
        </div>
      ) : events.length === 0 ? (
        <p className="text-sm text-slate-400 py-8 text-center">Nothing here yet for this market.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {events.map((e) => (
            <ListingCard
              key={e.event_id}
              listing={e}
              badge={
                <>
                  {e.isNew && <Badge className="text-[10px] bg-emerald-600 text-white border-0">New</Badge>}
                  <Badge variant="outline" className="text-[10px] border-slate-600 text-slate-300">
                    {e.kind === 'cut' ? 'Price cut' : 'Listed'}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] border-slate-700 text-slate-400">
                    {MARKET_NAMES[e.market] || e.market}
                  </Badge>
                </>
              }
              meta={timeAgo(e.at)}
            />
          ))}
        </div>
      )}

      {!loading && !error && events.length > 0 && !done && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Load older
          </Button>
        </div>
      )}
      <p className="text-[11px] text-slate-500">
        MorphMarket listings arrive as often as MorphMarket is checked; Korea, Japan and Europe are checked daily.
        Prices outside the US are converted to US dollars for comparison.
      </p>
    </div>
  );
}
