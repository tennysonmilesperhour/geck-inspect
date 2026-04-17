import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, X, Loader2, Sparkles, Camera, ArrowRight } from 'lucide-react';
import { recognizeGeckoMorph } from '../functions/recognizeGeckoMorph';
import { UploadFile } from '@/integrations/Core';
import { useToast } from '@/components/ui/use-toast';

import MorphCorrectionPanel from '../components/morph-id/MorphCorrectionPanel';
import PhotoTipsCard from '../components/morph-id/PhotoTipsCard';
import SimilarGeckosStrip from '../components/morph-id/SimilarGeckosStrip';

export default function Recognition() {
  const { toast } = useToast();
  const fileInputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [uploadedUrl, setUploadedUrl] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState(null);
  const [savedOnce, setSavedOnce] = useState(false);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const reset = () => {
    setFile(null);
    setPreview(null);
    setUploadedUrl(null);
    setAnalysis(null);
    setError(null);
    setSavedOnce(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const pickFile = async (f) => {
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setAnalysis(null);
    setError(null);
    setSavedOnce(false);
    setIsUploading(true);
    try {
      const { file_url } = await UploadFile({ file: f });
      setUploadedUrl(file_url);
    } catch (err) {
      // Non-fatal: we can still try recognition with the raw file.
      console.warn('Upload failed, continuing with raw file:', err);
      toast({
        title: 'Could not upload to storage',
        description: 'Analysis will still run, but you won’t be able to save corrections.',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const onFileChange = (e) => pickFile(e.target.files?.[0]);
  const onDrop = (e) => {
    e.preventDefault();
    pickFile(e.dataTransfer.files?.[0]);
  };

  const analyze = async () => {
    if (!uploadedUrl) {
      setError('Please wait for the image to finish uploading before analyzing.');
      return;
    }
    setIsAnalyzing(true);
    setError(null);
    setAnalysis(null);
    try {
      const { data, error: funcError } = await recognizeGeckoMorph({ imageUrl: uploadedUrl });
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
              Drop a photo of your crested gecko. Our model calls out the primary
              morph, pattern, color, and traits. Agree or correct the call —
              either way you’re helping the next generation of the model get
              sharper.
            </p>
          </CardHeader>
        </Card>

        <PhotoTipsCard />

        <Card className="bg-slate-900 border-slate-700">
          <CardContent className="p-6 space-y-5">
            {!preview ? (
              <div
                className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-slate-600 rounded-lg text-center cursor-pointer hover:border-emerald-500 hover:bg-slate-800/50 transition-colors"
                onDragOver={(e) => e.preventDefault()}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-12 h-12 text-slate-500 mb-4" />
                <h3 className="text-xl font-semibold text-slate-200">Drop, or click to upload</h3>
                <p className="text-slate-400">PNG, JPG, WEBP up to 10 MB</p>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={onFileChange}
                  className="hidden"
                  accept="image/png, image/jpeg, image/webp"
                />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-6 items-start">
                <div className="relative">
                  <img
                    src={preview}
                    alt="Gecko preview"
                    className="rounded-lg max-h-[400px] object-contain border border-slate-700 bg-slate-800"
                  />
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 rounded-full"
                    onClick={reset}
                  >
                    <X className="w-5 h-5" />
                  </Button>
                  {isUploading && (
                    <div className="absolute inset-0 bg-slate-900/70 rounded-lg flex items-center justify-center">
                      <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
                      <span className="ml-2 text-slate-200 text-sm">Uploading…</span>
                    </div>
                  )}
                </div>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">
                      Ready to analyze
                    </p>
                    <p className="text-slate-200 text-sm">
                      {file?.name}
                      {uploadedUrl && (
                        <span className="text-emerald-400"> · uploaded</span>
                      )}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Button
                      size="lg"
                      onClick={analyze}
                      disabled={isAnalyzing || isUploading}
                      className="bg-emerald-600 hover:bg-emerald-700"
                    >
                      {isAnalyzing ? (
                        <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Analyzing…</>
                      ) : (
                        <><Sparkles className="mr-2 h-5 w-5" /> Identify morph</>
                      )}
                    </Button>
                    <Button variant="outline" size="lg" onClick={reset}>
                      <Camera className="mr-2 h-4 w-4" /> Try another
                    </Button>
                  </div>
                  <p className="text-xs text-slate-500">
                    Takes ~5–15 seconds. Your photo is stored so you can save
                    corrections to training data.
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
            imageUrl={uploadedUrl}
            onSaved={() => {
              setSavedOnce(true);
              toast({
                title: 'Added to training corpus',
                description: 'Reviewers will see this sample in the /training queue.',
              });
            }}
          />
        )}

        {analysis && uploadedUrl && <SimilarGeckosStrip imageUrl={uploadedUrl} />}

        {savedOnce && (
          <Card className="bg-emerald-950/30 border-emerald-800">
            <CardContent className="p-4 text-emerald-200 flex items-center justify-between">
              <span>
                Thanks — your feedback is in the queue. Want to review others?
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
