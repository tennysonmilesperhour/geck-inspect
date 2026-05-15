import { useEffect, useMemo, useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Loader2, Upload, CheckCircle2, X, Sparkles } from 'lucide-react';
import { Gecko } from '@/entities/all';
import { uploadFile } from '@/lib/uploadFile';
import { useToast } from '@/components/ui/use-toast';

const SEX_OPTIONS = ['Male', 'Female', 'Unsexed'];

/**
 * Minimal editor that surfaces ONLY the four fields MorphMarket requires.
 * Lets a breeder fix a gecko mid-export without leaving the page and
 * losing their batch state. Persists straight to Gecko.update and returns
 * the patched gecko via onSaved so the export page can refresh in place.
 */
export default function QuickFixModal({ gecko, open, onClose, onSaved, missing = [], allGeckos = [] }) {
  const { toast } = useToast();
  const [sex, setSex] = useState(gecko?.sex || '');
  const [traits, setTraits] = useState(gecko?.morphs_traits || '');
  const [price, setPrice] = useState(gecko?.asking_price ?? '');
  const [imageUrls, setImageUrls] = useState(Array.isArray(gecko?.image_urls) ? gecko.image_urls : []);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!gecko) return;
    setSex(gecko.sex || '');
    setTraits(gecko.morphs_traits || (Array.isArray(gecko.morph_tags) ? gecko.morph_tags.join(', ') : ''));
    setPrice(gecko.asking_price ?? '');
    setImageUrls(Array.isArray(gecko.image_urls) ? gecko.image_urls : []);
  }, [gecko]);

  // Sibling-derived trait suggestions: any other gecko in the breeder's
  // collection with the same sire AND dam. Same-clutch siblings tend to
  // share trait labels, so this saves a lot of typing on hatch groups.
  const siblingTraits = useMemo(() => {
    if (!gecko || !Array.isArray(allGeckos)) return [];
    const sireId = gecko.sire_id;
    const damId = gecko.dam_id;
    if (!sireId && !damId) return [];
    const siblings = allGeckos.filter((g) => {
      if (g.id === gecko.id) return false;
      if (sireId && damId) return g.sire_id === sireId && g.dam_id === damId;
      if (sireId) return g.sire_id === sireId;
      return g.dam_id === damId;
    });
    const counts = new Map();
    for (const sib of siblings) {
      const raw = sib.morphs_traits ||
        (Array.isArray(sib.morph_tags) ? sib.morph_tags.join(',') : '');
      raw.split(/[,;]/).map((t) => t.trim()).filter(Boolean).forEach((t) => {
        counts.set(t, (counts.get(t) || 0) + 1);
      });
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([trait, count]) => ({ trait, count, total: siblings.length }));
  }, [gecko, allGeckos]);

  const applySuggestion = (trait) => {
    const current = (traits || '').trim();
    const tokens = current.split(/[,;]/).map((t) => t.trim()).filter(Boolean);
    if (tokens.includes(trait)) return;
    setTraits(current ? `${current}, ${trait}` : trait);
  };

  const needSex = missing.includes('Sex');
  const needTraits = missing.includes('Traits');
  const needPrice = missing.includes('Price');
  const needImage = missing.includes('At least 1 image');

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const { file_url } = await uploadFile({ file, folder: 'geckos' });
      setImageUrls((prev) => [...prev, file_url]);
    } catch (err) {
      toast({ title: 'Upload failed', description: err.message, variant: 'destructive' });
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const removeImage = (url) => {
    setImageUrls((prev) => prev.filter((u) => u !== url));
  };

  const handleSave = async () => {
    if (!gecko) return;
    setIsSaving(true);
    try {
      const patch = {};
      if (sex && sex !== gecko.sex) patch.sex = sex;
      if (traits !== (gecko.morphs_traits || '')) patch.morphs_traits = traits;
      const priceNum = price === '' ? null : Number(price);
      if (priceNum !== (gecko.asking_price ?? null)) patch.asking_price = priceNum;
      if (JSON.stringify(imageUrls) !== JSON.stringify(gecko.image_urls || [])) {
        patch.image_urls = imageUrls;
      }
      if (Object.keys(patch).length === 0) {
        onClose();
        return;
      }
      const updated = await Gecko.update(gecko.id, patch);
      toast({ title: 'Saved', description: `${updated.name || 'Gecko'} updated.` });
      onSaved?.({ ...gecko, ...patch, ...updated });
    } catch (err) {
      toast({ title: 'Save failed', description: err.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  if (!gecko) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="bg-slate-900 border-slate-700 text-slate-100 max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-slate-100">
            Quick fix: {gecko.name || gecko.gecko_id_code || 'gecko'}
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Just the fields MorphMarket needs. For everything else (notes, lineage, photos beyond the cover), use the full editor in My Geckos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label className="text-xs uppercase tracking-wide text-slate-400 flex items-center gap-1.5">
              Sex {needSex && <span className="text-amber-400 text-[10px]">required</span>}
            </Label>
            <Select value={sex || ''} onValueChange={setSex}>
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

          <div>
            <Label className="text-xs uppercase tracking-wide text-slate-400 flex items-center gap-1.5">
              Traits {needTraits && <span className="text-amber-400 text-[10px]">required</span>}
            </Label>
            <Textarea
              value={traits}
              onChange={(e) => setTraits(e.target.value)}
              rows={2}
              placeholder="e.g. Lilly White, Harlequin, Phantom"
              className="bg-slate-800 border-slate-700 text-slate-100 mt-1"
            />
            {siblingTraits.length > 0 && (
              <div className="mt-2 p-2 rounded border border-slate-700 bg-slate-950/40 space-y-1.5">
                <p className="text-[10px] text-slate-400 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-emerald-400" />
                  Tap to add a trait from this gecko's clutchmates
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {siblingTraits.map(({ trait, count, total }) => (
                    <button
                      key={trait}
                      type="button"
                      onClick={() => applySuggestion(trait)}
                      className="text-[11px] px-2 py-0.5 rounded-full border border-emerald-700/60 bg-emerald-950/30 text-emerald-200 hover:bg-emerald-900/40"
                      title={`Used by ${count} of ${total} sibling${total === 1 ? '' : 's'}`}
                    >
                      {trait} <span className="text-emerald-400/70">{count}/{total}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <p className="text-[10px] text-slate-500 mt-1">
              MorphMarket reads its trait tags from this text. Use the same labels you'd put in a listing.
            </p>
          </div>

          <div>
            <Label className="text-xs uppercase tracking-wide text-slate-400 flex items-center gap-1.5">
              Asking price (USD) {needPrice && <span className="text-amber-400 text-[10px]">required</span>}
            </Label>
            <Input
              type="number"
              step="1"
              min="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="e.g. 250"
              className="bg-slate-800 border-slate-700 text-slate-100 mt-1"
            />
          </div>

          <div>
            <Label className="text-xs uppercase tracking-wide text-slate-400 flex items-center gap-1.5">
              Photos {needImage && <span className="text-amber-400 text-[10px]">required (at least 1)</span>}
            </Label>
            <div className="mt-1 flex flex-wrap gap-2">
              {imageUrls.map((url) => (
                <div key={url} className="relative w-16 h-16 rounded border border-slate-700 overflow-hidden bg-slate-950">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeImage(url)}
                    className="absolute top-0 right-0 bg-slate-900/80 text-rose-300 hover:text-rose-200 p-0.5 rounded-bl"
                    title="Remove"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              <label className="w-16 h-16 rounded border border-dashed border-slate-700 hover:border-slate-500 flex items-center justify-center cursor-pointer text-slate-500 hover:text-slate-300 bg-slate-950">
                {isUploading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                  disabled={isUploading}
                />
              </label>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              First photo becomes the listing cover on MorphMarket.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            className="border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="bg-emerald-600 hover:bg-emerald-500 text-white"
          >
            {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
