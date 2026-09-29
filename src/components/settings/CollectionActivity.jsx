import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import {
  Archive,
  ArchiveRestore,
  ArrowRightLeft,
  Droplets,
  History,
  Loader2,
  Pencil,
  Plus,
  Scale,
  Trash2,
  UserMinus,
  UserPlus,
  Utensils,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { describeActivity, fetchCollectionActivity, groupActivityByDay } from '@/lib/collectionActivity';

const ICONS = {
  added: Plus,
  edited: Pencil,
  archived: Archive,
  restored: ArchiveRestore,
  deleted: Trash2,
  moved_in: ArrowRightLeft,
  moved_out: ArrowRightLeft,
  weighed: Scale,
  fed: Utensils,
  shed: Droplets,
  joined: UserPlus,
  removed: UserMinus,
};

const PAGE = 40;

// The activity feed for a shared collection (Settings) or for one gecko
// (detail view). With hideWhenEmpty, a gecko that has no shared history
// renders nothing at all.
export default function CollectionActivity({ collectionId, geckoId, currentEmail, hideWhenEmpty = false, title }) {
  const [entries, setEntries] = useState([]);
  const [limit, setLimit] = useState(geckoId ? 10 : PAGE);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchCollectionActivity({ collectionId, geckoId, limit: limit + 1 })
      .then((rows) => { if (!cancelled) { setEntries(rows); setFailed(false); } })
      .catch((err) => {
        console.warn('Activity log failed to load', err);
        if (!cancelled) setFailed(true);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [collectionId, geckoId, limit]);

  const shown = entries.slice(0, limit);
  const hasMore = entries.length > limit;

  if (hideWhenEmpty && !loading && (failed || shown.length === 0)) return null;
  if (hideWhenEmpty && loading && shown.length === 0) return null;

  return (
    <div data-collection-activity>
      {title && (
        <h3 className="text-lg font-semibold text-slate-100 mb-3 flex items-center gap-2">
          <History className="w-5 h-5" />
          {title}
        </h3>
      )}
      {loading && shown.length === 0 ? (
        <p className="text-sm text-slate-400 flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading activity
        </p>
      ) : failed ? (
        <p className="text-sm text-slate-400">The activity log could not load. Try again in a moment.</p>
      ) : shown.length === 0 ? (
        <p className="text-sm text-slate-400">
          Nothing yet. From now on, geckos added, edited, weighed, fed or archived by anyone in this
          collection show up here.
        </p>
      ) : (
        <div className="space-y-3">
          {groupActivityByDay(shown).map((group) => (
            <div key={group.label}>
              <p className="text-[11px] uppercase tracking-wider text-slate-500 mb-1.5">{group.label}</p>
              <ul className="space-y-1.5">
                {group.items.map((entry) => {
                  const Icon = ICONS[entry.action] || Pencil;
                  return (
                    <li key={entry.id} className="flex items-start gap-2 text-sm">
                      <span className="mt-0.5 h-6 w-6 shrink-0 rounded-md bg-slate-800 border border-slate-700 grid place-items-center">
                        <Icon className="w-3.5 h-3.5 text-emerald-300" />
                      </span>
                      <span className="min-w-0 flex-1 text-slate-200 break-words">{describeActivity(entry, currentEmail)}</span>
                      <time className="shrink-0 text-xs text-slate-500 mt-0.5" dateTime={entry.created_at}>
                        {format(new Date(entry.created_at), 'h:mm a')}
                      </time>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
          {hasMore && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setLimit((n) => n + PAGE)}
              disabled={loading}
              className="text-slate-300 hover:text-emerald-300"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Show more'}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
