import GeckoImage from '@/components/shared/GeckoImage';
import { useEffect, useState } from 'react';
import { ArrowRight, ExternalLink, Flame, Loader2, Share2, Target, Trophy } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/use-toast';
import PriceBandBar from '@/components/market/PriceBandBar';
import { captureEvent } from '@/lib/posthog';
import {
  formatUsd,
  gameShareText,
  loadPriceGame,
  morphLabel,
  positionLabel,
  scoreWord,
  sexAgeLabel,
  shortDay,
  submitGuess,
  submitPrediction,
} from '@/lib/marketHabit';

function Dots({ rounds, current, onPick }) {
  return (
    <div className="flex items-center gap-1.5">
      {rounds.map((r) => (
        <button
          key={r.slot}
          type="button"
          onClick={() => r.guessed && onPick(r.slot)}
          disabled={!r.guessed}
          aria-label={r.guessed ? `Gecko ${r.slot}, ${r.score} points` : `Gecko ${r.slot}, not played yet`}
          className={`h-2.5 rounded-full transition-all ${r.slot === current ? 'w-6' : 'w-2.5'} ${
            !r.guessed ? 'bg-slate-700' : r.score >= 85 ? 'bg-emerald-400' : r.score >= 50 ? 'bg-amber-300' : 'bg-slate-400'
          }`}
        />
      ))}
    </div>
  );
}

function Reveal({ round, sellsQuestion, onPredicted }) {
  const [saving, setSaving] = useState(false);

  const predict = async (sells) => {
    setSaving(true);
    try {
      const stats = await submitPrediction(round.slot, sells);
      onPredicted(round.slot, sells, stats);
    } catch (err) {
      toast({ title: 'Could not save your answer', description: err.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-slate-500">Asking price</p>
          <p className="text-2xl font-bold text-amber-300">{formatUsd(round.price)}</p>
        </div>
        <div className="text-right">
          <p className="text-[11px] uppercase tracking-wider text-slate-500">Your guess</p>
          <p className="text-2xl font-bold text-sky-300">{formatUsd(round.guess)}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Badge className="bg-emerald-600 text-white border-0">{round.score} points</Badge>
        <span className="text-sm text-slate-300">{scoreWord(round.score)}</span>
      </div>
      <PriceBandBar
        price={round.price}
        guess={round.guess}
        p25={round.similar_p25}
        p50={round.similar_p50}
        p75={round.similar_p75}
      />
      {round.price_position && (
        <p className="text-xs text-slate-400">
          {positionLabel(round.price_position)}
          {Number(round.compared_n) > 0 && round.compared_trait
            ? `, against ${round.compared_n} similar ${round.compared_trait} listings.`
            : '.'}
          {' '}Amber marks the asking price, blue your guess.
        </p>
      )}

      {sellsQuestion && round.predicted_sells == null && (
        <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-3">
          <p className="text-sm text-slate-200">Bonus: will it sell within 14 days?</p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            It counts as sold if the listing comes down within 14 days. Your record shows in the stats once the time is up.
          </p>
          <div className="flex gap-2 mt-2">
            <Button size="sm" variant="outline" disabled={saving} onClick={() => predict(true)}>Yes</Button>
            <Button size="sm" variant="outline" disabled={saving} onClick={() => predict(false)}>No</Button>
          </div>
        </div>
      )}
      {round.predicted_sells != null && (
        <p className="text-xs text-slate-400">
          You said it {round.predicted_sells ? 'will' : 'will not'} sell within 14 days.
        </p>
      )}

      {round.listing_url && (
        <a
          href={round.listing_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300"
        >
          Open the listing <ExternalLink className="w-3 h-3" />
        </a>
      )}
    </div>
  );
}

function RoundCard({ round, sellsQuestion, onGuessed, onPredicted, onNext, nextLabel }) {
  const [guess, setGuess] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { setGuess(''); }, [round.slot]);

  const submit = async (e) => {
    e.preventDefault();
    const value = Math.round(Number(guess));
    if (!(value >= 1 && value <= 100000)) {
      toast({ title: 'Guess a price between $1 and $100,000' });
      return;
    }
    setSaving(true);
    try {
      const res = await submitGuess(round.slot, value);
      onGuessed(res.round, res.stats);
      captureEvent('price_game_guess', { slot: round.slot, score: res.round?.score });
    } catch (err) {
      toast({ title: 'Could not save your guess', description: err.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  const label = morphLabel(round.morphs);
  const detail = [
    sexAgeLabel(round.sex_class, round.age_class),
    Number(round.weight_grams) > 0 ? `${Math.round(round.weight_grams)} g` : null,
  ].filter(Boolean).join(', ');

  return (
    <Card>
      <CardContent className="p-4 md:p-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
          <div className="aspect-square w-full overflow-hidden rounded-xl border border-slate-700 bg-slate-800">
            <GeckoImage src={round.image_url} alt={label} className="w-full h-full object-cover" />
          </div>
          <div className="space-y-3 min-w-0">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-slate-500">Gecko {round.slot} of 5</p>
              <h3 className="text-lg font-semibold text-slate-100 mt-0.5">{label}</h3>
              {detail && <p className="text-sm text-slate-400">{detail}</p>}
              {round.title && <p className="text-xs text-slate-500 mt-1 break-words">Listed as &ldquo;{round.title}&rdquo;</p>}
            </div>

            {!round.guessed ? (
              <form onSubmit={submit} className="space-y-2">
                <Label htmlFor="price-guess" className="text-slate-300">What is it listed for?</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                    <Input
                      id="price-guess"
                      type="number"
                      inputMode="numeric"
                      min="1"
                      max="100000"
                      value={guess}
                      onChange={(e) => setGuess(e.target.value)}
                      placeholder="250"
                      className="pl-7 bg-slate-800 border-slate-600"
                    />
                  </div>
                  <Button type="submit" disabled={saving || !guess} className="bg-emerald-600 hover:bg-emerald-500 text-white">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Target className="w-4 h-4" />}
                    Guess
                  </Button>
                </div>
                <p className="text-[11px] text-slate-500">
                  A real crested gecko listed in the US. One guess per gecko; the asking price shows after you guess.
                </p>
              </form>
            ) : (
              <>
                <Reveal round={round} sellsQuestion={sellsQuestion} onPredicted={onPredicted} />
                <Button onClick={onNext} className="bg-emerald-600 hover:bg-emerald-500 text-white">
                  {nextLabel} <ArrowRight className="w-4 h-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StatTile({ label, value, sub }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
      <p className="text-[11px] uppercase tracking-wider text-slate-500">{label}</p>
      <p className="text-xl font-bold text-slate-100 mt-1">{value ?? 'n/a'}</p>
      {sub && <p className="text-[11px] text-slate-500 mt-0.5">{sub}</p>}
    </div>
  );
}

function DaySummary({ day, rounds, stats, onPick }) {
  const played = rounds.filter((r) => r.guessed);
  const total = played.reduce((s, r) => s + (Number(r.score) || 0), 0);
  const right = Number(stats?.predictions_right) || 0;
  const wrong = Number(stats?.predictions_wrong) || 0;
  const pending = Number(stats?.predictions_pending) || 0;

  const share = async () => {
    const text = gameShareText(day, rounds);
    captureEvent('price_game_share', { total });
    try {
      if (navigator.share) {
        await navigator.share({ text });
        return;
      }
      await navigator.clipboard.writeText(text);
      toast({ title: 'Copied', description: 'Your score is on the clipboard.' });
    } catch {
      // The member closed the share sheet, or the clipboard is blocked.
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-5 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Trophy className="w-8 h-8 text-amber-300 shrink-0" />
            <div>
              <p className="text-sm text-slate-400">Guess the Price, {shortDay(day)}</p>
              <p className="text-3xl font-bold text-slate-100">
                {total} <span className="text-base font-normal text-slate-500">of {played.length * 100}</span>
              </p>
            </div>
          </div>
          <Button onClick={share} variant="outline">
            <Share2 className="w-4 h-4" /> Share
          </Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <StatTile
          label="Streak"
          value={stats?.streak ? `${stats.streak} ${stats.streak === 1 ? 'day' : 'days'}` : '0 days'}
          sub="Days in a row played"
        />
        <StatTile label="30-day average" value={stats?.average_score != null ? `${stats.average_score}` : null} sub="Points per gecko" />
        <StatTile label="Best day" value={stats?.best_day != null ? `${stats.best_day}` : null} sub="Of 500" />
        <StatTile label="Days played" value={stats?.days_played ?? 0} />
      </div>

      {(right + wrong + pending) > 0 && (
        <p className="text-sm text-slate-400">
          Sell calls: {right} right, {wrong} wrong{pending ? `, ${pending} still open` : ''}.
        </p>
      )}

      <Card>
        <CardContent className="p-3">
          {played.map((r) => (
            <button
              key={r.slot}
              type="button"
              onClick={() => onPick(r.slot)}
              className="w-full flex items-center justify-between gap-3 py-2 px-1 border-b border-slate-800 last:border-0 text-left hover:bg-slate-900/60 rounded"
            >
              <span className="min-w-0">
                <span className="block text-sm text-slate-100 truncate">{morphLabel(r.morphs)}</span>
                <span className="block text-[11px] text-slate-500">
                  Guessed {formatUsd(r.guess)}, asking {formatUsd(r.price)}
                </span>
              </span>
              <Badge variant="outline" className="shrink-0 border-slate-600 text-slate-200">{r.score}</Badge>
            </button>
          ))}
        </CardContent>
      </Card>
      <p className="text-[11px] text-slate-500">Five new geckos at midnight US Eastern. Everyone gets the same five.</p>
    </div>
  );
}

/**
 * Guess the Price: five real crested gecko listings a day, the same five
 * for everyone. The member guesses each asking price, then sees the real
 * one and where it sits among similar geckos. Playing it trains the same
 * eye a breeder uses to price a clutch.
 */
export default function PriceGamePanel() {
  const [game, setGame] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [slot, setSlot] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await loadPriceGame();
        if (cancelled) return;
        setGame(data);
        const firstOpen = (data?.rounds || []).find((r) => !r.guessed);
        setSlot(firstOpen ? firstOpen.slot : null);
      } catch (e) {
        if (!cancelled) setError(e);
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-slate-400 py-10 justify-center">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading today&apos;s geckos
      </div>
    );
  }
  if (error || !game) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-200">
        Today&apos;s game could not load. Try again in a minute.
      </div>
    );
  }

  const rounds = game.rounds || [];
  if (rounds.length === 0) {
    return (
      <p className="text-sm text-slate-400 py-8 text-center">
        No geckos to guess today. The game needs recent US listings with enough similar geckos to compare against.
      </p>
    );
  }

  const current = rounds.find((r) => r.slot === slot) || null;
  const nextOpen = rounds.find((r) => !r.guessed && r.slot !== slot) || null;
  const played = rounds.filter((r) => r.guessed).length;
  const soFar = rounds.reduce((s, r) => s + (r.guessed ? Number(r.score) || 0 : 0), 0);

  const onGuessed = (round, stats) => {
    setGame((prev) => ({
      ...prev,
      stats,
      rounds: prev.rounds.map((r) => (r.slot === round.slot ? round : r)),
    }));
    if (played + 1 === rounds.length) {
      captureEvent('price_game_complete', { total: soFar + (Number(round.score) || 0) });
    }
  };
  const onPredicted = (slotNo, sells, stats) => {
    setGame((prev) => ({
      ...prev,
      stats,
      rounds: prev.rounds.map((r) => (r.slot === slotNo ? { ...r, predicted_sells: sells } : r)),
    }));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Dots rounds={rounds} current={slot} onPick={setSlot} />
        <div className="flex items-center gap-3 text-sm text-slate-400">
          {Number(game.stats?.streak) > 0 && (
            <span className="inline-flex items-center gap-1">
              <Flame className="w-4 h-4 text-amber-400" /> {game.stats.streak}
            </span>
          )}
          <span>{soFar} points, {played} of {rounds.length} played</span>
        </div>
      </div>

      {current ? (
        <RoundCard
          round={current}
          sellsQuestion={game.sells_question}
          onGuessed={onGuessed}
          onPredicted={onPredicted}
          onNext={() => setSlot(nextOpen ? nextOpen.slot : null)}
          nextLabel={nextOpen ? 'Next gecko' : 'See your day'}
        />
      ) : (
        <DaySummary day={game.day} rounds={rounds} stats={game.stats} onPick={setSlot} />
      )}
    </div>
  );
}
