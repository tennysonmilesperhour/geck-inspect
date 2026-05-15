import { useEffect, useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Loader2, Layers } from 'lucide-react';
import { Gecko } from '@/entities/all';
import { useToast } from '@/components/ui/use-toast';

const SEX_OPTIONS = ['Male', 'Female', 'Unsexed'];
const STATUS_OPTIONS = ['For Sale', 'Pet', 'Future Breeder', 'Holdback', 'Ready to Breed', 'Proven', 'Sold'];
const TRAITS_MODES = [
  { value: 'replace', label: 'Replace existing traits' },
  { value: 'append',  label: 'Append (comma-separate)' },
];

/**
 * Apply a small patch to many geckos at once. Each field has an "apply"
 * checkbox so the breeder can opt fields in/out individually. For traits,
 * the breeder also picks replace vs append since either is a valid use
 * case (a fresh batch wants replace; tagging an extra trait wants append).
 */
export default function BulkEditModal({ geckos, open, onClose, onSaved }) {
  const { toast } = useToast();
  const [applySex, setApplySex] = useState(false);
  const [applyStatus, setApplyStatus] = useState(false);
  const [applyPrice, setApplyPrice] = useState(false);
  const [applyTraits, setApplyTraits] = useState(false);
  const [sex, setSex] = useState('');
  const [status, setStatus] = useState('');
  const [price, setPrice] = useState('');
  const [traits, setTraits] = useState('');
  const [traitsMode, setTraitsMode] = useState('replace');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setApplySex(false);
    setApplyStatus(false);
    setApplyPrice(false);
    setApplyTraits(false);
    setSex('');
    setStatus('');
    setPrice('');
    setTraits('');
    setTraitsMode('replace');
  }, [open]);

  const count = geckos.length;
  const anyChecked = applySex || applyStatus || applyPrice || applyTraits;

  const handleSave = async () => {
    if (!anyChecked) {
      toast({ title: 'Pick at least one field', description: 'Tick a field on the left to apply it.' });
      return;
    }
    setIsSaving(true);
    let ok = 0;
    let fail = 0;
    const updated = [];
    for (const g of geckos) {
      const patch = {};
      if (applySex && sex) patch.sex = sex;
      if (applyStatus && status) patch.status = status;
      if (applyPrice && price !== '') patch.asking_price = Number(price);
      if (applyTraits) {
        if (traitsMode === 'replace') {
          patch.morphs_traits = traits;
        } else {
          const existing = (g.morphs_traits || '').trim();
          patch.morphs_traits = existing
            ? `${existing}, ${traits}`.trim().replace(/,\s*,/g, ',')
            : traits;
        }
      }
      if (Object.keys(patch).length === 0) continue;
      try {
        const saved = await Gecko.update(g.id, patch);
        updated.push({ ...g, ...patch, ...saved });
        ok += 1;
      } catch {
        fail += 1;
      }
    }
    setIsSaving(false);
    if (ok > 0) {
      toast({
        title: `Updated ${ok} gecko${ok === 1 ? '' : 's'}`,
        description: fail > 0 ? `${fail} failed to save.` : 'Patch applied across the selection.',
        variant: fail > 0 ? 'destructive' : 'default',
      });
      onSaved?.(updated);
    } else {
      toast({ title: 'Nothing saved', description: 'No updates went through.', variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="bg-slate-900 border-slate-700 text-slate-100 max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-slate-100 flex items-center gap-2">
            <Layers className="w-5 h-5 text-emerald-400" />
            Bulk edit {count} gecko{count === 1 ? '' : 's'}
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Tick a field on the left to apply it. Unticked fields are left alone on every gecko.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-[auto_1fr] gap-3 items-start">
            <Checkbox checked={applySex} onCheckedChange={(v) => setApplySex(!!v)} className="mt-2" />
            <div>
              <Label className="text-xs uppercase tracking-wide text-slate-400">Sex</Label>
              <Select value={sex} onValueChange={(v) => { setSex(v); setApplySex(true); }}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-100 mt-1">
                  <SelectValue placeholder="Pick sex" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700 text-slate-100">
                  {SEX_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s} className="focus:bg-slate-700">{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-[auto_1fr] gap-3 items-start">
            <Checkbox checked={applyStatus} onCheckedChange={(v) => setApplyStatus(!!v)} className="mt-2" />
            <div>
              <Label className="text-xs uppercase tracking-wide text-slate-400">Status</Label>
              <Select value={status} onValueChange={(v) => { setStatus(v); setApplyStatus(true); }}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-100 mt-1">
                  <SelectValue placeholder="Pick status" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700 text-slate-100">
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s} className="focus:bg-slate-700">{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-[auto_1fr] gap-3 items-start">
            <Checkbox checked={applyPrice} onCheckedChange={(v) => setApplyPrice(!!v)} className="mt-2" />
            <div>
              <Label className="text-xs uppercase tracking-wide text-slate-400">Asking price (USD)</Label>
              <Input
                type="number"
                step="1"
                min="0"
                value={price}
                onChange={(e) => { setPrice(e.target.value); setApplyPrice(true); }}
                placeholder="e.g. 250"
                className="bg-slate-800 border-slate-700 text-slate-100 mt-1"
              />
            </div>
          </div>

          <div className="grid grid-cols-[auto_1fr] gap-3 items-start">
            <Checkbox checked={applyTraits} onCheckedChange={(v) => setApplyTraits(!!v)} className="mt-2" />
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-slate-400">Traits</Label>
              <Textarea
                value={traits}
                onChange={(e) => { setTraits(e.target.value); setApplyTraits(true); }}
                rows={2}
                placeholder="e.g. Lilly White, Harlequin"
                className="bg-slate-800 border-slate-700 text-slate-100"
              />
              <Select value={traitsMode} onValueChange={setTraitsMode}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-100 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700 text-slate-100">
                  {TRAITS_MODES.map((m) => (
                    <SelectItem key={m.value} value={m.value} className="focus:bg-slate-700 text-xs">{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            className="border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200"
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || !anyChecked}
            className="bg-emerald-600 hover:bg-emerald-500 text-white"
          >
            {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Layers className="w-4 h-4 mr-2" />}
            Apply to {count}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
