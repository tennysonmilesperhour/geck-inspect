import { useMemo, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Layers, Sparkles, RotateCcw, HardHat, Eye, Compass } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Seo from '@/components/seo/Seo';
import { ORG_ID, SITE_URL } from '@/lib/organization-schema';

import { composePhenotype } from '../components/morph-visualizer/engine/compose';
import { DEFAULT_SELECTIONS, PRESETS_BY_ID } from '../components/morph-visualizer/data/presets';
import { ZYGOSITY as Z } from '../components/morph-visualizer/data/traits';

// WebApplication + HowTo schema. WebApplication advertises this as a
// free no-install crested-gecko trait simulator; HowTo gives AI assistants
// a step-by-step walkthrough they can read aloud when a user asks "how
// do I use the morph visualizer".
const VISUALIZER_JSON_LD = [
  {
    '@type': 'WebApplication',
    '@id': `${SITE_URL}/MorphVisualizer#webapp`,
    name: 'Crested Gecko Morph Visualizer',
    url: `${SITE_URL}/MorphVisualizer`,
    applicationCategory: 'EducationalApplication',
    applicationSubCategory: 'Reptile genetics simulator',
    operatingSystem: 'Web',
    browserRequirements: 'Modern browser with JavaScript enabled',
    description:
      'Interactive crested gecko (Correlophus ciliatus) trait simulator. Pick base color, set Mendelian morph zygosity, dial pattern intensity, toggle accents, and watch the resulting phenotype render in real time with rarity and value estimates.',
    featureList: [
      'Base color picker (red, orange, yellow, olive, chocolate, lavender, etc.)',
      'Mendelian morph genotype panel with zygosity (het / visible / super)',
      'Polygenic pattern intensity sliders (Harlequin, Pinstripe, Dalmatian)',
      'Accent toggles (cream, white wall, soft scale)',
      'Structural and environmental modifiers',
      'Genetics reasoning explanation for every phenotype',
      'Rarity and price-tier estimate',
      'Preset gallery (wild type and named morph combinations)',
    ],
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    publisher: { '@id': ORG_ID },
    isPartOf: { '@id': `${SITE_URL}/#website` },
  },
  {
    '@type': 'HowTo',
    '@id': `${SITE_URL}/MorphVisualizer#howto`,
    name: 'How to use the Crested Gecko Morph Visualizer',
    description:
      'Build a virtual crested gecko phenotype to predict what a real-world pairing might look like, or to study how individual morph genes stack.',
    totalTime: 'PT5M',
    tool: [{ '@type': 'HowToTool', name: 'Geck Inspect Morph Visualizer (web browser)' }],
    step: [
      {
        '@type': 'HowToStep',
        position: 1,
        name: 'Pick a base color',
        text: 'Open the Base Color panel on the left and choose the underlying body color (red, orange, yellow, olive, chocolate, or lavender). This sets the foundation everything else paints on top of.',
      },
      {
        '@type': 'HowToStep',
        position: 2,
        name: 'Set Mendelian morph zygosity',
        text: 'In the Morph Genotype panel, mark recessive, co-dominant, and incomplete-dominant traits as het, visible, or super. Lilly White, Axanthic, Cappuccino, and similar single-gene morphs live here.',
      },
      {
        '@type': 'HowToStep',
        position: 3,
        name: 'Dial in polygenic pattern intensity',
        text: 'Use the Pattern Intensity sliders for Harlequin, Pinstripe, Dalmatian, and similar polygenic traits ,  these stack continuously rather than as on/off genes.',
      },
      {
        '@type': 'HowToStep',
        position: 4,
        name: 'Toggle accents and structural traits',
        text: 'Add accents like cream edging, white wall, or soft scale, then adjust structural traits (crests, eye color, tail) and environmental modifiers (fired vs unfired) to match the look you want.',
      },
      {
        '@type': 'HowToStep',
        position: 5,
        name: 'Read the genetics reasoning and rarity',
        text: 'The Genetics Reasoning panel explains every active trait and its expected expression. The Rarity and Value panel on the right gives an indicative price tier so you can sanity-check a pairing before committing eggs to it.',
      },
      {
        '@type': 'HowToStep',
        position: 6,
        name: 'Try a preset or reset',
        text: 'Apply a preset from the gallery to study a named combination, or hit Reset to return to wild type and start over.',
      },
    ],
  },
  {
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
      { '@type': 'ListItem', position: 2, name: 'Morph Visualizer', item: `${SITE_URL}/MorphVisualizer` },
    ],
  },
];

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
  const [view, setView] = useState('side');

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
      <Seo
        title="Crested Gecko Morph Visualizer"
        description="Free interactive crested gecko trait simulator. Pick a base color, set morph genotype zygosity, dial pattern intensity, and watch the resulting phenotype render in real time with a rarity and value estimate."
        path="/MorphVisualizer"
        imageAlt="Crested gecko morph visualizer ,  interactive trait simulator"
        keywords={[
          'crested gecko morph visualizer',
          'gecko trait simulator',
          'crested gecko phenotype builder',
          'crested gecko genetics tool',
          'morph combination preview',
        ]}
        jsonLd={VISUALIZER_JSON_LD}
      />
      <div className="max-w-[1700px] mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-3xl md:text-5xl font-bold text-slate-100 mb-2 flex items-center justify-center gap-3">
            <Layers className="w-9 h-9 text-emerald-400" />
            Crested Gecko Morph Visualizer
          </h1>
          <p className="text-sm md:text-base text-slate-400">
            Explore traits, combinations, and genetics ,  see what every morph actually looks like and why.
          </p>
        </div>

        {/* Main grid: left controls, center canvas + explanations, right presets+rarity */}
        <div className="grid grid-cols-1 xl:grid-cols-[360px_1fr_340px] gap-4 md:gap-6">

          {/* LEFT ,  control stack */}
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

          {/* CENTER ,  canvas + reasoning */}
          <div className="space-y-4 order-1 xl:order-2">
            <Card className="bg-slate-900 border-slate-700 shadow-2xl">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="flex items-center gap-2 text-slate-200 text-base">
                    <Sparkles className="w-5 h-5 text-emerald-400" />
                    Gecko Preview
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    {/* View toggle */}
                    <div className="flex rounded-md border border-slate-700 bg-slate-800 overflow-hidden">
                      <button
                        onClick={() => setView('side')}
                        className={`px-2.5 py-1 text-xs flex items-center gap-1 transition ${
                          view === 'side'
                            ? 'bg-emerald-700 text-white'
                            : 'text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        <Eye className="w-3 h-3" /> Side
                      </button>
                      <button
                        onClick={() => setView('top')}
                        className={`px-2.5 py-1 text-xs flex items-center gap-1 transition ${
                          view === 'top'
                            ? 'bg-emerald-700 text-white'
                            : 'text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        <Compass className="w-3 h-3" /> Top
                      </button>
                    </div>
                    <Button
                      onClick={reset}
                      variant="outline"
                      size="sm"
                      className="text-xs bg-slate-800 border-slate-600 hover:bg-slate-700"
                    >
                      <RotateCcw className="w-3 h-3 mr-1" /> Reset
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Under construction banner */}
                <div className="mb-3 flex items-center gap-2 rounded-md border border-amber-700/60 bg-amber-950/40 px-3 py-2 text-amber-200">
                  <HardHat className="w-4 h-4 flex-shrink-0" />
                  <div className="text-[12px] leading-snug">
                    <span className="font-semibold">Under construction.</span>{' '}
                    The gecko illustration is a playful work-in-progress ,  click around,
                    stack morphs, load presets, break it in interesting ways. Your
                    experiments help us tune what the final render should emphasize.
                  </div>
                </div>

                <div className="aspect-[800/480] rounded-lg overflow-hidden bg-slate-800 border border-slate-700">
                  <GeckoCanvas view={view} phenotype={phenotype} selections={selections} />
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

          {/* RIGHT ,  presets + rarity/value */}
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
