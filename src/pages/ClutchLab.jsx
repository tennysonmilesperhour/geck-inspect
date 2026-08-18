import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FlaskConical, Trophy, RotateCcw, ArrowRight, AlertTriangle, Egg } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Seo from '@/components/seo/Seo';
import { breadcrumbSchema, ORG_ID } from '@/lib/organization-schema';
import {
  PUZZLES,
  PUZZLES_BY_ID,
  initialBench,
  crossOptions,
  satisfiesTarget,
} from '@/lib/genetics/clutchLab';
import { REVERSE_TARGETS_BY_ID } from '@/lib/genetics/reverseSolver';
import { pct } from '@/lib/genetics/clutchMath';

/**
 * Clutch Lab at /calculator/learn: the puzzle ladder that teaches
 * crested gecko genetics by breeding for targets (the Pigeonetics
 * format on the real engine). Deterministic: a cross shows every
 * distinct possible offspring and the player picks the keeper, so the
 * lesson is the genetics, not the dice. Scored in crosses against par.
 */

const STORAGE_KEY = 'geckinspect_clutchlab_v1';

function loadProgress() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function saveProgress(progress) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // Private browsing: progress just does not persist.
  }
}

const LEARN_JSON_LD = [
  {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    '@id': 'https://geckinspect.com/calculator/learn#app',
    name: 'Clutch Lab: Crested Gecko Genetics Puzzles',
    url: 'https://geckinspect.com/calculator/learn',
    description:
      'Learn crested gecko genetics by playing: six breeding puzzles from your first Lilly White to a two-generation Phantom Frappuccino project, scored by how few crosses you need. Free, no signup.',
    applicationCategory: 'EducationalApplication',
    applicationSubCategory: 'Genetics puzzle game',
    operatingSystem: 'Web',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    creator: { '@id': ORG_ID },
  },
  breadcrumbSchema([
    { name: 'Home', path: '/' },
    { name: 'Genetic Calculator', path: '/calculator' },
    { name: 'Clutch Lab', path: '/calculator/learn' },
  ]),
];

function BenchCard({ animal, selected, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left rounded-lg border px-3 py-2 transition-colors ${
        selected
          ? 'border-purple-500/80 bg-purple-950/40'
          : 'border-slate-700 bg-slate-900/60 hover:border-slate-500'
      }`}
    >
      <p className="text-sm text-slate-100 font-medium">
        {animal.sex === 'M' ? '♂' : animal.sex === 'F' ? '♀' : ''} {animal.name}
        {!animal.starter && <span className="ml-1.5 text-[10px] text-purple-300">holdback</span>}
      </p>
      <div className="flex flex-wrap gap-1 mt-1">
        {animal.chips.map((chip) => (
          <span key={chip} className="text-[11px] bg-slate-700/60 border border-slate-600 text-slate-300 px-1.5 py-0.5 rounded">
            {chip}
          </span>
        ))}
      </div>
    </button>
  );
}

export default function ClutchLab() {
  const [progress, setProgress] = useState(loadProgress);
  const [puzzleId, setPuzzleId] = useState(null);
  const [bench, setBench] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [options, setOptions] = useState(null);
  const [crosses, setCrosses] = useState(0);
  const [forbiddenNote, setForbiddenNote] = useState('');
  const [won, setWon] = useState(false);

  const puzzle = puzzleId ? PUZZLES_BY_ID[puzzleId] : null;
  const target = puzzle ? REVERSE_TARGETS_BY_ID[puzzle.target] : null;

  const startPuzzle = (id) => {
    setPuzzleId(id);
    setBench(initialBench(PUZZLES_BY_ID[id]));
    setSelectedIds([]);
    setOptions(null);
    setCrosses(0);
    setForbiddenNote('');
    setWon(false);
  };

  const toggleSelect = (id) => {
    setForbiddenNote('');
    setOptions(null);
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      return [...prev.slice(-1), id];
    });
  };

  const runCross = () => {
    const [a, b] = selectedIds.map((id) => bench.find((x) => x.id === id));
    if (!a || !b) return;
    if (puzzle.forbidden?.test(a.genotype, b.genotype)) {
      setForbiddenNote(
        `That pairing risks ${puzzle.forbidden.description}. ${puzzle.lesson}`,
      );
      return;
    }
    setOptions(crossOptions(a.genotype, b.genotype));
    setCrosses((c) => c + 1);
  };

  const keepOffspring = (option) => {
    const holdback = {
      id: `hold-${crosses}-${bench.length}`,
      name: `Holdback ${bench.filter((x) => !x.starter).length + 1}`,
      sex: '',
      genotype: option.genotype,
      chips: option.chips,
      starter: false,
    };
    setBench((prev) => [...prev, holdback]);
    setOptions(null);
    setSelectedIds([holdback.id]);
    if (satisfiesTarget(option.genotype, puzzle.target)) {
      setWon(true);
      const best = progress[puzzle.id];
      if (!best || crosses < best) {
        const next = { ...progress, [puzzle.id]: crosses };
        setProgress(next);
        saveProgress(next);
      }
    }
  };

  const solvedCount = useMemo(
    () => PUZZLES.filter((p) => progress[p.id]).length,
    [progress],
  );

  return (
    <div className="p-4 md:p-8 bg-slate-950 min-h-screen">
      <Seo
        title="Clutch Lab: Genetics Puzzles"
        description="Learn crested gecko genetics by playing: six breeding puzzles from your first Lilly White to a two-generation Phantom Frappuccino project, scored by how few crosses you need. Free, no signup."
        path="/calculator/learn"
        imageAlt="Clutch Lab crested gecko genetics puzzles"
        keywords={[
          'learn crested gecko genetics',
          'crested gecko genetics game',
          'punnett square practice reptiles',
          'lilly white genetics explained',
          'crested gecko breeding puzzles',
        ]}
        jsonLd={LEARN_JSON_LD}
      />
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-3">
            <Link to="/" className="hover:text-slate-300">Home</Link>
            <span>/</span>
            <Link to="/calculator" className="hover:text-slate-300">Genetic Calculator</Link>
            <span>/</span>
            <span className="text-slate-400">Clutch Lab</span>
          </div>
          <h1 className="text-2xl md:text-4xl font-bold text-slate-100 flex items-center gap-3">
            <FlaskConical className="w-8 h-8 md:w-10 md:h-10 text-purple-400" />
            Clutch Lab
          </h1>
          <p className="text-slate-400 mt-2 text-sm md:text-base">
            Learn crestie genetics by breeding for a goal. Pick two animals, see every possible
            baby with its odds, keep the right one, repeat. Fewer crosses, better score. The same
            math as the real calculator, none of the waiting.
          </p>
        </div>

        {!puzzle ? (
          <div className="space-y-3">
            <p className="text-xs text-slate-500 uppercase tracking-wider">
              {solvedCount} of {PUZZLES.length} solved
            </p>
            {PUZZLES.map((p, index) => (
              <button
                key={p.id}
                type="button"
                onClick={() => startPuzzle(p.id)}
                className="w-full text-left rounded-xl border border-slate-700 bg-slate-900 hover:border-purple-600/60 p-4 transition-colors"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-slate-100 font-semibold">
                    <span className="text-slate-500 font-mono mr-2">{index + 1}</span>
                    {p.title}
                  </p>
                  {progress[p.id] ? (
                    <span className="text-xs text-emerald-300 inline-flex items-center gap-1">
                      <Trophy className="w-3.5 h-3.5" />
                      solved in {progress[p.id]} (par {p.par})
                    </span>
                  ) : (
                    <span className="text-xs text-slate-500">par {p.par}</span>
                  )}
                </div>
                <p className="text-sm text-slate-400 mt-1">{p.brief}</p>
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-slate-900 border border-slate-700 rounded-xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-slate-100 font-semibold">{puzzle.title}</p>
                  <p className="text-sm text-slate-400 mt-1">{puzzle.brief}</p>
                </div>
                <div className="text-right text-xs text-slate-500 whitespace-nowrap">
                  <p>crosses: <span className="font-mono text-slate-300">{crosses}</span></p>
                  <p>par: <span className="font-mono">{puzzle.par}</span></p>
                </div>
              </div>
              <p className="text-xs text-purple-300 mt-2">
                Goal: produce {target?.label}
              </p>
            </div>

            {won ? (
              <div className="rounded-xl border border-emerald-700 bg-emerald-950/40 p-5 space-y-3">
                <p className="text-emerald-200 font-semibold flex items-center gap-2">
                  <Trophy className="w-5 h-5" />
                  {target?.label} produced in {crosses} cross{crosses > 1 ? 'es' : ''}
                  {crosses <= puzzle.par ? ' (par or better!)' : ` (par is ${puzzle.par}, try again for the clean route)`}
                </p>
                <p className="text-sm text-emerald-100/90">{puzzle.lesson}</p>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="border-slate-600 text-slate-200" onClick={() => startPuzzle(puzzle.id)}>
                    <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Replay
                  </Button>
                  {PUZZLES[PUZZLES.findIndex((p) => p.id === puzzle.id) + 1] ? (
                    <Button size="sm" className="bg-purple-600 hover:bg-purple-700 text-white" onClick={() => startPuzzle(PUZZLES[PUZZLES.findIndex((p) => p.id === puzzle.id) + 1].id)}>
                      Next puzzle <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                    </Button>
                  ) : (
                    <Button size="sm" className="bg-purple-600 hover:bg-purple-700 text-white" onClick={() => setPuzzleId(null)}>
                      Back to the ladder
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <>
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">
                    Your bench (pick two)
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {bench.map((animal) => (
                      <BenchCard
                        key={animal.id}
                        animal={animal}
                        selected={selectedIds.includes(animal.id)}
                        onClick={() => toggleSelect(animal.id)}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Button
                    disabled={selectedIds.length !== 2}
                    onClick={runCross}
                    className="bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-40"
                  >
                    <Egg className="w-4 h-4 mr-1.5" /> Cross the pair
                  </Button>
                  <Button variant="outline" size="sm" className="border-slate-600 text-slate-300" onClick={() => startPuzzle(puzzle.id)}>
                    <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Restart
                  </Button>
                  <Button variant="outline" size="sm" className="border-slate-600 text-slate-300" onClick={() => setPuzzleId(null)}>
                    All puzzles
                  </Button>
                </div>

                {forbiddenNote && (
                  <div className="flex items-start gap-2 rounded-lg border border-amber-700 bg-amber-950/40 px-3 py-2">
                    <AlertTriangle className="w-4 h-4 text-amber-300 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-200 leading-snug">{forbiddenNote}</p>
                  </div>
                )}

                {options && (
                  <div className="bg-slate-900 border border-slate-700 rounded-xl p-4">
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">
                      Every possible baby from this pairing. Keep one.
                    </p>
                    <div className="space-y-2">
                      {options.map((option, index) => (
                        <div
                          key={index}
                          className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 ${
                            option.lethal
                              ? 'border-red-800 bg-red-950/30'
                              : 'border-slate-700 bg-slate-900/60'
                          }`}
                        >
                          <div className="flex flex-wrap gap-1 items-center min-w-0">
                            {option.chips.map((chip) => (
                              <span key={chip} className={`text-[11px] px-1.5 py-0.5 rounded border ${
                                option.lethal
                                  ? 'border-red-800 text-red-300 bg-red-950/40'
                                  : 'border-slate-600 text-slate-200 bg-slate-700/60'
                              }`}>
                                {chip}
                              </span>
                            ))}
                            {option.lethal && (
                              <span className="text-[11px] text-red-400">does not survive the egg</span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 whitespace-nowrap">
                            <span className="text-xs font-mono text-slate-400">{pct(option.p)}</span>
                            {!option.lethal && (
                              <Button size="sm" variant="outline" className="border-purple-700 text-purple-200 hover:bg-purple-950/50 h-7 text-xs" onClick={() => keepOffspring(option)}>
                                Keep
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        <p className="text-xs text-slate-600 mt-8">
          Odds shown are real Punnett probabilities from the calculator's engine. In the Lab you
          choose which baby to keep; in a real season, the eggs choose. The{' '}
          <Link to="/calculator" className="underline text-slate-500">calculator</Link> and its
          hatch simulator show what that difference feels like.
        </p>
      </div>
    </div>
  );
}
