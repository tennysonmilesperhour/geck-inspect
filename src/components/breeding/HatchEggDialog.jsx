import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { Loader2, Sparkles } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { createPageUrl } from '@/utils';
import { parseLocalDate, todayLocalISO } from '@/lib/dateUtils';
import { isGeckoLimitError } from '@/lib/geckoLimit';
import { predictPairOutcomes } from '@/lib/genetics/pairOutcomes';
import { OTHER_OUTCOME, defaultHatchlingName, hatchDateProblem, hatchEgg } from '@/lib/hatchEgg';

const SKIP = '__skip__';

/**
 * The hatch dialog. Every place that marks an egg Hatched opens this, so
 * every hatch asks for the date, adds the same gecko and can log what
 * hatched. The saving itself lives in src/lib/hatchEgg.js.
 *
 * Props: egg, plan, sire, dam, pairEggs (every egg of the plan, for the
 * ID code and the default name), defaultDate (optional), onClose,
 * onHatched(result).
 */
export default function HatchEggDialog({ egg, plan, sire, dam, pairEggs = [], defaultDate, onClose, onHatched }) {
    const { toast } = useToast();
    const today = todayLocalISO();
    const [hatchDate, setHatchDate] = useState(defaultDate && defaultDate <= today ? defaultDate : today);
    const [name, setName] = useState(() => defaultHatchlingName(sire, dam, pairEggs));
    const [choice, setChoice] = useState(SKIP);
    const [typedOutcome, setTypedOutcome] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [limitReached, setLimitReached] = useState(false);

    const predicted = useMemo(() => predictPairOutcomes(sire, dam), [sire, dam]);
    const options = useMemo(
        () => [...new Set(predicted.filter((o) => o.health_risk !== 'lethal').map((o) => o.label).filter(Boolean))],
        [predicted],
    );
    const parentsMissing = !sire || !dam;
    const alreadyLinked = !!egg?.gecko_id;
    const dateProblem = hatchDateProblem(hatchDate, egg, today);

    const observed = options.length > 0
        ? (choice === SKIP ? '' : choice)
        : typedOutcome.trim();

    const handleSave = async () => {
        if (dateProblem || parentsMissing) return;
        setSaving(true);
        setError(null);
        setLimitReached(false);
        try {
            const result = await hatchEgg({ egg, plan, sire, dam, pairEggs, hatchDate, name, observed, predicted });
            toast({
                title: alreadyLinked ? 'Egg marked hatched' : `${result.gecko?.name || 'Hatchling'} added to your collection`,
                description: result.outcomeError
                    ? 'The hatch is saved, but "What hatched?" could not be logged. You can log it from the pairing\'s Genetics panel.'
                    : `Hatched ${format(parseLocalDate(hatchDate), 'MMM d, yyyy')}.`,
            });
            onHatched?.(result);
            onClose?.();
        } catch (err) {
            if (isGeckoLimitError(err)) {
                setLimitReached(true);
                setError(err.message);
            } else {
                setError(err?.message || 'The hatch could not be saved. Check your connection and try again.');
            }
        }
        setSaving(false);
    };

    return (
        <Dialog open={true} onOpenChange={(open) => { if (!open && !saving) onClose?.(); }}>
            <DialogContent className="bg-slate-900 border-slate-700 text-slate-100 max-w-lg w-[95vw] sm:w-full">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-emerald-400" />
                        Record a hatch
                    </DialogTitle>
                    <DialogDescription className="text-slate-400">
                        {sire?.name || 'Unknown'} x {dam?.name || 'Unknown'}
                        {egg?.lay_date ? `, egg laid ${format(parseLocalDate(egg.lay_date), 'MMM d, yyyy')}` : ''}
                    </DialogDescription>
                </DialogHeader>

                {parentsMissing ? (
                    <p className="text-sm text-amber-300 bg-amber-950/40 border border-amber-800 rounded-lg p-3">
                        This egg&apos;s breeding plan is missing its sire or dam (one may have been deleted), so the hatchling cannot be added. Edit the plan or set the egg&apos;s status another way.
                    </p>
                ) : (
                    <div className="space-y-4">
                        <div>
                            <Label htmlFor="hatch-date">Hatch date</Label>
                            <Input
                                id="hatch-date"
                                type="date"
                                value={hatchDate}
                                max={today}
                                min={egg?.lay_date ? String(egg.lay_date).slice(0, 10) : undefined}
                                onChange={(e) => setHatchDate(e.target.value)}
                                className="bg-slate-800 border-slate-600"
                            />
                            {dateProblem && hatchDate && <p className="text-xs text-red-300 mt-1">{dateProblem}</p>}
                        </div>

                        {alreadyLinked ? (
                            <p className="text-xs text-slate-400">
                                This egg is already linked to a gecko in your collection. Its hatch date will be updated to match.
                            </p>
                        ) : (
                            <div>
                                <Label htmlFor="hatch-name">Hatchling name</Label>
                                <Input
                                    id="hatch-name"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="bg-slate-800 border-slate-600"
                                />
                                <p className="text-xs text-slate-500 mt-1">
                                    Added to your collection as Unsexed, with both parents linked. You can rename it later.
                                </p>
                            </div>
                        )}

                        <div>
                            <Label htmlFor="hatch-outcome">What hatched? (optional)</Label>
                            {options.length > 0 ? (
                                <Select value={choice} onValueChange={setChoice}>
                                    <SelectTrigger id="hatch-outcome" className="bg-slate-800 border-slate-600">
                                        <SelectValue placeholder="Choose what it looks like" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-slate-800 border-slate-600 text-slate-200">
                                        <SelectItem value={SKIP}>Skip for now</SelectItem>
                                        {options.map((label) => (
                                            <SelectItem key={label} value={label}>{label}</SelectItem>
                                        ))}
                                        <SelectItem value={OTHER_OUTCOME}>Other or unsure</SelectItem>
                                    </SelectContent>
                                </Select>
                            ) : (
                                <Input
                                    id="hatch-outcome"
                                    value={typedOutcome}
                                    onChange={(e) => setTypedOutcome(e.target.value)}
                                    placeholder="e.g. Lilly White, Harlequin, Phantom"
                                    maxLength={80}
                                    className="bg-slate-800 border-slate-600"
                                />
                            )}
                            <p className="text-xs text-slate-500 mt-1">
                                Your answer goes into this pairing&apos;s prediction vs reality log, so you can see how the clutch tracks the odds.
                            </p>
                        </div>

                        {error && (
                            <div className="bg-red-900/30 border border-red-700 rounded-lg p-3 text-sm text-red-200 space-y-2" role="alert">
                                <p>{error}</p>
                                {limitReached && (
                                    <p>
                                        The egg is still marked Incubating.{' '}
                                        <Link to={createPageUrl('Membership')} className="underline text-emerald-300">See plans</Link>
                                        {' '}or archive a gecko you no longer keep, then record the hatch again.
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                )}

                <DialogFooter className="flex-col sm:flex-row gap-2">
                    <Button variant="outline" onClick={onClose} disabled={saving} className="border-slate-600 w-full sm:w-auto">
                        Cancel
                    </Button>
                    {!parentsMissing && (
                        <Button
                            onClick={handleSave}
                            disabled={saving || !!dateProblem}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white w-full sm:w-auto"
                        >
                            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            {alreadyLinked ? 'Mark hatched' : 'Mark hatched and add gecko'}
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
