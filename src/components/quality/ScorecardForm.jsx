import { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Award, Camera, ClipboardCheck, Loader2, Save, Sparkles } from 'lucide-react';
import { Gecko, User } from '@/entities/all';
import { base44 } from '@/api/base44Client';
import { tierForScore, formatScore, patternGradeForScore } from '@/lib/quality';
import QualityBadge from '@/components/shared/QualityBadge';
import { parseLocalDate } from '@/lib/dateUtils';
import { differenceInMonths } from 'date-fns';

/**
 * ScorecardForm
 *
 * Interactive worksheet for the Geck Inspect Standard (P11 phase 2,
 * ROADMAP item 8 Option A: conformation and structure grading).
 *
 * Walks the 10 rubric criteria (0 / 0.5 / 1 point each), computes the
 * total and tier live, and saves the result to the selected gecko via
 * Gecko.update. quality_score is the source of truth; pattern_grade is
 * mirrored from the derived tier so Market Pricing aggregations keep
 * working unchanged (same convention as GeckoForm).
 *
 * Known gap: the per-criterion breakdown is NOT persisted yet. The
 * geckos table only has quality_score; the quality_score_breakdown
 * jsonb column proposed in docs/specs/P11-quality-rubric.md was never
 * migrated, and no other gecko field is intended for structured
 * scorecard data. Until that column ships, only the total is saved and
 * the worksheet opens blank on revisit.
 *
 * Anonymous visitors can still walk the rubric and see their total;
 * saving requires sign-in. Owner-reported scores are the labeled
 * dataset a future structure-grading AI trains on, which is why the
 * copy pushes consistent, honest scoring.
 *
 * Props:
 *   criteria: array of { n, name, blurb } (the RUBRIC from QualityScale)
 */

const POINT_OPTIONS = [0, 0.5, 1];

const PHOTO_ANGLES = [
  {
    name: 'Full side profile',
    detail:
      'Whole body, level with the gecko. Shows spine line, hip set, tail base, and the dorsal crest line from head to tail. This is the angle structure judging leans on hardest.',
  },
  {
    name: 'Head-on crest shot',
    detail:
      'Face the camera straight at the snout. Shows head width, crown crest fullness and left-right symmetry, eye size and clarity, and jaw line.',
  },
  {
    name: 'Top-down',
    detail:
      'Directly above the gecko. Shows bilateral pattern symmetry, pinning continuity on pinstripes, lateral pattern reach on Harlequins, and dorsal-to-lateral contrast.',
  },
];

export default function ScorecardForm({ criteria = [] }) {
  const [user, setUser] = useState(null);
  const [geckos, setGeckos] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [scores, setScores] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const sectionRef = useRef(null);

  // Deep link support: /QualityScale?geckoId=<id> preselects the gecko
  // and scrolls the worksheet into view (used by the GeckoDetail
  // "Score structure" button).
  const linkedGeckoId = useMemo(() => {
    return new URLSearchParams(window.location.search).get('geckoId') || '';
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const me = await User.me().catch(() => null);
      if (cancelled) return;
      setUser(me);
      if (me?.email) {
        const list = await Gecko.filter({ created_by: me.email }, '-created_date').catch(() => []);
        if (cancelled) return;
        setGeckos((list || []).filter((g) => !g.archived));
      }
      setIsLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (linkedGeckoId && geckos.some((g) => g.id === linkedGeckoId)) {
      setSelectedId(linkedGeckoId);
      sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [linkedGeckoId, geckos]);

  const selectedGecko = geckos.find((g) => g.id === selectedId) || null;

  const scoredCount = criteria.filter((c) => scores[c.n] != null).length;
  const allScored = criteria.length > 0 && scoredCount === criteria.length;
  const total = criteria.reduce((sum, c) => sum + (scores[c.n] ?? 0), 0);
  const roundedTotal = Math.round(total * 2) / 2;
  const tier = allScored ? tierForScore(roundedTotal) : null;

  const ageMonths = selectedGecko?.hatch_date
    ? differenceInMonths(new Date(), parseLocalDate(selectedGecko.hatch_date))
    : null;
  const underAgeFloor = ageMonths != null && ageMonths < 18;

  const setCriterionScore = (n, value) => {
    setSaveMessage(null);
    setSaveError(null);
    setScores((prev) => {
      const next = { ...prev };
      if (prev[n] === value) {
        delete next[n]; // tap again to un-score
      } else {
        next[n] = value;
      }
      return next;
    });
  };

  const handleSelectGecko = (id) => {
    setSelectedId(id);
    setSaveMessage(null);
    setSaveError(null);
  };

  const handleSave = async () => {
    if (!selectedGecko || !allScored || isSaving) return;
    setIsSaving(true);
    setSaveMessage(null);
    setSaveError(null);
    try {
      // Per-criterion breakdown is intentionally not sent: the geckos
      // table has no column for it yet (see component docblock).
      await Gecko.update(selectedGecko.id, {
        quality_score: roundedTotal,
        pattern_grade: patternGradeForScore(roundedTotal),
      });
      setGeckos((prev) =>
        prev.map((g) => (g.id === selectedGecko.id ? { ...g, quality_score: roundedTotal } : g))
      );
      const t = tierForScore(roundedTotal);
      setSaveMessage(
        `Saved. ${selectedGecko.name} is now recorded as ${t?.label} grade (${formatScore(roundedTotal)} / 10).`
      );
    } catch (err) {
      console.error('Failed to save quality score:', err);
      setSaveError('Could not save the score. Check your connection and try again.');
    }
    setIsSaving(false);
  };

  return (
    <div ref={sectionRef} id="scorecard" className="bg-slate-900 border border-slate-700 rounded-xl p-6 mb-8 scroll-mt-6">
      <div className="flex items-center gap-2 mb-2">
        <ClipboardCheck className="w-5 h-5 text-emerald-400" />
        <h2 className="text-lg font-semibold text-slate-100">Score your gecko now</h2>
      </div>
      <p className="text-slate-400 text-sm mb-5">
        The interactive worksheet. Pick a gecko from your collection, award 0, 0.5, or 1 point per criterion, and save the total straight to that gecko&apos;s record. The saved score shows as a quality badge on its card, passport, and any marketplace listing.
      </p>

      {/* Guided photo note */}
      <div className="bg-slate-950/50 border border-slate-800 rounded-lg p-4 mb-5">
        <div className="flex items-center gap-2 mb-2">
          <Camera className="w-4 h-4 text-sky-400" />
          <h3 className="text-sm font-semibold text-slate-100">Photograph before you score</h3>
        </div>
        <p className="text-slate-400 text-xs mb-3">
          Structure judging needs three angles. Shoot them in good light against a neutral backdrop, then score from the photos rather than from memory. Photos keep your scoring consistent between animals, and consistent scorecards are what a future structure grader learns from.
        </p>
        <div className="grid sm:grid-cols-3 gap-2">
          {PHOTO_ANGLES.map((a) => (
            <div key={a.name} className="border border-slate-800 rounded-lg p-3 bg-slate-900/60">
              <p className="text-xs font-semibold text-slate-200">{a.name}</p>
              <p className="text-[11px] text-slate-400 leading-relaxed mt-1">{a.detail}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Gecko selector */}
      {isLoading ? (
        <div className="flex items-center gap-2 text-slate-400 text-sm mb-5">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading your collection...
        </div>
      ) : !user ? (
        <div className="bg-slate-950/50 border border-slate-800 rounded-lg p-4 mb-5 text-sm text-slate-300">
          You can walk the rubric below without an account, but saving a score to a gecko needs one.{' '}
          <button
            type="button"
            onClick={() => base44.auth.redirectToLogin()}
            className="text-emerald-400 hover:text-emerald-300 underline"
          >
            Sign in
          </button>{' '}
          to score a gecko in your collection.
        </div>
      ) : geckos.length === 0 ? (
        <div className="bg-slate-950/50 border border-slate-800 rounded-lg p-4 mb-5 text-sm text-slate-300">
          No geckos in your collection yet. Add one in{' '}
          <Link to="/MyGeckos" className="text-emerald-400 hover:text-emerald-300 underline">My Geckos</Link>{' '}
          and come back to score it.
        </div>
      ) : (
        <div className="mb-5 space-y-3">
          <label htmlFor="scorecard-gecko" className="block text-sm font-medium text-slate-200">
            Which gecko are you scoring?
          </label>
          <select
            id="scorecard-gecko"
            value={selectedId}
            onChange={(e) => handleSelectGecko(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
          >
            <option value="">Select a gecko...</option>
            {geckos.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}{g.morphs_traits ? ` (${g.morphs_traits})` : ''}
              </option>
            ))}
          </select>

          {selectedGecko && (
            <div className="bg-slate-950/50 border border-slate-800 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <p className="text-sm text-slate-200 font-medium">{selectedGecko.name}</p>
                {selectedGecko.quality_score != null && (
                  <span className="inline-flex items-center gap-2 text-xs text-slate-400">
                    Current saved score: <QualityBadge score={selectedGecko.quality_score} size="sm" />
                    <span>(saving will overwrite it)</span>
                  </span>
                )}
              </div>
              {underAgeFloor && (
                <p className="text-xs text-amber-300 bg-amber-950/40 border border-amber-900 rounded-md px-2.5 py-1.5">
                  {selectedGecko.name} is under 18 months old. Score head, color, and pattern freely, but reduce or withhold the body structure point until structural maturity (45 g with full tail, 40 g without).
                </p>
              )}
              {selectedGecko.image_urls?.length > 0 ? (
                <div>
                  <p className="text-xs text-slate-400 mb-1.5">
                    {selectedGecko.image_urls.length} photo{selectedGecko.image_urls.length === 1 ? '' : 's'} on file. Check that the three angles above are covered; add any missing angle in{' '}
                    <Link to="/MyGeckos" className="text-emerald-400 underline">My Geckos</Link>{' '}
                    before trusting your structure points.
                  </p>
                  <div className="flex gap-1.5 flex-wrap">
                    {selectedGecko.image_urls.slice(0, 6).map((url, i) => (
                      <img
                        key={i}
                        src={url}
                        alt={`${selectedGecko.name} photo ${i + 1}`}
                        className="w-14 h-14 rounded object-cover border border-slate-800"
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-400">
                  No photos on file for this gecko yet. Add the three angles above in{' '}
                  <Link to="/MyGeckos" className="text-emerald-400 underline">My Geckos</Link>{' '}
                  first; scoring crest structure and head shape from memory is how scores drift.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* The 10 criteria */}
      <div className="space-y-3 mb-5">
        {criteria.map((c) => (
          <div key={c.n} className="border border-slate-800 rounded-lg p-3 bg-slate-950/40">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex gap-3 min-w-0 flex-1">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-800 border border-slate-700 text-slate-300 text-[11px] font-mono flex items-center justify-center mt-0.5">
                  {c.n}
                </span>
                <div className="min-w-0">
                  <p className="text-slate-100 font-medium text-sm">{c.name}</p>
                  <p className="text-slate-400 text-xs leading-relaxed mt-0.5">{c.blurb}</p>
                </div>
              </div>
              <div className="flex gap-1.5 flex-shrink-0" role="group" aria-label={`Score for ${c.name}`}>
                {POINT_OPTIONS.map((pt) => {
                  const active = scores[c.n] === pt;
                  return (
                    <button
                      key={pt}
                      type="button"
                      onClick={() => setCriterionScore(c.n, pt)}
                      aria-pressed={active}
                      className={`w-12 h-9 rounded-md border text-sm font-mono font-semibold transition-colors ${
                        active
                          ? 'bg-emerald-600 border-emerald-500 text-white'
                          : 'bg-slate-800/40 border-slate-700 text-slate-400 hover:bg-slate-800'
                      }`}
                    >
                      {pt === 0.5 ? '0.5' : pt}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Running total + save */}
      <div className="bg-slate-950/50 border border-slate-800 rounded-lg p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm">
            <Sparkles className="w-4 h-4 text-amber-400" />
            {allScored ? (
              <span className="inline-flex items-center gap-2">
                <span className="text-slate-200">
                  Total: <span className="font-mono font-semibold text-slate-100">{formatScore(roundedTotal)} / 10</span>
                </span>
                {tier && (
                  <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${tier.chipBg} ${tier.chipBorder} ${tier.chipText}`}>
                    <Award size={12} /> {tier.label} grade
                  </span>
                )}
              </span>
            ) : (
              <span className="text-slate-400">
                {scoredCount} of {criteria.length} criteria scored
                {scoredCount > 0 && (
                  <span className="font-mono text-slate-300"> ({formatScore(roundedTotal)} so far)</span>
                )}
              </span>
            )}
          </div>
          {user && geckos.length > 0 && (
            <button
              type="button"
              onClick={handleSave}
              disabled={!selectedGecko || !allScored || isSaving}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white text-sm font-semibold px-4 py-2 transition-colors"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {isSaving ? 'Saving...' : 'Save score to this gecko'}
            </button>
          )}
        </div>
        {!allScored && user && (
          <p className="text-xs text-slate-500">
            Score all {criteria.length} criteria to save. Partial scorecards aren&apos;t saved because half-filled totals would poison the dataset.
          </p>
        )}
        {saveMessage && <p className="text-sm text-emerald-400">{saveMessage}</p>}
        {saveError && <p className="text-sm text-red-400">{saveError}</p>}

        {/* Self-grade disclaimer */}
        <p className="text-[11px] text-slate-500 leading-relaxed border-t border-slate-800 pt-3">
          Scores are owner-reported for now. Nobody at Geck Inspect verifies a self-score, so be honest: optimistic grading mostly hurts your own pricing. Every consistent scorecard you save also builds the labeled dataset that will train the Geck Inspect structure AI, the first grader built specifically for crested gecko structure. Score the same way every time and your data teaches it well.
        </p>
      </div>
    </div>
  );
}
