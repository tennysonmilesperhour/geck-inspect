import { useMemo, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Layers, Sparkles } from 'lucide-react';
import Seo from '@/components/seo/Seo';
import { ORG_ID, SITE_URL } from '@/lib/organization-schema';

import { composePhenotype } from '../components/morph-visualizer/engine/compose';
import { PRESETS, PRESETS_BY_ID } from '../components/morph-visualizer/data/presets';

// WebApplication + HowTo schema for SEO. The page is now a photo gallery
// of canonical crested gecko morphs rather than an interactive composer.
const VISUALIZER_JSON_LD = [
  {
    '@type': 'WebApplication',
    '@id': `${SITE_URL}/MorphVisualizer#webapp`,
    name: 'Crested Gecko Morph Gallery',
    url: `${SITE_URL}/MorphVisualizer`,
    applicationCategory: 'EducationalApplication',
    applicationSubCategory: 'Reptile morph reference',
    operatingSystem: 'Web',
    browserRequirements: 'Modern browser with JavaScript enabled',
    description:
      'Reference gallery of canonical crested gecko (Correlophus ciliatus) morphs. See photo-quality examples of Wild Type, Red Harlequin, Lilly White, Cappuccino, Frappuccino, Axanthic, Tiger, Pinstripe and more, each annotated with its genetics, rarity tier and value estimate.',
    featureList: [
      'Photo-quality images of every canonical crested gecko morph',
      'Genetics reasoning for each preset (which genes are doing what)',
      'Rarity tier and indicative price for each look',
      'Side-by-side comparison of morph aesthetics',
    ],
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    publisher: { '@id': ORG_ID },
    isPartOf: { '@id': `${SITE_URL}/#website` },
  },
  {
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
      { '@type': 'ListItem', position: 2, name: 'Morph Visualizer', item: `${SITE_URL}/MorphVisualizer` },
    ],
  },
];

import PresetImage from '../components/morph-visualizer/panels/PresetImage';
import GeneticsReasoningPanel from '../components/morph-visualizer/panels/GeneticsReasoningPanel';
import RarityValuePanel from '../components/morph-visualizer/panels/RarityValuePanel';
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
  const [activePresetId, setActivePresetId] = useState(PRESETS[0].id);

  const activePreset = PRESETS_BY_ID[activePresetId] || PRESETS[0];
  const selections = useMemo(
    () => cloneSelections(activePreset.selections),
    [activePreset],
  );
  const phenotype = useMemo(() => composePhenotype(selections), [selections]);

  const applyPreset = useCallback((presetId) => {
    setActivePresetId(presetId);
    // Scroll to the featured area so the user sees the new image without
    // having to manually scroll back up after picking from the bottom grid.
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  return (
    <div className="p-4 md:p-6 bg-slate-950 min-h-screen text-white">
      <Seo
        title="Crested Gecko Morph Gallery"
        description="Photo-quality reference gallery of every canonical crested gecko morph. See Wild Type, Harlequin, Lilly White, Cappuccino, Frappuccino, Axanthic, Tiger and Pinstripe with genetics, rarity and value for each."
        path="/MorphVisualizer"
        imageAlt="Crested gecko morph gallery"
        keywords={[
          'crested gecko morph gallery',
          'crested gecko morph examples',
          'lilly white crested gecko',
          'harlequin crested gecko',
          'cappuccino crested gecko',
          'axanthic crested gecko',
        ]}
        jsonLd={VISUALIZER_JSON_LD}
      />
      <div className="max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-3xl md:text-5xl font-bold text-slate-100 mb-2 flex items-center justify-center gap-3">
            <Layers className="w-9 h-9 text-emerald-400" />
            Crested Gecko Morph Gallery
          </h1>
          <p className="text-sm md:text-base text-slate-400 max-w-2xl mx-auto">
            Photo-quality examples of every canonical morph, with the genetics, rarity, and rough price behind each look.
          </p>
        </div>

        {/* Featured ,  big image on the left, info panels on the right.
            Balanced two-column layout keeps both sides full at xl, stacks on
            smaller screens. */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-4 md:gap-6 mb-8">
          {/* Featured image */}
          <Card className="bg-slate-900 border-slate-700 shadow-2xl overflow-hidden">
            <div className="aspect-[4/3] bg-slate-800 border-b border-slate-700">
              <PresetImage
                preset={activePreset}
                phenotype={phenotype}
                selections={selections}
              />
            </div>
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-3 mb-2">
                <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                  {activePreset.name}
                </h2>
                <span className="text-sm text-amber-400 whitespace-nowrap mt-1">
                  {'★'.repeat(activePreset.rarityTier)}
                </span>
              </div>
              <p className="text-slate-300 text-sm leading-relaxed mb-3">
                {activePreset.description}
              </p>
              <div>
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                  Active Traits
                </h4>
                <ActiveTraitsChips phenotype={phenotype} selections={selections} />
              </div>
            </CardContent>
          </Card>

          {/* Info side: genetics reasoning + rarity. Two stacked cards so the
              right column fills out roughly the same height as the image card. */}
          <div className="space-y-4">
            <Card className="bg-slate-900 border-slate-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-slate-200 text-base">Genetics</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <GeneticsReasoningPanel phenotype={phenotype} selections={selections} />
              </CardContent>
            </Card>

            <Card className="bg-slate-900 border-slate-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-slate-200 text-base">Rarity &amp; Value</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <RarityValuePanel phenotype={phenotype} selections={selections} />
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Preset grid ,  full width. Tap a card to feature it above. */}
        <Card className="bg-slate-900 border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-slate-200 text-base flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              All Morphs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
              {PRESETS.map((p) => {
                const active = p.id === activePresetId;
                return (
                  <button
                    key={p.id}
                    onClick={() => applyPreset(p.id)}
                    className={`text-left rounded-lg overflow-hidden border-2 transition group ${
                      active
                        ? 'border-emerald-500 ring-2 ring-emerald-500/30'
                        : 'border-slate-700 hover:border-slate-500'
                    }`}
                  >
                    <div className="aspect-[4/3] bg-slate-800 overflow-hidden">
                      <PresetImage
                        preset={p}
                        phenotype={composePhenotype(p.selections)}
                        selections={p.selections}
                      />
                    </div>
                    <div className="p-3 bg-slate-900">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-semibold text-slate-100 truncate">
                          {p.name}
                        </span>
                        <span className="text-[10px] text-amber-400 flex-shrink-0 ml-2">
                          {'★'.repeat(p.rarityTier)}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-snug line-clamp-2">
                        {p.description}
                      </p>
                      <div className="text-[11px] text-emerald-400 mt-1.5 font-mono">
                        ≈ ${p.valueHint}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
