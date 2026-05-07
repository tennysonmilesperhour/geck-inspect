import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Gecko } from '@/entities/all';
import { base44 } from '@/api/base44Client';
import { Dna, Loader2, ArrowLeftRight, ArrowRight, Users, Pencil } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import GeneticCalculator from '../components/breeding/GeneticCalculator';
import BreedingSimulator from '../components/innovations/BreedingSimulator';
import ManualGenotypePicker, {
  buildAnimalFromZygosity,
} from '../components/breeding/ManualGenotypePicker';
import Seo from '@/components/seo/Seo';
import { createPageUrl } from '@/utils';
import { breadcrumbSchema, ORG_ID } from '@/lib/organization-schema';

const CALCULATOR_JSON_LD = [
  {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    '@id': 'https://geckinspect.com/calculator#app',
    name: 'Crested Gecko Genetics Calculator',
    url: 'https://geckinspect.com/calculator',
    description: 'Punnett-square-based genetics calculator for crested gecko (Correlophus ciliatus) breeders. Predicts offspring outcomes for incomplete-dominant, recessive, and dominant traits including Lilly White, Cappuccino, Axanthic, Soft Scale, and Hypo. Free, no signup required.',
    applicationCategory: 'UtilitiesApplication',
    applicationSubCategory: 'Reptile Breeding Calculator',
    operatingSystem: 'Web',
    browserRequirements: 'Requires JavaScript',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    featureList: [
      'No-signup manual genotype entry',
      'Single-trait Punnett square projections',
      'Multi-trait combined projections',
      'Lilly White lethal-super flagging',
      'Monte Carlo litter simulation',
      'Percentage breakdown of visible vs carrier offspring',
    ],
    creator: { '@id': ORG_ID },
  },
  breadcrumbSchema([
    { name: 'Home', path: '/' },
    { name: 'Genetic Calculator', path: '/calculator' },
  ]),
];

/**
 * Free, public Punnett-square genetics calculator.
 *
 * Two parent-entry modes share the same prediction engine:
 *   - 'manual'     — pick zygosity per trait. Available to everyone,
 *                    default for unauthenticated visitors. Per-morph
 *                    SEO routes (/calculator/:morph) pre-fill one
 *                    parent via the `initialSireZygosity` prop.
 *   - 'collection' — pick two of the user's saved geckos. Authed only.
 *
 * The downstream `GeneticCalculator` component reads `morph_tags` off
 * each parent, so manual-mode "animals" are constructed by
 * `buildAnimalFromZygosity` to emit the same shape.
 */
export default function GeneticCalculatorTool({
  initialSireZygosity,
  pageTitle,
  pageDescription,
  pagePath = '/calculator',
  pageKeywords,
  pageJsonLd,
  pageBreadcrumb,
  introSlot,
}) {
    const [geckos, setGeckos] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isAuthed, setIsAuthed] = useState(false);

    // Collection-mode selections
    const [sireId, setSireId] = useState('');
    const [damId, setDamId] = useState('');

    // Manual-mode zygosity records, e.g. { lilly_white: 'het', axanthic: 'visual' }
    const [sireZygosity, setSireZygosity] = useState(initialSireZygosity || {});
    const [damZygosity, setDamZygosity] = useState({});

    // Default mode: manual for everyone (and required for unauthed). Authed
    // users can switch to 'collection' to pull from their saved geckos.
    const [mode, setMode] = useState('manual');

    useEffect(() => {
        const load = async () => {
            setIsLoading(true);
            try {
                const user = await base44.auth.me();
                if (user) {
                    setIsAuthed(true);
                    const { getVisibleGeckos } = await import('@/lib/geckoAccess');
                    const data = await getVisibleGeckos(user);
                    setGeckos(data.filter(g => !g.archived));
                    // Authed users haven't filled in a manual genotype yet —
                    // start them on collection mode if they have geckos.
                    if (!initialSireZygosity && data.length > 0) {
                        setMode('collection');
                    }
                }
            } catch {
                // auth.me throws when unauthenticated. Manual mode stays
                // default and works without an account.
                setIsAuthed(false);
            }
            setIsLoading(false);
        };
        load();
    }, [initialSireZygosity]);

    const males = geckos.filter(g => g.sex === 'Male');
    const females = geckos.filter(g => g.sex === 'Female');
    const unsexed = geckos.filter(g => g.sex === 'Unsexed');

    const allForSire = [...males, ...unsexed];
    const allForDam = [...females, ...unsexed];

    const collectionSire = geckos.find(g => g.id === sireId) || null;
    const collectionDam = geckos.find(g => g.id === damId) || null;

    // The actual sire/dam objects fed to the calculator. In manual mode we
    // synthesize them from zygosity selections; in collection mode we use
    // the user's saved Gecko entities directly.
    const sire = mode === 'manual'
      ? buildAnimalFromZygosity('manual_sire', 'Parent A (Sire)', sireZygosity)
      : collectionSire;
    const dam = mode === 'manual'
      ? buildAnimalFromZygosity('manual_dam', 'Parent B (Dam)', damZygosity)
      : collectionDam;

    const handleSwap = () => {
        if (mode === 'manual') {
            const prev = sireZygosity;
            setSireZygosity(damZygosity);
            setDamZygosity(prev);
        } else {
            const prev = sireId;
            setSireId(damId);
            setDamId(prev);
        }
    };

    const hasParents = mode === 'manual'
      ? (sire.morph_tags.length > 0 || dam.morph_tags.length > 0)
      : (sire && dam);

    return (
        <div className="p-4 md:p-8 bg-slate-950 min-h-screen">
            <Seo
              title={pageTitle || 'Crested Gecko Genetics Calculator'}
              description={pageDescription || 'Free Punnett-square genetics calculator for crested gecko breeders. Predict offspring outcomes for Lilly White (incomplete-dominant, lethal super), Cappuccino, Axanthic, Soft Scale, Whiteout, Empty Back, Phantom, and Hypo. No signup required.'}
              path={pagePath}
              imageAlt="Crested gecko genetics Punnett-square calculator"
              keywords={pageKeywords || [
                'crested gecko genetics calculator',
                'crested gecko punnett square',
                'lilly white calculator',
                'cappuccino calculator',
                'axanthic calculator',
                'crested gecko breeding projections',
                'morph outcome predictor',
                'free reptile genetics calculator',
              ]}
              jsonLd={pageJsonLd || CALCULATOR_JSON_LD}
            />
            <div className="max-w-4xl mx-auto">
                <div className="mb-6">
                    <div className="flex items-center gap-2 text-xs text-slate-500 mb-3">
                        <Link to="/" className="hover:text-slate-300">Home</Link>
                        <span>/</span>
                        {pageBreadcrumb ? (
                          <>
                            <Link to="/calculator" className="hover:text-slate-300">Genetic Calculator</Link>
                            <span>/</span>
                            <span className="text-slate-400">{pageBreadcrumb}</span>
                          </>
                        ) : (
                          <span className="text-slate-400">Genetic Calculator</span>
                        )}
                    </div>
                    <h1 className="text-2xl md:text-4xl font-bold text-slate-100 flex items-center gap-3">
                        <Dna className="w-8 h-8 md:w-10 md:h-10 text-purple-400" />
                        {pageTitle || 'Crested Gecko Genetics Calculator'}
                    </h1>
                    <p className="text-slate-400 mt-2 text-sm md:text-base">
                        {pageDescription
                          ? pageDescription
                          : 'Free Punnett-square projections for Lilly White, Cappuccino, Axanthic, Soft Scale, Whiteout, Empty Back, Phantom, and Hypo. Pick zygosity per trait below — no account required — or sign in to pull parents straight from your collection.'}
                    </p>
                </div>

                {introSlot}

                {isLoading ? (
                    <div className="text-center py-20">
                        <Loader2 className="w-12 h-12 text-purple-400 animate-spin mx-auto" />
                    </div>
                ) : (
                    <>
                        {/* Mode toggle (only visible to signed-in users — guests have
                            only the manual mode anyway, so the toggle would be
                            misleading). */}
                        {isAuthed && (
                          <div className="flex items-center gap-2 mb-4">
                            <span className="text-xs text-slate-500 mr-1">Pick parents:</span>
                            <button
                              type="button"
                              onClick={() => setMode('manual')}
                              className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
                                mode === 'manual'
                                  ? 'bg-purple-600/20 border-purple-500/60 text-purple-200'
                                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
                              }`}
                            >
                              <Pencil className="w-3.5 h-3.5 inline mr-1.5" />
                              Manual entry
                            </button>
                            <button
                              type="button"
                              onClick={() => setMode('collection')}
                              className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
                                mode === 'collection'
                                  ? 'bg-purple-600/20 border-purple-500/60 text-purple-200'
                                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
                              }`}
                            >
                              <Users className="w-3.5 h-3.5 inline mr-1.5" />
                              From my collection ({geckos.length})
                            </button>
                          </div>
                        )}

                        {mode === 'manual' ? (
                          /* Manual entry — works for everyone */
                          <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 mb-6">
                            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 items-start">
                              <div className="space-y-3">
                                <Label className="text-blue-400 font-semibold">♂ Parent A (Sire)</Label>
                                <ManualGenotypePicker
                                  value={sireZygosity}
                                  onChange={setSireZygosity}
                                  accentClass="border-blue-700"
                                />
                              </div>
                              <div className="flex justify-center pt-8">
                                <Button
                                  variant="outline"
                                  size="icon"
                                  onClick={handleSwap}
                                  className="border-slate-600 hover:bg-slate-700 rounded-full"
                                  title="Swap parents"
                                >
                                  <ArrowLeftRight className="w-4 h-4" />
                                </Button>
                              </div>
                              <div className="space-y-3">
                                <Label className="text-pink-400 font-semibold">♀ Parent B (Dam)</Label>
                                <ManualGenotypePicker
                                  value={damZygosity}
                                  onChange={setDamZygosity}
                                  accentClass="border-pink-700"
                                />
                              </div>
                            </div>
                            {!isAuthed && (
                              <div className="mt-4 pt-4 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <p className="text-xs text-slate-500">
                                  Want to save these parents and run this against your real collection?
                                </p>
                                <Link to={createPageUrl('AuthPortal')}>
                                  <Button size="sm" className="bg-purple-600 hover:bg-purple-700 text-white text-xs">
                                    Create a free account
                                    <ArrowRight className="w-3 h-3 ml-1.5" />
                                  </Button>
                                </Link>
                              </div>
                            )}
                          </div>
                        ) : (
                          /* Collection mode — authed users picking saved geckos */
                          <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 mb-6">
                            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 items-end">
                              <div className="space-y-2">
                                <Label className="text-blue-400 font-semibold">♂ Parent A (Sire)</Label>
                                <Select value={sireId} onValueChange={setSireId}>
                                  <SelectTrigger className="bg-slate-800 border-blue-700 text-slate-100">
                                    <SelectValue placeholder="Select gecko..." />
                                  </SelectTrigger>
                                  <SelectContent className="bg-slate-800 border-slate-600 text-slate-200">
                                    {allForSire.map(g => (
                                      <SelectItem key={g.id} value={g.id}>
                                        {g.name}{g.gecko_id_code ? ` (${g.gecko_id_code})` : ''} — {g.sex}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                {collectionSire && (
                                  <div className="flex items-center gap-2 mt-1">
                                    {collectionSire.image_urls?.[0] && (
                                      <img src={collectionSire.image_urls[0]} alt={collectionSire.name} className="w-10 h-10 rounded object-cover border border-blue-700" />
                                    )}
                                    <div>
                                      <p className="text-xs text-slate-300 font-medium">{collectionSire.name}</p>
                                      <p className="text-xs text-slate-500">{(collectionSire.morph_tags || []).length} morph tags</p>
                                    </div>
                                  </div>
                                )}
                              </div>
                              <div className="flex justify-center pb-1">
                                <Button
                                  variant="outline"
                                  size="icon"
                                  onClick={handleSwap}
                                  className="border-slate-600 hover:bg-slate-700 rounded-full"
                                  title="Swap parents"
                                >
                                  <ArrowLeftRight className="w-4 h-4" />
                                </Button>
                              </div>
                              <div className="space-y-2">
                                <Label className="text-pink-400 font-semibold">♀ Parent B (Dam)</Label>
                                <Select value={damId} onValueChange={setDamId}>
                                  <SelectTrigger className="bg-slate-800 border-pink-700 text-slate-100">
                                    <SelectValue placeholder="Select gecko..." />
                                  </SelectTrigger>
                                  <SelectContent className="bg-slate-800 border-slate-600 text-slate-200">
                                    {allForDam.map(g => (
                                      <SelectItem key={g.id} value={g.id}>
                                        {g.name}{g.gecko_id_code ? ` (${g.gecko_id_code})` : ''} — {g.sex}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                {collectionDam && (
                                  <div className="flex items-center gap-2 mt-1">
                                    {collectionDam.image_urls?.[0] && (
                                      <img src={collectionDam.image_urls[0]} alt={collectionDam.name} className="w-10 h-10 rounded object-cover border border-pink-700" />
                                    )}
                                    <div>
                                      <p className="text-xs text-slate-300 font-medium">{collectionDam.name}</p>
                                      <p className="text-xs text-slate-500">{(collectionDam.morph_tags || []).length} morph tags</p>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Calculator results — same engine for both modes */}
                        <div className="bg-slate-900 border border-slate-700 rounded-xl p-5">
                          <GeneticCalculator sire={hasParents ? sire : null} dam={hasParents ? dam : null} />
                        </div>

                        {/* Monte Carlo simulator */}
                        {hasParents && <BreedingSimulator sire={sire} dam={dam} />}
                    </>
                )}
            </div>
        </div>
    );
}
