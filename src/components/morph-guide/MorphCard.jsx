
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Star, Info, Dna } from "lucide-react";

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

export default function MorphCard({ morph, onClick }) {
  return (
    <Card className="bg-white/80 dark:bg-sage-100/90 backdrop-blur-sm border-sage-200 dark:border-sage-300 shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer group flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between mb-2">
          <CardTitle className="text-sage-900 text-lg group-hover:text-sage-700 transition-colors">
            {morph.morph_name}
          </CardTitle>
          <div className="flex items-center gap-1">
            {Array.from({ length: rarityIcons[morph.rarity] }).map((_, i) => (
              <Star key={i} className="w-3 h-3 fill-amber-400 text-amber-400" />
            ))}
          </div>
        </div>
        <Badge className={rarityColors[morph.rarity]} variant="outline">
          {morph.rarity.replace('_', ' ')}
        </Badge>
      </CardHeader>
      
      <CardContent className="pt-0 flex-grow flex flex-col">
        {morph.example_image_url && (
          <div className="mb-4 aspect-video rounded-lg overflow-hidden border border-sage-200 dark:border-sage-300">
            <img
              src={morph.example_image_url}
              alt={morph.morph_name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          </div>
        )}
        
        <p className="text-sage-700 dark:text-sage-600 text-sm mb-4 line-clamp-3 flex-grow">
          {morph.description}
        </p>
        
        {morph.key_features && morph.key_features.length > 0 && (
          <div className="space-y-2 mb-4">
            <h4 className="text-xs font-semibold text-sage-600 dark:text-sage-500 uppercase tracking-wider">Key Features</h4>
            <div className="flex flex-wrap gap-1">
              {morph.key_features.slice(0, 3).map((feature, index) => (
                <Badge key={index} variant="secondary" className="text-xs bg-sage-100 text-sage-700 dark:bg-sage-200 dark:text-sage-700">
                  {feature}
                </Badge>
              ))}
              {morph.key_features.length > 3 && (
                <Badge variant="secondary" className="text-xs bg-sage-100 text-sage-700 dark:bg-sage-200 dark:text-sage-700">
                  +{morph.key_features.length - 3}
                </Badge>
              )}
            </div>
          </div>
        )}
        
        <div className="flex items-center justify-between pt-2 border-t border-sage-200 dark:border-sage-300 mt-auto">
          {morph.breeding_info && (
            <div className="flex items-center gap-1">
              <Dna className="w-3 h-3 text-sage-500" />
              <span className="text-xs text-sage-500">Breeding info available</span>
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onClick(morph)}
            className="text-sage-600 dark:text-sage-500 hover:text-sage-800 dark:hover:text-sage-400"
          >
            <Info className="w-4 h-4 mr-1" />
            Details
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
