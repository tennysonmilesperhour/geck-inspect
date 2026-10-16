import GeckoImage from '@/components/shared/GeckoImage';
import { ArrowLeftRight } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

function ParentPreview({ gecko, borderClass }) {
  if (!gecko) return null;
  return (
    <div className="flex items-center gap-2 mt-1">
      <GeckoImage src={gecko?.image_urls?.[0]} alt={gecko.name} width={96} className={`w-10 h-10 rounded object-cover border ${borderClass}`} />
      <div>
        <p className="text-xs text-slate-300 font-medium">{gecko.name}</p>
        <p className="text-xs text-slate-500">{(gecko.morph_tags || []).length} morph tags</p>
      </div>
    </div>
  );
}

/**
 * The calculator's "From my collection" mode: pick a sire and a dam from
 * the member's saved geckos. Signed-in members only.
 *
 * It lives in its own file, loaded with the genetics engine below the
 * calculator's spinner (./calculatorEngineParts.js), so the drop-down
 * code it needs does not download with the calculator page for visitors
 * who never see it.
 */
export default function CollectionParentPicker({
  sireId,
  damId,
  onSireChange,
  onDamChange,
  sireOptions,
  damOptions,
  sire,
  dam,
  onSwap,
}) {
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 mb-6">
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 items-end">
        <div className="space-y-2">
          <Label id="calc-sire-label" className="text-blue-400 font-semibold">♂ Parent A (Sire)</Label>
          <Select value={sireId} onValueChange={onSireChange}>
            <SelectTrigger id="calc-sire-pick" aria-labelledby="calc-sire-label calc-sire-pick" className="bg-slate-800 border-blue-700 text-slate-100">
              <SelectValue placeholder="Select gecko..." />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-600 text-slate-200">
              {sireOptions.map(g => (
                <SelectItem key={g.id} value={g.id}>
                  {g.name}{g.gecko_id_code ? ` (${g.gecko_id_code})` : ''}, {g.sex}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <ParentPreview gecko={sire} borderClass="border-blue-700" />
        </div>
        <div className="flex justify-center pb-1">
          <Button
            variant="outline"
            size="icon"
            onClick={onSwap}
            className="border-slate-600 hover:bg-slate-700 rounded-full"
            title="Swap parents"
            aria-label="Swap sire and dam"
          >
            <ArrowLeftRight className="w-4 h-4" />
          </Button>
        </div>
        <div className="space-y-2">
          <Label id="calc-dam-label" className="text-pink-400 font-semibold">♀ Parent B (Dam)</Label>
          <Select value={damId} onValueChange={onDamChange}>
            <SelectTrigger id="calc-dam-pick" aria-labelledby="calc-dam-label calc-dam-pick" className="bg-slate-800 border-pink-700 text-slate-100">
              <SelectValue placeholder="Select gecko..." />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-600 text-slate-200">
              {damOptions.map(g => (
                <SelectItem key={g.id} value={g.id}>
                  {g.name}{g.gecko_id_code ? ` (${g.gecko_id_code})` : ''}, {g.sex}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <ParentPreview gecko={dam} borderClass="border-pink-700" />
        </div>
      </div>
    </div>
  );
}
