import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Target, ArrowRight, AlertTriangle, Dna } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import Seo from '@/components/seo/Seo';
import { breadcrumbSchema, ORG_ID } from '@/lib/organization-schema';
import {
  REVERSE_TARGETS,
  REVERSE_TARGETS_BY_ID,
  solveTarget,
  scanCollection,
  scanCollectionTwoGen,
} from '@/lib/genetics/reverseSolver';
import { tagsToSpec } from '@/lib/genetics/predictWeighted';
import {
  EGGS_PER_CLUTCH,
  DEFAULT_CLUTCHES_PER_SEASON,
  pAtLeastOne,
  pct,
  simpleFraction,
  roundExpected,
} from '@/lib/genetics/clutchMath';

/**
 * Reverse genetics calculator at /calculator/reverse: pick the gecko
 * you WANT, get the pairings that produce it, ranked by per-egg odds.
 * No reptile calculator anywhere offers this mode; see
 * MORPH_CALCULATOR_PLAN.md item 2.1.
 *
 * The math lives in lib/genetics/reverseSolver.js (exact per-locus
 * gamete probabilities). Signed-in users additionally get their own
 * collection scanned for the best candidate pairs.
 */

const REVERSE_JSON_LD = [
  {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    '@id': 'https://geckinspect.com/calculator/reverse#app',
    name: 'Reverse Crested Gecko Genetics Calculator',
    url: 'https://geckinspect.com/calculator/reverse',
    description:
      'Pick a target crested gecko morph (Lilly White, Axanthic, Luwak, Frappuccino, and more) and see every pairing that can produce it, ranked by per-egg odds, with lethal and health warnings. Free, no signup required.',
    applicationCategory: 'UtilitiesApplication',
    applicationSubCategory: 'Reptile Breeding Calculator',
    operatingSystem: 'Web',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    featureList: [
      'Goal-seek mode: target morph in, ranked parent pairings out',
      'Exact per-egg odds with season-level at-least-one probability',
      'Lethal-egg and compromised-super costs shown per route',
      'Proven-het requirements flagged',
      'Scan your own collection for the best candidate pairs',
    ],
    creator: { '@id': ORG_ID },
  },
  breadcrumbSchema([
    { name: 'Home', path: '/' },
    { name: 'Genetic Calculator', path: '/calculator' },
    { name: 'Reverse Calculator', path: '/calculator/reverse' },
  ]),
];

const GROUP_ORDER = ['Proven genes', 'Cappuccino complex', 'Combos', 'Emerging genes'];

function RouteCard({ route, rank, eggs }) {
  const frac = simpleFraction(route.p);
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm text-slate-100">
          <span className="text-slate-500 font-mono mr-2">#{rank}</span>
          <span className="text-blue-300">{route.sireLabel}</span>
          <span className="text-slate-500 mx-1.5">x</span>
          <span className="text-pink-300">{route.damLabel}</span>
        </p>
        <span className="text-sm font-mono text-emerald-300 whitespace-nowrap">
          {pct(route.p)}{frac && <span className="text-slate-500 ml-1.5">{frac}</span>}
        </span>
      </div>
      <p className="text-xs text-slate-400 mt-1 font-mono">
        ≈{roundExpected(route.p * eggs)} of {eggs} eggs · {pct(pAtLeastOne(route.p, eggs))} chance of
        at least one this season
      </p>
      <div className="flex flex-wrap items-center gap-1.5 mt-2">
        {route.lethalP > 0 && (
          <span className="text-[11px] px-1.5 py-0.5 rounded-full border border-red-700 bg-red-950/50 text-red-300">
            {pct(route.lethalP)} of eggs non-viable
          </span>
        )}
        {route.compromisedP > 0 && (
          <span className="text-[11px] px-1.5 py-0.5 rounded-full border border-amber-700 bg-amber-950/40 text-amber-300">
            {pct(route.compromisedP)} compromised supers
          </span>
        )}
        {route.needsProvenHet && (
          <span className="text-[11px] px-1.5 py-0.5 rounded-full border border-slate-600 bg-slate-800 text-slate-300">
            needs a proven het
          </span>
        )}
        {route.cautions.map((c) => (
          <span key={c} className="text-[11px] px-1.5 py-0.5 rounded-full border border-amber-700 bg-amber-950/40 text-amber-300">
            {c}
          </span>
        ))}
        <Link
          to={route.permalink}
          className="ml-auto text-xs text-purple-300 hover:text-purple-200 underline inline-flex items-center gap-1"
        >
          Open in calculator <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    </div>
  );
}

export default function ReverseCalculator() {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlTarget = searchParams.get('target');
  const [targetId, setTargetId] = useState(
    REVERSE_TARGETS_BY_ID[urlTarget] ? urlTarget : 'lilly_white',
  );
  const [geckos, setGeckos] = useState(null); // null = not signed in / loading

  const target = REVERSE_TARGETS_BY_ID[targetId];
  const eggs = DEFAULT_CLUTCHES_PER_SEASON * EGGS_PER_CLUTCH;

  useEffect(() => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('target', targetId);
      return next;
    }, { replace: true });
  }, [targetId, setSearchParams]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const user = await base44.auth.me();
        if (!user || cancelled) return;
        const { getVisibleGeckos } = await import('@/lib/geckoAccess');
        const data = await getVisibleGeckos(user);
        if (cancelled) return;
        setGeckos(
          data
            .filter((g) => !g.archived)
            .map((g) => ({
              id: g.id,
              name: g.name,
              sex: g.sex,
              spec: tagsToSpec(g.morph_tags || []),
            })),
        );
      } catch {
        // Signed out: the public solver is the whole page.
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const routes = useMemo(() => solveTarget(targetId), [targetId]);
  const collectionScan = useMemo(
    () => (geckos ? scanCollection(targetId, geckos) : null),
    [targetId, geckos],
  );
  // When no single pairing in the collection can get there, plan the
  // two-generation route: pair, hold back the right baby, pair again.
  const twoGenScan = useMemo(
    () => (geckos && collectionScan && collectionScan.results.length === 0
      ? scanCollectionTwoGen(targetId, geckos)
      : null),
    [targetId, geckos, collectionScan],
  );

  const grouped = GROUP_ORDER.map((group) => ({
    group,
    targets: REVERSE_TARGETS.filter((t) => t.group === group),
  }));

  return (
    <div className="p-4 md:p-8 bg-slate-950 min-h-screen">
      <Seo
        title="Reverse Genetics Calculator: Crested Gecko"
        description="Pick the crested gecko you want (Lilly White, visual Axanthic, Luwak, Frappuccino, Phantom Lilly and more) and see every pairing that produces it, ranked by per-egg odds with lethal and health warnings. Free, no signup."
        path="/calculator/reverse"
        imageAlt="Reverse crested gecko genetics calculator"
        keywords={[
          'reverse genetics calculator crested gecko',
          'how to make a frappuccino crested gecko',
          'how to produce lilly white',
          'what pairing makes axanthic',
          'luwak crested gecko pairing',
          'crested gecko breeding planner',
        ]}
        jsonLd={REVERSE_JSON_LD}
      />
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-3">
            <Link to="/" className="hover:text-slate-300">Home</Link>
            <span>/</span>
            <Link to="/calculator" className="hover:text-slate-300">Genetic Calculator</Link>
            <span>/</span>
            <span className="text-slate-400">Reverse Calculator</span>
          </div>
          <h1 className="text-2xl md:text-4xl font-bold text-slate-100 flex items-center gap-3">
            <Target className="w-8 h-8 md:w-10 md:h-10 text-purple-400" />
            Reverse Genetics Calculator
          </h1>
          <p className="text-slate-400 mt-2 text-sm md:text-base">
            Start from the gecko you want. Pick a target and see every pairing that can produce it,
            ranked by per-egg odds, with the lethal-egg and health costs of each route shown
            honestly. Then open any route in the calculator to fine-tune it.
          </p>
        </div>

        {/* Target picker */}
        <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 mb-6">
          <label className="text-xs text-slate-400 uppercase tracking-wider block mb-2" htmlFor="reverse-target">
            I want to produce
          </label>
          <Select value={targetId} onValueChange={setTargetId}>
            <SelectTrigger id="reverse-target" className="bg-slate-800 border-purple-700 text-slate-100">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-600 text-slate-200">
              {grouped.map(({ group, targets }) => (
                <SelectGroup key={group}>
                  <SelectLabel className="text-slate-500">{group}</SelectLabel>
                  {targets.map((t) => (
                    <SelectItem key={t.id} value={t.id} className="text-sm">
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
          {target?.emerging && (
            <p className="text-xs text-amber-300 mt-2">
              This trait is badged Emerging: documented, but the science is younger than the proven
              genes. Odds assume the published inheritance model holds.
            </p>
          )}
          {target?.note && (
            <p className="text-xs text-slate-400 mt-2">{target.note}</p>
          )}
        </div>

        {/* Collection scan for signed-in users */}
        {collectionScan && (
          <div className="bg-slate-900 border border-emerald-800/60 rounded-xl p-5 mb-6">
            <h2 className="text-sm font-semibold text-emerald-300 mb-3 flex items-center gap-2">
              <Dna className="w-4 h-4" />
              From your collection
            </h2>
            {collectionScan.results.length === 0 ? (
              <div className="space-y-3">
                <p className="text-sm text-slate-400">
                  No single pairing in your collection can produce {target?.label}.
                  {twoGenScan?.results.length
                    ? ' But a two-generation project can get there:'
                    : ' The routes below show what genetics to bring in.'}
                </p>
                {twoGenScan?.results.map((route, index) => (
                  <div
                    key={`${route.gen1.sire.id}-${route.gen1.dam.id}-${route.gen2.mate.id}`}
                    className="rounded-lg border border-slate-700 bg-slate-900/60 p-3 text-sm text-slate-200 space-y-1"
                  >
                    <p className="text-xs text-slate-500 font-mono">
                      Two-generation route #{index + 1}
                      {route.backcross && <span className="ml-2 text-amber-300">back-cross</span>}
                    </p>
                    <p>
                      1. Pair <span className="text-blue-300">{route.gen1.sire.name}</span>
                      <span className="text-slate-500"> x </span>
                      <span className="text-pink-300">{route.gen1.dam.name}</span> and hold back a{' '}
                      <span className="text-purple-200">{route.holdbackLabel}</span>{' '}
                      <span className="text-slate-500 font-mono">({pct(route.gen1.p)} of eggs)</span>
                    </p>
                    <p>
                      2. Pair the holdback to <span className="text-emerald-300">{route.gen2.mate.name}</span>{' '}
                      <span className="text-slate-500 font-mono">({pct(route.gen2.p)} per egg)</span>
                    </p>
                    <p className="text-xs text-slate-500">
                      Season one makes the parent, season two makes the goal. Serious projects are
                      measured in seasons.
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {collectionScan.results.map((r) => (
                  <div key={`${r.sire.id}-${r.dam.id}`} className="flex items-baseline justify-between gap-3 rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2">
                    <p className="text-sm text-slate-100 min-w-0 truncate">
                      <span className="text-blue-300">{r.sire.name}</span>
                      <span className="text-slate-500 mx-1.5">x</span>
                      <span className="text-pink-300">{r.dam.name}</span>
                      {r.lethalP > 0 && (
                        <span className="ml-2 text-[11px] text-red-300">({pct(r.lethalP)} eggs non-viable)</span>
                      )}
                    </p>
                    <span className="text-sm font-mono text-emerald-300 whitespace-nowrap">{pct(r.p)} per egg</span>
                  </div>
                ))}
                {collectionScan.truncated && (
                  <p className="text-xs text-slate-500">
                    Collection too large to scan every pair; showing the best of the first 2,500.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Ranked routes */}
        <div className="bg-slate-900 border border-slate-700 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-slate-200 mb-1">
            Pairings that produce {target?.label}
          </h2>
          <p className="text-xs text-slate-500 mb-3">
            Ranked by per-egg odds; at equal odds, routes with no lethal or compromised eggs rank
            first. Season numbers assume {DEFAULT_CLUTCHES_PER_SEASON} clutches of {EGGS_PER_CLUTCH} eggs.
          </p>
          {routes.length === 0 ? (
            <p className="text-sm text-slate-400">No viable pairing produces this target.</p>
          ) : (
            <div className="space-y-2">
              {routes.map((r, i) => (
                <RouteCard key={`${r.sireLabel}|${r.damLabel}`} route={r} rank={i + 1} eggs={eggs} />
              ))}
            </div>
          )}
          <div className="mt-4 pt-3 border-t border-slate-800 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-slate-500">
              Routes marked "needs a proven het" depend on a carrier that looks normal; only
              breeding trials or lineage prove hets. Polygenic looks (Harlequin structure, Dalmatian
              density, base color) are not part of these odds because no honest per-egg number
              exists for them.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
