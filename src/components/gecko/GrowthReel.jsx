import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Play, Pause, Download, Film, Loader2, Crown, LogIn } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { createPageUrl } from '@/utils';
import { consumeFeatureCredit } from '@/lib/usageMeter';
import {
  buildReelFrames,
  PLAYER_FRAME_MS,
  EXPORT_FRAME_MS,
  EXPORT_CROSSFADE_MS,
  EXPORT_TAIL_HOLD_MS,
} from '@/lib/growthReel';

/**
 * Growth Reel: an auto-generated time-lapse of a gecko growing up, built
 * from the photos already on the record. In-app playback is free and
 * uses plain <img> crossfades. The "Download reel" export renders the
 * same frames to a canvas, records it with MediaRecorder, and is metered
 * via consumeFeatureCredit('growth_reel').
 *
 * Props:
 *   gecko   - gecko record (image_urls, image_crop_data, hatch_date, name)
 *   weights - WeightRecord rows for this gecko (record_date, weight_grams)
 *   user    - signed-in user or null/undefined for guests
 */

const EXPORT_WIDTH = 720;
const EXPORT_HEIGHT = 900; // 4:5, the friendliest crop for IG/Facebook feeds
const SPEED_OPTIONS = [0.5, 1, 2];

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Supabase storage serves permissive CORS headers, so anonymous
    // cross-origin loads keep the canvas untainted and exportable.
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('One of the photos could not be loaded.'));
    img.src = url;
  });
}

/** Draws an image cover-fit into a w x h canvas, honoring crop rotation. */
function drawCover(ctx, img, w, h, rotationDeg = 0) {
  ctx.save();
  ctx.translate(w / 2, h / 2);
  if (rotationDeg) ctx.rotate((rotationDeg * Math.PI) / 180);
  const quarterTurn = Math.abs(rotationDeg % 180) === 90;
  const targetW = quarterTurn ? h : w;
  const targetH = quarterTurn ? w : h;
  const scale = Math.max(targetW / img.width, targetH / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
  ctx.restore();
}

/** Caption strip plus the name + geckinspect.com watermark. */
function drawOverlays(ctx, w, h, name, caption) {
  const gradient = ctx.createLinearGradient(0, h - 150, 0, h);
  gradient.addColorStop(0, 'rgba(2, 6, 23, 0)');
  gradient.addColorStop(1, 'rgba(2, 6, 23, 0.88)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, h - 150, w, 150);

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#ffffff';
  ctx.font = '600 30px system-ui, -apple-system, sans-serif';
  ctx.fillText(name, 24, h - 62);
  if (caption) {
    ctx.fillStyle = 'rgba(226, 232, 240, 0.95)';
    ctx.font = '24px system-ui, -apple-system, sans-serif';
    ctx.fillText(caption, 24, h - 26);
  }
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(52, 211, 153, 0.95)'; // emerald-400 watermark
  ctx.font = '600 22px system-ui, -apple-system, sans-serif';
  ctx.fillText('geckinspect.com', w - 24, h - 26);
  ctx.textAlign = 'left';
}

/** Renders the frame sequence to a canvas stream and resolves to a webm Blob. */
async function recordReel({ frames, images, name, mimeType }) {
  const canvas = document.createElement('canvas');
  canvas.width = EXPORT_WIDTH;
  canvas.height = EXPORT_HEIGHT;
  const ctx = canvas.getContext('2d');

  // Taint check before recording: if any photo came from a host without
  // CORS headers the canvas is tainted and captureStream produces black
  // or throws. getImageData throws a SecurityError we catch upstream.
  drawCover(ctx, images[0], canvas.width, canvas.height, frames[0].rotation);
  ctx.getImageData(0, 0, 1, 1);

  const stream = canvas.captureStream(30);
  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: 6_000_000,
  });
  const chunks = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };
  const stopped = new Promise((resolve, reject) => {
    recorder.onstop = resolve;
    recorder.onerror = (e) => reject(e.error || new Error('Recording failed.'));
  });
  recorder.start(250);

  const totalMs = frames.length * EXPORT_FRAME_MS;
  const start = performance.now();
  await new Promise((resolve) => {
    const tick = (nowTs) => {
      const elapsed = nowTs - start;
      if (elapsed >= totalMs + EXPORT_TAIL_HOLD_MS) {
        resolve();
        return;
      }
      const clamped = Math.min(elapsed, totalMs - 1);
      const i = Math.floor(clamped / EXPORT_FRAME_MS);
      const local = clamped - i * EXPORT_FRAME_MS;

      drawCover(ctx, images[i], canvas.width, canvas.height, frames[i].rotation);
      const fadeStart = EXPORT_FRAME_MS - EXPORT_CROSSFADE_MS;
      if (i < frames.length - 1 && local > fadeStart) {
        ctx.globalAlpha = (local - fadeStart) / EXPORT_CROSSFADE_MS;
        drawCover(ctx, images[i + 1], canvas.width, canvas.height, frames[i + 1].rotation);
        ctx.globalAlpha = 1;
      }
      drawOverlays(ctx, canvas.width, canvas.height, name, frames[i].caption);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  recorder.stop();
  await stopped;
  return new Blob(chunks, { type: mimeType });
}

export default function GrowthReel({ gecko, weights = [], user }) {
  const frames = useMemo(() => buildReelFrames(gecko, weights), [gecko, weights]);
  const [index, setIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [isExporting, setIsExporting] = useState(false);
  const [gate, setGate] = useState(null); // null | 'guest' | 'exhausted'
  const exportingRef = useRef(false);

  // Feature detection for export: MediaRecorder + canvas.captureStream +
  // a webm codec the browser will actually encode. Safari historically
  // fails one of these three, in which case we hide the download button
  // and keep the in-app player.
  const exportMimeType = useMemo(() => {
    if (typeof window === 'undefined') return null;
    if (typeof window.MediaRecorder === 'undefined') return null;
    if (
      typeof HTMLCanvasElement === 'undefined' ||
      typeof HTMLCanvasElement.prototype.captureStream !== 'function'
    ) {
      return null;
    }
    const candidates = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
    return (
      candidates.find((type) => {
        try {
          return window.MediaRecorder.isTypeSupported(type);
        } catch {
          return false;
        }
      }) || null
    );
  }, []);

  useEffect(() => {
    if (!isPlaying || frames.length < 2) return undefined;
    const id = setInterval(
      () => setIndex((i) => (i + 1) % frames.length),
      PLAYER_FRAME_MS / speed,
    );
    return () => clearInterval(id);
  }, [isPlaying, speed, frames.length]);

  // Keep the index valid if photos get removed while mounted.
  useEffect(() => {
    setIndex((i) => Math.min(i, Math.max(0, frames.length - 1)));
  }, [frames.length]);

  // A reel needs an arc: fewer than 3 photos is a before/after, not a time-lapse.
  if (frames.length < 3) return null;

  const geckoName = gecko?.name || 'My gecko';
  const currentFrame = frames[Math.min(index, frames.length - 1)];

  const handleDownload = async () => {
    if (exportingRef.current) return;
    setGate(null);

    let credit;
    try {
      // Metered: one credit per export attempt, never for in-app playback.
      credit = await consumeFeatureCredit('growth_reel', user);
    } catch (err) {
      toast({
        title: 'Could not start the export',
        description: err?.message || 'Please try again in a moment.',
        variant: 'destructive',
      });
      return;
    }
    if (!credit.ok) {
      setGate(credit.guest ? 'guest' : 'exhausted');
      return;
    }

    exportingRef.current = true;
    setIsExporting(true);
    setIsPlaying(false);
    try {
      const images = await Promise.all(frames.map((f) => loadImage(f.url)));
      const blob = await recordReel({
        frames,
        images,
        name: geckoName,
        mimeType: exportMimeType,
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const slug = geckoName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'gecko';
      link.download = `${slug}-growth-reel.webm`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast({
        title: 'Growth reel downloaded',
        description: `${frames.length} photos of ${geckoName} in one clip. Ready to share.`,
      });
    } catch (err) {
      const tainted = err?.name === 'SecurityError';
      toast({
        title: tainted ? 'Export not available for these photos' : 'Export failed',
        description: tainted
          ? 'Some of these photos are hosted where cross-origin export is blocked, so the browser will not let us save them to video. The in-app player still works.'
          : err?.message || 'Something went wrong while recording the reel.',
        variant: 'destructive',
      });
    } finally {
      exportingRef.current = false;
      setIsExporting(false);
    }
  };

  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-white flex items-center gap-2 text-base">
            <Film className="w-4 h-4 text-emerald-400" />
            Growth Reel
          </CardTitle>
          {exportMimeType && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
              disabled={isExporting}
            >
              {isExporting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              {isExporting ? 'Recording...' : 'Download reel'}
            </Button>
          )}
        </div>
        <p className="text-xs text-slate-400">
          {geckoName} growing up, stitched from {frames.length} photos. Ages are
          estimated from the photo order.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="relative w-full overflow-hidden rounded-lg bg-slate-900 aspect-[4/5]">
          {frames.map((frame, i) => (
            <img
              key={frame.url}
              src={frame.url}
              alt={`${geckoName} at ${frame.ageLabel || `photo ${i + 1}`}`}
              draggable={false}
              className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ease-in-out ${
                i === index ? 'opacity-100' : 'opacity-0'
              }`}
              style={frame.rotation ? { transform: `rotate(${frame.rotation}deg)` } : undefined}
            />
          ))}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/90 to-transparent px-4 pb-3 pt-10 pointer-events-none">
            <p className="text-white font-semibold text-sm leading-tight">{geckoName}</p>
            {currentFrame.caption && (
              <p className="text-slate-200 text-xs">{currentFrame.caption}</p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => setIsPlaying((p) => !p)}
            aria-label={isPlaying ? 'Pause reel' : 'Play reel'}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </Button>

          <div className="flex items-center gap-1.5 flex-wrap justify-center min-w-0">
            {frames.map((frame, i) => (
              <button
                key={frame.url}
                type="button"
                onClick={() => {
                  setIndex(i);
                  setIsPlaying(false);
                }}
                aria-label={`Jump to photo ${i + 1}`}
                className={`h-2 w-2 rounded-full transition-colors ${
                  i === index ? 'bg-emerald-400' : 'bg-slate-600 hover:bg-slate-400'
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {SPEED_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setSpeed(option)}
                className={`px-1.5 py-0.5 rounded text-xs font-medium transition-colors ${
                  speed === option
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                {option}x
              </button>
            ))}
          </div>
        </div>

        {gate === 'exhausted' && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 flex items-start gap-3">
            <Crown className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
            <div className="text-sm">
              <p className="text-amber-200 font-medium">
                You have used all of this month&apos;s growth reel downloads.
              </p>
              <p className="text-slate-300 text-xs mt-1">
                Reel exports are limited per month on your current plan. Upgrade
                to keep sharing {geckoName}&apos;s glow-up.
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
              <p className="text-emerald-200 font-medium">Sign in to download reels</p>
              <p className="text-slate-300 text-xs mt-1">
                Reel downloads need an account so we can track your monthly
                allotment. Playback here is always free.
              </p>
              <Link to={createPageUrl('AuthPortal')} className="inline-block mt-2">
                <Button size="sm">Sign in</Button>
              </Link>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
