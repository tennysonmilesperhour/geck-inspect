import { useState } from 'react';
import { format } from 'date-fns';
import { Loader2 } from 'lucide-react';
import { Egg, BreedingPlan, User } from '@/entities/all';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { todayLocalISO } from '@/lib/dateUtils';
import { DEFAULT_INCUBATION_PROFILE_ID, getEstimatedHatchDates } from '@/lib/incubationProfiles';
import { clutchSireFields, isMissingSireColumnError, SIRE_NOT_READY_MESSAGE } from '@/lib/eggSire';
import ClutchSireFields, { useDamPairings } from './ClutchSireFields';

const NO_GRADE = '__none__';

/**
 * Add a clutch with its real lay date and an optional egg grade. This is
 * the "add egg" form that used to live on the retired Breeding Pairs page
 * (step 8); the quick +1 and +2 buttons on the card still add eggs laid
 * today.
 *
 * When the dam was paired with another male before this plan, the form
 * also asks which male the clutch is from (src/lib/eggSire.js), since a
 * female can store sperm for months.
 */
export default function AddEggsDialog({ plan, sire = null, dam = null, open, onOpenChange, onAdded }) {
    const { toast } = useToast();
    const today = todayLocalISO();
    const [layDate, setLayDate] = useState(today);
    const [count, setCount] = useState('2');
    const [grade, setGrade] = useState(NO_GRADE);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [sireChoice, setSireChoice] = useState({ sireId: null, possibleSireId: null });
    const { damPlans, sires } = useDamPairings(plan, { active: open, knownGeckos: [sire, dam] });

    const reset = () => {
        setLayDate(todayLocalISO());
        setCount('2');
        setGrade(NO_GRADE);
        setError(null);
        setSireChoice({ sireId: null, possibleSireId: null });
    };

    const handleSave = async () => {
        if (!layDate) { setError('Choose the date the eggs were laid.'); return; }
        if (layDate > today) { setError('The lay date cannot be in the future.'); return; }
        setSaving(true);
        setError(null);
        try {
            const currentUser = await User.me();
            const profileId = currentUser?.incubation_temperature_range || DEFAULT_INCUBATION_PROFILE_ID;
            const expected = format(getEstimatedHatchDates(layDate, profileId).estimated, 'yyyy-MM-dd');
            const n = Number(count) || 1;
            // Only a male other than the plan's is written, so a database
            // without the egg sire columns yet still saves ordinary clutches.
            const sireFields = clutchSireFields({ plan, ...sireChoice });
            for (let i = 0; i < n; i += 1) {
                const egg = {
                    breeding_plan_id: plan.id,
                    lay_date: layDate,
                    hatch_date_expected: expected,
                    status: 'Incubating',
                };
                if (grade !== NO_GRADE) egg.grade = grade;
                if (sireFields.sire_id) egg.sire_id = sireFields.sire_id;
                if (sireFields.possible_sire_id) egg.possible_sire_id = sireFields.possible_sire_id;
                await Egg.create(egg);
            }
            // One clutch, same as the quick add buttons.
            await BreedingPlan.update(plan.id, { egg_check_count: (plan.egg_check_count || 0) + 1 });
            toast({ title: n === 1 ? 'Egg added' : `${n} eggs added` });
            reset();
            onOpenChange(false);
            onAdded?.();
        } catch (err) {
            setError(isMissingSireColumnError(err)
                ? SIRE_NOT_READY_MESSAGE
                : (err?.message || 'The eggs could not be saved. Please try again.'));
        }
        setSaving(false);
    };

    return (
        <Dialog open={open} onOpenChange={(next) => { if (!saving) { if (!next) reset(); onOpenChange(next); } }}>
            <DialogContent className="bg-slate-900 border-slate-700 text-slate-100 max-w-md w-[95vw] sm:w-full">
                <DialogHeader>
                    <DialogTitle>Add a clutch</DialogTitle>
                    <DialogDescription className="text-slate-400">
                        Record eggs with the day they were laid. The expected hatch date follows your incubation temperature setting.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                    <div>
                        <Label htmlFor="clutch-lay-date">Lay date</Label>
                        <Input
                            id="clutch-lay-date"
                            type="date"
                            value={layDate}
                            max={today}
                            onChange={(e) => setLayDate(e.target.value)}
                            className="bg-slate-800 border-slate-600"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <Label htmlFor="clutch-count">Eggs</Label>
                            <Select value={count} onValueChange={setCount}>
                                <SelectTrigger id="clutch-count" className="bg-slate-800 border-slate-600"><SelectValue /></SelectTrigger>
                                <SelectContent className="bg-slate-800 border-slate-600 text-slate-200">
                                    <SelectItem value="1">1 egg</SelectItem>
                                    <SelectItem value="2">2 eggs</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label htmlFor="clutch-grade">Egg grade (optional)</Label>
                            <Select value={grade} onValueChange={setGrade}>
                                <SelectTrigger id="clutch-grade" className="bg-slate-800 border-slate-600"><SelectValue /></SelectTrigger>
                                <SelectContent className="bg-slate-800 border-slate-600 text-slate-200">
                                    <SelectItem value={NO_GRADE}>No grade</SelectItem>
                                    <SelectItem value="A+">A+, Excellent</SelectItem>
                                    <SelectItem value="A">A, Great</SelectItem>
                                    <SelectItem value="B">B, Good</SelectItem>
                                    <SelectItem value="C">C, Fair</SelectItem>
                                    <SelectItem value="D">D, Poor</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <ClutchSireFields
                        plan={plan}
                        planSire={sire}
                        dam={dam}
                        layDate={layDate}
                        damPlans={damPlans}
                        sires={sires}
                        sireId={sireChoice.sireId}
                        possibleSireId={sireChoice.possibleSireId}
                        onChange={setSireChoice}
                        disabled={saving}
                        idPrefix="add-clutch"
                    />
                    {error && <p className="text-sm text-red-300" role="alert">{error}</p>}
                </div>
                <DialogFooter className="flex-col sm:flex-row gap-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving} className="border-slate-600 w-full sm:w-auto">Cancel</Button>
                    <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
                        {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Save clutch
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
