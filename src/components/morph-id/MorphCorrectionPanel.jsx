import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertTriangle, BrainCircuit, Check, CheckCircle2, Eye, GitBranch,
  ImagePlus, Images, Loader2, Pencil, Save, ShieldQuestion,
} from 'lucide-react';
import { User } from '@/entities/all';
import { useToast } from '@/components/ui/use-toast';
import { saveGeckoImageWithMeta } from './persistence';
import { morphHeadline } from './morphHeadline';
import { ESTIMATE_PREFIX, evidenceWord, fitWord } from './modelSignal';
import { loadTraitValueIndex } from '@/lib/traitValueTable';
import { dollars, morphIdPriceRows } from '@/lib/morphIdPriceRange';

import MorphPicker from './MorphPicker';
import TraitPicker from './TraitPicker';
import ConfidenceSlider from './ConfidenceSlider';
import {
  BASE_COLORS, PATTERN_INTENSITIES, WHITE_AMOUNTS,
  FIRED_STATES, TAXONOMY_VERSION, VISUAL_PROFILE_AXES,
  labelFor, lookalikeNotes, patternColorLabel, visualAxisLabel,
} from './morphTaxonomy';

const STATUS = {
  best_match: {
    label: 'Best visual match',
    icon: CheckCircle2,
    className: 'border-emerald-700 bg-emerald-950/40 text-emerald-100',
    detail: 'The photos support a leading candidate, but this is still an AI suggestion until reviewed.',
  },
  tentative: {
    label: 'Tentative shortlist',
    icon: ShieldQuestion,
    className: 'border-amber-700 bg-amber-950/40 text-amber-100',
    detail: 'More than one morph fits the visible evidence. Compare the shortlist or ask an expert to review it.',
  },
  insufficient_evidence: {
    label: 'Better photos needed',
    icon: ImagePlus,
    className: 'border-rose-800 bg-rose-950/40 text-rose-100',
    detail: 'The current photos do not support a responsible visual identification.',
  },
};

function normalizeFromAI(result) {
  if (!result) return null;
  return {
    primary_morph: result.primary_morph || '',
    genetics: result.genetic_traits || [],
    secondary_traits: result.secondary_traits || [],
    base_color: result.base_color || '',
    pattern_intensity: result.pattern_intensity || 'unknown',
    white_amount: result.white_amount || 'unknown',
    pattern_color: result.pattern_color || 'unknown',
    fired_state: result.fired_state || 'unknown',
    ai_signal: Number(result.model_signal ?? result.confidence_score ?? result.confidence ?? 0),
  };
}

function candidatesFrom(result, state) {
  if (Array.isArray(result?.candidate_morphs) && result.candidate_morphs.length > 0) {
    return result.candidate_morphs;
  }
  return state?.primary_morph
    ? [{ morph: state.primary_morph, score: state.ai_signal, why: result?.explanation || '' }]
    : [];
}

/**
 * Asking prices for the looks on screen, from the Price Index, with how
 * many listings each range rests on. Replaces the model's own guessed
 * "Estimated retail range", which had no source. Shown only to members who
 * turned on asking prices in Settings (showPriceRange).
 */
function PriceIndexRanges({ looks, ageStage }) {
  const [index, setIndex] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | ready | failed

  useEffect(() => {
    let cancelled = false;
    loadTraitValueIndex()
      .then((loaded) => {
        if (cancelled) return;
        setIndex(loaded);
        setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setStatus('failed');
      });
    return () => { cancelled = true; };
  }, []);

  const rows = useMemo(() => morphIdPriceRows(looks, index, ageStage), [looks, index, ageStage]);
  if (status === 'loading') return null;

  return (
    <section className="rounded-lg border border-slate-700 bg-slate-800/40 p-4">
      <p className="text-xs uppercase tracking-wide text-amber-300/80">Asking prices in the Price Index</p>
      {status === 'failed' && (
        <p className="text-sm text-slate-400 mt-1">Asking prices could not load just now.</p>
      )}
      {status === 'ready' && rows.length === 0 && (
        <p className="text-sm text-slate-400 mt-1">Not enough listings of these looks to show a price range yet.</p>
      )}
      {rows.length > 0 && (
        <>
          <ul className="mt-2 space-y-2">
            {rows.map((row) => (
              <li key={row.trait} className="text-sm text-slate-200">
                <span className="font-medium text-slate-100">{row.look}</span>
                {row.gene && <span className="text-slate-400"> (only if breeding records confirm it)</span>}
                {': '}
                {dollars(row.low)} to {dollars(row.high)}
                <span className="block text-xs text-slate-400">
                  Middle half of {row.listings.toLocaleString('en-US')} listings, {row.slice}. Median {dollars(row.median)}.
                </span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-slate-400 mt-3">
            Asking prices on public crested gecko listings, not sale prices and not an appraisal. Quality, lineage, sex and proven genes move a real price a lot.
          </p>
        </>
      )}
    </section>
  );
}

export default function MorphCorrectionPanel({ result, imageUrl, imageUrls, ageStage, showPriceRange = false, onSaved, onChange }) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [state, setState] = useState(() => normalizeFromAI(result));
  const [reviewerConfidence, setReviewerConfidence] = useState(80);
  const [notes, setNotes] = useState('');
  const [verdict, setVerdict] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    setState(normalizeFromAI(result));
    setVerdict(null);
    setNotes('');
    setEditing(false);
    setIsSaved(false);
  }, [result]);

  // Let the page build "Add to my collection" from the member's corrections
  // rather than the raw AI answer.
  useEffect(() => {
    onChange?.(state);
  }, [state, onChange]);

  const candidates = useMemo(() => candidatesFrom(result, state), [result, state]);

  if (!result || !state) return null;
  const set = (key, value) => setState((current) => ({ ...current, [key]: value }));
  const status = STATUS[result.assessment_status] || STATUS.tentative;
  const StatusIcon = status.icon;
  const photo = result.photo_assessment || {};
  const visualProfile = result.visual_profile || null;
  const photoObservations = Array.isArray(result.photo_observations) ? result.photo_observations : [];
  const withholdIdentification = result.assessment_status === 'insufficient_evidence';
  const headline = morphHeadline(state.primary_morph, state.genetics);

  const saveFeedback = async () => {
    if (!imageUrl || !state.primary_morph) {
      toast({
        title: 'A photo and visual label are required',
        description: 'Add a clear photo and choose the closest primary morph before sending it for review.',
        variant: 'destructive',
      });
      return;
    }
    setIsSaving(true);
    try {
      const user = await User.me().catch(() => null);
      const confidence = verdict === 'agree' ? state.ai_signal : reviewerConfidence;
      const urls = imageUrls?.length > 0 ? imageUrls : [imageUrl];
      const resolvedAgeStage = ageStage || result?.age_stage || 'unknown';
      const record = {
        image_url: urls[0],
        image_urls: urls,
        user_id: user?.id || null,
        primary_morph: state.primary_morph,
        secondary_morph: state.genetics?.[0] || null,
        secondary_traits: state.secondary_traits,
        base_color: state.base_color || null,
        pattern_intensity: state.pattern_intensity,
        white_amount: state.white_amount,
        fired_state: state.fired_state,
        age_estimate: resolvedAgeStage,
        confidence_score: confidence,
        notes,
        verified: false,
        training_meta: {
          taxonomy_version: TAXONOMY_VERSION,
          provenance: verdict === 'agree' ? 'community' : 'ai_then_expert',
          review_status: 'pending_review',
          ai_original: result,
          reviewer_verdict: verdict,
          reviewer_edits: state,
          photo_count: urls.length,
          age_stage: resolvedAgeStage,
        },
      };
      const saved = await saveGeckoImageWithMeta(record);
      setIsSaved(true);
      toast({
        title: 'Sent for expert review',
        description: 'This label is queued and will not become verified training data until an approved expert reviews it.',
      });
      onSaved?.(saved);
    } catch (err) {
      toast({ title: 'Save failed', description: err.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b border-slate-800">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-slate-100 flex items-center gap-2">
              <BrainCircuit className="w-5 h-5 text-emerald-400" />
              Visual assessment
            </CardTitle>
            <p className="text-sm text-slate-400 mt-1">AI suggestion, not a verified identification</p>
          </div>
          <Badge variant="outline" className="border-slate-600 text-slate-300">Not verified</Badge>
        </div>
      </CardHeader>
      <CardContent className="p-5 md:p-6 space-y-6">
        <div className={`rounded-lg border p-4 ${status.className}`}>
          <div className="flex gap-3">
            <StatusIcon className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">{status.label}</p>
              <p className="text-sm opacity-80 mt-1">{status.detail}</p>
            </div>
          </div>
        </div>

        {!withholdIdentification && (
          <div className="grid grid-cols-1 md:grid-cols-[1.2fr_0.8fr] gap-4">
            <div className="rounded-lg bg-slate-800/60 border border-slate-700 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-400">Leading candidate</p>
              <p className="text-2xl font-bold text-slate-100 mt-1">
                {headline.name || labelFor(state.primary_morph, 'Uncertain')}
              </p>
              {headline.genes.length > 0 && headline.pattern && (
                <p className="text-sm text-slate-300 mt-1">
                  {headline.patternInName ? 'Pattern' : 'Pattern underneath'}: {headline.pattern}
                </p>
              )}
              <p className="text-sm text-slate-400 mt-2">{result.explanation}</p>
            </div>
            <div className="rounded-lg bg-slate-800/60 border border-slate-700 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-400">Visible context</p>
              <dl className="mt-2 space-y-2 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-400">Base color</dt>
                  <dd className="text-slate-100">{labelFor(state.base_color, 'Not assessed')}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-400">Pattern</dt>
                  <dd className="text-slate-100">{labelFor(state.pattern_intensity, 'Not assessed')}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-400">White</dt>
                  <dd className="text-slate-100">{labelFor(state.white_amount, 'Not assessed')}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-400">Pattern color</dt>
                  <dd className="text-slate-100">{patternColorLabel(state.pattern_color)}</dd>
                </div>
              </dl>
            </div>
          </div>
        )}

        {withholdIdentification && (
          <div className="rounded-lg bg-slate-800/60 border border-slate-700 p-4">
            <p className="font-medium text-slate-100">No morph call shown</p>
            <p className="text-sm text-slate-400 mt-1">
              We withhold the model's fallback when the subject or photo evidence is not usable.
            </p>
          </div>
        )}

        {visualProfile && !withholdIdentification && (
          <section className="rounded-lg border border-slate-700 bg-slate-950/30 p-4">
            <div className="mb-3">
              <h3 className="font-semibold text-slate-100">Visible trait profile</h3>
              <p className="text-xs text-slate-500 mt-1">
                Traits are assessed independently because pattern, pinning, banding, and spotting can coexist.
              </p>
            </div>
            <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {VISUAL_PROFILE_AXES.map((axis) => (
                <div key={axis.key} className="rounded-md bg-slate-800/70 border border-slate-700 p-3">
                  <dt className="text-xs uppercase tracking-wide text-slate-500">{axis.label}</dt>
                  <dd className="text-sm font-medium text-slate-100 mt-1">
                    {visualAxisLabel(visualProfile[axis.key])}
                  </dd>
                </div>
              ))}
            </dl>
            {visualProfile.white_cream_traits?.length > 0 && (
              <div className="mt-3 pt-3 border-t border-slate-700">
                <p className="text-xs uppercase tracking-wide text-slate-500 mb-2">White and cream placement</p>
                <div className="flex flex-wrap gap-2">
                  {visualProfile.white_cream_traits.map((trait) => (
                    <Badge key={trait} variant="secondary" className="bg-slate-700 text-slate-200">
                      {labelFor(trait)}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {candidates.length > 0 && !withholdIdentification && (
          <section>
            <div className="mb-3">
              <h3 className="font-semibold text-slate-100">Candidate comparison</h3>
              <p className="text-xs text-slate-500">
                The words are the AI&apos;s own estimate of how well each look fits these photos, not a measured accuracy. Morph ID has not yet been tested on an independent set of photos, so treat them as a rough guide.
              </p>
            </div>
            <div className="space-y-2">
              {candidates.map((candidate, index) => {
                const rawScore = Number(candidate.score ?? 0);
                const pctWidth = rawScore > 1 ? Math.min(100, Math.max(12, rawScore)) : Math.min(100, Math.max(12, Math.round(rawScore * 100)));
                return (
                <div key={candidate.morph} className="rounded-lg border border-slate-700 bg-slate-800/40 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-6 h-6 rounded-full bg-slate-700 text-slate-200 text-xs font-mono tabular-nums grid place-items-center shrink-0">
                        {index + 1}
                      </span>
                      <p className="font-medium text-slate-100 truncate">{labelFor(candidate.morph)}</p>
                    </div>
                    <span className="text-xs text-slate-400 shrink-0 font-mono tabular-nums">
                      {candidate.source === 'photo_lookup' ? 'reference photos' : `${ESTIMATE_PREFIX}: ${fitWord(candidate.score)}`}
                    </span>
                  </div>
                  <div className="mt-2 ml-8 h-1.5 rounded-full bg-slate-900/80 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-700 ease-out"
                      style={{ width: `${pctWidth}%` }}
                    />
                  </div>
                  {candidate.why && <p className="text-xs text-slate-400 mt-2 ml-8">{candidate.why}</p>}
                </div>
                );
              })}
            </div>
          </section>
        )}

        {photoObservations.length > 0 && (
          <section className="rounded-lg border border-slate-700 bg-slate-950/30 p-4">
            <div className="mb-3">
              <h3 className="font-semibold text-slate-100 flex items-center gap-2">
                <Images className="w-4 h-4 text-emerald-400" /> Photo-by-photo evidence
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Each image is checked separately before the evidence is combined. The evidence words are the AI&apos;s own estimate, not a measured accuracy.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {photoObservations.map((observation) => {
                const photoUrl = imageUrls?.[observation.photo_number - 1];
                return (
                  <article key={observation.photo_number} className="rounded-md border border-slate-700 bg-slate-800/50 p-3">
                    <div className="flex gap-3">
                      {photoUrl && (
                        <img
                          src={photoUrl}
                          alt={`Submitted gecko photo ${observation.photo_number}`}
                          className="w-16 h-16 rounded-md object-cover border border-slate-700 shrink-0"
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-medium text-slate-100">Photo {observation.photo_number}</p>
                          <Badge
                            variant="outline"
                            className={observation.contributes_to_result
                              ? 'border-emerald-700 text-emerald-200'
                              : 'border-slate-600 text-slate-400'}
                          >
                            {observation.contributes_to_result ? 'Used' : 'Limited'}
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-400 mt-1 capitalize">
                          {String(observation.view || 'unclear').replace(/_/g, ' ')} · {observation.quality_grade || 'poor'} · {ESTIMATE_PREFIX.toLowerCase()}: {evidenceWord(observation.evidence_signal)}
                        </p>
                      </div>
                    </div>
                    {observation.visible_features?.length > 0 && (
                      <p className="text-xs text-slate-300 mt-3">Seen: {observation.visible_features.join('; ')}</p>
                    )}
                    {observation.limitations?.length > 0 && (
                      <p className="text-xs text-amber-200/80 mt-1">Limits: {observation.limitations.join('; ')}</p>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <section className="rounded-lg border border-slate-700 p-4">
            <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              <Eye className="w-4 h-4 text-emerald-400" /> Evidence seen
            </h3>
            {result.evidence_markers?.length > 0 ? (
              <ul className="mt-3 space-y-2 text-sm text-slate-300">
                {result.evidence_markers.map((marker, index) => (
                  <li key={`${index}-${marker}`} className="flex gap-2"><Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />{marker}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500 mt-2">No reliable visual markers were returned.</p>
            )}
          </section>

          <section className="rounded-lg border border-slate-700 p-4">
            <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" /> Photo check
            </h3>
            <p className="text-sm text-slate-300 mt-2 capitalize">
              {photo.quality_grade || 'Unknown'} quality for visual ID
            </p>
            {(photo.issues?.length > 0 || result.uncertainty_reasons?.length > 0) && (
              <ul className="mt-2 text-xs text-slate-400 space-y-1 list-disc pl-4">
                {[...(photo.issues || []), ...(result.uncertainty_reasons || [])].map((issue, index) => (
                  <li key={`${index}-${issue}`}>{issue}</li>
                ))}
              </ul>
            )}
            {photo.next_photo_needed && (
              <p className="text-xs text-amber-200 mt-3">Best next photo: {photo.next_photo_needed}</p>
            )}
          </section>
        </div>

        {(state.secondary_traits?.length > 0 || state.genetics?.length > 0) && (
          <section className="space-y-3">
            {state.secondary_traits?.length > 0 && (
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400 mb-2">Visible modifiers</p>
                <div className="flex flex-wrap gap-2">
                  {state.secondary_traits.map((trait) => (
                    <Badge key={trait} variant="secondary" className="bg-slate-700 text-slate-200">{labelFor(trait)}</Badge>
                  ))}
                </div>
              </div>
            )}
            {state.genetics?.length > 0 && (
              <div className="rounded-lg border border-amber-800/70 bg-amber-950/20 p-3">
                <p className="text-xs uppercase tracking-wide text-amber-200 mb-2">Possible visible genetic expression</p>
                <div className="flex flex-wrap gap-2">
                  {state.genetics.map((trait) => (
                    <Badge key={trait} variant="outline" className="border-amber-700 text-amber-100">{labelFor(trait)}</Badge>
                  ))}
                </div>
                <p className="text-xs text-slate-400 mt-2">Photos cannot prove genotype, lineage, or hidden hets. Confirm those from breeding records.</p>
              </div>
            )}
          </section>
        )}

        {!withholdIdentification && (
          <section className="rounded-lg border border-amber-800/70 bg-amber-950/20 p-4">
            <h3 className="font-semibold text-amber-100 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-300" /> What this photo can't confirm
            </h3>
            <p className="text-xs text-amber-100/80 mt-1">
              This is a read of what is visible, not a genetic test. Line-bred looks, fired state and lighting can make different morphs look the same.
            </p>
            {lookalikeNotes([
              state.primary_morph,
              ...(state.genetics || []),
              ...(state.secondary_traits || []),
              ...candidates.map((c) => c.morph),
            ]).map((note) => (
              <p key={note} className="text-xs text-slate-300 mt-2">{note}</p>
            ))}
            <p className="text-xs text-emerald-200/90 mt-3 flex items-start gap-2">
              <GitBranch className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>
                Record this gecko with its sire and dam in{' '}
                <Link to="/MyGeckos" className="underline text-emerald-300 hover:text-emerald-200">My Geckos</Link>
                {' '}so its genes are known for certain, not guessed from a photo.
              </span>
            </p>
          </section>
        )}

        {/* The model's own dollar guess (result.value_estimate, still sent by
            servers before 16 Oct 2026 and kept in stored answers) is never
            shown: it had no source. */}
        {showPriceRange && !withholdIdentification && (
          <PriceIndexRanges looks={state} ageStage={ageStage || result?.age_stage || 'unknown'} />
        )}

        <section className="pt-5 border-t border-slate-700">
          <div className="flex flex-wrap gap-3">
            <Button
              variant={verdict === 'agree' ? 'default' : 'outline'}
              className={verdict === 'agree' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
              onClick={() => { setVerdict('agree'); setEditing(false); }}
              disabled={isSaved || withholdIdentification}
            >
              <Check className="w-4 h-4 mr-2" /> Confirm visual label
            </Button>
            <Button
              variant={verdict === 'disagree' ? 'default' : 'outline'}
              className={verdict === 'disagree' ? 'bg-amber-600 hover:bg-amber-700' : ''}
              onClick={() => {
                setVerdict('disagree');
                setEditing(true);
                if (withholdIdentification) set('primary_morph', '');
              }}
              disabled={isSaved}
            >
              <Pencil className="w-4 h-4 mr-2" /> Suggest a correction
            </Button>
          </div>

          {editing && (
            <div className="space-y-5 p-4 mt-4 rounded-lg bg-slate-800/40 border border-slate-700">
              <MorphPicker
                primary={state.primary_morph}
                onPrimaryChange={(value) => set('primary_morph', value)}
                genetics={state.genetics}
                onGeneticsChange={(value) => set('genetics', value)}
              />
              <div>
                <Label className="text-slate-300 text-xs uppercase tracking-wide mb-2 block">Visible modifiers</Label>
                <TraitPicker value={state.secondary_traits} onChange={(value) => set('secondary_traits', value)} compact />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                  <Label className="text-slate-300 text-xs">Base color</Label>
                  <Select value={state.base_color} onValueChange={(value) => set('base_color', value)}>
                    <SelectTrigger className="bg-slate-800 border-slate-600 text-slate-100"><SelectValue placeholder="Pick color" /></SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-600 max-h-60">
                      {BASE_COLORS.map((item) => <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-slate-300 text-xs">Pattern</Label>
                  <Select value={state.pattern_intensity} onValueChange={(value) => set('pattern_intensity', value)}>
                    <SelectTrigger className="bg-slate-800 border-slate-600 text-slate-100"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-600">
                      {PATTERN_INTENSITIES.map((item) => <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-slate-300 text-xs">White</Label>
                  <Select value={state.white_amount} onValueChange={(value) => set('white_amount', value)}>
                    <SelectTrigger className="bg-slate-800 border-slate-600 text-slate-100"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-600">
                      {WHITE_AMOUNTS.map((item) => <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-slate-300 text-xs">Fired state</Label>
                  <Select value={state.fired_state} onValueChange={(value) => set('fired_state', value)}>
                    <SelectTrigger className="bg-slate-800 border-slate-600 text-slate-100"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-600">
                      {FIRED_STATES.map((item) => <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <ConfidenceSlider value={reviewerConfidence} onChange={setReviewerConfidence} label="Your confidence in this correction" />
            </div>
          )}

          {verdict && !isSaved && (
            <div className="space-y-3 p-4 mt-4 rounded-lg bg-slate-800/40 border border-slate-700">
              <div>
                <Label className="text-slate-300 text-xs uppercase tracking-wide">What evidence led to your call?</Label>
                <Textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="For example: the pin breaks near the tail, and the leg pattern is too limited for harlequin."
                  className="bg-slate-800 border-slate-600 text-slate-100 mt-2"
                />
              </div>
              <Button disabled={isSaving || !state.primary_morph} onClick={saveFeedback} className="bg-emerald-600 hover:bg-emerald-700">
                {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Send for expert review
              </Button>
              <p className="text-xs text-slate-500">A sample enters the verified corpus only after an approved expert reviews the full label set.</p>
            </div>
          )}

          {isSaved && (
            <div className="rounded-lg border border-emerald-800 bg-emerald-950/30 p-4 mt-4 text-sm text-emerald-100">
              Submitted. Your suggestion is pending independent expert review.
            </div>
          )}
        </section>
      </CardContent>
    </Card>
  );
}
