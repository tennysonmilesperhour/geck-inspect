import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dna, Loader2 } from 'lucide-react';
import { Gecko } from '@/entities/all';
import { buildAncestry, inferHiddenHets } from '@/lib/genetics/hetInference';

/**
 * "Possible hidden genetics" card.
 *
 * Loads a gecko's lineage (up to 3 generations), runs the het-inference
 * model in lib/genetics/hetInference.js, and lists each recessive trait
 * the animal might secretly carry with a rough probability and the
 * lineage evidence behind it.
 *
 * Pure computation on the user's own collection data, so this surface is
 * unmetered: no AI call, no quota.
 *
 * Props:
 *   gecko, the subject gecko row (needs id and morph_tags)
 *
 * Renders nothing when there is no usable lineage and nothing to show,
 * so it can be dropped into a detail layout without leaving an empty box.
 */
export default function HiddenHetPanel({ gecko }) {
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState([]);
  const [hadLineage, setHadLineage] = useState(false);

  useEffect(() => {
    if (!gecko?.id) {
      setLoading(false);
      setEntries([]);
      setHadLineage(false);
      return undefined;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const ancestry = await buildAncestry(gecko.id, {
          maxDepth: 3,
          GeckoEntity: Gecko,
        });
        if (cancelled) return;
        const inferred = inferHiddenHets(gecko, ancestry);
        if (cancelled) return;
        setHadLineage(ancestry.length > 0);
        setEntries(inferred);
      } catch {
        if (!cancelled) {
          setHadLineage(false);
          setEntries([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [gecko]);

  // While loading we render nothing rather than a spinner box, to avoid a
  // flash of empty card for animals with no lineage (the common case).
  if (loading) {
    return (
      <div className="flex items-center justify-center py-4 text-slate-500">
        <Loader2 className="w-4 h-4 animate-spin mr-2" />
        <span className="text-xs">Checking lineage for hidden genetics...</span>
      </div>
    );
  }

  // Nothing to show and no lineage to reason from: render nothing.
  if (entries.length === 0 && !hadLineage) return null;

  return (
    <Card className="gecko-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-gecko-text flex items-center gap-2">
          <Dna className="w-5 h-5 text-gecko-accent" /> Possible hidden genetics
        </CardTitle>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="text-sm text-slate-400">
            Nothing in the recorded lineage suggests a hidden recessive
            carrier. As you add more ancestors with morph tags, estimates
            will sharpen here.
          </p>
        ) : (
          <ul className="space-y-3">
            {entries.map((entry) => (
              <li
                key={entry.traitName}
                className="rounded-lg border border-slate-800 bg-slate-900/40 p-3"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-semibold text-slate-100">
                    Het {entry.traitName}
                  </span>
                  <span className="text-sm font-semibold text-emerald-300 tabular-nums">
                    ~{Math.round(entry.probability * 100)}%
                  </span>
                </div>
                {entry.basis.length > 0 && (
                  <ul className="mt-1.5 space-y-0.5">
                    {entry.basis.map((line, i) => (
                      <li key={i} className="text-xs text-slate-500">
                        {line}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}

        <p className="mt-3 text-[11px] leading-relaxed text-slate-600">
          Estimates from recorded lineage only. Breeding trials or genetic
          testing confirm hets.
        </p>
      </CardContent>
    </Card>
  );
}
