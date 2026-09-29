import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Camera, Loader2, CheckCircle2, Scale, PlusCircle, Sparkles, ImagePlus } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import { FeedingGroup } from '@/entities/all';
import { UploadFile } from '@/integrations/Core';
import { supabase } from '@/lib/supabaseClient';
import { todayLocalISO } from '@/lib/dateUtils';
import { captureEvent } from '@/lib/posthog';

// Crested geckos on CGD are usually fed every 2 to 3 days.
const DEFAULT_FEEDING_INTERVAL_DAYS = 3;
const SEXES = ['Unsexed', 'Female', 'Male'];

/**
 * Quick add for a keeper's first crested gecko (VIP audit P1.2, 27 Sep 2026).
 *
 * The full GeckoForm has 20+ fields with photos last; two of three new
 * accounts never finished it. This asks for the photo first, then name,
 * sex, and optional hatch date, morph and weight, and offers feeding-day
 * reminders (served by the enqueue_feeding_reminders cron). "More details"
 * hands everything to the full form. It saves through save_gecko_record,
 * the same atomic RPC the full form uses, so a weight entered here becomes
 * the first point on the growth chart.
 *
 * Props: open, user, onClose(), onSaved(gecko), onMoreDetails(draft),
 * onLogWeight(gecko).
 */
export default function QuickAddGecko({ open, user, onClose, onSaved, onMoreDetails, onLogWeight }) {
  const { toast } = useToast();
  const fileInputRef = useRef(null);
  const requestIdRef = useRef(crypto.randomUUID());
  const [photoUrl, setPhotoUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [name, setName] = useState('');
  const [sex, setSex] = useState('Unsexed');
  const [hatchDate, setHatchDate] = useState('');
  const [morph, setMorph] = useState('');
  const [weight, setWeight] = useState('');
  const [remind, setRemind] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(null);
  const [addedCount, setAddedCount] = useState(0);

  const resetForAnother = () => {
    requestIdRef.current = crypto.randomUUID();
    setPhotoUrl(null);
    setName('');
    setSex('Unsexed');
    setHatchDate('');
    setMorph('');
    setWeight('');
    setSaved(null);
  };

  const handlePhoto = async (event) => {
    const file = event.target.files?.[0];
    if (event.target) event.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      // The shared upload path converts iPhone HEIC photos to JPEG.
      const { file_url } = await UploadFile({ file });
      setPhotoUrl(file_url);
    } catch (err) {
      toast({ title: 'Photo upload failed', description: err.message || 'Try another photo.', variant: 'destructive' });
    }
    setUploading(false);
  };

  const draft = () => ({
    name: name.trim(),
    sex,
    hatch_date: hatchDate || null,
    morphs_traits: morph.trim() || '',
    image_urls: photoUrl ? [photoUrl] : [],
    weight_grams: weight === '' ? null : Number(weight),
    species: 'Crested Gecko',
  });

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast({ title: 'Give your gecko a name', description: 'Anything works, you can change it later.' });
      return;
    }
    const grams = weight === '' ? null : Number(weight);
    if (grams !== null && (!Number.isFinite(grams) || grams < 0)) {
      toast({ title: 'Check the weight', description: 'Enter grams as a number, for example 34.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      let feedingGroupId = null;
      if (remind) {
        const groups = await FeedingGroup.filter({ created_by: user.email }).catch(() => []);
        const group = groups[0] || await FeedingGroup.create({
          label: 'A',
          name: 'My geckos',
          diet_type: 'CGD',
          interval_days: DEFAULT_FEEDING_INTERVAL_DAYS,
          last_fed_date: todayLocalISO(),
          feeding_reminder_enabled: true,
        });
        feedingGroupId = group?.id || null;
      }

      const record = {
        name: trimmed,
        sex,
        hatch_date: hatchDate || null,
        morphs_traits: morph.trim() || null,
        image_urls: photoUrl ? [photoUrl] : [],
        species: 'Crested Gecko',
        status: 'Pet',
        is_public: false,
        weight_grams: grams,
        feeding_group_id: feedingGroupId,
      };
      const { data: gecko, error } = await supabase.rpc('save_gecko_record', {
        p_record: record,
        p_request_id: requestIdRef.current,
        p_gecko_id: null,
        p_record_weight: grams !== null,
        p_record_date: todayLocalISO(),
      });
      if (error) throw error;

      captureEvent('animal_created', {
        animal_id: gecko.id,
        source: 'quick_add',
        has_photo: Boolean(photoUrl),
        recorded_weight: grams !== null,
        feeding_reminders: Boolean(feedingGroupId),
      });
      setAddedCount((n) => n + 1);
      setSaved({ gecko, remind: Boolean(feedingGroupId), hadWeight: grams !== null, hadMorph: Boolean(morph.trim()) });
      onSaved?.(gecko);
    } catch (err) {
      console.error('Quick add failed:', err);
      toast({ title: 'Gecko could not be saved', description: err.message || 'Your entries are still here. Please try again.', variant: 'destructive' });
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next && !saving) onClose?.(); }}>
      <DialogContent className="w-[95vw] max-w-md max-h-[90svh] overflow-y-auto bg-slate-900 border-slate-700">
        {saved ? (
          <div className="space-y-5">
            <div className="text-center space-y-2 pt-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
              <DialogTitle className="text-xl text-slate-100">{saved.gecko.name} is in your collection</DialogTitle>
              <DialogDescription className="text-slate-400">
                {saved.remind
                  ? `We will remind you on feeding days, every ${DEFAULT_FEEDING_INTERVAL_DAYS} days. Change the schedule in Project Manager, on the Feeding tab.`
                  : 'Weights, sheds, photos and lineage now have a home.'}
              </DialogDescription>
            </div>
            <div className="grid gap-2">
              {!saved.hadWeight && (
                <Button className="w-full min-h-11" onClick={() => onLogWeight?.(saved.gecko)}>
                  <Scale className="w-4 h-4 mr-2" /> Log today&rsquo;s weight
                </Button>
              )}
              {!saved.hadMorph && (
                <Link to="/Recognition" onClick={() => onClose?.()} className="block">
                  <Button variant="outline" className="w-full min-h-11 border-slate-600 text-slate-100">
                    <Sparkles className="w-4 h-4 mr-2" /> Not sure of the morph? Try Morph ID free
                  </Button>
                </Link>
              )}
              <Button variant="outline" className="w-full min-h-11 border-slate-600 text-slate-100" onClick={resetForAnother}>
                <PlusCircle className="w-4 h-4 mr-2" /> Add another gecko
              </Button>
              <Button variant="ghost" className="w-full min-h-11 text-slate-300" onClick={() => onClose?.()}>
                Done
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <DialogTitle className="text-xl text-slate-100">{addedCount > 0 ? 'Add another gecko' : 'Add your first gecko'}</DialogTitle>
              <DialogDescription className="text-slate-400 mt-1">
                Start with a photo and a name. Everything else can wait.
              </DialogDescription>
            </div>

            <input ref={fileInputRef} type="file" accept="image/*,.heic,.heif" className="hidden" onChange={handlePhoto} />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="touch:min-h-11 w-full aspect-[4/3] rounded-xl border-2 border-dashed border-slate-600 hover:border-emerald-500/70 bg-slate-800/50 flex flex-col items-center justify-center gap-2 overflow-hidden text-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              aria-label={photoUrl ? 'Change photo' : 'Add a photo'}
            >
              {uploading ? (
                <><Loader2 className="w-7 h-7 animate-spin text-emerald-400" /><span className="text-sm">Uploading...</span></>
              ) : photoUrl ? (
                <img src={photoUrl} alt="Your gecko" className="w-full h-full object-cover" />
              ) : (
                <>
                  <Camera className="w-8 h-8 text-emerald-400" />
                  <span className="text-sm font-medium text-slate-200">Add a photo</span>
                  <span className="text-xs text-slate-500 px-6 text-center">A clear top-down shot in daylight works best</span>
                </>
              )}
            </button>
            {photoUrl && !uploading && (
              <button type="button" onClick={() => fileInputRef.current?.click()} className="touch:min-h-11 text-xs text-emerald-300 hover:text-emerald-200 inline-flex items-center gap-1">
                <ImagePlus className="w-3.5 h-3.5" /> Change photo
              </button>
            )}

            <div>
              <Label htmlFor="qa-name" className="text-slate-200">Name</Label>
              <Input id="qa-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Mango" className="mt-1 bg-slate-800 border-slate-600 text-slate-100" autoComplete="off" />
            </div>

            <div>
              <Label className="text-slate-200">Sex</Label>
              <div className="mt-1 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Sex">
                {SEXES.map((option) => (
                  <button
                    key={option}
                    type="button"
                    role="radio"
                    aria-checked={sex === option}
                    onClick={() => setSex(option)}
                    className={`min-h-11 rounded-lg border text-sm font-medium transition-colors ${
                      sex === option
                        ? 'border-emerald-500 bg-emerald-900/40 text-emerald-100'
                        : 'border-slate-600 bg-slate-800 text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    {option === 'Unsexed' ? 'Not sure' : option}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="qa-hatch" className="text-slate-200">Hatch date <span className="text-slate-500 font-normal">(optional)</span></Label>
                <Input id="qa-hatch" type="date" value={hatchDate} max={todayLocalISO()} onChange={(e) => setHatchDate(e.target.value)} className="mt-1 bg-slate-800 border-slate-600 text-slate-100" />
              </div>
              <div>
                <Label htmlFor="qa-weight" className="text-slate-200">Weight today <span className="text-slate-500 font-normal">(g)</span></Label>
                <Input id="qa-weight" type="number" inputMode="decimal" min="0" step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="optional" className="mt-1 bg-slate-800 border-slate-600 text-slate-100" />
              </div>
            </div>

            <div>
              <Label htmlFor="qa-morph" className="text-slate-200">Morph <span className="text-slate-500 font-normal">(optional)</span></Label>
              <Input id="qa-morph" value={morph} onChange={(e) => setMorph(e.target.value)} placeholder="e.g. Lilly White Harlequin" className="mt-1 bg-slate-800 border-slate-600 text-slate-100" autoComplete="off" />
            </div>

            <div className="flex items-start justify-between gap-3 rounded-lg border border-slate-700 bg-slate-800/60 p-3">
              <div>
                <Label htmlFor="qa-remind" className="text-slate-100">Remind me on feeding days</Label>
                <p className="text-xs text-slate-400 mt-0.5">Every {DEFAULT_FEEDING_INTERVAL_DAYS} days, starting today. One message, even with the app closed.</p>
              </div>
              <Switch id="qa-remind" checked={remind} onCheckedChange={setRemind} />
            </div>

            <div className="flex flex-col-reverse sm:flex-row gap-2 pt-1">
              <Button
                variant="ghost"
                className="min-h-11 text-slate-300"
                disabled={saving || uploading}
                onClick={() => onMoreDetails?.(draft())}
              >
                More details
              </Button>
              <Button className="min-h-11 flex-1" disabled={saving || uploading} onClick={handleSave}>
                {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</> : 'Save gecko'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
