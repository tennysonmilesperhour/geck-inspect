import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, X, Loader2, Sparkles } from 'lucide-react';
import { recognizeGeckoMorph } from '../functions/recognizeGeckoMorph';
import AnalysisResultDisplay from '../components/recognition/AnalysisResultDisplay';

export default function Recognition() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setPreview(URL.createObjectURL(selectedFile));
      setAnalysisResult(null);
      setError(null);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      setFile(droppedFile);
      setPreview(URL.createObjectURL(droppedFile));
      setAnalysisResult(null);
      setError(null);
    }
  };

  const handleRemoveImage = () => {
    setFile(null);
    setPreview(null);
    setAnalysisResult(null);
    setError(null);
    if(fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setIsLoading(true);
    setError(null);
    setAnalysisResult(null);
    try {
      const { data, error: funcError } = await recognizeGeckoMorph({ imageFile: file });
      if (funcError) {
        throw new Error(funcError.message);
      }
      setAnalysisResult(data);
    } catch (err) {
      console.error("Analysis error:", err);
      setError(err.message || 'An unexpected error occurred during analysis.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-4 md:p-8 bg-slate-950 min-h-screen">
      <div className="max-w-4xl mx-auto space-y-8">
        <Card className="bg-slate-900 border-slate-700 text-center">
            <CardHeader>
                <CardTitle className="text-3xl font-bold text-slate-100">AI Morph Identifier</CardTitle>
                <p className="text-slate-400 max-w-2xl mx-auto">
                    Upload a photo of your crested gecko, and our AI will analyze its morphs and traits. For best results, use clear, well-lit photos.
                </p>
            </CardHeader>
        </Card>

        <Card className="bg-slate-900 border-slate-700">
          <CardContent className="p-6">
            {!preview ? (
              <div
                className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-slate-600 rounded-lg text-center cursor-pointer hover:border-emerald-500 hover:bg-slate-800/50 transition-colors"
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-12 h-12 text-slate-500 mb-4" />
                <h3 className="text-xl font-semibold text-slate-200">Drag & Drop or Click to Upload</h3>
                <p className="text-slate-400">PNG, JPG, or WEBP. (Max 5MB)</p>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="hidden"
                  accept="image/png, image/jpeg, image/webp"
                />
              </div>
            ) : (
              <div className="space-y-6">
                <div className="relative max-w-lg mx-auto">
                  <img src={preview} alt="Gecko preview" className="rounded-lg w-full h-auto object-contain" />
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 rounded-full"
                    onClick={handleRemoveImage}
                  >
                    <X className="w-5 h-5" />
                  </Button>
                </div>
                <div className="text-center">
                  <Button
                    size="lg"
                    onClick={handleAnalyze}
                    disabled={isLoading}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                       <>
                        <Sparkles className="mr-2 h-5 w-5" />
                        Analyze Gecko
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {error && (
          <Card className="bg-red-900/50 border-red-700">
              <CardContent className="p-4">
                 <p className="text-red-300 text-center">{error}</p>
              </CardContent>
          </Card>
        )}

        {analysisResult && (
           <AnalysisResultDisplay result={analysisResult} imageUrl={preview} />
        )}
      </div>
    </div>
  );
}