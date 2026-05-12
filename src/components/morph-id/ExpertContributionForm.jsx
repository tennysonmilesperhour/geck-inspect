import { useEffect, useState } from 'react';
import { User } from '@/entities/all';
import { saveGeckoImageWithMeta } from './persistence';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import {
  Loader2, CheckCircle2, Camera, Sparkles, Info,
} from 'lucide-react';

import {
  BASE_COLORS,
  PATTERN_INTENSITIES,
  WHITE_AMOUNTS,
  PROVENANCE,
  TAXONOMY_VERSION,
} from './morphTaxonomy';
import MorphPicker from './MorphPicker';
import TraitPicker from './TraitPicker';
import PhotoQualityInputs from './PhotoQualityInputs';
import GeneticsContextInputs from './GeneticsContextInputs';
import ConfidenceSlider from './ConfidenceSlider';
import MultiPhotoUploader from './MultiPhotoUploader';
import PhotoSlideshow from './PhotoSlideshow';

const EMPTY_STATE = {
  primary_morph: '',
  genetics: [],
  secondary_traits: [],
  base_color: '',
  pattern_intensity: 'medium',
  white_amount: 'medium',
  confidence_score: 75,
  notes: '',
  provenance: 'expert_owner',
  photo: { angle: '', lighting: '', fired_state: 'unknown', flags: [] },
  geneticsCtx: {
    age_stage: 'unknown', sex: 'unknown',
    sire_morph: '', dam_morph: '',
    known_hets: [], line_name: '',
  },
};

function initialUrlsFromPrefill(prefill) {
  if (!prefill) return [];
  if (Array.isArray(prefill.image_urls) && prefill.image_urls.length) return prefill.image_urls;
  if (prefill.image_url) return [prefill.image_url];
  return [];
}

export default function ExpertContributionForm({ prefill, onSaved }) {
  const [state, setState] = useState({ ...EMPTY_STATE, ...prefill });
  const [imageUrls, setImageUrls] = useState(() => initialUrlsFromPrefill(prefill));
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!prefill) return;
    setState((s) => ({
      ...s,
      ...prefill,
      photo:         { ...s.photo,         ...(prefill.photo || {}) },
      geneticsCtx:   { ...s.geneticsCtx,   ...(prefill.geneticsCtx || {}) },
    }));
    const prefillUrls = initialUrlsFromPrefill(prefill);
    if (prefillUrls.length) setImageUrls(prefillUrls);
  }, [prefill]);

  const set = (k, v) => setState((s) => ({ ...s, [k]: v }));

  const submit = async () => {
    if (imageUrls.length === 0) {
      toast({ title: 'No image', description: 'Upload at least one photo first.', variant: 'destructive' });
      return;
    }
    if (!state.primary_morph) {
      toast({ title: 'Pick a primary morph', description: 'Choose the main pattern class.', variant: 'destructive' });
      return;
    }
    setIsSaving(true);
    try {
      const user = await User.me().catch(() => null);
      const record = {
        image_url: imageUrls[0],
        image_urls: imageUrls,
        user_id: user?.id || null,
        primary_morph: state.primary_morph,
        secondary_morph: state.genetics?.[0] || null,
        secondary_traits: state.secondary_traits,
        base_color: state.base_color || null,
        pattern_intensity: state.pattern_intensity,
        white_amount: state.white_amount,
        confidence_score: state.confidence_score,
        fired_state: state.photo?.fired_state || 'unknown',
        age_estimate: state.geneticsCtx?.age_stage || 'unknown',
        notes: state.notes,
        training_meta: {
          taxonomy_version: TAXONOMY_VERSION,
          provenance: state.provenance,
          genetic_traits: state.genetics,
          photo: state.photo,
          genetics: state.geneticsCtx,
          photo_count: imageUrls.length,
        },
        verified: false,
      };

      const saved = await saveGeckoImageWithMeta(record);

      toast({ title: 'Submitted', description: 'Thanks ,  queued for peer review.' });
      onSaved?.(saved);
      setState({ ...EMPTY_STATE });
      setImageUrls([]);
    } catch (err) {
      toast({ title: 'Save failed', description: err.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="space-y-6">
        <Card className="bg-slate-900 border-slate-700">
          <CardHeader>
            <CardTitle className="text-slate-100 flex items-center gap-2">
              <Camera className="w-5 h-5" /> Photos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <MultiPhotoUploader value={imageUrls} onChange={setImageUrls} />
            {imageUrls.length > 0 && (
              <div>
                <Label className="text-slate-300 text-xs uppercase tracking-wide mb-2 block">Preview slideshow</Label>
                <PhotoSlideshow urls={imageUrls} alt="Contribution preview" maxHeightClass="max-h-[360px]" />
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-700">
          <CardHeader>
            <CardTitle className="text-slate-100 flex items-center gap-2">
              <Info className="w-5 h-5" /> Photo quality
            </CardTitle>
          </CardHeader>
          <CardContent>
            <PhotoQualityInputs value={state.photo} onChange={(v) => set('photo', v)} />
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-700">
          <CardHeader>
            <CardTitle className="text-slate-100">Genetics & life stage</CardTitle>
          </CardHeader>
          <CardContent>
            <GeneticsContextInputs value={state.geneticsCtx} onChange={(v) => set('geneticsCtx', v)} />
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card className="bg-slate-900 border-slate-700">
          <CardHeader>
            <CardTitle className="text-slate-100 flex items-center gap-2">
              <Sparkles className="w-5 h-5" /> Morph classification
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
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

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label className="text-slate-300 text-xs uppercase tracking-wide">Base color</Label>
                <Select value={state.base_color} onValueChange={(v) => set('base_color', v)}>
                  <SelectTrigger className="bg-slate-800 border-slate-600 text-slate-100">
                    <SelectValue placeholder="Pick color" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-600 max-h-60">
                    {BASE_COLORS.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-slate-300 text-xs uppercase tracking-wide">Pattern intensity</Label>
                <Select value={state.pattern_intensity} onValueChange={(v) => set('pattern_intensity', v)}>
                  <SelectTrigger className="bg-slate-800 border-slate-600 text-slate-100">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-600">
                    {PATTERN_INTENSITIES.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-slate-300 text-xs uppercase tracking-wide">White amount</Label>
                <Select value={state.white_amount} onValueChange={(v) => set('white_amount', v)}>
                  <SelectTrigger className="bg-slate-800 border-slate-600 text-slate-100">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-600">
                    {WHITE_AMOUNTS.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <ConfidenceSlider
              value={state.confidence_score}
              onChange={(v) => set('confidence_score', v)}
            />

            <div>
              <Label className="text-slate-300 text-xs uppercase tracking-wide">Provenance</Label>
              <Select value={state.provenance} onValueChange={(v) => set('provenance', v)}>
                <SelectTrigger className="bg-slate-800 border-slate-600 text-slate-100">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-600">
                  {PROVENANCE.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.label} · weight {p.weight}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-slate-300 text-xs uppercase tracking-wide">Notes</Label>
              <Textarea
                value={state.notes}
                onChange={(e) => set('notes', e.target.value)}
                placeholder="Anything a reviewer should know ,  lineage, unique marks, lighting quirks…"
                className="bg-slate-800 border-slate-600 text-slate-100"
                rows={3}
              />
            </div>

            <Button
              onClick={submit}
              disabled={imageUrls.length === 0 || !state.primary_morph || isSaving}
              className="w-full bg-emerald-600 hover:bg-emerald-700"
            >
              {isSaving ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving…</>
              ) : (
                <><CheckCircle2 className="w-4 h-4 mr-2" /> Submit training sample</>
              )}
            </Button>
            <p className="text-xs text-slate-500 text-center">
              Samples are queued as unverified and become training-grade once
              peer-reviewed by another expert.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
