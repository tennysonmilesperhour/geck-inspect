import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Loader2, Sparkles, ArrowRight, Camera, Lock, PlusCircle, ShieldCheck } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useNavigate } from 'react-router-dom';
import { recognizeGeckoMorph } from '../functions/recognizeGeckoMorph';
import { useAuth } from '@/lib/AuthContext';
import { getTierLimits, TIER_LIMITS } from '@/lib/tierLimits';
import { TIER_PRICING } from '@/lib/stripe-config';
import { buildGeckoDraftFromAnalysis } from '@/lib/morphIdDraft';
import { captureEvent } from '@/lib/posthog';

import MorphCorrectionPanel from '../components/morph-id/MorphCorrectionPanel';
import PhotoTipsCard from '../components/morph-id/PhotoTipsCard';
import SimilarGeckosStrip from '../components/morph-id/SimilarGeckosStrip';
import MultiPhotoUploader from '../components/morph-id/MultiPhotoUploader';
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
  upstream_rate_limited: {
    title: 'Our AI is busy right now',
    body: 'Lots of geckos under the lens. Please try again in a minute.',
  },
  upstream_error: {
    title: "We couldn't reach the analyzer",
    body: 'Try again in a moment. If it keeps happening, message support and we will take a look.',
  },
  auth_required: {
    title: 'Please sign in to use MorphID',
    body: 'MorphID counts against your monthly plan, so we need to know who you are first.',
    cta: { label: 'Sign in', href: '/AuthPortal' },
  },
  bad_request: {
    title: 'Upload at least one clear photo',
    body: 'Drop a JPG or PNG of your gecko and try again.',
  },
};

export default function Recognition() {
  const { toast } = useToast();
  const { user, isGuest, isLoadingAuth } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'admin';
  const [imageUrls, setImageUrls] = useState([]);
  const [ageStage, setAgeStage] = useState('unknown');
  const [firedState, setFiredState] = useState('unknown');
  const [analysis, setAnalysis] = useState(null);
  const [meta, setMeta] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isUploadingPhotos, setIsUploadingPhotos] = useState(false);
  const [error, setError] = useState(null);
  const [savedOnce, setSavedOnce] = useState(false);

  const primaryUrl = imageUrls[0] || null;

  // Free accounts have no MorphID credits. Show the upgrade card up front
  // instead of an uploader that ends in a 402 after the photo is chosen.
  const morphIdLocked =
    Boolean(user) && !isGuest && !isAdmin && getTierLimits(user).monthlyMorphIDCredits === 0;

  const reset = () => {
    setImageUrls([]);
    setAgeStage('unknown');
    setFiredState('unknown');
    setAnalysis(null);
    setMeta(null);
    setError(null);
    setSavedOnce(false);
    setIsUploadingPhotos(false);
  };

  // The headline funnel: turn the AI result into a pre-filled new gecko
  // instead of making the user re-key everything. Signed-in users go
  // straight to the add flow with the draft in router state; guests get
  // the draft stashed and are sent to sign in, then it is restored on
  // their first visit to MyGeckos.
  const handleAddToCollection = () => {
    const draft = buildGeckoDraftFromAnalysis(analysis, imageUrls);
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
    if (imageUrls.length === 0) {
      setError({ code: 'bad_request', message: 'Upload at least one photo before analyzing.' });
      return;
    }
    setIsAnalyzing(true);
    setError(null);
    setAnalysis(null);
    setMeta(null);
    try {
      const { data, error: funcError, meta: respMeta } = await recognizeGeckoMorph({ imageUrls, ageStage, firedState });
      if (funcError) {
        setError(funcError);
      } else {
        setAnalysis(data);
        setMeta(respMeta || null);
      }
    } catch (err) {
      console.error('Analysis error:', err);
      setError({ code: 'internal_error', message: err.message || 'AI analysis failed.' });
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="p-4 md:p-8 bg-slate-950 min-h-screen">
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="pt-2">
          <div className="flex items-center gap-2 text-emerald-300 text-sm font-medium">
            <ShieldCheck className="w-4 h-4" /> Evidence-first visual identification
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-100 mt-3">Crested gecko Morph ID</h1>
          <p className="text-slate-400 max-w-2xl mt-3">
            Add clear photos of one crested gecko. You will get a ranked visual shortlist,
            the traits behind it, and an honest prompt for better evidence when the photos are not enough.
          </p>
          <div className="flex flex-wrap gap-x-5 gap-y-2 mt-5 text-xs text-slate-400">
            <span><strong className="text-slate-200">1.</strong> Add photos</span>
            <span><strong className="text-slate-200">2.</strong> Compare evidence</span>
            <span><strong className="text-slate-200">3.</strong> Confirm or request review</span>
          </div>
          <p className="text-xs text-amber-200/80 mt-4">
            Crested geckos only. Other species will be rejected as insufficient evidence.
          </p>
        </div>

        <PhotoTipsCard />

        {morphIdLocked && (
          <Card className="bg-amber-950/40 border-amber-800">
            <CardContent className="p-6 flex flex-col items-center text-center gap-3">
              <Lock className="w-6 h-6 text-amber-300" />
              <p className="font-semibold text-amber-100">AI Morph ID is included with Keeper and up</p>
              <p className="text-sm text-amber-200/80 max-w-md">
                Keeper is {TIER_PRICING.keeper.monthly.price} a month and includes {TIER_LIMITS.keeper.monthlyMorphIDCredits} identifications
                a month. Free accounts can browse the Morph Guide, use the genetics calculator, and track their collection.
              </p>
              <div className="flex flex-wrap gap-3 justify-center">
                <Button className="bg-emerald-600 hover:bg-emerald-500 text-white" onClick={() => navigate('/Membership')}>
                  See plans
                </Button>
                <Button variant="outline" className="border-slate-600 text-slate-200" onClick={() => navigate('/MorphGuide')}>
                  Open the Morph Guide
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {!morphIdLocked && (
        <Card className="bg-slate-900 border-slate-700">
          <CardContent className="p-6 space-y-5">
            {isLoadingAuth ? (
              <div className="py-10 text-center text-slate-400">
                <Loader2 className="w-5 h-5 animate-spin inline mr-2" /> Checking your account...
              </div>
            ) : user && !isGuest ? (
              <MultiPhotoUploader
                value={imageUrls}
                onBusyChange={setIsUploadingPhotos}
                onChange={(urls) => {
                  setImageUrls(urls);
                  setAnalysis(null);
                  setError(null);
                  setSavedOnce(false);
                }}
                label="Gecko photos"
              />
            ) : (
              <div className="py-8 text-center max-w-lg mx-auto">
                <Lock className="w-7 h-7 text-emerald-400 mx-auto" />
                <h2 className="text-lg font-semibold text-slate-100 mt-3">Sign in before uploading</h2>
                <p className="text-sm text-slate-400 mt-2">
                  This prevents abandoned public uploads and lets us keep your result and monthly credit count together.
                </p>
                <Button onClick={() => navigate('/AuthPortal')} className="bg-emerald-600 hover:bg-emerald-700 mt-4">
                  Sign in to use Morph ID
                </Button>
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
                      {imageUrls.length} photo{imageUrls.length !== 1 ? 's' : ''} · primary is the one used as cover.
                    </p>
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
                  <div className="flex flex-wrap gap-3">
                    <Button
                      size="lg"
                      onClick={analyze}
                      disabled={isAnalyzing || isUploadingPhotos || !user || isGuest}
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
                    One credit is charged only when an analysis succeeds. A failed analyzer call is refunded automatically.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        )}

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
          const friendly = FRIENDLY_ERROR[error.code] || {
            title: "We couldn't analyze that photo",
            body: 'Try a different photo, or check your connection and try again.',
          };
          const isExhausted = error.code === 'morph_id_credits_exhausted';
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
                {friendly.cta && (
                  <Button
                    onClick={() => { window.location.href = friendly.cta.href; }}
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

        {meta && !meta.is_admin && typeof meta.credits_remaining === 'number' && (
          <p className="text-xs text-slate-500 text-center">
            {meta.credits_remaining} of {meta.credits_included} MorphID credits left this month.
          </p>
        )}

        {analysis && (
          <MorphCorrectionPanel
            result={analysis}
            imageUrl={primaryUrl}
            imageUrls={imageUrls}
            ageStage={ageStage}
            onSaved={() => {
              setSavedOnce(true);
              toast({
                title: 'Sent for expert review',
                description: 'The sample is queued, but it is not verified training data yet.',
              });
            }}
          />
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
            <CardContent className="p-4 text-emerald-200 flex items-center justify-between">
              <span>Thanks. Your feedback is pending independent expert review.</span>
              <Button
                variant="outline"
                size="sm"
                className="border-emerald-600 text-emerald-200 hover:bg-emerald-900/50"
                onClick={() => { window.location.href = '/training'; }}
              >
                Open review queue <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
