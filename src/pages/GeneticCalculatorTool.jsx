import { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Dna, Loader2, ArrowLeftRight, ArrowRight, Users, Pencil, Link2, Check } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import GeneticCalculator from '../components/breeding/GeneticCalculator';
import BreedingSimulator from '../components/innovations/BreedingSimulator';
import ManualGenotypePicker, {
  buildParentFromState,
} from '../components/breeding/ManualGenotypePicker';
import {
  encodeParentState,
  decodeParentState,
  stateHasSelection,
} from '@/lib/genetics/calculatorCatalog';
import { parsePairing } from '@/lib/genetics/pairingParser';
import { specWithInferredHets } from '@/lib/genetics/collectionSpec';
import { Gecko } from '@/entities/all';
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
    description: 'Punnett-square-based genetics calculator for crested gecko (Correlophus ciliatus) breeders. Predicts offspring outcomes for incomplete-dominant, recessive, and dominant traits including Lilly White, Cappuccino, Sable, Luwak, Axanthic, Phantom, and Empty Back, with 66% and 50% possible-het inputs and per-clutch odds. Free, no signup required.',
    applicationCategory: 'UtilitiesApplication',
    applicationSubCategory: 'Reptile Breeding Calculator',
    operatingSystem: 'Web',
    browserRequirements: 'Requires JavaScript',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    featureList: [
      'No-signup manual genotype entry',
      'Combined offspring projections with combo morph names (Frappuccino, Luwak)',
      'Cappuccino allelic complex support (Cappuccino, Sable, Highway, Luwak)',
      '66% and 50% possible-het inputs with correct probability math',
      'Lilly White lethal-super flagging and expected egg-loss accounting',
      'Per-clutch and per-season odds (2-egg clutches, at-least-one probability)',
      'Shareable pairing permalinks',
      'Season simulation',
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
 *   - 'manual'    , pick zygosity per trait. Available to everyone,
 *                    default for unauthenticated visitors. Per-morph
 *                    SEO routes (/calculator/:morph) pre-fill one
 *                    parent via the `initialSireZygosity` prop.
 *   - 'collection', pick two of the user's saved geckos. Authed only.
 *
 * Manual-mode "animals" are constructed by `buildParentFromState` and
 * carry a `genotype_spec` (weighted-locus spec supporting possible
 * hets and the Cappuccino complex) alongside display `morph_tags`;
 * collection-mode geckos carry only `morph_tags` and the downstream
 * `GeneticCalculator` converts those via the engine's tag importer.
 * The manual pairing is mirrored into the URL (?sire=...&dam=...) so
 * every calculation is a shareable permalink.
 */
export default function GeneticCalculatorTool({
  initialSireZygosity,
  initialDamZygosity,
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
    const [copied, setCopied] = useState(false);

    // Collection-mode selections
    const [sireId, setSireId] = useState('');
    const [damId, setDamId] = useState('');

    // Lineage-enriched genotype specs per collection gecko: tags plus
    // hidden-het inference (3 generations), keyed by gecko id.
    const [collectionSpecs, setCollectionSpecs] = useState({});

    // Permalink state: ?sire=lilly_white:het,axanthic:ph66&dam=... The URL
    // wins over the per-morph prefill so shared links reproduce exactly
    // what the sharer configured.
    const [searchParams, setSearchParams] = useSearchParams();
    const [urlSeeded] = useState(() => ({
        sire: decodeParentState(searchParams.get('sire')),
        dam: decodeParentState(searchParams.get('dam')),
    }));

    // Manual-mode zygosity records, e.g. { lilly_white: 'het', axanthic: 'ph66' }
    const [sireZygosity, setSireZygosity] = useState(() =>
        stateHasSelection(urlSeeded.sire) ? urlSeeded.sire : (initialSireZygosity || {}));
    const [damZygosity, setDamZygosity] = useState(() =>
        stateHasSelection(urlSeeded.dam) ? urlSeeded.dam : (initialDamZygosity || {}));

    // Default mode: manual for everyone (and required for unauthed). Authed
    // users can switch to 'collection' to pull from their saved geckos.
    const [mode, setMode] = useState('manual');

    const hasUrlSeed = stateHasSelection(urlSeeded.sire) || stateHasSelection(urlSeeded.dam);

    // Keep the URL in sync with the manual pairing so every calculation
    // is a shareable permalink. replace:true so fiddling with the picker
    // doesn't pollute browser history.
    useEffect(() => {
        if (mode !== 'manual') return;
        const sireStr = encodeParentState(sireZygosity);
        const damStr = encodeParentState(damZygosity);
        setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            if (sireStr) next.set('sire', sireStr); else next.delete('sire');
            if (damStr) next.set('dam', damStr); else next.delete('dam');
            return next;
        }, { replace: true });
    }, [mode, sireZygosity, damZygosity, setSearchParams]);

    // Omnibox: breeder shorthand in, both parents filled.
    const [omniboxText, setOmniboxText] = useState('');
    const [omniboxNote, setOmniboxNote] = useState('');
    const handleOmnibox = (e) => {
        e?.preventDefault?.();
        const { sire: s, dam: d, unrecognized } = parsePairing(omniboxText);
        if (!stateHasSelection(s) && !stateHasSelection(d)) {
            setOmniboxNote(omniboxText.trim() ? 'No genes recognized in that. Try something like "lilly white het axanthic x sable".' : '');
            return;
        }
        setMode('manual');
        setSireZygosity(s);
        setDamZygosity(d);
        setOmniboxNote(
            unrecognized.length
              ? `Could not read: ${unrecognized.join(', ')} (polygenic looks like Harlequin and Dalmatian are not Punnett-calculable, so the omnibox skips them).`
              : '',
        );
    };

    const handleCopyLink = async () => {
        try {
            await navigator.clipboard.writeText(window.location.href);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // Clipboard can be unavailable (permissions, http); the URL
            // bar still has the same link, so fail quietly.
        }
    };

    // Enrich selected collection parents with lineage-inferred possible
    // hets so pairing odds reflect the pedigree, not just visible tags.
    useEffect(() => {
        if (mode !== 'collection') return;
        let cancelled = false;
        for (const id of [sireId, damId]) {
            if (!id || collectionSpecs[id]) continue;
            const gecko = geckos.find((g) => g.id === id);
            if (!gecko) continue;
            specWithInferredHets(gecko, { GeckoEntity: Gecko }).then((result) => {
                if (!cancelled) {
                    setCollectionSpecs((prev) => ({ ...prev, [id]: result }));
                }
            });
        }
        return () => { cancelled = true; };
    }, [mode, sireId, damId, geckos, collectionSpecs]);

    useEffect(() => {
        const load = async () => {
            setIsLoading(true);
            try {
                const user = await base44.auth.me();
                if (user) {
                    setIsAuthed(true);
                    const { getVisibleGeckos } = await import('@/lib/geckoAccess');
                    const data = await getVisibleGeckos(user);
                    const visible = data.filter(g => !g.archived);
                    setGeckos(visible);
                    // Deep links from gecko profiles: ?sireGecko=<id> /
                    // ?damGecko=<id> preselect collection mode.
                    const params = new URLSearchParams(window.location.search);
                    const sireGecko = params.get('sireGecko');
                    const damGecko = params.get('damGecko');
                    const sireHit = sireGecko && visible.some(g => g.id === sireGecko);
                    const damHit = damGecko && visible.some(g => g.id === damGecko);
                    if (sireHit || damHit) {
                        setMode('collection');
                        if (sireHit) setSireId(sireGecko);
                        if (damHit) setDamId(damGecko);
                    } else if (!initialSireZygosity && !hasUrlSeed && data.length > 0) {
                        // Authed users haven't filled in a manual genotype
                        // yet, start them on collection mode if they have
                        // geckos, unless a permalink or per-morph prefill
                        // seeded manual mode with a pairing.
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
    }, [initialSireZygosity, hasUrlSeed]);

    const males = geckos.filter(g => g.sex === 'Male');
    const females = geckos.filter(g => g.sex === 'Female');
    const unsexed = geckos.filter(g => g.sex === 'Unsexed');

    const allForSire = [...males, ...unsexed];
    const allForDam = [...females, ...unsexed];

    const collectionSire = geckos.find(g => g.id === sireId) || null;
    const collectionDam = geckos.find(g => g.id === damId) || null;

    // The actual sire/dam objects fed to the calculator. In manual mode we
    // synthesize them from zygosity selections (carrying a genotype_spec
    // that supports possible hets and the Cappuccino complex); in
    // collection mode we use the user's saved Gecko entities directly.
    const sire = useMemo(
      () => {
        if (mode === 'manual') {
          return buildParentFromState('manual_sire', 'Parent A (Sire)', sireZygosity);
        }
        if (!collectionSire) return null;
        const enriched = collectionSpecs[collectionSire.id];
        return enriched
          ? { ...collectionSire, genotype_spec: enriched.spec, inferred_hets: enriched.inferredHets }
          : collectionSire;
      },
      [mode, sireZygosity, collectionSire, collectionSpecs],
    );
    const dam = useMemo(
      () => {
        if (mode === 'manual') {
          return buildParentFromState('manual_dam', 'Parent B (Dam)', damZygosity);
        }
        if (!collectionDam) return null;
        const enriched = collectionSpecs[collectionDam.id];
        return enriched
          ? { ...collectionDam, genotype_spec: enriched.spec, inferred_hets: enriched.inferredHets }
          : collectionDam;
      },
      [mode, damZygosity, collectionDam, collectionSpecs],
    );

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
      ? (stateHasSelection(sireZygosity) || stateHasSelection(damZygosity))
      : (sire && dam);

    return (
        <div className="p-4 md:p-8 bg-slate-950 min-h-screen">
            <Seo
              title={pageTitle || 'Crested Gecko Morph & Breeding Calculator (Genetics)'}
              description={pageDescription || 'Free crested gecko morph calculator and breeding calculator. Predict offspring morphs with Punnett-square genetics for Lilly White (lethal super), the Cappuccino complex (Cappuccino, Sable, Highway, Luwak), Axanthic, Phantom, Empty Back, Soft Scale, Whiteout, and Hypo, with possible-het inputs and per-clutch odds. No signup required.'}
              path={pagePath}
              imageAlt="Crested gecko morph and breeding genetics Punnett-square calculator"
              keywords={pageKeywords || [
                'crested gecko morph calculator',
                'crested gecko breeding calculator',
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
                          : 'A free crested gecko morph calculator and breeding calculator in one. Projections for every proven gene, including the Cappuccino complex (Cappuccino, Sable, Highway, Luwak), 66% and 50% possible hets, and real 2-egg clutch odds. Pick genes below, no account required, or sign in to pull parents straight from your collection.'}
                    </p>
                </div>

                {introSlot}

                {isLoading ? (
                    <div className="text-center py-20">
                        <Loader2 className="w-12 h-12 text-purple-400 animate-spin mx-auto" />
                    </div>
                ) : (
                    <>
                        {/* Mode toggle (only visible to signed-in users, guests have
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

                        {/* Omnibox: type a pairing in breeder shorthand */}
                        <form onSubmit={handleOmnibox} className="mb-4">
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={omniboxText}
                              onChange={(e) => setOmniboxText(e.target.value)}
                              placeholder='Type a pairing: "lilly white het axanthic x sable"'
                              className="flex-1 h-10 rounded-md bg-slate-800 border border-slate-600 px-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                              aria-label="Type a pairing in breeder shorthand"
                            />
                            <Button type="submit" className="bg-purple-600 hover:bg-purple-700 text-white text-sm h-10">
                              Fill parents
                            </Button>
                          </div>
                          {omniboxNote && (
                            <p className="text-xs text-amber-300 mt-1.5">{omniboxNote}</p>
                          )}
                        </form>

                        {/* Reverse-mode cross-link */}
                        <div className="mb-4 rounded-lg border border-purple-500/20 bg-purple-500/5 px-4 py-3 flex items-center justify-between gap-3">
                          <p className="text-sm text-slate-300">
                            Have a dream gecko in mind? Work backwards from the target instead.
                          </p>
                          <Link to="/calculator/reverse" className="text-sm text-purple-300 hover:text-purple-200 underline whitespace-nowrap">
                            Reverse calculator
                            <ArrowRight className="w-3.5 h-3.5 inline ml-1" />
                          </Link>
                        </div>

                        {mode === 'manual' ? (
                          /* Manual entry, works for everyone */
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
                            {hasParents && (
                              <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between gap-3">
                                <p className="text-xs text-slate-500">
                                  This pairing lives in the URL, share it anywhere.
                                </p>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={handleCopyLink}
                                  className="border-slate-600 text-slate-200 hover:bg-slate-700 text-xs"
                                >
                                  {copied ? <Check className="w-3.5 h-3.5 mr-1.5 text-emerald-400" /> : <Link2 className="w-3.5 h-3.5 mr-1.5" />}
                                  {copied ? 'Copied' : 'Copy link'}
                                </Button>
                              </div>
                            )}
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
                          /* Collection mode, authed users picking saved geckos */
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
                                        {g.name}{g.gecko_id_code ? ` (${g.gecko_id_code})` : ''}, {g.sex}
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
                                        {g.name}{g.gecko_id_code ? ` (${g.gecko_id_code})` : ''}, {g.sex}
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

                        {/* Calculator results, same engine for both modes */}
                        <div className="bg-slate-900 border border-slate-700 rounded-xl p-5">
                          <GeneticCalculator sire={hasParents ? sire : null} dam={hasParents ? dam : null} />
                        </div>

                        {/* Monte Carlo simulator */}
                        {hasParents && <BreedingSimulator sire={sire} dam={dam} />}
                    </>
                )}

                {/* Positioning + SEO context. Base /calculator only, the
                    per-morph landing pages carry their own intro copy and
                    should not repeat this block. Written to state what makes
                    this calculator accurate for crested geckos specifically,
                    without naming competitors. */}
                {!pageBreadcrumb && (
                  <div className="mt-10 grid gap-4 md:grid-cols-3">
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                      <div className="flex items-center gap-2 mb-2">
                        <Dna className="w-4 h-4 text-purple-400" />
                        <h2 className="text-sm font-semibold text-slate-100">Built crested-gecko-first</h2>
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        The inheritance rules here are tuned for crested geckos (Correlophus ciliatus), not adapted from a general reptile calculator. Lilly White is modeled as incomplete-dominant with a lethal super, Cappuccino and Axanthic as recessives, and Soft Scale as dominant, so the outcomes match how these traits actually pass in the hobby. Learn the underlying rules in the{' '}
                        <Link to="/GeneticsGuide" className="text-purple-300 hover:text-purple-200">genetics guide</Link>.
                      </p>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                      <div className="flex items-center gap-2 mb-2">
                        <Users className="w-4 h-4 text-emerald-400" />
                        <h2 className="text-sm font-semibold text-slate-100">Pulls from your collection</h2>
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        Sign in and pick real parents straight from your collection instead of re-entering genotypes by hand. Each projection ties back to the animals you already track, and every hatchling can flow into your{' '}
                        <Link to="/breeding-records" className="text-emerald-300 hover:text-emerald-200">breeding records</Link> and{' '}
                        <Link to="/pedigree-tracker" className="text-emerald-300 hover:text-emerald-200">pedigree</Link>.
                      </p>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                      <div className="flex items-center gap-2 mb-2">
                        <ArrowRight className="w-4 h-4 text-sky-400" />
                        <h2 className="text-sm font-semibold text-slate-100">Free, no account needed</h2>
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        Run any pairing right now without signing up. Explore per-trait calculators for{' '}
                        <Link to="/calculator/lilly-white" className="text-sky-300 hover:text-sky-200">Lilly White</Link>,{' '}
                        <Link to="/calculator/cappuccino" className="text-sky-300 hover:text-sky-200">Cappuccino</Link>, and{' '}
                        <Link to="/calculator/axanthic" className="text-sky-300 hover:text-sky-200">Axanthic</Link>, or browse the full{' '}
                        <Link to="/MorphGuide" className="text-sky-300 hover:text-sky-200">morph guide</Link>.
                      </p>
                    </div>
                  </div>
                )}
            </div>
        </div>
    );
}
