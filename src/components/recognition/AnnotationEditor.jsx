import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Save, Plus, Pencil } from "lucide-react";

const ANNOTATION_TYPES = [
  { value: 'outline', label: 'Outline Feature' },
  { value: 'highlight', label: 'Highlight Region' },
  { value: 'arrow', label: 'Point to Feature' }
];

const MORPHS = [
  'flame', 'harlequin', 'pinstripe', 'tiger', 'brindle', 'extreme_harlequin',
  'dalmatian', 'patternless', 'bicolor', 'tricolor'
];

export default function AnnotationEditor({ imageUrl, annotations, onSave, className }) {
  const canvasRef = useRef(null);
  const imageRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentAnnotation, setCurrentAnnotation] = useState(null);
  const [currentPoints, setCurrentPoints] = useState([]);
  const [selectedMorph, setSelectedMorph] = useState('');
  const [selectedType, setSelectedType] = useState('outline');
  const [featureDescription, setFeatureDescription] = useState('');
  const [editingIndex, setEditingIndex] = useState(-1);

  const startAnnotation = () => {
    if (!selectedMorph) return;
    
    setCurrentAnnotation({
      morph: selectedMorph,
      type: selectedType,
      feature: featureDescription || 'Feature',
      points: [],
      regions: [],
      arrows: []
    });
    setCurrentPoints([]);
    setIsDrawing(true);
  };

  const handleCanvasClick = (e) => {
    if (!isDrawing) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * imageRef.current.naturalWidth;
    const y = ((e.clientY - rect.top) / rect.height) * imageRef.current.naturalHeight;
    
    const newPoint = { x, y };
    setCurrentPoints(prev => [...prev, newPoint]);
  };

  const finishAnnotation = () => {
    if (!currentAnnotation || currentPoints.length < 2) return;
    
    const newAnnotation = { ...currentAnnotation };
    
    if (selectedType === 'outline' || selectedType === 'highlight') {
      if (selectedType === 'outline') {
        newAnnotation.points = currentPoints;
      } else {
        newAnnotation.regions = [{ points: currentPoints }];
      }
    } else if (selectedType === 'arrow' && currentPoints.length >= 2) {
      newAnnotation.arrows = [{
        start: currentPoints[0],
        end: currentPoints[currentPoints.length - 1]
      }];
    }
    
    const updatedAnnotations = editingIndex >= 0 
      ? annotations.map((ann, idx) => idx === editingIndex ? newAnnotation : ann)
      : [...annotations, newAnnotation];
    
    onSave(updatedAnnotations);
    resetAnnotation();
  };

  const resetAnnotation = () => {
    setIsDrawing(false);
    setCurrentAnnotation(null);
    setCurrentPoints([]);
    setEditingIndex(-1);
    setFeatureDescription('');
  };

  const deleteAnnotation = (index) => {
    const updatedAnnotations = annotations.filter((_, idx) => idx !== index);
    onSave(updatedAnnotations);
  };

  return (
    <div className={className}>
      <Card className="bg-white/80 backdrop-blur-sm border-sage-200 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Pencil className="w-5 h-5" />
            Annotation Editor
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <img
              ref={imageRef}
              src={imageUrl}
              alt="Gecko for annotation"
              className="w-full rounded-lg"
            />
            <canvas
              ref={canvasRef}
              className="absolute top-0 left-0 cursor-crosshair rounded-lg"
              style={{ width: '100%', height: 'auto' }}
              onClick={handleCanvasClick}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Morph Type</Label>
              <Select value={selectedMorph} onValueChange={setSelectedMorph}>
                <SelectTrigger>
                  <SelectValue placeholder="Select morph" />
                </SelectTrigger>
                <SelectContent>
                  {MORPHS.map(morph => (
                    <SelectItem key={morph} value={morph}>
                      {morph.replace(/_/g, ' ').toUpperCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Annotation Type</Label>
              <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ANNOTATION_TYPES.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Feature Description</Label>
            <Input
              value={featureDescription}
              onChange={(e) => setFeatureDescription(e.target.value)}
              placeholder="e.g., 'dorsal stripe', 'lateral pattern'"
            />
          </div>

          <div className="flex gap-2">
            <Button
              onClick={startAnnotation}
              disabled={!selectedMorph || isDrawing}
              className="flex-1"
            >
              <Plus className="w-4 h-4 mr-2" />
              Start Annotation
            </Button>
            <Button
              onClick={finishAnnotation}
              disabled={!isDrawing || currentPoints.length < 2}
              variant="outline"
            >
              <Save className="w-4 h-4 mr-2" />
              Finish
            </Button>
            <Button
              onClick={resetAnnotation}
              disabled={!isDrawing}
              variant="outline"
            >
              Cancel
            </Button>
          </div>

          {annotations.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium">Current Annotations:</h4>
              {annotations.map((annotation, index) => (
                <div key={index} className="flex items-center justify-between p-2 bg-sage-50 rounded">
                  <span className="text-sm">
                    {annotation.morph.replace(/_/g, ' ')} - {annotation.feature}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteAnnotation(index)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}