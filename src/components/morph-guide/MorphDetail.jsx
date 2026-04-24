
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MorphReferenceImage, User } from '@/entities/all';
import { UploadFile } from '@/integrations/Core';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  X, 
  Star, 
  Dna, 
  Eye, 
  CheckSquare,
  Info,
  Upload,
  CheckCircle,
  EyeOff,
  ImagePlus
} from "lucide-react";
import CommentSection from './CommentSection'; // Added import

const rarityColors = {
  common: "bg-amber-100 text-amber-700 border-amber-200",
  uncommon: "bg-yellow-200 text-yellow-800 border-yellow-300",
  rare: "bg-orange-200 text-orange-800 border-orange-300",
  very_rare: "bg-yellow-400 text-yellow-900 border-yellow-500"
};

const rarityIcons = {
  common: 1,
  uncommon: 2,
  rare: 3,
  very_rare: 4
};

export default function MorphDetail({ morph, onClose }) {
  const [user, setUser] = useState(null);
  const [referenceImages, setReferenceImages] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  useEffect(() => {
      const fetchData = async () => {
          const currentUser = await User.me().catch(() => null);
          setUser(currentUser);

          if(morph) {
            const approvedImages = await MorphReferenceImage.filter({
                morph_guide_id: morph.id,
                status: 'approved'
            });
            setReferenceImages(approvedImages);
          }
      };
      fetchData();
  }, [morph]);

  const handleImageUpload = async (e) => {
      if (!e.target.files || e.target.files.length === 0) return;
      const file = e.target.files[0];
      
      setIsUploading(true);
      setUploadSuccess(false);

      try {
          const { file_url } = await UploadFile({ file });
          await MorphReferenceImage.create({
              morph_guide_id: morph.id,
              image_url: file_url,
              submitted_by_email: user.email,
              status: 'pending'
          });
          setUploadSuccess(true);
          setTimeout(() => setUploadSuccess(false), 5000);
      } catch (error) {
          console.error("Image submission failed:", error);
          // Optionally, handle error display to the user
      } finally {
          setIsUploading(false);
      }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <Card className="bg-card max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <CardHeader className="border-b border-border bg-muted/40">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <CardTitle className="text-2xl text-foreground">{morph.morph_name}</CardTitle>
                <div className="flex items-center gap-1">
                  {Array.from({ length: rarityIcons[morph.rarity] || 0 }).map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>
              </div>
              <Badge variant="outline" className={`${rarityColors[morph.rarity]} text-sm`}>
                {morph.rarity.replace('_', ' ')} morph
              </Badge>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="p-6 overflow-y-auto flex-grow">
          {morph.example_image_url && (
            <div className="mb-6 rounded-lg overflow-hidden shadow-lg border border-border">
              <img
                src={morph.example_image_url}
                alt={morph.morph_name}
                className="w-full h-64 object-cover"
              />
            </div>
          )}
          
          <div className="space-y-6">
            {/* Description */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Info className="w-5 h-5 text-primary" />
                <h3 className="text-lg font-semibold text-foreground">Description</h3>
              </div>
              <p className="text-muted-foreground leading-relaxed">{morph.description}</p>
            </div>
            
            {/* Key Features */}
            {morph.key_features && morph.key_features.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <CheckSquare className="w-5 h-5 text-primary" />
                  <h3 className="text-lg font-semibold text-foreground">Key Identifying Features</h3>
                </div>
                <div className="grid gap-3">
                  {morph.key_features.map((feature, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 bg-muted rounded-lg border border-border">
                      <div className="w-2 h-2 bg-sage-500 rounded-full flex-shrink-0"></div>
                      <span className="text-foreground font-medium">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Breeding Information */}
            {morph.breeding_info && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Dna className="w-5 h-5 text-primary" />
                  <h3 className="text-lg font-semibold text-foreground">Breeding & Genetics</h3>
                </div>
                <div className="bg-muted p-4 rounded-lg border border-border">
                  <p className="text-foreground leading-relaxed">{morph.breeding_info}</p>
                </div>
              </div>
            )}

            {/* User Submitted Reference Photos */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Eye className="w-5 h-5 text-primary" />
                <h3 className="text-lg font-semibold text-foreground">Community Reference Photos</h3>
              </div>
              
              <Alert className="mb-4 border-blue-200 bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300">
                  <ImagePlus className="h-4 w-4" />
                  <AlertDescription>
                    Help build the visual library! Submit your own photos of this morph to help others learn.
                  </AlertDescription>
              </Alert>

              {uploadSuccess && (
                  <Alert className="mb-4 border-green-200 bg-green-50 dark:bg-green-900/30 dark:text-green-200">
                      <CheckCircle className="h-4 w-4" />
                      <AlertDescription>
                          Photo submitted successfully! It will be visible to everyone after admin approval.
                      </AlertDescription>
                  </Alert>
              )}

              {referenceImages.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                      {referenceImages.map(refImage => (
                          <a key={refImage.id} href={refImage.image_url} target="_blank" rel="noopener noreferrer">
                              <img 
                                  src={refImage.image_url} 
                                  alt={`Reference for ${morph.morph_name}`}
                                  className="w-full h-32 object-cover rounded-lg border border-border hover:opacity-80 transition-opacity"
                              />
                          </a>
                      ))}
                  </div>
              ) : (
                  <div className="text-center py-4 text-sage-500 bg-muted rounded-lg mb-4">
                      <EyeOff className="w-8 h-8 mx-auto mb-2 text-sage-400" />
                      <p>No community photos yet.</p>
                      <p className="text-xs">Be the first to submit one!</p>
                  </div>
              )}
              
              {user && (
                  <Button asChild variant="outline" className="w-full" disabled={isUploading}>
                      <label className="cursor-pointer">
                          {isUploading ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                              Uploading...
                            </>
                          ) : (
                            <>
                              <Upload className="w-4 h-4 mr-2" />
                              Submit Your Photo
                            </>
                          )}
                          <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={isUploading} />
                      </label>
                  </Button>
              )}
            </div>
            
            {/* Additional Info */}
            <div className="bg-muted p-4 rounded-lg border border-border">
              <h4 className="font-semibold text-foreground mb-3">Quick Reference</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Rarity:</span>
                  <span className="ml-2 font-medium text-foreground capitalize">
                    {morph.rarity.replace('_', ' ')}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Features:</span>
                  <span className="ml-2 font-medium text-foreground">
                    {morph.key_features?.length || 0} listed
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Community Comments Section */}
          <div className="mt-8 pt-6 border-t border-sage-300">
            <CommentSection morphGuideId={morph.id} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
