import GeckoImage from '@/components/shared/GeckoImage';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Images } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { labelFor } from './morphTaxonomy';

function friendlyEmbedError(raw) {
  const lower = String(raw || '').toLowerCase();
  if (lower.includes('429') || lower.includes('rate limit') || lower.includes('throttled')) {
    return 'Visual comparison is busy right now. The morph assessment still used the photo evidence.';
  }
  return 'Visual neighbors were unavailable for this assessment.';
}

function EvidenceStrip({ matches, error, isAdmin }) {
  return (
    <Card>
      <CardContent className="p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Images className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm uppercase tracking-wide text-slate-300">
            Visual evidence from the corpus
          </h3>
        </div>
        {error && (
          isAdmin ? (
            <p className="text-xs font-mono text-rose-300 break-words">[admin] {error}</p>
          ) : (
            <p className="text-xs text-slate-400">{friendlyEmbedError(error)}</p>
          )
        )}
        {!error && matches && matches.length === 0 && (
          <p className="text-xs text-slate-500">
            The indexed corpus did not contain a close enough visual neighbor yet.
          </p>
        )}
        {matches && matches.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            {matches.slice(0, 6).map((match, index) => (
              <div key={match.id} className="space-y-1">
                <GeckoImage
                  src={match.image_url}
                  alt={`Visual comparison labeled ${labelFor(match.primary_morph)}`}
                  className="aspect-square w-full object-cover rounded-md border border-slate-700"
                  loading="lazy"
                  width={480}
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
            These are the closest reference photos, each tagged by the breeder who listed that animal. Breeder tags are good evidence for those animals, but your own photos decide.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * The closest breeder-tagged reference photos Morph ID compared the
 * member's photos with (the answer's visual_evidence, found on the server
 * in the same request the member said yes to).
 *
 * An answer without visual_evidence (only an old stored answer) shows no
 * strip. Until 28 Oct 2026 the strip then ran its own visual search, which
 * asked with the browser's confirm box; the iPhone app does not reliably
 * show one, and Morph ID's permission step is now on the page
 * (AiConsentPanel), so that second request to Replicate was removed.
 */
export default function SimilarGeckosStrip({ imageUrl, evidence }) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  if (!imageUrl || !evidence) return null;

  return (
    <EvidenceStrip
      matches={evidence.neighbors || []}
      error={evidence.status === 'unavailable' ? evidence.note || 'Visual evidence unavailable' : null}
      isAdmin={isAdmin}
    />
  );
}
