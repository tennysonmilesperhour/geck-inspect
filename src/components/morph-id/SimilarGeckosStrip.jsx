import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Images } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { labelFor } from './morphTaxonomy';

export default function SimilarGeckosStrip({ imageUrl }) {
  const [matches, setMatches] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!imageUrl) return;
    let cancelled = false;

    (async () => {
      setIsLoading(true);
      setError(null);
      try {
        const embedRes = await supabase.functions.invoke('embed-gecko-image', {
          body: { imageUrl },
        });
        if (embedRes.error) {
          let detail = embedRes.error.message;
          const ctx = embedRes.error.context;
          if (ctx && typeof ctx.text === 'function') {
            try {
              const body = await ctx.text();
              if (body) {
                try {
                  const parsed = JSON.parse(body);
                  detail = parsed?.error || body;
                } catch {
                  detail = body;
                }
              }
            } catch { /* ignore */ }
          }
          throw new Error(detail);
        }
        const embedding = embedRes.data?.embedding;
        if (!Array.isArray(embedding)) throw new Error('no embedding returned');

        const { data, error: rpcError } = await supabase.rpc('nearest_training_samples', {
          query_embedding: embedding,
          match_count: 6,
          verified_only: true,
        });
        if (rpcError) throw rpcError;
        if (!cancelled) setMatches(data || []);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Similarity search failed');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [imageUrl]);

  if (!imageUrl) return null;

  return (
    <Card className="bg-slate-900 border-slate-700">
      <CardContent className="p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Images className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm uppercase tracking-wide text-slate-300">
            Closest verified samples
          </h3>
          {isLoading && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
        </div>
        {error && <p className="text-xs text-rose-300">{error}</p>}
        {!isLoading && matches && matches.length === 0 && (
          <p className="text-xs text-slate-500">
            No labeled samples close enough yet. Keep contributing ,  each
            verified sample grows the retrieval index.
          </p>
        )}
        {matches && matches.length > 0 && (
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
            {matches.map((m) => (
              <div key={m.id} className="space-y-1">
                <img
                  src={m.image_url}
                  alt={labelFor(m.primary_morph)}
                  className="aspect-square object-cover rounded-md border border-slate-700"
                  loading="lazy"
                />
                <p className="text-xs font-medium text-slate-200 truncate">
                  {labelFor(m.primary_morph)}
                </p>
                <Badge variant="secondary" className="text-[10px] bg-slate-800 text-slate-300">
                  {Math.round((m.similarity ?? 0) * 100)}% match
                </Badge>
              </div>
            ))}
          </div>
        )}
        {matches && matches.length > 0 && (
          <p className="text-xs text-slate-500">
            These are expert-verified geckos that visually resemble your photo.
            If several share a morph, that's strong corroborating evidence.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
