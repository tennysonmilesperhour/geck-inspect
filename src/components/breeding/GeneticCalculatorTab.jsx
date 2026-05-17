import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ArrowLeftRight, ChevronsUpDown, Check, X } from 'lucide-react';
import GeneticCalculator from './GeneticCalculator';

function ParentPicker({ label, accent, geckos, selectedId, onSelect, excludeId }) {
  const [open, setOpen] = useState(false);
  const selected = geckos.find((g) => g.id === selectedId) || null;
  const choices = useMemo(
    () => geckos.filter((g) => g.id !== excludeId),
    [geckos, excludeId]
  );

  const borderClass =
    accent === 'blue'
      ? 'border-blue-700 focus:ring-blue-500/40'
      : 'border-pink-700 focus:ring-pink-500/40';
  const labelClass = accent === 'blue' ? 'text-blue-400' : 'text-pink-400';
  const thumbBorder = accent === 'blue' ? 'border-blue-700' : 'border-pink-700';

  return (
    <div className="space-y-2 min-w-0">
      <Label className={`${labelClass} font-semibold`}>{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            role="combobox"
            aria-expanded={open}
            className={`w-full h-10 flex items-center justify-between gap-2 rounded-md bg-slate-800 px-3 text-sm text-slate-100 border ${borderClass} focus:outline-none focus:ring-2 transition`}
          >
            <span className={`truncate ${selected ? '' : 'text-slate-400'}`}>
              {selected
                ? `${selected.name}${selected.sex ? ` · ${selected.sex}` : ''}`
                : 'Select gecko...'}
            </span>
            <ChevronsUpDown className="w-4 h-4 text-slate-400 shrink-0" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="p-0 bg-slate-800 border-slate-600 text-slate-200 w-[--radix-popover-trigger-width]"
          align="start"
        >
          <Command className="bg-slate-800 text-slate-200">
            <CommandInput
              placeholder="Search by name, morph, or ID..."
              className="text-slate-100 placeholder:text-slate-500"
            />
            <CommandList className="max-h-72">
              <CommandEmpty className="py-6 text-center text-sm text-slate-400">
                No matches in your collection.
              </CommandEmpty>
              {selected && (
                <CommandGroup heading="Current selection">
                  <CommandItem
                    value="__clear__"
                    onSelect={() => {
                      onSelect('');
                      setOpen(false);
                    }}
                    className="text-rose-300 aria-selected:bg-slate-700 aria-selected:text-rose-200"
                  >
                    <X className="w-4 h-4 mr-2" /> Clear selection
                  </CommandItem>
                </CommandGroup>
              )}
              <CommandGroup heading={`${choices.length} gecko${choices.length === 1 ? '' : 's'} in collection`}>
                {choices.map((g) => {
                  const morphs = g.morphs_traits || (g.morph_tags || []).join(', ');
                  const searchKey = [g.name, g.sex, g.gecko_id_code, morphs]
                    .filter(Boolean)
                    .join(' ');
                  return (
                    <CommandItem
                      key={g.id}
                      value={`${searchKey} ${g.id}`}
                      onSelect={() => {
                        onSelect(g.id);
                        setOpen(false);
                      }}
                      className="aria-selected:bg-slate-700 aria-selected:text-slate-50 cursor-pointer"
                    >
                      {g.image_urls?.[0] ? (
                        <img
                          src={g.image_urls[0]}
                          alt=""
                          className="w-7 h-7 rounded object-cover mr-2 shrink-0"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-7 h-7 rounded bg-slate-700 mr-2 shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-slate-100 truncate">
                          {g.name}
                          {g.sex ? <span className="text-slate-400"> · {g.sex}</span> : null}
                        </div>
                        {morphs && (
                          <div className="text-[11px] text-slate-400 truncate">{morphs}</div>
                        )}
                      </div>
                      {g.id === selectedId && <Check className="w-4 h-4 ml-2 text-emerald-400" />}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {selected && (
        <div className="flex items-center gap-2">
          {selected.image_urls?.[0] && (
            <img
              src={selected.image_urls[0]}
              alt={selected.name}
              className={`w-8 h-8 rounded object-cover border ${thumbBorder}`}
            />
          )}
          <span className="text-xs text-slate-400">
            {(selected.morph_tags || []).length} morph tags
          </span>
        </div>
      )}
    </div>
  );
}

export default function GeneticCalculatorTab({ geckos }) {
  const [sireId, setSireId] = useState('');
  const [damId, setDamId] = useState('');

  const allGeckos = geckos.filter((g) => !g.archived);
  const sire = allGeckos.find((g) => g.id === sireId) || null;
  const dam = allGeckos.find((g) => g.id === damId) || null;

  const canSwap = !!(sireId || damId);
  const handleSwap = () => {
    setSireId(damId);
    setDamId(sireId);
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-xl p-5">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 items-end">
          <ParentPicker
            label="♂ Parent A"
            accent="blue"
            geckos={allGeckos}
            selectedId={sireId}
            onSelect={setSireId}
            excludeId={damId}
          />
          <div className="flex justify-center pb-1">
            <Button
              variant="outline"
              size="icon"
              onClick={handleSwap}
              disabled={!canSwap}
              className="border-slate-600 hover:bg-slate-700 rounded-full disabled:opacity-40 disabled:cursor-not-allowed"
              title="Swap Parent A and Parent B"
              aria-label="Swap Parent A and Parent B"
            >
              <ArrowLeftRight className="w-4 h-4" />
            </Button>
          </div>
          <ParentPicker
            label="♀ Parent B"
            accent="pink"
            geckos={allGeckos}
            selectedId={damId}
            onSelect={setDamId}
            excludeId={sireId}
          />
        </div>
      </div>
      <div className="bg-slate-900 border border-slate-700 rounded-xl p-5">
        <GeneticCalculator sire={sire} dam={dam} />
      </div>
    </div>
  );
}
