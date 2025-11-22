import React, { useState, useEffect } from 'react';
import { User, MorphGuide, MorphReferenceImage } from '@/entities/all';
import { UploadFile } from '@/integrations/Core';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Upload, X, CheckCircle, AlertCircle, ArrowLeft, Send } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';

const ImagePreview = ({ file, onRemove }) => (
  <div className="relative group w-full h-32">
    <img
      src={URL.createObjectURL(file)}
      alt={file.name}
      className="w-full h-full object-cover rounded-lg border border-sage-200"
    />
    <button
      onClick={onRemove}
      className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
    >
      <X className="w-4 h-4" />
    </button>
  </div>
);

export default function MorphGuideSubmissionPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [morphGuides, setMorphGuides] = useState([]);
  const [selectedMorphId, setSelectedMorphId] = useState('');
  const [files, setFiles] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const currentUser = await User.me();
        setUser(currentUser);
        const guides = await MorphGuide.list();
        setMorphGuides(guides.sort((a, b) => a.morph_name.localeCompare(b.morph_name)));
      } catch (e) {
        setUser(null); // Not logged in
      }
    };
    loadInitialData();
  }, []);

  const handleFileChange = (e) => {
    if (e.target.files) {
      setFiles(prev => [...prev, ...Array.from(e.target.files)]);
    }
  };

  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedMorphId || files.length === 0 || !user) return;

    setIsSubmitting(true);
    setError(null);
    setSuccess(false);

    try {
      const uploadedUrls = [];
      for (const file of files) {
        const { file_url } = await UploadFile({ file });
        uploadedUrls.push(file_url);
      }

      const submissionPromises = uploadedUrls.map(url => 
        MorphReferenceImage.create({
          morph_guide_id: selectedMorphId,
          image_url: url,
          submitted_by_email: user.email,
          status: 'pending'
        })
      );

      await Promise.all(submissionPromises);

      setSuccess(true);
      setSelectedMorphId('');
      setFiles([]);
      setTimeout(() => setSuccess(false), 5000);

    } catch (err) {
      console.error("Submission failed:", err);
      setError("An error occurred during submission. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-sage-50 to-earth-50 p-8">
        <Card className="max-w-md w-full text-center">
          <CardHeader>
            <CardTitle>Login Required</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sage-600 mb-4">You need to be logged in to submit photos.</p>
            <Button onClick={() => User.login()}>Login</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sage-50 to-earth-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate(createPageUrl("Dashboard"))}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-sage-900">Submit Morph Guide Photos</h1>
            <p className="text-sage-600">Contribute high-quality images to our official morph guide.</p>
          </div>
        </div>

        {success && (
          <Alert variant="default" className="mb-6 bg-green-50 border-green-200">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertTitle className="text-green-800">Submission Successful!</AlertTitle>
            <AlertDescription className="text-green-700">
              Thank you for your contribution! Your photos have been submitted for review.
            </AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Submission Failed</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Card className="bg-white/80 backdrop-blur-sm border-sage-200 shadow-lg">
          <form onSubmit={handleSubmit}>
            <CardHeader>
              <CardTitle>Your Submission</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-sage-800 mb-1">1. Select Morph</label>
                <Select value={selectedMorphId} onValueChange={setSelectedMorphId} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose the morph for your photos..." />
                  </SelectTrigger>
                  <SelectContent>
                    {morphGuides.map(guide => (
                      <SelectItem key={guide.id} value={guide.id}>{guide.morph_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-sage-800 mb-2">2. Upload Photos</label>
                <div className="p-6 border-2 border-dashed border-sage-300 rounded-lg text-center bg-sage-50">
                  <Upload className="mx-auto h-12 w-12 text-sage-400" />
                  <label htmlFor="file-upload" className="relative cursor-pointer rounded-md font-semibold text-sage-600 hover:text-sage-500 mt-2 block">
                    <span>Click to upload files</span>
                    <input id="file-upload" name="file-upload" type="file" className="sr-only" multiple onChange={handleFileChange} accept="image/*" />
                  </label>
                  <p className="text-xs text-sage-500 mt-1">High-resolution JPG, PNG, or WEBP accepted.</p>
                </div>
              </div>

              {files.length > 0 && (
                <div>
                  <h3 className="text-lg font-medium text-sage-800 mb-2">Selected Images ({files.length})</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {files.map((file, index) => (
                      <ImagePreview key={index} file={file} onRemove={() => removeFile(index)} />
                    ))}
                  </div>
                </div>
              )}

              <Alert>
                <AlertTitle>Photo Guidelines</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc list-inside text-sm text-sage-600 space-y-1 mt-2">
                    <li>Ensure photos are clear, well-lit, and in focus.</li>
                    <li>The gecko should be the main subject of the image.</li>
                    <li>Avoid cluttered backgrounds.</li>
                    <li>Provide both "fired up" and "fired down" states if possible.</li>
                  </ul>
                </AlertDescription>
              </Alert>

              <div className="pt-6 border-t border-sage-200">
                <Button
                  type="submit"
                  disabled={isSubmitting || files.length === 0 || !selectedMorphId}
                  className="w-full bg-gradient-to-r from-sage-600 to-earth-600"
                  size="lg"
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="w-5 h-5 mr-2" />
                      Submit {files.length} Photo{files.length !== 1 ? 's' : ''}
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </form>
        </Card>
      </div>
    </div>
  );
}