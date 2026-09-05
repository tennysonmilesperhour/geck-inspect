import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ScanSearch, ShieldAlert } from 'lucide-react';
import { MORPH_ID_CAPABILITIES, labelFor } from './morphTaxonomy';

export default function MorphIdCoverageCard() {
  return (
    <Card className="bg-slate-900/70 border-slate-700">
      <CardContent className="p-5">
        <details>
          <summary className="list-none cursor-pointer flex items-start justify-between gap-4">
            <div className="flex gap-3">
              <ScanSearch className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-slate-100">What Morph ID checks</p>
                <p className="text-sm text-slate-400 mt-1">
                  Pattern, pinning, banding, spotting, color, white placement, and visible genetic expression.
                </p>
              </div>
            </div>
            <span className="text-xs text-emerald-300 shrink-0 mt-1">View coverage</span>
          </summary>

          <div className="mt-5 pt-5 border-t border-slate-700 space-y-4">
            {MORPH_ID_CAPABILITIES.map((group) => (
              <div key={group.id}>
                <p className="text-xs uppercase tracking-wide text-slate-500 mb-2">{group.label}</p>
                <div className="flex flex-wrap gap-2">
                  {group.items.map((item) => (
                    <Badge key={item} variant="secondary" className="bg-slate-800 text-slate-200 border border-slate-700">
                      {labelFor(item)}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
            <div className="rounded-md border border-amber-800/70 bg-amber-950/20 p-3 flex gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-100/80">
                Photos can suggest visible expression, but cannot prove a genetic line, hidden het, or inheritance. Axanthic line and other lineage claims stay unverified until records support them.
              </p>
            </div>
          </div>
        </details>
      </CardContent>
    </Card>
  );
}
