import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search } from 'lucide-react';
import GeneticCalculator from './GeneticCalculator';

/**
 * Genetic calculator tab — picks any two geckos from the user's collection
 * and renders the punnett-square predictions via the underlying
 * GeneticCalculator component. Extracted from src/pages/Breeding.jsx as
 * part of the hairball cleanup.
 */
export default function GeneticCalculatorTab({ geckos }) {
  const [sireId, setSireId] = useState('');
  const [damId, setDamId] = useState('');

  const allGeckos = geckos.filter((g) => !g.archived);
  const sire = allGeckos.find((g) => g.id === sireId) || null;
  const dam = allGeckos.find((g) => g.id === damId) || null;

  const handleSwap = () => {
    const prev = sireId;
    setSireId(damId);
    setDamId(prev);
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-xl p-5">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 items-end">
          <div className="space-y-2">
            <Label className="text-blue-400 font-semibold">♂ Parent A</Label>
            <Select value={sireId} onValueChange={setSireId}>
              <SelectTrigger className="bg-slate-800 border-blue-700 text-slate-100">
                <SelectValue placeholder="Select gecko..." />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-600 text-slate-200">
                {allGeckos
                  .filter((g) => g.id !== damId)
                  .map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.name} — {g.sex}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            {sire && (
              <div className="flex items-center gap-2">
                {sire.image_urls?.[0] && (
                  <img
                    src={sire.image_urls[0]}
                    alt={sire.name}
                    className="w-8 h-8 rounded object-cover border border-blue-700"
                  />
                )}
                <span className="text-xs text-slate-400">
                  {(sire.morph_tags || []).length} morph tags
                </span>
              </div>
            )}
          </div>
          <div className="flex justify-center pb-1">
            <Button
              variant="outline"
              size="icon"
              onClick={handleSwap}
              className="border-slate-600 hover:bg-slate-700 rounded-full"
              title="Swap"
            >
              <Search className="w-4 h-4 rotate-90" />
            </Button>
          </div>
          <div className="space-y-2">
            <Label className="text-pink-400 font-semibold">♀ Parent B</Label>
            <Select value={damId} onValueChange={setDamId}>
              <SelectTrigger className="bg-slate-800 border-pink-700 text-slate-100">
                <SelectValue placeholder="Select gecko..." />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-600 text-slate-200">
                {allGeckos
                  .filter((g) => g.id !== sireId)
                  .map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.name} — {g.sex}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            {dam && (
              <div className="flex items-center gap-2">
                {dam.image_urls?.[0] && (
                  <img
                    src={dam.image_urls[0]}
                    alt={dam.name}
                    className="w-8 h-8 rounded object-cover border border-pink-700"
                  />
                )}
                <span className="text-xs text-slate-400">
                  {(dam.morph_tags || []).length} morph tags
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="bg-slate-900 border border-slate-700 rounded-xl p-5">
        <GeneticCalculator sire={sire} dam={dam} />
      </div>
    </div>
  );
}
