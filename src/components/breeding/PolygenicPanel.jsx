import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Brush } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import {
  POLYGENIC_LOOKS,
  scoresFromTags,
  expressionBand,
} from '@/lib/genetics/polygenic';

/**
 * Polygenic looks panel: expression in, expression bands out.
 *
 * Deliberately a different visual language from the Mendelian results:
 * meters and words, never percentages or egg counts. "95% pinstripe"
 * (physical coverage) and "66% het" (probability) are the two
 * most-confused numbers in crestie listings; keeping expression as
 * meters and chance as eggs/percent is the fix.
 *
 * Scores seed from each parent's morph tags (Extreme Harlequin, Super
 * Dalmatian, and friends) and stay adjustable, because the tags say
 * "has the look" while the breeder knows how strong it really is.
 */

function Meter({ value }) {
  return (
    <div className="relative h-2 flex-1 rounded-full bg-gradient-to-r from-slate-700 via-purple-800/70 to-purple-400/90">
      <div
        className="absolute -top-1 w-1 h-4 rounded bg-slate-100 shadow"
        style={{ left: `calc(${Math.max(0, Math.min(100, value))}% - 2px)` }}
      />
    </div>
  );
}

export default function PolygenicPanel({ sireTags, damTags }) {
  const [open, setOpen] = useState(false);
  const seeded = useMemo(
    () => ({ sire: scoresFromTags(sireTags), dam: scoresFromTags(damTags) }),
    [sireTags, damTags],
  );
  const [scores, setScores] = useState(seeded);
  useEffect(() => setScores(seeded), [seeded]);

  const anyExpression = POLYGENIC_LOOKS.some(
    (l) => (scores.sire[l.id] || 0) > 0 || (scores.dam[l.id] || 0) > 0,
  );

  const setScore = (parent, id, v) =>
    setScores((s) => ({ ...s, [parent]: { ...s[parent], [id]: v } }));

  return (
    <div className="bg-slate-800 rounded-lg p-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-sm text-slate-300 hover:text-slate-100 w-full"
      >
        {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        <Brush className="w-4 h-4 text-purple-400" />
        Polygenic looks (Harlequin, Pinstripe, Dalmatian, Tiger)
        <span className="ml-auto text-xs text-slate-500">
          {anyExpression ? 'expression bands, not odds' : 'optional'}
        </span>
      </button>
      {open && (
        <div className="mt-3 space-y-4">
          <p className="text-xs text-slate-500">
            These looks are selectively bred, not Punnett-calculable, so this panel speaks in
            expression bands instead of percentages. Set how strongly each parent shows the look
            (0 = absent, 100 = as extreme as the hobby produces).
          </p>
          {POLYGENIC_LOOKS.map((look) => {
            const s = scores.sire[look.id] || 0;
            const d = scores.dam[look.id] || 0;
            const band = expressionBand(s, d);
            return (
              <div key={look.id} className="space-y-1.5">
                <p className="text-xs font-semibold text-slate-300">{look.label}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[['sire', s, 'text-blue-400', '♂'], ['dam', d, 'text-pink-400', '♀']].map(
                    ([parent, value, cls, glyph]) => (
                      <div key={parent} className="flex items-center gap-2">
                        <span className={`text-xs ${cls} w-4`}>{glyph}</span>
                        <Slider
                          value={[value]}
                          onValueChange={([v]) => setScore(parent, look.id, v)}
                          min={0}
                          max={100}
                          step={5}
                          className="flex-1"
                        />
                        <span className="text-xs font-mono text-slate-400 w-8 text-right">{value}</span>
                      </div>
                    ),
                  )}
                </div>
                {(s > 0 || d > 0) && (
                  <div className="flex items-center gap-3">
                    <Meter value={band.mid} />
                    <p className="text-xs text-slate-300 flex-1">
                      <span className="text-purple-200 font-medium">{band.headline}.</span>{' '}
                      <span className="text-slate-500">{band.detail}</span>
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
