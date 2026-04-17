import { useMemo, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Layers, Sparkles, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

import { composePhenotype } from '../components/morph-visualizer/engine/compose';
import { DEFAULT_SELECTIONS, PRESETS_BY_ID } from '../components/morph-visualizer/data/presets';
import { ZYGOSITY as Z } from '../components/morph-visualizer/data/traits';

import GeckoCanvas from '../components/morph-visualizer/render/GeckoCanvas';
import BaseColorPicker from '../components/morph-visualizer/panels/BaseColorPicker';
import MorphGenotypePanel from '../components/morph-visualizer/panels/MorphGenotypePanel';
import PatternIntensityPanel from '../components/morph-visualizer/panels/PatternIntensityPanel';
import AccentTogglePanel from '../components/morph-visualizer/panels/AccentTogglePanel';
import StructuralPanel from '../components/morph-visualizer/panels/StructuralPanel';
import EnvironmentalPanel from '../components/morph-visualizer/panels/EnvironmentalPanel';
import GeneticsReasoningPanel from '../components/morph-visualizer/panels/GeneticsReasoningPanel';
import RarityValuePanel from '../components/morph-visualizer/panels/RarityValuePanel';
import PresetGallery from '../components/morph-visualizer/panels/PresetGallery';
import ActiveTraitsChips from '../components/morph-visualizer/panels/ActiveTraitsChips';

function cloneSelections(s) {
  return {
    baseColor: s.baseColor,
    mendelian: { ...(s.mendelian || {}) },
    patterns: { ...(s.patterns || {}) },
    accents: { ...(s.accents || {}) },
    structural: { ...(s.structural || {}) },
    environmental: { ...(s.environmental || {}) },
  };
}

export default function MorphVisualizer() {
  const [selections, setSelections] = useState(() => cloneSelections(DEFAULT_SELECTIONS));
  const [activePresetId, setActivePresetId] = useState('wild_type');

  const phenotype = useMemo(() => composePhenotype(selections), [selections]);

  // --- Handlers (dispatcher style keeps each panel's concerns isolated) ---
  const setBaseColor = useCallback((id) => {
    setSelections((s) => ({ ...s, baseColor: id }));
    setActivePresetId(null);
  }, []);

  const setMendelian = useCallback((traitId, zygosity) => {
    setSelections((s) => {
      const next = { ...s.mendelian };
      if (zygosity === Z.ABSENT) delete next[traitId];
      else next[traitId] = zygosity;
      return { ...s, mendelian: next };
    });
    setActivePresetId(null);
  }, []);

  const setPatternIntensity = useCallback((traitId, value) => {
    setSelections((s) => ({ ...s, patterns: { ...s.patterns, [traitId]: value } }));
    setActivePresetId(null);
  }, []);

  const toggleAccent = useCallback((traitId) => {
    setSelections((s) => ({ ...s, accents: { ...s.accents, [traitId]: !s.accents[traitId] } }));
    setActivePresetId(null);
  }, []);

  const setStructural = useCallback((traitId, value) => {
    setSelections((s) => ({ ...s, structural: { ...s.structural, [traitId]: value } }));
    setActivePresetId(null);
  }, []);

  const setEnvironmental = useCallback((traitId, value) => {
    setSelections((s) => ({ ...s, environmental: { ...s.environmental, [traitId]: value } }));
    setActivePresetId(null);
  }, []);

  const applyPreset = useCallback((presetId) => {
    const p = PRESETS_BY_ID[presetId];
    if (!p) return;
    setSelections(cloneSelections(p.selections));
    setActivePresetId(presetId);
  }, []);

  const reset = useCallback(() => {
    setSelections(cloneSelections(DEFAULT_SELECTIONS));
    setActivePresetId('wild_type');
  }, []);

  return (
    <div className="p-4 md:p-6 bg-slate-950 min-h-screen text-white">
      <div className="max-w-[1700px] mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-3xl md:text-5xl font-bold text-slate-100 mb-2 flex items-center justify-center gap-3">
            <Layers className="w-9 h-9 text-emerald-400" />
            Crested Gecko Morph Visualizer
          </h1>
          <p className="text-sm md:text-base text-slate-400">
            Explore traits, combinations, and genetics — see what every morph actually looks like and why.
          </p>
        </div>

        {/* Main grid: left controls, center canvas + explanations, right presets+rarity */}
        <div className="grid grid-cols-1 xl:grid-cols-[360px_1fr_340px] gap-4 md:gap-6">

          {/* LEFT — control stack */}
          <div className="space-y-4 order-2 xl:order-1">
            <Card className="bg-slate-900 border-slate-700">
              <CardContent className="p-4 space-y-5">
                <BaseColorPicker        selected={selections.baseColor} onSelect={setBaseColor} />
                <MorphGenotypePanel     mendelian={selections.mendelian} onChange={setMendelian} />
                <PatternIntensityPanel  patterns={selections.patterns}   onChange={setPatternIntensity} />
              </CardContent>
            </Card>

            <Card className="bg-slate-900 border-slate-700">
              <CardContent className="p-4 space-y-5">
                <AccentTogglePanel      accents={selections.accents}       onToggle={toggleAccent} />
                <StructuralPanel        structural={selections.structural} onChange={setStructural} />
                <EnvironmentalPanel     environmental={selections.environmental} onChange={setEnvironmental} />
              </CardContent>
            </Card>
          </div>

          {/* CENTER — canvas + reasoning */}
          <div className="space-y-4 order-1 xl:order-2">
            <Card className="bg-slate-900 border-slate-700 shadow-2xl">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-slate-200 text-base">
                    <Sparkles className="w-5 h-5 text-emerald-400" />
                    Gecko Preview
                  </CardTitle>
                  <Button
                    onClick={reset}
                    variant="outline"
                    size="sm"
                    className="text-xs bg-slate-800 border-slate-600 hover:bg-slate-700"
                  >
                    <RotateCcw className="w-3 h-3 mr-1" /> Reset
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="aspect-[800/480] rounded-lg overflow-hidden bg-slate-800 border border-slate-700">
                  <GeckoCanvas phenotype={phenotype} selections={selections} />
                </div>

                <div className="mt-4">
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                    Active Traits
                  </h4>
                  <ActiveTraitsChips phenotype={phenotype} selections={selections} />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-900 border-slate-700">
              <CardContent className="p-4">
                <GeneticsReasoningPanel phenotype={phenotype} selections={selections} />
              </CardContent>
            </Card>
          </div>

          {/* RIGHT — presets + rarity/value */}
          <div className="space-y-4 order-3">
            <Card className="bg-slate-900 border-slate-700">
              <CardContent className="p-4">
                <PresetGallery onApply={applyPreset} currentPresetId={activePresetId} />
              </CardContent>
            </Card>

            <Card className="bg-slate-900 border-slate-700">
              <CardContent className="p-4">
                <RarityValuePanel phenotype={phenotype} selections={selections} />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
