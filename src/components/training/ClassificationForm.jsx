import React, { useState, useEffect } from 'react';
import { GeckoImage } from "@/entities/all";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, Save, X, BrainCircuit, Image as ImageIcon } from "lucide-react";

export default function ClassificationForm({
  onSave,
  isSaving,
  existingClassification,
  currentUser,
  images = [],
  currentImageIndex,
  setCurrentImageIndex,
  uploadType,
  isLastImage
}) {
  const [classification, setClassification] = useState({
    primary_morph: '',
    secondary_morph: '',
    secondary_traits: [],
    base_color: '',
    confidence_score: 80,
    notes: ''
  });
  const [schemaOptions, setSchemaOptions] = useState(null);

  useEffect(() => {
    // Fetch schema once to populate dropdowns
    const fetchSchema = async () => {
      try {
        const schema = await GeckoImage.schema();
        // Sort enums alphabetically
        Object.keys(schema.properties).forEach(key => {
          if (schema.properties[key].enum) {
            schema.properties[key].enum.sort();
          }
          if (schema.properties[key].items?.enum) {
            schema.properties[key].items.enum.sort();
          }
        });
        setSchemaOptions(schema.properties);
      } catch (e) {
        console.error("Failed to load gecko image schema", e);
      }
    };
    fetchSchema();
  }, []);

  useEffect(() => {
    if (existingClassification) {
      setClassification({
        primary_morph: existingClassification.primary_morph || '',
        secondary_morph: existingClassification.secondary_morph || '',
        secondary_traits: existingClassification.secondary_traits || [],
        base_color: existingClassification.base_color || '',
        confidence_score: existingClassification.confidence_score || 80,
        notes: existingClassification.notes || ''
      });
    } else {
      // Reset form when moving to a new image in 'different-geckos' mode
      setClassification({
        primary_morph: '',
        secondary_morph: '',
        secondary_traits: [],
        base_color: '',
        confidence_score: 80,
        notes: ''
      });
    }
  }, [existingClassification, currentImageIndex]);

  const handleMultiSelectChange = (field, value) => {
    setClassification(prev => {
      const currentValues = prev[field] || [];
      const newValues = currentValues.includes(value)
        ? currentValues.filter(v => v !== value)
        : [...currentValues, value];
      return { ...prev, [field]: newValues };
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(classification);
  };

  const nextImage = () => {
    if (setCurrentImageIndex && currentImageIndex < images.length - 1) {
      setCurrentImageIndex(currentImageIndex + 1);
    }
  };

  const prevImage = () => {
    if (setCurrentImageIndex && currentImageIndex > 0) {
      setCurrentImageIndex(currentImageIndex - 1);
    }
  };
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        {/* Image Viewer */}
        <Card className="bg-white/80 backdrop-blur-sm border-sage-200 shadow-lg sticky top-24">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sage-900">
                    <ImageIcon className="w-5 h-5" />
                    Gecko Image
                </CardTitle>
            </CardHeader>
            <CardContent>
                {images.length > 0 ? (
                    <div className="relative">
                        <img
                            src={images[currentImageIndex]}
                            alt={`Gecko for classification ${currentImageIndex + 1}`}
                            className="w-full h-auto max-h-[60vh] object-contain rounded-lg border border-sage-200"
                        />
                        {images.length > 1 && (
                            <>
                                <Button
                                    onClick={prevImage}
                                    disabled={currentImageIndex === 0}
                                    variant="secondary"
                                    size="icon"
                                    className="absolute left-2 top-1/2 -translate-y-1/2"
                                >
                                    <ChevronLeft className="w-5 h-5" />
                                </Button>
                                <Button
                                    onClick={nextImage}
                                    disabled={currentImageIndex === images.length - 1}
                                    variant="secondary"
                                    size="icon"
                                    className="absolute right-2 top-1/2 -translate-y-1/2"
                                >
                                    <ChevronRight className="w-5 h-5" />
                                </Button>
                                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/50 text-white text-xs px-2 py-1 rounded-full">
                                    {currentImageIndex + 1} / {images.length}
                                </div>
                            </>
                        )}
                    </div>
                ) : (
                    <div className="text-center text-sage-500 py-16">
                        No image to display.
                    </div>
                )}
            </CardContent>
        </Card>

        {/* Classification Form */}
        <Card className="bg-white/80 backdrop-blur-sm border-sage-200 shadow-lg">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sage-900">
                    <BrainCircuit className="w-5 h-5" />
                    Step 2: Classify the Gecko
                </CardTitle>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Primary Morph - Button Format */}
                    <div>
                        <Label className="font-semibold text-sage-800 mb-3 block">Primary Morph*</Label>
                        <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                            {schemaOptions?.primary_morph.enum.map(morph => (
                                <Button
                                    key={morph}
                                    type="button"
                                    variant={classification.primary_morph === morph ? "default" : "outline"}
                                    className={`text-left justify-start h-auto py-3 ${
                                        classification.primary_morph === morph 
                                            ? 'bg-sage-600 text-white hover:bg-sage-700' 
                                            : 'hover:bg-sage-50'
                                    }`}
                                    onClick={() => setClassification(prev => ({...prev, primary_morph: morph}))}
                                >
                                    {morph.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                </Button>
                            ))}
                        </div>
                    </div>

                    {/* Confidence Score Slider */}
                    <div>
                        <Label className="font-semibold text-sage-800 mb-2 block">
                            Confidence Score: {classification.confidence_score}%
                        </Label>
                        <div className="px-2">
                            <Slider
                                value={[classification.confidence_score]}
                                onValueChange={(value) => setClassification(prev => ({...prev, confidence_score: value[0]}))}
                                min={0}
                                max={100}
                                step={5}
                                className="w-full"
                            />
                        </div>
                        <div className="flex justify-between text-xs text-sage-500 mt-1 px-2">
                            <span>0%</span>
                            <span>50%</span>
                            <span>100%</span>
                        </div>
                    </div>

                    {/* Secondary Morph */}
                    <div>
                        <Label htmlFor="secondary_morph" className="font-semibold text-sage-800">Secondary Morph</Label>
                        <Select
                            value={classification.secondary_morph}
                            onValueChange={(value) => setClassification(prev => ({...prev, secondary_morph: value}))}
                        >
                            <SelectTrigger id="secondary_morph"><SelectValue placeholder="Select secondary morph..." /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value={null}>None</SelectItem>
                                {schemaOptions?.secondary_morph.enum.map(morph => (
                                    <SelectItem key={morph} value={morph}>{morph.replace(/_/g, ' ')}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Secondary Traits */}
                    <div>
                        <Label className="font-semibold text-sage-800 mb-2 block">Secondary Traits</Label>
                        <div className="p-2 border border-sage-200 rounded-lg max-h-48 overflow-y-auto">
                            {schemaOptions?.secondary_traits.items.enum.map(trait => (
                                <div
                                    key={trait}
                                    onClick={() => handleMultiSelectChange('secondary_traits', trait)}
                                    className={`p-2 rounded-md cursor-pointer transition-colors ${
                                        classification.secondary_traits.includes(trait) 
                                            ? 'bg-sage-600 text-white' 
                                            : 'hover:bg-sage-100'
                                    }`}
                                >
                                    {trait.replace(/_/g, ' ')}
                                </div>
                            ))}
                        </div>
                        <div className="flex flex-wrap gap-2 mt-2">
                            {classification.secondary_traits.map(trait => (
                                <Badge
                                    key={trait}
                                    variant="secondary"
                                    className="bg-sage-200 text-sage-800"
                                >
                                    {trait.replace(/_/g, ' ')}
                                    <button
                                        type="button"
                                        onClick={() => handleMultiSelectChange('secondary_traits', trait)}
                                        className="ml-2"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </Badge>
                            ))}
                        </div>
                    </div>

                    {/* Base Color */}
                    <div>
                        <Label htmlFor="base_color" className="font-semibold text-sage-800">Base Color</Label>
                        <Select
                            value={classification.base_color}
                            onValueChange={(value) => setClassification(prev => ({...prev, base_color: value}))}
                        >
                            <SelectTrigger id="base_color"><SelectValue placeholder="Select base color..." /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value={null}>None</SelectItem>
                                {schemaOptions?.base_color.enum.map(color => (
                                    <SelectItem key={color} value={color}>{color.replace(/_/g, ' ')}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Notes */}
                    <div>
                        <Label htmlFor="notes" className="font-semibold text-sage-800">Notes</Label>
                        <Textarea
                            id="notes"
                            value={classification.notes}
                            onChange={(e) => setClassification(prev => ({...prev, notes: e.target.value}))}
                            placeholder="Add any additional notes about this gecko..."
                            className="h-24"
                        />
                    </div>

                    <div className="flex justify-end pt-4 border-t border-sage-200">
                         <Button
                            type="submit"
                            disabled={isSaving || !classification.primary_morph}
                            className="bg-gradient-to-r from-sage-600 to-earth-600 hover:from-sage-700 hover:to-earth-700 shadow-lg"
                        >
                            {isSaving ? 'Saving...' : (
                                <>
                                    <Save className="w-4 h-4 mr-2" />
                                    {uploadType === 'different-geckos' && !isLastImage ? 'Save & Next' : 'Save Classification'}
                                </>
                            )}
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    </div>
  );
}