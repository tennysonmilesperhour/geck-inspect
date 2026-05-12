import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BrainCircuit, Check, Pencil, ThumbsDown, ThumbsUp, Loader2, Save } from 'lucide-react';
import { User } from '@/entities/all';
import { useToast } from '@/components/ui/use-toast';
import { saveGeckoImageWithMeta } from './persistence';

import MorphPicker from './MorphPicker';
import TraitPicker from './TraitPicker';
import ConfidenceSlider from './ConfidenceSlider';
import {
  PROVENANCE, BASE_COLORS, PATTERN_INTENSITIES, WHITE_AMOUNTS,
  FIRED_STATES, TAXONOMY_VERSION, labelFor, confusedWith,
} from './morphTaxonomy';

function normalizeFromAI(result) {
  if (!result) return null;
  return {
    primary_morph: result.primary_morph || '',
    genetics: result.genetic_traits || [],
    secondary_traits: result.secondary_traits || [],
    base_color: result.base_color || '',
    pattern_intensity: result.pattern_intensity || 'medium',
    white_amount: result.white_amount || 'medium',
    fired_state: result.fired_state || 'unknown',
    ai_confidence: Number(result.confidence_score ?? result.confidence ?? 0),
  };
}

export default function MorphCorrectionPanel({ result, imageUrl, imageUrls, onSaved }) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [state, setState] = useState(() => normalizeFromAI(result));
  const [reviewerConfidence, setReviewerConfidence] = useState(80);
  const [notes, setNotes] = useState('');
  const [verdict, setVerdict] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setState(normalizeFromAI(result));
    setVerdict(null);
    setEditing(false);
  }, [result]);

  if (!result || !state) return null;
  const set = (k, v) => setState((s) => ({ ...s, [k]: v }));

  const saveFeedback = async () => {
    if (!imageUrl) {
      toast({ title: 'No image URL', description: 'Need the uploaded image URL to persist training feedback.', variant: 'destructive' });
      return;
    }
    setIsSaving(true);
    try {
      const user = await User.me().catch(() => null);
      const provenance = verdict === 'agree' ? 'community' : 'ai_then_expert';
      const confidence = verdict === 'agree' ? state.ai_confidence : reviewerConfidence;
      const urls = (imageUrls && imageUrls.length > 0) ? imageUrls : [imageUrl];
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
        confidence_score: confidence,
        notes,
        verified: false,
        training_meta: {
          taxonomy_version: TAXONOMY_VERSION,
          provenance,
          ai_original: result,
          reviewer_verdict: verdict,
          reviewer_edits: state,
          photo_count: urls.length,
        },
      };
      const saved = await saveGeckoImageWithMeta(record);
      toast({ title: 'Thanks!', description: 'Your correction is now part of the training corpus.' });
      onSaved?.(saved);
    } catch (err) {
      toast({ title: 'Save failed', description: err.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const confidenceColor =
    state.ai_confidence > 85 ? 'bg-emerald-500' :
    state.ai_confidence > 60 ? 'bg-amber-500' :
    'bg-rose-500';

  const confused = confusedWith(state.primary_morph);

  return (
    <Card className="bg-slate-900 border-slate-700">
      <CardHeader>
        <CardTitle className="text-slate-100 flex items-center gap-2">
          <BrainCircuit className="w-5 h-5 text-emerald-400" />
          AI analysis
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-lg bg-slate-800/60 border border-slate-700">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">Primary morph</p>
            <p className="text-2xl font-bold text-slate-100 capitalize">
              {labelFor(state.primary_morph, 'Uncertain')}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">Base color</p>
            <p className="text-lg text-slate-200 capitalize">
              {labelFor(state.base_color, '—')}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">Confidence</p>
            <div className="flex items-center gap-2 mt-1">
              <Progress value={state.ai_confidence} className="h-3 flex-1" colorClassName={confidenceColor} />
              <span className="font-semibold text-slate-100 w-10 text-right">
                {Math.round(state.ai_confidence)}%
              </span>
            </div>
          </div>
        </div>

        {state.secondary_traits?.length > 0 && (
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">Secondary traits</p>
            <div className="flex flex-wrap gap-2">
              {state.secondary_traits.map((t) => (
                <Badge key={t} variant="secondary" className="bg-slate-700 text-slate-200">
                  {labelFor(t)}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {result.explanation && (
          <div className="p-3 rounded-lg bg-slate-800 border border-slate-700">
            <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">AI reasoning</p>
            <p className="text-sm text-slate-300">{result.explanation}</p>
          </div>
        )}

        {confused.length > 0 && (
          <p className="text-xs text-amber-300">
            Often confused with: {confused.map(labelFor).join(', ')} ,  if any of those look
            closer, correct the call below.
          </p>
        )}

        <div className="flex flex-wrap gap-3">
          <Button
            variant={verdict === 'agree' ? 'default' : 'outline'}
            className={verdict === 'agree' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
            onClick={() => { setVerdict('agree'); setEditing(false); }}
          >
            <ThumbsUp className="w-4 h-4 mr-2" /> Looks right
          </Button>
          <Button
            variant={verdict === 'disagree' ? 'default' : 'outline'}
            className={verdict === 'disagree' ? 'bg-rose-600 hover:bg-rose-700' : ''}
            onClick={() => { setVerdict('disagree'); setEditing(true); }}
          >
            <ThumbsDown className="w-4 h-4 mr-2" /> Not quite
          </Button>
          <Button
            variant="outline"
            onClick={() => setEditing((v) => !v)}
          >
            <Pencil className="w-4 h-4 mr-2" /> {editing ? 'Stop editing' : 'Edit fields'}
          </Button>
        </div>

        {editing && (
          <div className="space-y-5 p-4 rounded-lg bg-slate-800/40 border border-slate-700">
            <MorphPicker
              primary={state.primary_morph}
              onPrimaryChange={(v) => set('primary_morph', v)}
              genetics={state.genetics}
              onGeneticsChange={(v) => set('genetics', v)}
            />
            <div>
              <Label className="text-slate-300 text-xs uppercase tracking-wide mb-2 block">Secondary traits</Label>
              <TraitPicker value={state.secondary_traits} onChange={(v) => set('secondary_traits', v)} compact />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <Label className="text-slate-300 text-xs">Base color</Label>
                <Select value={state.base_color} onValueChange={(v) => set('base_color', v)}>
                  <SelectTrigger className="bg-slate-800 border-slate-600 text-slate-100">
                    <SelectValue placeholder="Pick color" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-600 max-h-60">
                    {BASE_COLORS.map((c) => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-slate-300 text-xs">Pattern</Label>
                <Select value={state.pattern_intensity} onValueChange={(v) => set('pattern_intensity', v)}>
                  <SelectTrigger className="bg-slate-800 border-slate-600 text-slate-100"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-600">
                    {PATTERN_INTENSITIES.map((p) => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-slate-300 text-xs">White</Label>
                <Select value={state.white_amount} onValueChange={(v) => set('white_amount', v)}>
                  <SelectTrigger className="bg-slate-800 border-slate-600 text-slate-100"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-600">
                    {WHITE_AMOUNTS.map((p) => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-slate-300 text-xs">Fired state</Label>
                <Select value={state.fired_state} onValueChange={(v) => set('fired_state', v)}>
                  <SelectTrigger className="bg-slate-800 border-slate-600 text-slate-100"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-600">
                    {FIRED_STATES.map((f) => <SelectItem key={f.id} value={f.id}>{f.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <ConfidenceSlider value={reviewerConfidence} onChange={setReviewerConfidence} label="Your confidence" />
          </div>
        )}

        {verdict && (
          <div className="space-y-3 p-4 rounded-lg bg-slate-800/40 border border-slate-700">
            <Label className="text-slate-300 text-xs uppercase tracking-wide">Notes for reviewers</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Why did you agree / disagree? What did the AI miss?"
              className="bg-slate-800 border-slate-600 text-slate-100"
            />
            <div className="flex items-center gap-3">
              <Button
                disabled={isSaving}
                onClick={saveFeedback}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Submit feedback to training set
              </Button>
              <span className="text-xs text-slate-400">
                provenance: <code className="text-slate-200">
                  {PROVENANCE.find((p) => p.id === (verdict === 'agree' ? 'community' : 'ai_then_expert'))?.label}
                </code>
              </span>
            </div>
          </div>
        )}

        {!verdict && (
          <p className="text-xs text-slate-500">
            <Check className="w-3 h-3 inline -mt-0.5 mr-1" />
            Your feedback trains the model. Agreeing reinforces the AI's output; disagreeing
            creates a labeled correction pair.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
