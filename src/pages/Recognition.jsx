import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Loader2, Sparkles, ArrowRight, Camera, Lock, PlusCircle, ShieldCheck, Search, RotateCcw, Check } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { recognizeGeckoMorph } from '../functions/recognizeGeckoMorph';
import { useAuth } from '@/lib/AuthContext';
import Seo from '@/components/seo/Seo';
import PageHeader from '@/components/shared/PageHeader';
import { getTierLimits, TIER_LIMITS } from '@/lib/tierLimits';
import { loadMorphIdQuota, morphIdGate, morphIdScansLeftLabel } from '@/lib/morphIdQuota';
import { TIER_PRICING } from '@/lib/stripe-config';
import { buildGeckoDraftFromAnalysis, applyCorrections } from '@/lib/morphIdDraft';
import { captureEvent } from '@/lib/posthog';
import { upgradePromptShown, upgradePromptClicked } from '@/lib/activation';
import { onPhotoPath } from '@/lib/firstGeckoFlow';

import MorphCorrectionPanel from '../components/morph-id/MorphCorrectionPanel';
import PhotoTipsCard from '../components/morph-id/PhotoTipsCard';
import MorphIdCoverageCard from '../components/morph-id/MorphIdCoverageCard';
import SimilarGeckosStrip from '../components/morph-id/SimilarGeckosStrip';
import ViewPhotoUploader from '../components/morph-id/ViewPhotoUploader';
import PhotoSlideshow from '../components/morph-id/PhotoSlideshow';
import { AGE_STAGES, FIRED_STATES } from '../components/morph-id/morphTaxonomy';

// User-facing error copy keyed by edge-function error code. Admins skip
// this and see the raw upstream message instead, so they can debug the
// 429 from Replicate or whatever else fired.
const FRIENDLY_ERROR = {
  morph_id_credits_exhausted: {
    title: "You're out of MorphID credits for this month",
    body: 'Your credits reset on the 1st. Upgrade your plan to identify more geckos now.',
    cta: { label: 'See plans', href: '/Membership' },
  },
  // The per-network daily cap runs before a credit is used, so nothing was
  // charged. Without its own copy this fell through to "try a different
  // photo", which only invited more retries.
  morph_id_ip_daily_exhausted: {
    title: 'Daily Morph ID limit reached on this network',
    body: 'Please try again tomorrow. No credit was used.',
  },
  upstream_rate_limited: {
    title: 'Our AI is busy right now',
    body: 'Lots of geckos under the lens. Please try again in a minute.',
  },
  upstream_error: {
    title: "We couldn't reach the analyzer",
    body: 'Try again in a moment. If it keeps happening, message support and we will take a look.',
  },
  request_timeout: {
    title: 'The analysis took too long',
    body: 'Your photos are still here. Press Identify again: if the first try finished, you get that answer back without using another credit.',
  },
  upstream_timeout: {
    title: 'The analysis took too long',
    body: 'Your photos are still here and no credit was used. Please try once more in a moment.',
  },
  morph_id_in_progress: {
    title: 'Still working on these photos',
    body: 'Your last analysis of these photos is still running. Wait a few seconds, then press Identify again. You will not be charged twice.',
  },
  network_error: {
    title: 'The analyzer request was interrupted',
    body: 'Your photos are still here. Check your connection or browser privacy extension, then press Identify again. A retry of the same photos is not charged twice.',
  },
  auth_required: {
    title: 'Please sign in to use MorphID',
    body: 'MorphID counts against your monthly plan, so we need to know who you are first.',
    cta: { label: 'Sign in', href: '/AuthPortal' },
  },
  bad_request: {
    title: 'Add a top view and a side view',
    body: 'Morph ID needs one clear photo from above and one from the side. Add both, then press Identify again.',
  },
  image_unreadable: {
    title: "The analyzer couldn't open one of the photos",
    body: 'No credit was used. Retake it as a normal camera photo (JPG or PNG), or pick a different one, then press Identify again.',
  },
  credit_check_failed: {
    title: "We couldn't check your credits",
    body: 'Nothing was charged. Please press Try again in a moment.',
  },
  analyzer_unavailable: {
    title: 'Morph ID is down for maintenance',
    body: 'Nothing was charged and your photos are still here. We have been alerted. Please try again in a few hours.',
  },
  config_error: {
    title: 'Morph ID is down for maintenance',
    body: 'Nothing was charged. We have been alerted and it should be back shortly.',
  },
  internal_error: {
    title: 'Something went wrong on our side',
    body: 'Any credit used was refunded automatically. Your photos are still here, so press Try again.',
  },
};

// Errors where pressing Identify again with the same photos can work. The
// request key makes a retry safe: a finished first try is returned, not
// charged twice.
const RETRYABLE = new Set([
  'upstream_rate_limited', 'upstream_error', 'upstream_timeout', 'request_timeout',
  'morph_id_in_progress', 'network_error', 'credit_check_failed', 'internal_error',
]);

// What the analyzer is doing, in the order it does it, so a 30 to 90 second
// wait reads as work in progress instead of a frozen button.
const PROGRESS_STEPS = [
  { at: 0, label: 'Checking your photos are sharp and show the whole gecko' },
  { at: 6, label: 'Comparing against thousands of breeder-tagged crested geckos' },
  { at: 20, label: 'Reading pattern: harlequin coverage, pinning, dalmatian spots' },
  { at: 35, label: 'Checking for Lilly White, Axanthic and Cappuccino markers' },
  { at: 55, label: 'Weighing the evidence across every photo' },
  { at: 80, label: 'Almost there. Detailed photos take a little longer' },
];

function AnalysisProgress({ seconds }) {
  const current = PROGRESS_STEPS.reduce((idx, step, i) => (seconds >= step.at ? i : idx), 0);
  const pct = Math.min(95, Math.round((seconds / 75) * 100));
  return (
    <Card className="bg-slate-900/80 border-emerald-800/60" aria-live="polite">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <p className="font-semibold text-emerald-100 flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Identifying your gecko
          </p>
          <span className="text-xs text-slate-400 tabular-nums">{seconds}s</span>
        </div>
        <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
          <div className="h-full bg-emerald-500 transition-all duration-1000" style={{ width: `${pct}%` }} />
        </div>
        <ol className="space-y-1.5">
          {PROGRESS_STEPS.map((step, i) => (
            <li
              key={step.label}
              className={`text-sm flex items-start gap-2 ${i < current ? 'text-slate-500' : i === current ? 'text-emerald-100' : 'text-slate-600'}`}
            >
              {i < current
                ? <Check className="h-4 w-4 mt-0.5 shrink-0 text-emerald-500" />
                : i === current
                  ? <Loader2 className="h-4 w-4 mt-0.5 shrink-0 animate-spin text-emerald-400" />
                  : <span className="h-4 w-4 mt-0.5 shrink-0" />}
              {step.label}
            </li>
          ))}
        </ol>
        <p className="text-xs text-slate-500">Usually 30 to 60 seconds. You can keep this tab open in the background.</p>
      </CardContent>
    </Card>
  );
}

export default function Recognition() {
  const { user, isGuest, isLoadingAuth } = useAuth();
  const navigate = useNavigate();
  // Arrived from the guided first gecko's "Add it by photo".
  const [firstGeckoPath] = useState(() => onPhotoPath() || new URLSearchParams(window.location.search).get('first_gecko') === '1');
  const isAdmin = user?.role === 'admin';
  const [imageUrls, setImageUrls] = useState([]);
  const [ageStage, setAgeStage] = useState('unknown');
  const [firedState, setFiredState] = useState('unknown');
  const [analysis, setAnalysis] = useState(null);
  const [meta, setMeta] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isUploadingPhotos, setIsUploadingPhotos] = useState(false);
  // True once the required top and side views are both uploaded.
  const [viewsComplete, setViewsComplete] = useState(false);
  const [uploaderKey, setUploaderKey] = useState(0);
  const [error, setError] = useState(null);
  const [savedOnce, setSavedOnce] = useState(false);
  // The member's corrections from the result panel, used by "Add to my
  // collection" so it saves what they confirmed.
  const [corrected, setCorrected] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const resultRef = useRef(null);

  useEffect(() => {
    if (!isAnalyzing) return undefined;
    setElapsed(0);
    const started = Date.now();
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [isAnalyzing]);

  // On a phone the answer lands below the uploader, out of sight. Bring it
  // (or the error) into view when it arrives.
  useEffect(() => {
    if ((analysis || error) && resultRef.current) {
      resultRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [analysis, error]);

  const handleCorrectionChange = useCallback((state) => setCorrected(state), []);

  const primaryUrl = imageUrls[0] || null;

  // The server reports scans left (the plan allowance plus any unexpired
  // bonus credits). Free is 1 lifetime try. Paid plans are the monthly
  // cap. Lock only once that number is known to be 0. If the read fails,
  // the server still enforces the limit and returns a clear error.
  const isFreeTier =
    Boolean(user) && !isGuest && !isAdmin && getTierLimits(user).monthlyMorphIDCredits === 0;
  const quotaQuery = useQuery({
    // Usage is keyed by the sign-in id (auth_user_id). user.id is the
    // profile id, which differs for every free account.
    queryKey: ['morph-id-scans-remaining', user?.auth_user_id, isFreeTier],
    enabled: Boolean(user?.auth_user_id) && !isGuest && !isAdmin,
    staleTime: 60 * 1000,
    queryFn: () => loadMorphIdQuota(supabase, {
      isFreeTier,
      userId: user.auth_user_id,
    }),
  });
  const gate = quotaQuery.data ?? morphIdGate({ isFreeTier });
  const morphIdLocked = gate.locked;
  const showFirstFreeBanner = isFreeTier && (
    quotaQuery.isSuccess ? gate.showFirstFreeBanner : !quotaQuery.isError
  );
  const showScansLeft = quotaQuery.isSuccess && gate.showScansLeft;

  // Funnel: the locked card is an upgrade prompt.
  useEffect(() => {
    if (morphIdLocked) upgradePromptShown('morph_id', 'morph_id_locked');
  }, [morphIdLocked]);

  // One request key per set of photos and answers. A retry of the same
  // photos (after a timeout, a dropped connection or a double tap) sends
  // the same key, so the server returns the first answer instead of
  // charging a second credit. New photos or "Start over" get a new key.
  const requestKeyRef = useRef({ signature: null, key: null });
  const analyzingRef = useRef(false);
  const requestKeyFor = (signature) => {
    if (requestKeyRef.current.signature !== signature || !requestKeyRef.current.key) {
      let key;
      try {
        key = crypto.randomUUID();
      } catch {
        key = `k${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
      }
      requestKeyRef.current = { signature, key };
    }
    return requestKeyRef.current.key;
  };

  const reset = () => {
    setImageUrls([]);
    setViewsComplete(false);
    // Remount the uploader so its photo slots empty too.
    setUploaderKey((k) => k + 1);
    setAgeStage('unknown');
    setFiredState('unknown');
    setAnalysis(null);
    setMeta(null);
    setError(null);
    setSavedOnce(false);
    setCorrected(null);
    setIsUploadingPhotos(false);
    requestKeyRef.current = { signature: null, key: null };
  };

  // The headline funnel: turn the AI result into a pre-filled new gecko
  // instead of making the user re-key everything. Signed-in users go
  // straight to the add flow with the draft in router state; guests get
  // the draft stashed and are sent to sign in, then it is restored on
  // their first visit to MyGeckos.
  const handleAddToCollection = () => {
    const draft = buildGeckoDraftFromAnalysis(applyCorrections(analysis, corrected), imageUrls);
    if (!draft) return;
    captureEvent('morph_id_add_to_collection_clicked', {
      morph_count: draft.morph_tags.length,
      is_guest: Boolean(isGuest) || !user,
    });
    if (user && !isGuest) {
      navigate('/MyGeckos', { state: { geckoDraft: draft } });
    } else {
      try {
        sessionStorage.setItem('pending_gecko_draft', JSON.stringify(draft));
      } catch {
        // sessionStorage unavailable (private mode): fall through to sign-in
      }
      navigate('/AuthPortal');
    }
  };

  const analyze = async () => {
    if (!user || isGuest) {
      setError({ code: 'auth_required', message: 'Please sign in before uploading or analyzing photos.' });
      return;
    }
    if (!viewsComplete) {
      setError({ code: 'bad_request', message: 'Add a top view and a side view before analyzing.' });
      return;
    }
    // A second tap before React re-renders the disabled button would
    // start a second paid analysis.
    if (analyzingRef.current) return;
    analyzingRef.current = true;
    setIsAnalyzing(true);
    setError(null);
    setAnalysis(null);
    setMeta(null);
    setCorrected(null);
    const requestKey = requestKeyFor(JSON.stringify([imageUrls, ageStage, firedState]));
    try {
      const { data, error: funcError, meta: respMeta } = await recognizeGeckoMorph({ imageUrls, ageStage, firedState, requestKey });
      if (funcError) {
        captureEvent('morph_id_analysis_failed', {
          error_code: funcError.code || 'unknown',
          photo_count: imageUrls.length,
        });
        captureEvent('morph_id_result', {
          outcome: 'error',
          error_code: funcError.code || 'unknown',
          photo_count: imageUrls.length,
          free_tier: isFreeTier,
        });
        if (funcError.code === 'morph_id_credits_exhausted') {
          upgradePromptShown('morph_id', 'morph_id_exhausted');
          if (!isAdmin && user?.auth_user_id) await quotaQuery.refetch();
        }
        setError(funcError);
      } else {
        captureEvent('morph_id_result', {
          outcome: data?.assessment_status === 'insufficient_evidence' ? 'insufficient' : 'success',
          photo_count: imageUrls.length,
          free_tier: isFreeTier,
          tier: respMeta?.tier || null,
          credit_refunded: respMeta?.credit_refunded === true,
          replayed: respMeta?.replayed === true,
          top_morph: data?.primary_morph || null,
        });
        // Refresh before showing the result, so "scans left" and the lock
        // match the scan that just finished (including a refund).
        if (!isAdmin && user?.auth_user_id) await quotaQuery.refetch();
        setMeta(respMeta || null);
        setAnalysis(data);
      }
    } catch (err) {
      console.error('Analysis error:', err);
      setError({ code: 'internal_error', message: err.message || 'AI analysis failed.' });
      captureEvent('morph_id_result', { outcome: 'error', error_code: 'client_exception', photo_count: imageUrls.length, free_tier: isFreeTier });
    } finally {
      analyzingRef.current = false;
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-8">
      <Seo
        title="Crested Gecko Morph ID"
        description="Upload photos of your crested gecko and get a ranked, evidence-first morph shortlist: the visible traits behind it, what the photos cannot confirm, and which photo would help next."
        path="/Recognition"
        keywords={['crested gecko morph identifier', 'crested gecko morph ID', 'identify crested gecko morph']}
      />
      <div className="max-w-5xl mx-auto space-y-6">
        <PageHeader
          icon={Search}
          eyebrow={
            <div className="flex items-center gap-2 text-emerald-300 text-sm font-medium">
              <ShieldCheck className="w-4 h-4" /> Evidence-first visual identification
            </div>
          }
          title="Crested Gecko Morph ID"
          description="Add clear photos of one crested gecko. You will get a ranked visual shortlist, the traits behind it, and an honest prompt for better evidence when the photos are not enough."
        />

        {/* Step 1 of the guided first gecko, by photo. "Add to my collection"
            below hands the result to the short add form. */}
        {firstGeckoPath && user && !isGuest && (
          <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/30 p-3 md:p-4 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-[11px] uppercase tracking-wider font-semibold text-emerald-300">Your first gecko, step 1 of 3</p>
              <p className="text-sm text-slate-200 mt-0.5">
                Add a top and a side photo and run Morph ID. Then tap &ldquo;Add to my collection&rdquo; and the morph and photos are filled in for you.
              </p>
            </div>
            <Link to="/MyGeckos?add=1&how=type" className="touch:min-h-11 inline-flex items-center text-sm text-emerald-300 hover:text-emerald-200 underline underline-offset-4 shrink-0">
              Type it in instead
            </Link>
          </div>
        )}

        <div className="space-y-3">
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-400">
            <span><strong className="text-slate-200">1.</strong> Add photos</span>
            <span><strong className="text-slate-200">2.</strong> Compare evidence</span>
            <span><strong className="text-slate-200">3.</strong> Confirm or request review</span>
          </div>
          <p className="text-xs text-amber-200/80">
            Crested geckos only. Other species will be rejected as insufficient evidence.
          </p>
        </div>

        <details className="rounded-xl border border-slate-700 p-4">
          <summary className="cursor-pointer font-medium text-slate-200 touch:py-2.5">Photo tips and supported morphs</summary>
          <div className="mt-4 space-y-4"><PhotoTipsCard /><MorphIdCoverageCard /></div>
        </details>

        {morphIdLocked && (
          <Card className="bg-amber-950/40 border-amber-800">
            <CardContent className="p-4 md:p-6 flex flex-col items-center text-center gap-3">
              <Lock className="w-6 h-6 text-amber-300" />
              <p className="font-semibold text-amber-100">
                {isFreeTier
                  ? (gate.bonus > 0 ? 'You have used your Morph ID scans' : 'You have used your free Morph ID')
                  : "You're out of Morph ID scans for this month"}
              </p>
              <p className="text-sm text-amber-200/80 max-w-md">
                {isFreeTier
                  ? <>Keeper is {TIER_PRICING.keeper.monthly.price} a month and includes {TIER_LIMITS.keeper.monthlyMorphIDCredits} identifications a month. Free accounts can keep using the Morph Guide, the genetics calculator, and collection tracking.</>
                  : 'Your monthly scans reset on the 1st. Upgrade your plan to identify more geckos now.'}
              </p>
              <div className="flex flex-wrap gap-2 justify-center mt-1">
                <Button onClick={() => { upgradePromptClicked('morph_id', 'morph_id_locked'); navigate('/Membership'); }}>
                  See plans
                </Button>
                <Button variant="outline" onClick={() => navigate('/MorphGuide')}>
                  Open the Morph Guide
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {!morphIdLocked && (
        <Card>
          <CardContent className="p-4 md:p-6 space-y-5">
            {isLoadingAuth ? (
              <div className="py-10 text-center text-slate-400">
                <Loader2 className="w-5 h-5 animate-spin inline mr-2" /> Checking your account...
              </div>
            ) : user && !isGuest ? (
              <>
              {showFirstFreeBanner && (
                <div className="rounded-lg border border-emerald-700/60 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-100">
                  <p className="font-semibold">Your first identification is free.</p>
                  <p className="text-emerald-200/80 mt-1">
                    Make it count: a sharp top view and side view in daylight, plus a third photo if you can.
                  </p>
                </div>
              )}
              {showScansLeft && (
                <div className="rounded-lg border border-emerald-700/60 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-100">
                  <p className="font-semibold">{morphIdScansLeftLabel(gate.remaining)}</p>
                  {isFreeTier && (
                    <p className="text-emerald-200/80 mt-1">
                      Make it count: a sharp top view and side view in daylight, plus a third photo if you can.
                    </p>
                  )}
                </div>
              )}
              <ViewPhotoUploader
                key={uploaderKey}
                onBusyChange={setIsUploadingPhotos}
                onChange={({ urls, ready }) => {
                  setImageUrls(urls);
                  setViewsComplete(ready);
                  setAnalysis(null);
                  setError(null);
                  setSavedOnce(false);
                }}
              />
              </>
            ) : (
              <div className="py-8 text-center max-w-lg mx-auto">
                <Lock className="w-7 h-7 text-emerald-400 mx-auto" />
                <h2 className="text-lg font-semibold text-slate-100 mt-3">Your first identification is free</h2>
                <p className="text-sm text-slate-400 mt-2">
                  Create a free account to try Morph ID once on your own crested gecko. An account keeps your photos
                  and result together, and lets you save the gecko to your collection afterwards.
                </p>
                <div className="flex flex-wrap gap-2 justify-center mt-4">
                  <Button onClick={() => navigate('/AuthPortal?mode=signup')}>
                    Create free account
                  </Button>
                  <Button variant="outline" onClick={() => navigate('/AuthPortal')}>
                    Sign in
                  </Button>
                </div>
              </div>
            )}

            {imageUrls.length > 0 && (
              <div className="pt-4 border-t border-slate-700 grid grid-cols-1 md:grid-cols-[auto_1fr] gap-6 items-start">
                <div className="w-full md:w-80">
                  <PhotoSlideshow urls={imageUrls} alt="Gecko under review" maxHeightClass="max-h-[320px]" />
                </div>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">
                      Ready to analyze
                    </p>
                    <p className="text-slate-200 text-sm">
                      {imageUrls.length} photo{imageUrls.length !== 1 ? 's' : ''}
                      {viewsComplete ? ', top and side views in.' : '. Still needed: a top view and a side view.'}
                    </p>
                    {viewsComplete && imageUrls.length === 2 && (
                      <p className="text-xs text-slate-400 mt-1">
                        A third photo (the other side, fired up or down, or a pattern close-up) usually helps, but it is optional.
                      </p>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl">
                    <div>
                      <Label htmlFor="age-stage" className="text-slate-300 text-xs uppercase tracking-wide mb-1 block">Life stage</Label>
                      <Select value={ageStage} onValueChange={setAgeStage}>
                        <SelectTrigger id="age-stage" className="bg-slate-800 border-slate-600 text-slate-100"><SelectValue /></SelectTrigger>
                        <SelectContent className="bg-slate-800 border-slate-600">
                          {AGE_STAGES.map((stage) => <SelectItem key={stage.id} value={stage.id}>{stage.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="fired-state" className="text-slate-300 text-xs uppercase tracking-wide mb-1 block">Fired state in primary photo</Label>
                      <Select value={firedState} onValueChange={setFiredState}>
                        <SelectTrigger id="fired-state" className="bg-slate-800 border-slate-600 text-slate-100"><SelectValue /></SelectTrigger>
                        <SelectContent className="bg-slate-800 border-slate-600">
                          {FIRED_STATES.map((state) => <SelectItem key={state.id} value={state.id}>{state.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 max-w-xl">
                    These details now travel with the photos and help distinguish age and fire-state effects from morph traits.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="lg"
                      onClick={analyze}
                      disabled={isAnalyzing || isUploadingPhotos || !viewsComplete || !user || isGuest}
                      className="bg-emerald-600 hover:bg-emerald-700"
                    >
                      {isAnalyzing ? (
                        <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Checking visual evidence...</>
                      ) : (
                        <><Sparkles className="mr-2 h-5 w-5" /> Identify morph</>
                      )}
                    </Button>
                    <Button variant="outline" size="lg" onClick={reset}>
                      <Camera className="mr-2 h-4 w-4" /> Start over
                    </Button>
                  </div>
                  <p className="text-xs text-slate-500">
                    {isFreeTier && gate.bonus === 0
                      ? 'Your free try is used only when we can give you an answer. If the photos are not clear enough, you keep it and can try again with better photos.'
                      : 'A credit is used only when we can give you an answer. If the photos are not clear enough, or the analyzer fails, the credit comes back automatically.'}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        )}

        <div ref={resultRef} className="scroll-mt-20" />

        {isAnalyzing && <AnalysisProgress seconds={elapsed} />}

        {error && (() => {
          // Admins get the raw upstream message so they can debug 429s,
          // Anthropic outages, etc. Regular users get the toned-down copy
          // keyed off the structured error code from the edge function.
          if (isAdmin) {
            return (
              <Card className="bg-rose-950/40 border-rose-800">
                <CardContent className="p-4 text-rose-200 space-y-1">
                  <div className="text-xs uppercase tracking-wide text-rose-300/80">
                    [admin] {error.code || 'error'}
                  </div>
                  <div className="font-mono text-sm whitespace-pre-wrap break-words">
                    {error.message}
                  </div>
                </CardContent>
              </Card>
            );
          }
          const friendly = (error.code === 'morph_id_credits_exhausted' && isFreeTier)
            ? {
                title: gate.bonus > 0 ? 'You have used your Morph ID scans' : 'You have used your free Morph ID',
                body: `Keeper includes ${TIER_LIMITS.keeper.monthlyMorphIDCredits} identifications a month.`,
                cta: { label: 'See plans', href: '/Membership' },
              }
            : FRIENDLY_ERROR[error.code] || {
            title: "We couldn't analyze that photo",
            body: 'Try a different photo, or check your connection and try again.',
          };
          const isExhausted = error.code === 'morph_id_credits_exhausted';
          const canRetry = RETRYABLE.has(error.code) || !FRIENDLY_ERROR[error.code];
          return (
            <Card className={isExhausted
              ? 'bg-amber-950/40 border-amber-800'
              : 'bg-rose-950/40 border-rose-800'
            }>
              <CardContent className="p-5 flex flex-col items-center text-center gap-3">
                {isExhausted && <Lock className="w-6 h-6 text-amber-300" />}
                <div>
                  <p className={`font-semibold ${isExhausted ? 'text-amber-100' : 'text-rose-100'}`}>
                    {friendly.title}
                  </p>
                  <p className={`text-sm mt-1 ${isExhausted ? 'text-amber-200/80' : 'text-rose-200/80'}`}>
                    {friendly.body}
                  </p>
                </div>
                {canRetry && viewsComplete && (
                  <Button onClick={analyze} disabled={isAnalyzing} className="bg-rose-500 hover:bg-rose-400 text-white">
                    <RotateCcw className="w-4 h-4 mr-2" /> Try again
                  </Button>
                )}
                {friendly.cta && (
                  <Button
                    onClick={() => {
                      if (isExhausted) upgradePromptClicked('morph_id', 'morph_id_exhausted');
                      navigate(friendly.cta.href);
                    }}
                    className={isExhausted
                      ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                      : 'bg-rose-500 hover:bg-rose-400 text-white'
                    }
                  >
                    {friendly.cta.label}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })()}

        {meta && !meta.is_admin && meta.credit_refunded && (
          <p className="text-xs text-slate-500 text-center">
            {isFreeTier && gate.bonus === 0
              ? 'We need clearer photos for this one, so your free identification was not used. Retake the top and side views and try again.'
              : 'We need clearer photos for this one, so no credit was used. Retake the top and side views and try again.'}
          </p>
        )}
        {meta && !meta.is_admin && !meta.credit_refunded && isFreeTier && gate.known && gate.remaining === 0 && gate.bonus === 0 && (
          <p className="text-xs text-slate-500 text-center">
            That was your free identification. Keeper includes {TIER_LIMITS.keeper.monthlyMorphIDCredits} a month.
          </p>
        )}
        {meta && !meta.is_admin && showScansLeft && (
          <p className="text-xs text-slate-500 text-center">
            {morphIdScansLeftLabel(gate.remaining)}
          </p>
        )}

        {analysis && (
          <MorphCorrectionPanel
            result={analysis}
            imageUrl={primaryUrl}
            imageUrls={imageUrls}
            ageStage={ageStage}
            onChange={handleCorrectionChange}
            onSaved={() => setSavedOnce(true)}
          />
        )}

        {analysis && analysis.assessment_status === 'insufficient_evidence' && (
          <Card className="bg-amber-950/30 border-amber-700">
            <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-amber-100">Retake the photos for a confident answer</p>
                <p className="text-sm text-amber-200/80 mt-1">
                  {analysis.photo_assessment?.next_photo_needed
                    || 'Shoot in daylight, fill the frame with the gecko, and take one photo straight down and one from the side.'}
                </p>
              </div>
              <Button
                size="lg"
                onClick={() => {
                  reset();
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="bg-amber-500 hover:bg-amber-400 text-slate-950 shrink-0"
              >
                <Camera className="w-5 h-5 mr-2" /> Retake photos
              </Button>
            </CardContent>
          </Card>
        )}

        {analysis && primaryUrl && (
          <SimilarGeckosStrip imageUrl={primaryUrl} evidence={analysis.visual_evidence} />
        )}

        {analysis && analysis.assessment_status !== 'insufficient_evidence' && (
          <Card className="bg-emerald-950/30 border-emerald-700">
            <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-emerald-100">Add this gecko to your collection</p>
                <p className="text-sm text-emerald-200/80 mt-1">
                  We will pre-fill the photos and suggested visual labels. Review every field before saving.
                </p>
              </div>
              <Button size="lg" onClick={handleAddToCollection} className="bg-emerald-600 hover:bg-emerald-500 shrink-0">
                <PlusCircle className="w-5 h-5 mr-2" /> Add to my collection
              </Button>
            </CardContent>
          </Card>
        )}

        {savedOnce && (
          <Card className="bg-emerald-950/30 border-emerald-800">
            <CardContent className="p-4 text-emerald-200 flex flex-wrap items-center justify-between gap-3">
              <span>Thanks. Your feedback is pending independent expert review.</span>
              {/* Only reviewers can use the queue; everyone else just gets the thanks. */}
              {isAdmin && (
                <Button
                  variant="outline"
                  size="sm"
                  className="border-emerald-600 text-emerald-200 hover:bg-emerald-900/50"
                  onClick={() => { window.location.href = '/AdminPanel?section=morph_id_review'; }}
                >
                  Open review queue <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
