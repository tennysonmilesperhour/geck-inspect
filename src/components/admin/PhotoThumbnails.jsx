import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ImageDown, Loader2, Square } from 'lucide-react';
import { convertHeicForUpload, makeThumbnail } from '@/lib/imageResize';
import { THUMBNAIL } from '@/lib/photoThumbnails';
import { makeOneThumbnail, runBackfill } from './photoThumbnailBackfill';

/**
 * Admin tool: make thumbnails for member photos uploaded before 16 October
 * 2026 (newer photos get theirs at upload). The work happens in this
 * browser, with the admin's own session; see photoThumbnailBackfill.js for
 * why and how it can be stopped and resumed.
 */

function notInstalled(error) {
  const text = `${error?.code || ''} ${error?.message || ''}`;
  return /PGRST202|42883|could not find the function|does not exist/i.test(text);
}

async function fetchPage(after, limit) {
  const { data, error } = await supabase.rpc('admin_photos_without_thumbnail', {
    p_after: after,
    p_limit: limit,
  });
  if (error) throw error;
  return data || [];
}

// One run per tab. A run keeps going when the admin leaves this section,
// so its state lives here, outside the component: coming back shows the
// same run (with its Stop button) instead of letting a second loop start
// over the same photos.
const run = { active: false, stop: false, progress: null, error: null, listeners: new Set() };
function publish(patch) {
  Object.assign(run, patch);
  for (const listener of run.listeners) listener();
}
export function __resetThumbnailRun() {
  Object.assign(run, { active: false, stop: false, progress: null, error: null });
}

export default function PhotoThumbnails() {
  const [remaining, setRemaining] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [, setTick] = useState(0);
  const running = run.active;
  const progress = run.progress;
  const runError = run.error;

  useEffect(() => {
    const listener = () => setTick((n) => n + 1);
    run.listeners.add(listener);
    return () => { run.listeners.delete(listener); };
  }, []);

  const countRemaining = useCallback(async () => {
    setLoadError(null);
    try {
      const rows = await fetchPage(null, 1);
      setRemaining(rows.length ? Number(rows[0].total_needing) || rows.length : 0);
    } catch (error) {
      setRemaining(null);
      setLoadError(notInstalled(error)
        ? 'The list of photos is not installed on the database yet (migration 20261016090800_photo_thumbnails.sql). It installs with this release; try again in a few minutes.'
        : `Could not count the photos: ${error?.message || 'unknown error'}`);
    }
  }, []);

  useEffect(() => { countRemaining(); }, [countRemaining]);

  const start = async () => {
    if (run.active) return;
    publish({ active: true, stop: false, progress: null, error: null });
    try {
      const result = await runBackfill({
        fetchPage,
        makeOne: (row) => makeOneThumbnail(row, {
          storage: supabase.storage,
          makeThumbnail,
          convertHeic: convertHeicForUpload,
        }),
        shouldStop: () => run.stop,
        onProgress: (p) => publish({ progress: p }),
      });
      publish({ progress: result });
    } catch (error) {
      // Only the page fetch can end a run early; each photo's own failure
      // is counted and the run carries on.
      publish({ error: `The run stopped: ${error?.message || 'unknown error'}. Start again to carry on.` });
    } finally {
      publish({ active: false });
      countRemaining();
    }
  };

  const failures = progress?.failures || [];
  const finished = progress && !running;

  return (
    <Card className="bg-slate-900 border-slate-700">
      <CardHeader>
        <CardTitle className="text-slate-100 flex items-center gap-2">
          <ImageDown className="w-5 h-5" /> Photo thumbnails
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm text-slate-300">
        <p className="max-w-3xl">
          Gecko cards, lists and lineage trees load a small copy of each photo ({THUMBNAIL.maxEdge} pixels on
          the long side) instead of the full photo. Photos uploaded since 16 October 2026 get theirs
          automatically. This makes them for older photos, here in your browser, using your admin login.
        </p>
        <p className="max-w-3xl text-slate-400">
          Run it on a computer, not a phone (it opens two full-size photos at a time), and keep this tab
          open while it runs. You can stop at any time and start again later: photos that
          already have a thumbnail are skipped. A photo that fails is counted and left for the next run.
          A thumbnail someone other than the photo&apos;s owner uploaded is replaced.
        </p>

        <div className="rounded-lg border border-slate-700 bg-slate-950/60 p-3" aria-live="polite">
          {loadError ? (
            <p className="text-amber-300">{loadError}</p>
          ) : remaining === null ? (
            <p className="text-slate-400">Counting photos…</p>
          ) : (
            <p>
              <span className="font-semibold text-slate-100">{remaining.toLocaleString()}</span>{' '}
              {remaining === 1 ? 'photo needs' : 'photos need'} a thumbnail.
            </p>
          )}
          {progress && (
            <p className="mt-1" data-testid="thumbnail-progress">
              {running ? 'Working: ' : progress.stopped ? 'Stopped: ' : 'Done: '}
              made {progress.made.toLocaleString()} of {progress.total.toLocaleString()}
              {progress.failed ? `, ${progress.failed.toLocaleString()} failed` : ''}
              {progress.skipped ? `, ${progress.skipped.toLocaleString()} skipped` : ''}.
              {running && progress.current ? <span className="block truncate text-slate-500">{progress.current}</span> : null}
            </p>
          )}
          {runError && <p className="mt-1 text-rose-300">{runError}</p>}
        </div>

        <div className="flex flex-wrap gap-2">
          {running ? (
            <Button variant="outline" onClick={() => publish({ stop: true })}>
              <Square className="w-4 h-4 mr-2" /> Stop after the current photos
            </Button>
          ) : (
            <Button onClick={start} disabled={Boolean(loadError) || remaining === 0}>
              {remaining === 0 ? 'Every photo has a thumbnail' : 'Make thumbnails'}
            </Button>
          )}
          {running && <Loader2 className="w-5 h-5 animate-spin text-emerald-400 self-center" aria-hidden="true" />}
        </div>

        {finished && failures.length > 0 && (
          <div>
            <p className="font-medium text-slate-200">
              {failures.length === 1 ? 'One photo failed' : `${failures.length.toLocaleString()} photos failed`}.
              {' '}They stay on the list for the next run. The first ten:
            </p>
            <ul className="mt-1 space-y-0.5 text-xs text-slate-400">
              {failures.slice(0, 10).map((f) => (
                <li key={f.name} className="truncate">{f.name}: {f.message}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
