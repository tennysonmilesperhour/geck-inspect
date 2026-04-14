import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Layers, Sparkles } from 'lucide-react';
import TraitSelector from '../components/morph-visualizer/TraitSelector';

const BASE_GECKO_IMAGE = 'https://i.imgur.com/7b7r4d2.png';

const traitCategories = {
  baseColors: {
    title: 'Appearance – Base Colors',
    type: 'single',
    options: ['Black', 'Charcoal', 'Slate', 'Grey', 'Blue', 'Brown', 'Chocolate', 'Tan', 'Red', 'Orange', 'Rust', 'Tangerine', 'Yellow', 'Cream', 'Pale', 'White']
  },
  primaryPatterns: {
    title: 'Appearance – Primary Patterns',
    type: 'multiple',
    options: ['Harlequin', 'Extreme Harlequin', 'Pinstripe', 'Partial Pinstripe', 'Dalmatian', 'Tiger', 'Brindle', 'Flame', 'Bicolor', 'Patternless']
  },
  secondaryPatterns: {
    title: 'Appearance – Secondary Patterns / Accents',
    type: 'multiple',
    options: ['Lateral Stripe', 'Head Mask', 'Cheek Patch', 'Leg Bands', 'Limb Accents', 'Tail Ringed', 'Tail Solid', 'Tail Mottled', 'Eye Ring', 'Eyelid Pigment']
  },
  modifiers: {
    title: 'Modifiers',
    type: 'multiple',
    options: ['Extreme', 'Bold', 'High Contrast', 'Reverse', 'Muted', 'Pastel', 'Dusting', 'Freckling']
  },
  physicalTraits: {
    title: 'Physical Traits',
    type: 'single',
    subcategories: {
      tail: { title: 'Tail', options: ['Present', 'Absent'] },
      eyeColor: { title: 'Eye Color', options: ['Gold', 'Copper', 'Silver', 'Grey'] },
      crestProminence: { title: 'Crest Prominence', options: ['Light', 'Heavy'] },
      bodyBuild: { title: 'Body Build', options: ['Slender', 'Robust'] },
      toePadColor: { title: 'Toe Pad Color', options: ['Light', 'Dark'] }
    }
  },
  environmental: {
    title: 'Developmental / Environmental Variants',
    type: 'single',
    subcategories: {
      age: { title: 'Age', options: ['Juvenile', 'Adult'] },
      moodTemp: { title: 'Mood / Temperature', options: ['Lightened', 'Darkened'] },
      sheddingState: { title: 'Shedding State', options: ['Normal', 'Dull'] }
    }
  }
};

const initialSelections = {
  baseColors: 'Brown',
  primaryPatterns: [],
  secondaryPatterns: [],
  modifiers: [],
  physicalTraits: {
    tail: 'Present',
    eyeColor: 'Gold',
    crestProminence: 'Light',
    bodyBuild: 'Slender',
    toePadColor: 'Light'
  },
  environmental: {
    age: 'Adult',
    moodTemp: 'Lightened',
    sheddingState: 'Normal'
  }
};

export default function MorphVisualizer() {
  const [selections, setSelections] = useState(initialSelections);

  const handleSelectionChange = (category, value, subcategory = null) => {
    setSelections(prev => {
      if (subcategory) {
        return {
          ...prev,
          [category]: {
            ...prev[category],
            [subcategory]: value
          }
        };
      }

      if (traitCategories[category].type === 'multiple') {
        const currentSelections = prev[category];
        const newSelections = currentSelections.includes(value)
          ? currentSelections.filter(item => item !== value)
          : [...currentSelections, value];
        
        return {
          ...prev,
          [category]: newSelections
        };
      } else {
        return {
          ...prev,
          [category]: value
        };
      }
    });
  };

  const getVisualizerStyles = () => {
    let styles = {
      filter: '',
      backgroundColor: '#cccccc'
    };

    // Apply base color
    const baseColorMap = {
      'Black': '#2a2a2a',
      'Charcoal': '#4a4a4a', 
      'Slate': '#6a6a6a',
      'Grey': '#8a8a8a',
      'Blue': '#4a6a8a',
      'Brown': '#6b4f3a',
      'Chocolate': '#5d3a1a',
      'Tan': '#d2b48c',
      'Red': '#993d3d',
      'Orange': '#cc6600',
      'Rust': '#b7410e',
      'Tangerine': '#ff8c00',
      'Yellow': '#b0a54a',
      'Cream': '#f5f5dc',
      'Pale': '#f0f0f0',
      'White': '#ffffff'
    };
    
    styles.backgroundColor = baseColorMap[selections.baseColors] || '#cccccc';

    // Apply environmental effects
    if (selections.environmental.moodTemp === 'Darkened') {
      styles.filter += ' brightness(0.7)';
    } else if (selections.environmental.moodTemp === 'Lightened') {
      styles.filter += ' brightness(1.2)';
    }

    if (selections.environmental.sheddingState === 'Dull') {
      styles.filter += ' saturate(0.6)';
    }

    if (selections.environmental.age === 'Juvenile') {
      styles.filter += ' saturate(1.3) brightness(1.1)';
    }

    return styles;
  };

  const visualizerStyles = getVisualizerStyles();

  return (
    <div className="p-4 md:p-8 bg-slate-950 min-h-screen text-white">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-slate-100 mb-2 text-glow flex items-center justify-center gap-3">
            <Layers className="w-10 h-10 text-emerald-400" />
            Crested Gecko Morph Visualizer
          </h1>
          <p className="text-lg text-slate-400">
            Build custom gecko morphs by combining traits from different categories
          </p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          {/* Visualizer */}
          <Card className="xl:col-span-2 bg-slate-900 border-slate-700 shadow-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-slate-200">
                <Sparkles className="w-5 h-5 text-emerald-400" />
                Gecko Preview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative aspect-video rounded-lg overflow-hidden bg-slate-800 flex items-center justify-center">
                <div 
                  className="absolute inset-0 w-full h-full transition-all duration-500"
                  style={{ 
                    backgroundColor: visualizerStyles.backgroundColor,
                    filter: visualizerStyles.filter,
                    mixBlendMode: 'multiply',
                    opacity: 0.7
                  }}
                />
                <img 
                  src={BASE_GECKO_IMAGE} 
                  alt="Gecko base" 
                  className="relative z-10 w-full h-full object-contain transition-all duration-500"
                  style={{ 
                    filter: visualizerStyles.filter + ' drop-shadow(0 0 15px rgba(0,0,0,0.3))'
                  }}
                />
              </div>
              
              {/* Active traits display */}
              <div className="mt-6 space-y-3">
                <h4 className="text-sm font-semibold text-slate-300">Active Traits:</h4>
                <div className="flex flex-wrap gap-2">
                  <span className="px-2 py-1 bg-emerald-600 text-white text-xs rounded">
                    {selections.baseColors}
                  </span>
                  {selections.primaryPatterns.map(pattern => (
                    <span key={pattern} className="px-2 py-1 bg-blue-600 text-white text-xs rounded">
                      {pattern}
                    </span>
                  ))}
                  {selections.secondaryPatterns.map(pattern => (
                    <span key={pattern} className="px-2 py-1 bg-purple-600 text-white text-xs rounded">
                      {pattern}
                    </span>
                  ))}
                  {selections.modifiers.map(modifier => (
                    <span key={modifier} className="px-2 py-1 bg-orange-600 text-white text-xs rounded">
                      {modifier}
                    </span>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Trait Selectors */}
          <div className="space-y-6">
            <Card className="bg-slate-900 border-slate-700">
              <CardContent className="p-6 space-y-8">
                {/* Base Colors */}
                <TraitSelector
                  title={traitCategories.baseColors.title}
                  options={traitCategories.baseColors.options}
                  selected={selections.baseColors}
                  type="single"
                  onSelect={(value) => handleSelectionChange('baseColors', value)}
                />

                {/* Primary Patterns */}
                <TraitSelector
                  title={traitCategories.primaryPatterns.title}
                  options={traitCategories.primaryPatterns.options}
                  selected={selections.primaryPatterns}
                  type="multiple"
                  onSelect={(value) => handleSelectionChange('primaryPatterns', value)}
                />

                {/* Secondary Patterns */}
                <TraitSelector
                  title={traitCategories.secondaryPatterns.title}
                  options={traitCategories.secondaryPatterns.options}
                  selected={selections.secondaryPatterns}
                  type="multiple"
                  onSelect={(value) => handleSelectionChange('secondaryPatterns', value)}
                />

                {/* Modifiers */}
                <TraitSelector
                  title={traitCategories.modifiers.title}
                  options={traitCategories.modifiers.options}
                  selected={selections.modifiers}
                  type="multiple"
                  onSelect={(value) => handleSelectionChange('modifiers', value)}
                />

                {/* Physical Traits */}
                <div>
                  <h3 className="text-lg font-semibold text-slate-200 mb-4">
                    {traitCategories.physicalTraits.title}
                  </h3>
                  <div className="space-y-4">
                    {Object.entries(traitCategories.physicalTraits.subcategories).map(([key, subcat]) => (
                      <TraitSelector
                        key={key}
                        title={subcat.title}
                        options={subcat.options}
                        selected={selections.physicalTraits[key]}
                        type="single"
                        onSelect={(value) => handleSelectionChange('physicalTraits', value, key)}
                        compact
                      />
                    ))}
                  </div>
                </div>

                {/* Environmental */}
                <div>
                  <h3 className="text-lg font-semibold text-slate-200 mb-4">
                    {traitCategories.environmental.title}
                  </h3>
                  <div className="space-y-4">
                    {Object.entries(traitCategories.environmental.subcategories).map(([key, subcat]) => (
                      <TraitSelector
                        key={key}
                        title={subcat.title}
                        options={subcat.options}
                        selected={selections.environmental[key]}
                        type="single"
                        onSelect={(value) => handleSelectionChange('environmental', value, key)}
                        compact
                      />
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}