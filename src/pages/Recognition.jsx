import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Loader2, Sparkles, ArrowRight, Camera } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { recognizeGeckoMorph } from '../functions/recognizeGeckoMorph';

import MorphCorrectionPanel from '../components/morph-id/MorphCorrectionPanel';
import PhotoTipsCard from '../components/morph-id/PhotoTipsCard';
import SimilarGeckosStrip from '../components/morph-id/SimilarGeckosStrip';
import MultiPhotoUploader, { MAX_PHOTOS } from '../components/morph-id/MultiPhotoUploader';
import PhotoSlideshow from '../components/morph-id/PhotoSlideshow';
import { AGE_STAGES } from '../components/morph-id/morphTaxonomy';

export default function Recognition() {
  const { toast } = useToast();
  const [imageUrls, setImageUrls] = useState([]);
  const [ageStage, setAgeStage] = useState('unknown');
  const [analysis, setAnalysis] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState(null);
  const [savedOnce, setSavedOnce] = useState(false);

  const primaryUrl = imageUrls[0] || null;

  const reset = () => {
    setImageUrls([]);
    setAgeStage('unknown');
    setAnalysis(null);
    setError(null);
    setSavedOnce(false);
  };

  const analyze = async () => {
    if (imageUrls.length === 0) {
      setError('Upload at least one photo before analyzing.');
      return;
    }
    setIsAnalyzing(true);
    setError(null);
    setAnalysis(null);
    try {
      const { data, error: funcError } = await recognizeGeckoMorph({ imageUrls, ageStage });
      if (funcError) throw new Error(funcError.message || String(funcError));
      setAnalysis(data);
    } catch (err) {
      console.error('Analysis error:', err);
      setError(err.message || 'AI analysis failed. Try another photo or check your connection.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="p-4 md:p-8 bg-slate-950 min-h-screen">
      <div className="max-w-5xl mx-auto space-y-8">
        <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-3">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-600 to-blue-600 flex items-center justify-center shadow-xl">
                <Sparkles className="w-7 h-7 text-white" />
              </div>
            </div>
            <CardTitle className="text-3xl font-bold text-slate-100">AI Morph ID</CardTitle>
            <p className="text-slate-400 max-w-2xl mx-auto mt-2">
              Drop up to {MAX_PHOTOS} photos of the same crested gecko ,  different
              angles, fired up vs fired down, close-ups. The model synthesizes
              across all of them, and you save one feedback record covering the
              whole set.
            </p>
          </CardHeader>
        </Card>

        <PhotoTipsCard />

        <Card className="bg-slate-900 border-slate-700">
          <CardContent className="p-6 space-y-5">
            <MultiPhotoUploader
              value={imageUrls}
              onChange={(urls) => {
                setImageUrls(urls);
                setAnalysis(null);
                setError(null);
                setSavedOnce(false);
              }}
              label="Gecko photos"
            />

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
                  <div className="max-w-xs">
                    <Label htmlFor="age-stage" className="text-slate-300 text-xs uppercase tracking-wide mb-1 block">
                      Life stage
                    </Label>
                    <Select value={ageStage} onValueChange={setAgeStage}>
                      <SelectTrigger id="age-stage" className="bg-slate-800 border-slate-600 text-slate-100">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-600">
                        {AGE_STAGES.map((s) => (
                          <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-slate-500 mt-1">
                      Helps the model weigh traits at the right developmental baseline (hatchling whites read very differently from adult).
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Button
                      size="lg"
                      onClick={analyze}
                      disabled={isAnalyzing}
                      className="bg-emerald-600 hover:bg-emerald-700"
                    >
                      {isAnalyzing ? (
                        <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Analyzing…</>
                      ) : (
                        <><Sparkles className="mr-2 h-5 w-5" /> Identify morph</>
                      )}
                    </Button>
                    <Button variant="outline" size="lg" onClick={reset}>
                      <Camera className="mr-2 h-4 w-4" /> Start over
                    </Button>
                  </div>
                  <p className="text-xs text-slate-500">
                    Takes ~5–15 seconds. All uploaded photos are stored so you can save corrections to training data as one submission.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {error && (
          <Card className="bg-rose-950/40 border-rose-800">
            <CardContent className="p-4 text-rose-200 text-center">{error}</CardContent>
          </Card>
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
                title: 'Added to training corpus',
                description: 'Reviewers will see this sample in the /training queue.',
              });
            }}
          />
        )}

        {analysis && primaryUrl && <SimilarGeckosStrip imageUrl={primaryUrl} />}

        {savedOnce && (
          <Card className="bg-emerald-950/30 border-emerald-800">
            <CardContent className="p-4 text-emerald-200 flex items-center justify-between">
              <span>
                Thanks ,  your feedback is in the queue. Want to review others?
              </span>
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
