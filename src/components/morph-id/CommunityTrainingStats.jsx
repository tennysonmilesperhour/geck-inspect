import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Users, ShieldCheck, Layers, Scale, TrendingUp, ArrowRight,
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { createPageUrl } from '@/utils';

// Public-facing flywheel strip for the Recognition page. The competitor's
// identifier is trained on a single breeder's bloodlines; ours is trained by
// the whole community, and this card makes that visible (and gives visitors
// a reason to add to it).
//
// Data sources, both cheap:
//   - gecko_image_stats() RPC: SECURITY DEFINER aggregate over gecko_images,
//     granted to anon, so this works for signed-out visitors too.
//   - classification_votes head-count: RLS only allows authenticated reads,
//     so guests get null/0 there and the metric simply hides itself.
//
// Results are cached in module scope + sessionStorage so revisiting
// Recognition during a session fires zero extra queries. Any failure renders
// null; this card must never block or degrade the Recognition flow.

const CACHE_KEY = 'gi.community_training_stats.v1';
let memoryCache = null;

function readSessionCache() {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeSessionCache(stats) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(stats));
  } catch {
    // Storage full or unavailable; module cache still covers the session.
  }
}

async function fetchStats() {
  const [statsRes, votesRes] = await Promise.all([
    supabase.rpc('gecko_image_stats').then((r) => r).catch(() => null),
    supabase
      .from('classification_votes')
      .select('id', { count: 'exact', head: true })
      .then((r) => r)
      .catch(() => ({ count: null })),
  ]);

  const raw = statsRes && !statsRes.error ? statsRes.data : null;
  if (!raw) return null;

  return {
    verifiedPhotos: Number(raw.verified) || 0,
    morphsCovered: Number(raw.morph_categories_seen) || 0,
    addedThisWeek: Number(raw.recent_week) || 0,
    communityCorrections:
      typeof votesRes?.count === 'number' ? votesRes.count : 0,
  };
}

export default function CommunityTrainingStats() {
  const [stats, setStats] = useState(memoryCache || readSessionCache());

  useEffect(() => {
    if (stats) {
      memoryCache = stats;
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const fresh = await fetchStats();
        if (cancelled || !fresh) return;
        memoryCache = fresh;
        writeSessionCache(fresh);
        setStats(fresh);
      } catch {
        // Leave stats null; the card just doesn't render.
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (!stats) return null;

  const metrics = [
    {
      id: 'verified',
      icon: ShieldCheck,
      value: stats.verifiedPhotos,
      label: 'Verified training photos',
    },
    {
      id: 'morphs',
      icon: Layers,
      value: stats.morphsCovered,
      label: 'Morphs covered',
    },
    {
      id: 'corrections',
      icon: Scale,
      value: stats.communityCorrections,
      label: 'Community corrections',
    },
    {
      id: 'recent',
      icon: TrendingUp,
      value: stats.addedThisWeek,
      label: 'Added this week',
    },
  ].filter((m) => Number.isFinite(m.value) && m.value > 0);

  if (metrics.length === 0) return null;

  const gridCols = {
    1: 'sm:grid-cols-1',
    2: 'sm:grid-cols-2',
    3: 'sm:grid-cols-3',
    4: 'sm:grid-cols-4',
  }[metrics.length];

  return (
    <Card className="bg-slate-900 border-slate-700">
      <CardContent className="p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-emerald-400" />
            <span className="text-sm font-semibold text-slate-100">
              Community-trained AI
            </span>
            <Badge
              variant="outline"
              className="border-emerald-600/50 text-emerald-300 text-[10px] uppercase tracking-wide"
            >
              Live dataset
            </Badge>
          </div>
          <Link
            to={createPageUrl('Training')}
            className="text-xs font-medium text-emerald-300 hover:text-emerald-200 inline-flex items-center gap-1"
          >
            Help make it smarter <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        <div className={`grid grid-cols-2 ${gridCols} gap-3`}>
          {metrics.map(({ id, icon: Icon, value, label }) => (
            <div
              key={id}
              className="rounded-lg bg-slate-800/60 border border-slate-700 p-3 text-center"
            >
              <Icon className="w-4 h-4 mx-auto mb-1 text-emerald-400" />
              <div className="text-xl font-bold text-slate-100">
                {value.toLocaleString()}
              </div>
              <div className="text-[11px] text-slate-400 leading-tight">
                {label}
              </div>
            </div>
          ))}
        </div>

        <p className="text-xs text-slate-500">
          Trained by the crested gecko community, not one breeder's collection.
          Every photo you identify and every correction you save makes the next
          ID sharper.
        </p>
      </CardContent>
    </Card>
  );
}
