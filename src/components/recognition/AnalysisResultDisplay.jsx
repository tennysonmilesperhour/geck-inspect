import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BrainCircuit } from 'lucide-react';
import { Progress } from "@/components/ui/progress";

const commonMorphs = [
    'flame', 'harlequin', 'pinstripe', 'dalmatian', 'patternless', 'bicolor', 'lilly_white', 'axanthic'
];

export default function AnalysisResultDisplay({ result, onMorphChange }) {
  if (!result || !result.primary_morph) {
    return (
      <Card className="bg-sage-50 border-sage-200 mb-6 shadow-md">
        <CardContent className="p-6 text-center text-sage-500">
          AI analysis results will appear here.
        </CardContent>
      </Card>
    );
  }

  const {
    primary_morph,
    secondary_traits,
    base_color,
    confidence_score,
    explanation,
  } = result;

  const confidenceColor =
    confidence_score > 85 ? "bg-gradient-to-r from-emerald-400 to-green-500" :
    confidence_score > 60 ? "bg-gradient-to-r from-amber-400 to-yellow-500" :
    "bg-gradient-to-r from-rose-400 to-red-500";

  return (
    <Card className="bg-sage-50 border-sage-200 mb-6 shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sage-900">
          <BrainCircuit className="w-5 h-5" />
          AI Analysis Results
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-center">
            <p className="text-sm text-sage-600">Primary Morph</p>
            <h3 className="text-2xl font-bold text-sage-900 capitalize">
                {primary_morph?.replace(/_/g, ' ') || 'N/A'}
            </h3>
        </div>
        
        <div>
            <p className="text-sm text-sage-600 mb-2">Quick Correction</p>
            <div className="flex flex-wrap gap-2">
                {commonMorphs.map(morph => (
                    <Button
                        key={morph}
                        variant={primary_morph === morph ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => onMorphChange(morph)}
                        className={`capitalize ${primary_morph === morph ? 'bg-sage-600' : ''}`}
                    >
                        {morph.replace(/_/g, ' ')}
                    </Button>
                ))}
            </div>
        </div>

        <div className="flex justify-between items-center text-sm">
          {base_color && (
            <p>Base Color: <Badge variant="secondary">{base_color}</Badge></p>
          )}
          {secondary_traits && secondary_traits.length > 0 && (
            <p>Traits: <Badge variant="secondary">{secondary_traits.join(', ')}</Badge></p>
          )}
        </div>
        
        <div>
            <p className="text-sm text-sage-600 mb-2">AI Confidence</p>
            <div className="flex items-center gap-3">
                <Progress value={confidence_score} className="w-full h-4" colorClassName={confidenceColor} />
                <span className="font-bold text-sage-800 text-lg">{Math.round(confidence_score)}%</span>
            </div>
        </div>

        {explanation && (
          <div className="p-3 bg-white rounded-lg border border-sage-200">
            <p className="text-sm text-sage-700">{explanation}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}