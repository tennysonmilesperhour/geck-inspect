import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Gecko } from '@/entities/all';
import { base44 } from '@/api/base44Client';
import { Dna, Loader2, ArrowLeftRight, ArrowRight } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import GeneticCalculator from '../components/breeding/GeneticCalculator';
import BreedingSimulator from '../components/innovations/BreedingSimulator';
import Seo from '@/components/seo/Seo';
import { createPageUrl } from '@/utils';
import { breadcrumbSchema, ORG_ID } from '@/lib/organization-schema';

const CALCULATOR_JSON_LD = [
  {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    '@id': 'https://geckinspect.com/GeneticCalculatorTool#app',
    name: 'Crested Gecko Genetics Calculator',
    url: 'https://geckinspect.com/GeneticCalculatorTool',
    description: 'Punnett-square-based genetics calculator for crested gecko (Correlophus ciliatus) breeders. Predicts offspring outcomes for incomplete-dominant, recessive, and dominant traits including Lilly White, Cappuccino, Axanthic, Soft Scale, and Hypo.',
    applicationCategory: 'UtilitiesApplication',
    applicationSubCategory: 'Reptile Breeding Calculator',
    operatingSystem: 'Web',
    browserRequirements: 'Requires JavaScript',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    featureList: [
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
    { name: 'Genetic Calculator', path: '/GeneticCalculatorTool' },
  ]),
];

export default function GeneticCalculatorTool() {
    const [geckos, setGeckos] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isAuthed, setIsAuthed] = useState(false);
    const [sireId, setSireId] = useState('');
    const [damId, setDamId] = useState('');

    useEffect(() => {
        const load = async () => {
            setIsLoading(true);
            try {
                const user = await base44.auth.me();
                if (user) {
                    setIsAuthed(true);
                    const data = await Gecko.filter({ created_by: user.email });
                    setGeckos(data.filter(g => !g.archived));
                }
            } catch {
                // auth.me throws when unauthenticated. That's fine — we
                // render a public explainer + sign-up CTA in that case.
                setIsAuthed(false);
            }
            setIsLoading(false);
        };
        load();
    }, []);

    const males = geckos.filter(g => g.sex === 'Male');
    const females = geckos.filter(g => g.sex === 'Female');
    const unsexed = geckos.filter(g => g.sex === 'Unsexed');

    const allForSire = [...males, ...unsexed];
    const allForDam = [...females, ...unsexed];

    const sire = geckos.find(g => g.id === sireId) || null;
    const dam = geckos.find(g => g.id === damId) || null;

    const handleSwap = () => {
        const prevSire = sireId;
        const prevDam = damId;
        setSireId(prevDam);
        setDamId(prevSire);
    };

    return (
        <div className="p-4 md:p-8 bg-slate-950 min-h-screen">
            <Seo
              title="Crested Gecko Genetics Calculator"
              description="Free Punnett-square genetics calculator for crested gecko breeders. Predict offspring outcomes for Lilly White (incomplete-dominant, lethal super), Cappuccino (incomplete-dominant), Axanthic (recessive), Soft Scale (incomplete-dominant), and Hypo (dominant). Built for the crested gecko hobby."
              path="/GeneticCalculatorTool"
              imageAlt="Crested gecko genetics Punnett-square calculator"
              keywords={[
                'crested gecko genetics calculator',
                'crested gecko punnett square',
                'lilly white calculator',
                'cappuccino calculator',
                'axanthic calculator',
                'crested gecko breeding projections',
                'morph outcome predictor',
              ]}
              jsonLd={CALCULATOR_JSON_LD}
            />
            <div className="max-w-4xl mx-auto">
                <div className="mb-8">
                    <div className="flex items-center gap-2 text-xs text-slate-500 mb-3">
                        <Link to="/" className="hover:text-slate-300">Home</Link>
                        <span>/</span>
                        <span className="text-slate-400">Genetic Calculator</span>
                    </div>
                    <h1 className="text-2xl md:text-4xl font-bold text-slate-100 flex items-center gap-3">
                        <Dna className="w-8 h-8 md:w-10 md:h-10 text-purple-400" />
                        Crested Gecko Genetics Calculator
                    </h1>
                    <p className="text-slate-400 mt-2 text-sm md:text-base">
                        Punnett-square projections for Lilly White, Cappuccino, Axanthic, and Soft Scale pairings. Sign in and pick two geckos from your collection for a complete multi-trait breakdown.
                    </p>
                </div>

                {isLoading ? (
                    <div className="text-center py-20">
                        <Loader2 className="w-12 h-12 text-purple-400 animate-spin mx-auto" />
                    </div>
                ) : !isAuthed ? (
                    <div className="bg-slate-900 border border-slate-700 rounded-xl p-8 space-y-6">
                        <div>
                            <h2 className="text-xl font-bold text-slate-100 mb-2">What the calculator does</h2>
                            <p className="text-slate-400 text-sm leading-relaxed">
                                Enter any pair of crested geckos with known trait genotypes and see a Punnett-square-based projection of expected offspring percentages. Supports incomplete-dominant traits (Lilly White — including the lethal Super homozygous form — Cappuccino, Soft Scale, Whiteout, Empty Back), recessive traits (Axanthic), and dominant traits (Hypo). The Monte Carlo simulator models a full breeding season so you can pressure-test a pairing before committing to it.
                            </p>
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-100 mb-2">Which crested gecko traits follow Mendelian inheritance?</h2>
                            <ul className="text-slate-400 text-sm leading-relaxed space-y-1.5 list-disc pl-5">
                                <li><strong className="text-slate-200">Lilly White</strong> — incomplete-dominant; homozygous "Super Lilly White" is lethal in the egg.</li>
                                <li><strong className="text-slate-200">Cappuccino</strong> — incomplete-dominant; heterozygotes show the partial phenotype and the homozygous Super Cappuccino (Melanistic) has documented health concerns.</li>
                                <li><strong className="text-slate-200">Axanthic</strong> — recessive; removes red and yellow pigments entirely.</li>
                                <li><strong className="text-slate-200">Soft Scale</strong> — incomplete-dominant; homozygous Super Soft Scale is the maximum texture expression and is healthy.</li>
                                <li><strong className="text-slate-200">Hypo</strong> — dominant; reduces melanin and combines with base colors (e.g. Black → Lavender, Yellow → Cream).</li>
                            </ul>
                            <p className="text-slate-500 text-xs mt-3">Most other crested gecko "morphs" (Harlequin, Dalmatian, Pinstripe, Flame, etc.) are polygenic and do not follow a Punnett square. <Link to="/GeneticsGuide" className="text-purple-300 hover:underline">Read the genetics guide →</Link></p>
                        </div>
                        <Link to={createPageUrl('AuthPortal')}>
                            <Button size="lg" className="bg-purple-600 hover:bg-purple-700 text-white font-semibold">
                                Create a free account to run the calculator
                                <ArrowRight className="w-4 h-4 ml-2" />
                            </Button>
                        </Link>
                    </div>
                ) : (
                    <>
                        {/* Selector row */}
                        <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 mb-6">
                            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 items-end">
                                {/* Sire selector */}
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
                                    {sire && (
                                        <div className="flex items-center gap-2 mt-1">
                                            {sire.image_urls?.[0] && (
                                                <img src={sire.image_urls[0]} alt={sire.name} className="w-10 h-10 rounded object-cover border border-blue-700" />
                                            )}
                                            <div>
                                                <p className="text-xs text-slate-300 font-medium">{sire.name}</p>
                                                <p className="text-xs text-slate-500">{(sire.morph_tags || []).length} morph tags</p>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Swap button */}
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

                                {/* Dam selector */}
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
                                    {dam && (
                                        <div className="flex items-center gap-2 mt-1">
                                            {dam.image_urls?.[0] && (
                                                <img src={dam.image_urls[0]} alt={dam.name} className="w-10 h-10 rounded object-cover border border-pink-700" />
                                            )}
                                            <div>
                                                <p className="text-xs text-slate-300 font-medium">{dam.name}</p>
                                                <p className="text-xs text-slate-500">{(dam.morph_tags || []).length} morph tags</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Calculator results */}
                        <div className="bg-slate-900 border border-slate-700 rounded-xl p-5">
                            <GeneticCalculator sire={sire} dam={dam} />
                        </div>

                        {/* Monte Carlo simulator */}
                        <BreedingSimulator sire={sire} dam={dam} />
                    </>
                )}
            </div>
        </div>
    );
}