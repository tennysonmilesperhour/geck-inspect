import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Images } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { labelFor } from './morphTaxonomy';

function friendlyEmbedError(raw) {
  const lower = String(raw || '').toLowerCase();
  if (lower.includes('429') || lower.includes('rate limit') || lower.includes('throttled')) {
    return 'Visual comparison is busy right now. The morph assessment still used the photo evidence.';
  }
  return 'Visual neighbors were unavailable for this assessment.';
}

function EvidenceStrip({ matches, isLoading, error, isAdmin, source = 'legacy' }) {
  const fromRecognition = source === 'recognition';
  return (
    <Card className="bg-slate-900 border-slate-700">
      <CardContent className="p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Images className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm uppercase tracking-wide text-slate-300">
            Visual evidence from the corpus
          </h3>
          {isLoading && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
        </div>
        {error && (
          isAdmin ? (
            <p className="text-xs font-mono text-rose-300 break-words">[admin] {error}</p>
          ) : (
            <p className="text-xs text-slate-400">{friendlyEmbedError(error)}</p>
          )
        )}
        {!isLoading && !error && matches && matches.length === 0 && (
          <p className="text-xs text-slate-500">
            The indexed corpus did not contain a close enough visual neighbor yet.
          </p>
        )}
        {matches && matches.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            {matches.slice(0, 6).map((match, index) => (
              <div key={match.id} className="space-y-1">
                <img
                  src={match.image_url}
                  alt={`Visual comparison labeled ${labelFor(match.primary_morph)}`}
                  className="aspect-square w-full object-cover rounded-md border border-slate-700"
                  loading="lazy"
                />
                <p className="text-xs font-medium text-slate-200 truncate">
                  {labelFor(match.primary_morph)}
                </p>
                <Badge variant="secondary" className="text-[10px] bg-slate-800 text-slate-300">
                  neighbor {index + 1}
                </Badge>
              </div>
            ))}
          </div>
        )}
        {matches && matches.length > 0 && (
          <p className="text-xs text-slate-500">
            {fromRecognition
              ? 'These query-specific examples influenced the assessment. Listing labels are weighted as weak evidence, de-duplicated by source, and never treated as proof.'
              : 'These examples are ranked by general visual similarity. Their labels are comparison evidence, not proof.'}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function OnDemandVisualSearch({ imageUrl, isAdmin }) {
  const [matches, setMatches] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!imageUrl) return undefined;
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
            } catch { /* ignore response parsing errors */ }
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

  return (
    <EvidenceStrip
      matches={matches}
      isLoading={isLoading}
      error={error}
      isAdmin={isAdmin}
    />
  );
}

export default function SimilarGeckosStrip({ imageUrl, evidence }) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  if (!imageUrl) return null;

  if (evidence) {
    return (
      <EvidenceStrip
        matches={evidence.neighbors || []}
        isLoading={false}
        error={evidence.status === 'unavailable' ? evidence.note || 'Visual evidence unavailable' : null}
        isAdmin={isAdmin}
        source="recognition"
      />
    );
  }

  return <OnDemandVisualSearch imageUrl={imageUrl} isAdmin={isAdmin} />;
}
