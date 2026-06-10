import React, { useState, useEffect, useMemo, Suspense } from 'react';
import Seo from '@/components/seo/Seo';
import { base44 } from '@/api/base44Client';
import { MorphPriceCache } from '@/api/supabaseEntities';
import {
  predict,
  tagToGenotype,
  detectRisks,
  displayText,
  TRAITS,
  COMBO_MORPHS,
} from '@/lib/genetics';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import EmptyState from '../components/shared/EmptyState';
import {
  Target,
  DollarSign,
  ShieldCheck,
  AlertTriangle,
  Ban,
  ArrowRight,
  Heart,
  Sparkles,
} from 'lucide-react';

const LoginPortal = React.lazy(() => import('../components/auth/LoginPortal'));

// How many sire x dam pairs we are willing to evaluate eagerly. Beyond
// this we switch to "per selected sire" mode so the browser never has to
// run thousands of Punnett predictions in one synchronous pass.
const PAIR_EVAL_CAP = 400;

const GOALS = {
  morph: { label: 'Target a morph', icon: Target },
  value: { label: 'Maximize predicted value', icon: DollarSign },
  safe: { label: 'Safest pairings', icon: ShieldCheck },
};

// Static fallback tier weights, used only when the community price cache
// is empty. These are rough relative desirability scores for crested
// gecko traits, not dollar values. The UI says so plainly when they kick
// in so nobody mistakes them for real market data.
const STATIC_TIER_WEIGHTS = {
  'lilly white': 5,
  cappuccino: 5,
  sable: 4,
  axanthic: 5,
  whiteout: 5,
  highway: 4,
  'empty back': 3,
  phantom: 3,
  pinstripe: 2,
  harlequin: 3,
  dalmatian: 2,
  hypo: 2,
  tiger: 1,
  flame: 1,
};

// Combo morphs that command a premium even without per-trait pricing.
const STATIC_COMBO_WEIGHTS = {
  tricolor: 4,
  halloween: 4,
  'extreme harlequin': 4,
  xxx: 5,
  brindlequin: 4,
  frappuccino: 5,
  'phantom frappuccino': 5,
  luwak: 5,
  lavender: 3,
  lucy: 4,
};

function buildAnimal(gecko) {
  const result = tagToGenotype(gecko.morph_tags || []);
  return {
    id: gecko.id,
    species: 'correlophus_ciliatus',
    genotype: result.genotype,
    status: 'active',
    is_breeder: true,
    owner_id: gecko.id,
    created_at: '',
    updated_at: '',
  };
}

// Build the goal dropdown: engine trait names first, then known combo
// morphs. All crested-gecko-specific, all sourced from the engine so the
// list can never drift from the genetics facts.
function buildMorphOptions() {
  const traits = TRAITS.map((t) => ({ value: `trait:${t.name}`, label: t.name }));
  const combos = COMBO_MORPHS.map((c) => ({ value: `combo:${c.name}`, label: `${c.name} (combo)` }));
  return [...traits, ...combos].sort((a, b) => a.label.localeCompare(b.label));
}

// Does an offspring phenotype satisfy the targeted morph? We match the
// engine's phenotype_description string for traits and the lowercase
// combo id list for combo morphs.
function phenotypeHitsTarget(pheno, target) {
  if (!target) return false;
  const [kind, name] = target.split(/:(.+)/);
  if (kind === 'combo') {
    const wanted = name.toLowerCase();
    return (pheno.matching_combo_morphs || []).some((c) => c.toLowerCase() === wanted);
  }
  // trait: match against the human-readable description, case-insensitive.
  return (pheno.phenotype_description || '').toLowerCase().includes(name.toLowerCase());
}

// A pairing is "blocked by default" when it carries a critical (lethal or
// documented-harm) warning. Lilly White x Lilly White is the canonical
// case. The user can opt in with the risky-pairings toggle.
function isBlocked(warnings) {
  return warnings.some((w) => w.severity === 'critical');
}

export default function PairingPlannerPage() {
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [geckos, setGeckos] = useState([]);
  const [priceMap, setPriceMap] = useState(null); // morph_name(lower) -> avg price
  const [priceLoaded, setPriceLoaded] = useState(false);

  const [goal, setGoal] = useState('morph');
  const [targetMorph, setTargetMorph] = useState('');
  const [showRisky, setShowRisky] = useState(false);
  const [selectedSireId, setSelectedSireId] = useState('all');

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
        setAuthChecked(true);
        if (!currentUser) {
          setIsLoading(false);
          return;
        }
        const { getVisibleGeckos } = await import('@/lib/geckoAccess');
        const data = await getVisibleGeckos(currentUser);
        const live = (data || []).filter(
          (g) => !g.archived && !g.notes?.startsWith('[Manual sale]')
        );
        setGeckos(live);
      } catch (error) {
        console.error('Failed to load pairing planner data:', error);
        setAuthChecked(true);
      }
      setIsLoading(false);
    })();
  }, []);

  // Pull community price data once. Keyed by morph_name so the value goal
  // can look up an average for each trait an offspring carries.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await MorphPriceCache.list('-created_date');
        if (cancelled) return;
        const buckets = new Map();
        for (const r of rows || []) {
          const key = (r.morph_name || '').toLowerCase().trim();
          const price = r.average_price || r.price || r.median_price || r.min_price;
          if (!key || !price || price <= 0) continue;
          if (!buckets.has(key)) buckets.set(key, []);
          buckets.get(key).push(price);
        }
        const map = new Map();
        for (const [key, prices] of buckets) {
          map.set(key, prices.reduce((s, p) => s + p, 0) / prices.length);
        }
        setPriceMap(map);
      } catch (e) {
        console.warn('PairingPlanner price fetch failed:', e);
        if (!cancelled) setPriceMap(new Map());
      }
      if (!cancelled) setPriceLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const males = useMemo(() => geckos.filter((g) => g.sex === 'Male'), [geckos]);
  const females = useMemo(() => geckos.filter((g) => g.sex === 'Female'), [geckos]);
  const excludedUnsexed = useMemo(
    () => geckos.filter((g) => g.sex !== 'Male' && g.sex !== 'Female').length,
    [geckos]
  );

  const usingStaticWeights = priceLoaded && (!priceMap || priceMap.size === 0);

  // Score one offspring distribution against the active goal. Returns a
  // number where higher is better (0 for "no contribution").
  const scoreDistribution = useMemo(() => {
    return (phenotypes) => {
      if (goal === 'morph') {
        // Probability of producing at least the targeted morph in a
        // single egg, summed over every matching phenotype. Expressed as
        // a percentage so the card label reads naturally.
        let p = 0;
        for (const ph of phenotypes) {
          if (phenotypeHitsTarget(ph, targetMorph)) p += ph.probability;
        }
        return Math.round(p * 1000) / 10;
      }
      if (goal === 'value') {
        // Expected per-egg value: sum over phenotypes of
        // probability * (best per-trait/combo price the egg carries).
        // With live cache we use dollar averages; otherwise the static
        // tier weights stand in as a relative desirability score.
        let expected = 0;
        for (const ph of phenotypes) {
          const desc = (ph.phenotype_description || '').toLowerCase();
          let best = 0;
          // Combo premium first.
          for (const combo of ph.matching_combo_morphs || []) {
            const key = combo.toLowerCase();
            const live = priceMap && priceMap.get(key);
            const val = live != null ? live : (STATIC_COMBO_WEIGHTS[key] || 0);
            if (val > best) best = val;
          }
          // Then individual traits present in the description.
          for (const trait of TRAITS) {
            const key = trait.name.toLowerCase();
            if (!desc.includes(key)) continue;
            const live = priceMap && priceMap.get(key);
            const val = live != null ? live : (STATIC_TIER_WEIGHTS[key] || 0);
            if (val > best) best = val;
          }
          expected += ph.probability * best;
        }
        return Math.round(expected * 100) / 100;
      }
      // safe goal: scoring handled by risk filtering; rank by genetic
      // diversity (number of distinct outcomes) as a mild tiebreaker.
      return phenotypes.length;
    };
  }, [goal, targetMorph, priceMap]);

  // The heavy lifting: build every candidate pairing, predict, score, and
  // attach risk warnings. Capped so we never grind the browser to a halt.
  const results = useMemo(() => {
    if (males.length === 0 || females.length === 0) return { rows: [], capped: false };

    const totalPairs = males.length * females.length;
    const capped = totalPairs > PAIR_EVAL_CAP;

    // When over the cap, evaluate lazily: a single selected sire against
    // all dams, or (if "all") the first sire as a sensible default.
    let sireList = males;
    if (capped) {
      const chosen =
        selectedSireId !== 'all' ? males.find((m) => m.id === selectedSireId) : males[0];
      sireList = chosen ? [chosen] : [males[0]];
    }

    const rows = [];
    for (const sire of sireList) {
      const sireAnimal = buildAnimal(sire);
      for (const dam of females) {
        let prediction;
        try {
          prediction = predict(sireAnimal, buildAnimal(dam));
        } catch (e) {
          console.warn('predict failed for pair', sire.id, dam.id, e);
          continue;
        }
        const phenotypes = prediction.offspring_phenotypes || [];
        const warnings = detectRisks(prediction) || [];
        const blocked = isBlocked(warnings);

        const score = scoreDistribution(phenotypes);

        const top = [...phenotypes]
          .sort((a, b) => b.probability - a.probability)
          .slice(0, 3)
          .map((p) => ({
            label: displayText(p.phenotype_description) || 'Wild-type',
            percent: Math.round(p.probability * 1000) / 10,
            risk: p.health_risk,
          }));

        rows.push({
          sire,
          dam,
          score,
          top,
          warnings,
          blocked,
        });
      }
    }

    // Goal-specific filtering and ranking.
    let filtered = rows;
    if (goal === 'safe') {
      filtered = rows.filter((r) => r.warnings.length === 0);
    }

    filtered.sort((a, b) => {
      // Blocked pairings sink to the bottom unless the user opted in.
      if (a.blocked !== b.blocked) return a.blocked ? 1 : -1;
      return b.score - a.score;
    });

    return { rows: filtered, capped };
  }, [males, females, goal, scoreDistribution, selectedSireId]);

  const visibleRows = useMemo(() => {
    const rows = showRisky ? results.rows : results.rows.filter((r) => !r.blocked);
    return rows.slice(0, 40);
  }, [results, showRisky]);

  const blockedCount = useMemo(
    () => results.rows.filter((r) => r.blocked).length,
    [results]
  );

  if (authChecked && !user) {
    return (
      <Suspense
        fallback={
          <div className="min-h-screen bg-slate-950 flex items-center justify-center">
            <LoadingSpinner />
          </div>
        }
      >
        <LoginPortal requiredFeature="Pairing Planner" />
      </Suspense>
    );
  }

  const hasEnoughStock = males.length >= 1 && females.length >= 1;

  return (
    <div className="p-4 md:p-8 bg-slate-950 min-h-screen">
      <Seo
        title="Pairing Planner for Crested Geckos"
        description="Pick a goal and let the Pairing Planner rank every sire and dam in your crested gecko collection by predicted morph, value, or safety."
        path="/PairingPlanner"
        noIndex
        keywords={['crested gecko pairing', 'breeding planner', 'inverse genetics', 'morph calculator']}
      />
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl md:text-4xl font-bold text-slate-100 flex items-center gap-3">
            <Sparkles className="w-8 h-8 md:w-10 md:h-10 text-emerald-500" />
            Pairing Planner
          </h1>
          <p className="text-slate-400 mt-2 text-sm md:text-base">
            Tell us what you are breeding toward. We rank every possible pairing in your
            collection so you can plan the next clutch with confidence.
          </p>
        </div>

        {isLoading ? (
          <div className="text-center py-20">
            <LoadingSpinner />
          </div>
        ) : !hasEnoughStock ? (
          <EmptyState
            icon={Heart}
            title="Not enough geckos to plan a pairing"
            message="Add at least one male and one female to plan pairings. Once you have a breeding pair in your collection, the planner will rank every possible match."
          />
        ) : (
          <>
            {/* Goal + controls */}
            <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 mb-6 space-y-5">
              <div>
                <Label className="text-slate-300 text-sm mb-2 block">What is your goal?</Label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {Object.entries(GOALS).map(([key, { label, icon: Icon }]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setGoal(key)}
                      className={`flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium transition ${
                        goal === key
                          ? 'border-emerald-600 bg-emerald-900/40 text-emerald-200'
                          : 'border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-600'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {goal === 'morph' && (
                <div>
                  <Label className="text-slate-300 text-sm mb-2 block">
                    Which morph are you chasing?
                  </Label>
                  <Select value={targetMorph} onValueChange={setTargetMorph}>
                    <SelectTrigger className="w-full sm:w-80 bg-slate-800 border-slate-600">
                      <SelectValue placeholder="Select a trait or combo..." />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-600 text-slate-200 max-h-72">
                      {buildMorphOptions().map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {goal === 'value' && usingStaticWeights && (
                <div className="flex items-start gap-2 rounded-lg bg-amber-900/30 border border-amber-600/30 text-amber-300 p-3 text-sm">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    No community price data is available yet, so value scores use a static tier
                    weighting (relative desirability, not dollar amounts). Scores are directional,
                    not market quotes.
                  </span>
                </div>
              )}

              {results.capped && (
                <div className="space-y-2">
                  <div className="flex items-start gap-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 p-3 text-sm">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
                    <span>
                      Your collection has {males.length * females.length} possible pairings, which
                      is a lot to score at once. Pick one male to see how he matches against every
                      female in your collection.
                    </span>
                  </div>
                  <Select value={selectedSireId} onValueChange={setSelectedSireId}>
                    <SelectTrigger className="w-full sm:w-80 bg-slate-800 border-slate-600">
                      <SelectValue placeholder="Choose a male..." />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-600 text-slate-200 max-h-72">
                      <SelectItem value="all">First male (default)</SelectItem>
                      {males.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name}
                          {m.gecko_id_code ? ` (${m.gecko_id_code})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-400 pt-1">
                <span className="inline-flex items-center gap-1.5">
                  <span className="text-blue-400 font-semibold">{'♂'}</span> {males.length} male
                  {males.length === 1 ? '' : 's'}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="text-pink-400 font-semibold">{'♀'}</span> {females.length} female
                  {females.length === 1 ? '' : 's'}
                </span>
                {excludedUnsexed > 0 && (
                  <span className="text-slate-500">
                    {excludedUnsexed} unsexed gecko{excludedUnsexed === 1 ? '' : 's'} excluded
                  </span>
                )}
                {blockedCount > 0 && (
                  <label className="inline-flex items-center gap-2 ml-auto cursor-pointer">
                    <Switch checked={showRisky} onCheckedChange={setShowRisky} />
                    <span className="text-rose-300">
                      Show {blockedCount} risky pairing{blockedCount === 1 ? '' : 's'}
                    </span>
                  </label>
                )}
              </div>
            </div>

            {/* Results */}
            {goal === 'morph' && !targetMorph ? (
              <div className="text-center py-16 text-slate-400">
                Pick a target morph above to rank your pairings.
              </div>
            ) : visibleRows.length === 0 ? (
              <div className="text-center py-16 text-slate-400">
                {goal === 'safe'
                  ? 'No pairings in your collection are completely free of risk flags. Try a different goal.'
                  : goal === 'morph'
                    ? 'None of your current pairings can produce that morph. Try a different target or add new genetics to your collection.'
                    : 'No pairings to show. Adjust your goal or selection.'}
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
                {visibleRows.map((row, i) => (
                  <PairingCard key={`${row.sire.id}-${row.dam.id}`} row={row} rank={i + 1} goal={goal} usingStaticWeights={usingStaticWeights} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Thumb({ gecko, ring }) {
  return gecko.image_urls?.[0] ? (
    <img
      src={gecko.image_urls[0]}
      alt={gecko.name}
      className={`w-12 h-12 rounded-lg object-cover border ${ring}`}
      loading="lazy"
    />
  ) : (
    <div className={`w-12 h-12 rounded-lg bg-slate-700 border ${ring}`} />
  );
}

function PairingCard({ row, rank, goal, usingStaticWeights }) {
  const { sire, dam, top, warnings, blocked, score } = row;

  let scoreLabel = null;
  if (goal === 'morph') scoreLabel = `${score}% chance per egg`;
  else if (goal === 'value')
    scoreLabel = usingStaticWeights ? `Value score ${score}` : `~$${Math.round(score)} expected per egg`;

  return (
    <div
      className={`bg-slate-900 border rounded-xl p-5 ${
        blocked ? 'border-rose-700/60' : 'border-slate-700'
      }`}
    >
      <div className="flex items-center gap-3 mb-4">
        <span className="text-xs font-bold text-slate-500 w-6">#{rank}</span>
        <Thumb gecko={sire} ring="border-blue-700" />
        <div className="min-w-0 flex-1">
          <div className="text-sm text-slate-100 truncate font-medium">{sire.name}</div>
          <div className="text-[11px] text-blue-400">Sire</div>
        </div>
        <Heart className="w-4 h-4 text-slate-600 shrink-0" />
        <Thumb gecko={dam} ring="border-pink-700" />
        <div className="min-w-0 flex-1">
          <div className="text-sm text-slate-100 truncate font-medium">{dam.name}</div>
          <div className="text-[11px] text-pink-400">Dam</div>
        </div>
      </div>

      {/* Risk badges */}
      {warnings.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {blocked && (
            <Badge className="bg-rose-900/60 text-rose-200 border border-rose-700 gap-1">
              <Ban className="w-3 h-3" /> Blocked by default
            </Badge>
          )}
          {warnings.map((w) => (
            <Badge
              key={w.code}
              className={`gap-1 border ${
                w.severity === 'critical'
                  ? 'bg-rose-900/40 text-rose-200 border-rose-700'
                  : 'bg-amber-900/40 text-amber-200 border-amber-700'
              }`}
              title={displayText(w.message)}
            >
              <AlertTriangle className="w-3 h-3" />
              {displayText(w.message).split('.')[0]}
            </Badge>
          ))}
        </div>
      )}

      {/* Top outcomes */}
      <div className="space-y-1.5 mb-4">
        <div className="text-[11px] uppercase tracking-wide text-slate-500">
          Top predicted outcomes
        </div>
        {top.map((o, idx) => (
          <div key={idx} className="flex items-center gap-2 text-sm">
            <span className="text-emerald-400 font-mono text-xs w-12 shrink-0">{o.percent}%</span>
            <span className="text-slate-200 truncate flex-1">{o.label}</span>
            {o.risk === 'lethal' && (
              <span className="text-[10px] text-rose-300 shrink-0">lethal</span>
            )}
            {o.risk === 'severe' && (
              <span className="text-[10px] text-amber-300 shrink-0">severe</span>
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-slate-800">
        {scoreLabel ? (
          <span className="text-sm font-semibold text-emerald-300">{scoreLabel}</span>
        ) : (
          <span className="text-sm text-slate-400 inline-flex items-center gap-1">
            <ShieldCheck className="w-4 h-4 text-emerald-400" /> No risk flags
          </span>
        )}
        <Button
          asChild
          size="sm"
          variant="outline"
          className="border-slate-600 hover:bg-slate-800"
        >
          <a href={createPageUrl('Breeding')}>
            Plan this pairing <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </a>
        </Button>
      </div>
    </div>
  );
}
