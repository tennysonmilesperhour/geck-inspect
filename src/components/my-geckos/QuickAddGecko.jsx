import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Camera, Loader2, CheckCircle2, Scale, PlusCircle, Sparkles, ImagePlus, Keyboard, UserPlus, ArrowLeft } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import { UploadFile } from '@/integrations/Core';
import { todayLocalISO } from '@/lib/dateUtils';
import { captureEvent } from '@/lib/posthog';
import { isGeckoLimitError } from '@/lib/geckoLimit';
import { saveQuickGecko } from './quickGeckoSave';
import { holdOnboarding, releaseOnboarding } from '@/lib/onboardingState';
import { DEFAULT_FEEDING_INTERVAL_DAYS, flowEvent, savePendingGecko } from '@/lib/firstGeckoFlow';
import { isNativePlatform } from '@/lib/revenuecat';
import { captureDevicePhoto } from '@/lib/devicePhoto';

// After a guest keeps a gecko: create the account, then land on My Geckos,
// where the saved draft becomes the first gecko in the collection.
const GUEST_SIGNUP_URL = `/AuthPortal?mode=signup&redirect=${encodeURIComponent('/MyGeckos')}`;
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
 * onLogWeight(gecko), slotsLeftAtOpen (how many more active geckos the
 * plan allows when the dialog opened; Infinity for unlimited plans),
 * onLimitReached() (opens the upgrade prompt), existingGeckos (the
 * collection, so the new gecko gets the next ID code, like the full form)
 * and idSettings (the keeper's ID code format from collection settings).
 * onOpenRecord(gecko) opens the saved gecko's record, where its value
 * estimate shows once it has a morph; onImport() swaps this dialog for
 * the CSV import, for breeders who already keep a spreadsheet.
 *
 * First-gecko flow (activation pass, 5 Oct 2026), all optional:
 *   offerPhotoChoice: open on two choices, "identify it from a photo"
 *     (onChoosePhoto, which goes to Morph ID's free try) or "type a name
 *     and morph" (this form).
 *   initialDraft: prefill from a Morph ID result or a guest's saved draft
 *     ({ name, sex, hatch_date, morphs_traits, morph_tags, notes,
 *     image_urls, weight_grams }).
 *   stepLabel: e.g. "Step 1 of 3", shown above the title.
 *   onContinue(gecko, meta): replaces the success screen; the parent moves
 *     on to the parents step.
 *   guest: the demo. Nothing is saved; the gecko is kept in this browser
 *     and the visitor is offered a free account to keep it, or a way back.
 *   saveSource: analytics source for the save (quick_add or morph_id_draft).
 */
export default function QuickAddGecko({ open, user, onClose, onSaved, onMoreDetails, onLogWeight, onOpenRecord, onImport, slotsLeftAtOpen = Infinity, onLimitReached, existingGeckos = [], idSettings = null, offerPhotoChoice = false, onChoosePhoto, initialDraft = null, stepLabel = null, onContinue, guest = false, saveSource = 'quick_add' }) {
  const { toast } = useToast();
  const fileInputRef = useRef(null);
  const requestIdRef = useRef(crypto.randomUUID());

  // Keep the first-run keeper-or-breeder question from opening on top of
  // this form; it can follow once the form closes.
  useEffect(() => {
    if (!open) return undefined;
    holdOnboarding('quick_add');
    return () => releaseOnboarding('quick_add');
  }, [open]);
  const [photoUrl, setPhotoUrl] = useState(() => initialDraft?.image_urls?.[0] || null);
  const [uploading, setUploading] = useState(false);
  const [name, setName] = useState(() => initialDraft?.name || '');
  const [sex, setSex] = useState(() => (SEXES.includes(initialDraft?.sex) ? initialDraft.sex : 'Unsexed'));
  const [hatchDate, setHatchDate] = useState(() => initialDraft?.hatch_date || '');
  const [morph, setMorph] = useState(() => initialDraft?.morphs_traits || '');
  const [weight, setWeight] = useState(() => (initialDraft?.weight_grams != null ? String(initialDraft.weight_grams) : ''));
  const [remind, setRemind] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(null);
  // 'choose' shows the photo-or-type choice first; 'form' is the form.
  const [mode, setMode] = useState(() => (offerPhotoChoice && !initialDraft && !guest ? 'choose' : 'form'));
  // Guest demo: the gecko the visitor typed, kept for after sign-up.
  const [guestKept, setGuestKept] = useState(null);
  // Morph ID's tags and note ride along with a draft that came from it.
  const draftExtrasRef = useRef({
    morph_tags: Array.isArray(initialDraft?.morph_tags) && initialDraft.morph_tags.length ? initialDraft.morph_tags : null,
    notes: initialDraft?.notes || null,
    extraPhotos: Array.isArray(initialDraft?.image_urls) ? initialDraft.image_urls.slice(1) : [],
  });

  useEffect(() => {
    if (!open) return;
    flowEvent('add', 'shown', { choice: mode === 'choose', from_draft: Boolean(initialDraft), guest });
    // Once per opening.
  }, [open]);
  const [addedCount, setAddedCount] = useState(0);
  // Geckos saved in this dialog, so "Add another" counts them when it
  // numbers the next ID code even before the collection reloads.
  const savedHereRef = useRef([]);
  // The plan limit is checked when the dialog opens; each save here uses
  // one more slot, so "Add another" stops at the limit instead of letting
  // a free account pass 10 (the database refuses it anyway).
  const slotsAtOpenRef = useRef(slotsLeftAtOpen);
  const atLimit = slotsAtOpenRef.current - addedCount <= 0;

  const resetForAnother = () => {
    requestIdRef.current = crypto.randomUUID();
    setPhotoUrl(null);
    setName('');
    setSex('Unsexed');
    setHatchDate('');
    setMorph('');
    setWeight('');
    setSaved(null);
    draftExtrasRef.current = { morph_tags: null, notes: null, extraPhotos: [] };
  };

  const uploadPhotoFile = async (file) => {
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

  const handlePhoto = async (event) => {
    const file = event.target.files?.[0];
    if (event.target) event.target.value = '';
    await uploadPhotoFile(file);
  };

  const openPhoto = async () => {
    if (isNativePlatform()) {
      try {
        await uploadPhotoFile(await captureDevicePhoto());
      } catch (err) {
        toast({ title: 'Could not open the camera', description: err.message || 'Try again.', variant: 'destructive' });
      }
      return;
    }
    fileInputRef.current?.click();
  };

  const draft = () => ({
    name: name.trim(),
    sex,
    hatch_date: hatchDate || null,
    morphs_traits: morph.trim() || '',
    image_urls: photoUrl ? [photoUrl, ...draftExtrasRef.current.extraPhotos.filter((u) => u && u !== photoUrl)] : [],
    ...(draftExtrasRef.current.morph_tags ? { morph_tags: draftExtrasRef.current.morph_tags } : {}),
    ...(draftExtrasRef.current.notes ? { notes: draftExtrasRef.current.notes } : {}),
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
    if (guest) {
      // Nothing is written in the demo. Keep the gecko in this browser and
      // save it for real once the visitor has an account.
      savePendingGecko({ name: trimmed, sex, hatch_date: hatchDate || null, morphs_traits: morph.trim(), weight_grams: grams });
      flowEvent('add', 'guest_kept', { has_morph: Boolean(morph.trim()) });
      setGuestKept({ name: trimmed });
      return;
    }
    setSaving(true);
    try {
      // Geckos saved in this dialog count too when numbering the ID code.
      const known = new Set(existingGeckos.map((g) => g.id));
      const pool = [...existingGeckos, ...savedHereRef.current.filter((g) => !known.has(g.id))];
      const { gecko, feedingGroupId } = await saveQuickGecko({
        user,
        remind,
        pool,
        idSettings,
        requestId: requestIdRef.current,
        fields: {
          name: trimmed,
          sex,
          hatch_date: hatchDate || null,
          morphs_traits: morph,
          weight_grams: grams,
          image_urls: photoUrl ? [photoUrl, ...draftExtrasRef.current.extraPhotos.filter((u) => u && u !== photoUrl)] : [],
          morph_tags: draftExtrasRef.current.morph_tags,
          notes: draftExtrasRef.current.notes,
        },
      });

      captureEvent('animal_created', {
        animal_id: gecko.id,
        source: saveSource,
        has_photo: Boolean(photoUrl),
        recorded_weight: grams !== null,
        feeding_reminders: Boolean(feedingGroupId),
      });
      if (grams !== null) captureEvent('weight_logged', { via: 'quick_add', at_add: true });
      savedHereRef.current = [...savedHereRef.current, gecko];
      setAddedCount((n) => n + 1);
      flowEvent('add', 'saved', { source: saveSource, has_photo: Boolean(photoUrl), has_morph: Boolean(morph.trim()), has_weight: grams !== null, feeding_reminders: Boolean(feedingGroupId) });
      onSaved?.(gecko);
      if (onContinue) {
        onContinue(gecko, { feedingGroupId, hadWeight: grams !== null, hadMorph: Boolean(morph.trim()) });
      } else {
        setSaved({ gecko, remind: Boolean(feedingGroupId), hadWeight: grams !== null, hadMorph: Boolean(morph.trim()) });
      }
    } catch (err) {
      console.error('Quick add failed:', err);
      if (isGeckoLimitError(err) && onLimitReached) {
        setSaving(false);
        onLimitReached();
        return;
      }
      toast({ title: 'Gecko could not be saved', description: err.message || 'Your entries are still here. Please try again.', variant: 'destructive' });
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next && !saving) onClose?.(); }}>
      <DialogContent className="w-[95vw] max-w-md max-h-[90svh] overflow-y-auto bg-slate-900 border-slate-700">
        {guestKept ? (
          <div className="space-y-5">
            <div className="text-center space-y-2 pt-2">
              <UserPlus className="w-10 h-10 text-emerald-400 mx-auto" />
              <DialogTitle className="text-xl text-slate-100">Create a free account to keep {guestKept.name}</DialogTitle>
              <DialogDescription className="text-slate-400">
                This is the demo, so nothing is saved yet. {guestKept.name} is kept in this browser and goes
                straight into your collection once your free account exists. Free covers up to 10 geckos, no card needed.
              </DialogDescription>
            </div>
            <div className="grid gap-2">
              <Link
                to={GUEST_SIGNUP_URL}
                onClick={() => { flowEvent('add', 'guest_signup_clicked'); onClose?.(); }}
                className="inline-flex items-center justify-center gap-2 w-full min-h-11 rounded-md bg-emerald-600 hover:bg-emerald-500 px-4 text-sm font-semibold text-white"
              >
                <UserPlus className="w-4 h-4" /> Create a free account
              </Link>
              <Button variant="ghost" className="w-full min-h-11 text-slate-300" onClick={() => { flowEvent('add', 'guest_back_to_demo'); onClose?.(); }}>
                <ArrowLeft className="w-4 h-4 mr-2" /> Back to the demo
              </Button>
            </div>
          </div>
        ) : mode === 'choose' && !saved ? (
          <div className="space-y-4">
            <div>
              {stepLabel && <p className="text-[11px] uppercase tracking-wider font-semibold text-emerald-300">{stepLabel}</p>}
              <DialogTitle className="text-xl text-slate-100">Add your first gecko</DialogTitle>
              <DialogDescription className="text-slate-400 mt-1">
                Two ways in. Both take about a minute, and you can skip anything you don&rsquo;t know.
              </DialogDescription>
            </div>
            <button
              type="button"
              onClick={() => { flowEvent('add', 'choose_photo'); onChoosePhoto?.(); }}
              className="w-full text-left rounded-xl border border-emerald-500/50 bg-emerald-950/30 hover:bg-emerald-900/30 p-4 flex gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              <Camera className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                <span className="block font-semibold text-slate-100">Add it by photo</span>
                <span className="block text-sm text-slate-300 mt-0.5">Morph ID reads the morph from a top and a side photo (say, Lilly White or Harlequin) and fills it in. Your first one is free.</span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => { flowEvent('add', 'choose_type'); setMode('form'); }}
              className="w-full text-left rounded-xl border border-slate-600 bg-slate-800/60 hover:bg-slate-800 p-4 flex gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              <Keyboard className="w-6 h-6 text-slate-300 shrink-0 mt-0.5" />
              <span>
                <span className="block font-semibold text-slate-100">Type a name and morph</span>
                <span className="block text-sm text-slate-300 mt-0.5">Already know what it is? A name is enough, the rest is optional.</span>
              </span>
            </button>
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              {onImport ? (
                <button type="button" onClick={() => onImport()} className="touch:min-h-11 text-sm text-emerald-300 hover:text-emerald-200 underline underline-offset-4">
                  Import a spreadsheet instead
                </button>
              ) : <span />}
              <Button variant="ghost" className="min-h-11 text-slate-300" onClick={() => { flowEvent('add', 'skipped'); onClose?.(); }}>
                Skip for now
              </Button>
            </div>
          </div>
        ) : saved ? (
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
              {/* The payoff the landing page promises: add a morph and
                  see what the gecko is worth (MarketValueCard on the
                  record reads the morph text). */}
              {saved.hadMorph && onOpenRecord && (
                <Button className="w-full min-h-11" onClick={() => onOpenRecord(saved.gecko)}>
                  <Sparkles className="w-4 h-4 mr-2" /> See what {saved.gecko.name} is worth
                </Button>
              )}
              {!saved.hadWeight && (
                <Button variant={saved.hadMorph && onOpenRecord ? 'outline' : 'default'} className={`w-full min-h-11 ${saved.hadMorph && onOpenRecord ? 'border-slate-600 text-slate-100' : ''}`} onClick={() => onLogWeight?.(saved.gecko)}>
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
              {atLimit ? (
                <Button variant="outline" className="w-full min-h-11 border-slate-600 text-slate-100" onClick={() => onLimitReached?.()}>
                  <PlusCircle className="w-4 h-4 mr-2" /> Plan limit reached, see plans
                </Button>
              ) : (
                <Button variant="outline" className="w-full min-h-11 border-slate-600 text-slate-100" onClick={resetForAnother}>
                  <PlusCircle className="w-4 h-4 mr-2" /> Add another gecko
                </Button>
              )}
              <Button variant="ghost" className="w-full min-h-11 text-slate-300" onClick={() => onClose?.()}>
                Done
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              {stepLabel && addedCount === 0 && <p className="text-[11px] uppercase tracking-wider font-semibold text-emerald-300">{stepLabel}</p>}
              <DialogTitle className="text-xl text-slate-100">{addedCount > 0 ? 'Add another gecko' : 'Add your first gecko'}</DialogTitle>
              <DialogDescription className="text-slate-400 mt-1">
                {initialDraft?.morph_tags?.length || initialDraft?.notes
                  ? 'Morph ID filled in the morph and photo. Give your gecko a name and check the rest.'
                  : guest
                    ? 'Try it with any name. This is the demo, so you keep it by creating a free account.'
                    : 'Start with a photo and a name. Everything else can wait.'}
              </DialogDescription>
              {addedCount === 0 && onImport && !offerPhotoChoice && !guest && (
                <button
                  type="button"
                  onClick={() => onImport()}
                  className="touch:min-h-11 mt-1 text-sm text-emerald-300 hover:text-emerald-200 underline underline-offset-4"
                >
                  Already keep a spreadsheet? Import it instead
                </button>
              )}
            </div>

            {guest ? (
              <p className="rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2 text-xs text-slate-400">
                <Camera className="w-3.5 h-3.5 inline mr-1 text-emerald-400" />
                Photos and Morph ID open once you have a free account.
              </p>
            ) : (
            <>
            <input ref={fileInputRef} type="file" accept="image/*,.heic,.heif" className="hidden" onChange={handlePhoto} />
            <button
              type="button"
              onClick={openPhoto}
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
              <button type="button" onClick={openPhoto} className="touch:min-h-11 text-xs text-emerald-300 hover:text-emerald-200 inline-flex items-center gap-1">
                <ImagePlus className="w-3.5 h-3.5" /> Change photo
              </button>
            )}
            </>
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

            {!guest && (
            <div className="flex items-start justify-between gap-3 rounded-lg border border-slate-700 bg-slate-800/60 p-3">
              <div>
                <Label htmlFor="qa-remind" className="text-slate-100">Remind me on feeding days</Label>
                <p className="text-xs text-slate-400 mt-0.5">Every {DEFAULT_FEEDING_INTERVAL_DAYS} days, starting today. One message, even with the app closed.</p>
              </div>
              <Switch id="qa-remind" checked={remind} onCheckedChange={setRemind} />
            </div>
            )}

            <div className="flex flex-col-reverse sm:flex-row gap-2 pt-1">
              {guest ? (
                <Button variant="ghost" className="min-h-11 text-slate-300" onClick={() => onClose?.()}>
                  Back to the demo
                </Button>
              ) : (
              <Button
                variant="ghost"
                className="min-h-11 text-slate-300"
                disabled={saving || uploading}
                onClick={() => onMoreDetails?.(draft())}
              >
                More details
              </Button>
              )}
              <Button className="min-h-11 flex-1" disabled={saving || uploading} onClick={handleSave}>
                {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</> : guest ? 'Keep this gecko' : onContinue ? 'Save and continue' : 'Save gecko'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
