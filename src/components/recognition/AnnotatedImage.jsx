import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, EyeOff } from "lucide-react";

const MORPH_COLORS = {
  flame: "#ff6b6b",
  harlequin: "#4ecdc4",
  pinstripe: "#45b7d1",
  tiger: "#f9ca24",
  brindle: "#6c5ce7",
  extreme_harlequin: "#a55eea",
  dalmatian: "#26de81",
  patternless: "#fd79a8",
  bicolor: "#fdcb6e",
  tricolor: "#e17055"
};

export default function AnnotatedImage({ imageUrl, annotations = [], className }) {
  const canvasRef = useRef(null);
  const imageRef = useRef(null);
  const [visibleAnnotations, setVisibleAnnotations] = useState(new Set());
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (imageLoaded && annotations.length > 0) {
      drawAnnotations();
    }
  }, [visibleAnnotations, imageLoaded, annotations]);

  const handleImageLoad = () => {
    const img = imageRef.current;
    if (img && canvasRef.current) {
      const canvas = canvasRef.current;
      const container = canvas.parentElement;
      
      // Set canvas size to match displayed image size
      const displayWidth = container.clientWidth;
      const displayHeight = (img.naturalHeight / img.naturalWidth) * displayWidth;
      
      canvas.width = displayWidth;
      canvas.height = displayHeight;
      
      setImageDimensions({
        width: displayWidth,
        height: displayHeight,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight
      });
      
      setImageLoaded(true);
    }
  };

  const drawAnnotations = () => {
    const canvas = canvasRef.current;
    if (!canvas || !imageLoaded) return;
    
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const scaleX = imageDimensions.width / imageDimensions.naturalWidth;
    const scaleY = imageDimensions.height / imageDimensions.naturalHeight;

    annotations.forEach(annotation => {
      if (!visibleAnnotations.has(annotation.morph)) return;
      
      ctx.strokeStyle = MORPH_COLORS[annotation.morph] || '#ff0000';
      ctx.lineWidth = 3;
      ctx.setLineDash([]);
      
      if (annotation.type === 'outline') {
        ctx.beginPath();
        annotation.points.forEach((point, index) => {
          const x = point.x * scaleX;
          const y = point.y * scaleY;
          if (index === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        });
        ctx.closePath();
        ctx.stroke();
      } else if (annotation.type === 'highlight') {
        // Draw highlighted regions
        ctx.fillStyle = `${MORPH_COLORS[annotation.morph] || '#ff0000'}20`;
        ctx.strokeStyle = MORPH_COLORS[annotation.morph] || '#ff0000';
        
        annotation.regions.forEach(region => {
          ctx.beginPath();
          region.points.forEach((point, index) => {
            const x = point.x * scaleX;
            const y = point.y * scaleY;
            if (index === 0) {
              ctx.moveTo(x, y);
            } else {
              ctx.lineTo(x, y);
            }
          });
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        });
      } else if (annotation.type === 'arrow') {
        // Draw arrows pointing to specific features
        annotation.arrows.forEach(arrow => {
          const startX = arrow.start.x * scaleX;
          const startY = arrow.start.y * scaleY;
          const endX = arrow.end.x * scaleX;
          const endY = arrow.end.y * scaleY;
          
          // Draw arrow line
          ctx.beginPath();
          ctx.moveTo(startX, startY);
          ctx.lineTo(endX, endY);
          ctx.stroke();
          
          // Draw arrowhead
          const angle = Math.atan2(endY - startY, endX - startX);
          const headLength = 15;
          
          ctx.beginPath();
          ctx.moveTo(endX, endY);
          ctx.lineTo(
            endX - headLength * Math.cos(angle - Math.PI / 6),
            endY - headLength * Math.sin(angle - Math.PI / 6)
          );
          ctx.moveTo(endX, endY);
          ctx.lineTo(
            endX - headLength * Math.cos(angle + Math.PI / 6),
            endY - headLength * Math.sin(angle + Math.PI / 6)
          );
          ctx.stroke();
        });
      }
    });
  };

  const toggleAnnotation = (morph) => {
    setVisibleAnnotations(prev => {
      const newSet = new Set(prev);
      if (newSet.has(morph)) {
        newSet.delete(morph);
      } else {
        newSet.add(morph);
      }
      return newSet;
    });
  };

  const showAllAnnotations = () => {
    setVisibleAnnotations(new Set(annotations.map(a => a.morph)));
  };

  const hideAllAnnotations = () => {
    setVisibleAnnotations(new Set());
  };

  return (
    <div className={className}>
      <Card className="bg-white/80 backdrop-blur-sm border-sage-200 shadow-lg">
        <CardContent className="p-4">
          <div className="relative">
            <img
              ref={imageRef}
              src={imageUrl}
              alt="Annotated gecko"
              className="w-full rounded-lg"
              onLoad={handleImageLoad}
            />
            <canvas
              ref={canvasRef}
              className="absolute top-0 left-0 pointer-events-none rounded-lg"
              style={{ width: '100%', height: 'auto' }}
            />
          </div>
          
          {annotations.length > 0 && (
            <div className="mt-4 space-y-3">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={showAllAnnotations}
                  className="text-xs"
                >
                  Show All
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={hideAllAnnotations}
                  className="text-xs"
                >
                  Hide All
                </Button>
              </div>
              
              <div className="space-y-2">
                <h4 className="font-medium text-sage-900">Identified Features:</h4>
                {annotations.map((annotation, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <Badge
                      variant="outline"
                      className="capitalize"
                      style={{ 
                        borderColor: MORPH_COLORS[annotation.morph] || '#ff0000',
                        color: MORPH_COLORS[annotation.morph] || '#ff0000'
                      }}
                    >
                      {annotation.morph.replace(/_/g, ' ')} - {annotation.feature}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleAnnotation(annotation.morph)}
                      className="p-1 h-8 w-8"
                    >
                      {visibleAnnotations.has(annotation.morph) ? (
                        <Eye className="w-4 h-4" />
                      ) : (
                        <EyeOff className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}