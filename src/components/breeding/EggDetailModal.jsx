import { useState } from 'react';
import { Egg, Gecko } from '@/entities/all';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Egg as EggIcon, Trash2 } from 'lucide-react';
import { differenceInDays } from 'date-fns';
import { todayLocalISO, parseLocalDate } from '@/lib/dateUtils';
import { eggStatusFields } from '@/lib/hatchEgg';
import HatchEggDialog from './HatchEggDialog';
import DeleteEggDialog from './DeleteEggDialog';

export default function EggDetailModal({ egg, breedingPlan, sire, dam, pairEggs = [], onClose, onUpdate }) {
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState(null);
    // Choosing Hatched goes through the shared hatch dialog, which asks
    // for the date, adds the gecko and logs what hatched.
    const [hatchingEgg, setHatchingEgg] = useState(null);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [editData, setEditData] = useState({
        lay_date: egg.lay_date,
        hatch_date_expected: egg.hatch_date_expected,
        hatch_date_actual: egg.hatch_date_actual || '',
        status: egg.status,
        grade: egg.grade || '',
    });

    const becomingHatched = editData.status === 'Hatched' && egg.status !== 'Hatched';
    const daysIncubating = differenceInDays(new Date(), parseLocalDate(egg.lay_date));
    const incubationDays = egg.status === 'Hatched' && egg.hatch_date_actual
        ? differenceInDays(parseLocalDate(egg.hatch_date_actual), parseLocalDate(egg.lay_date))
        : null;

    const handleSave = async () => {
        setIsSaving(true);
        setSaveError(null);
        try {
            // Supabase rejects empty strings for date columns and enum fields,
            // convert them to null so the update goes through.
            const updatePayload = {
                lay_date: editData.lay_date || null,
                hatch_date_expected: editData.hatch_date_expected || null,
                grade: editData.grade || null,
            };

            if (becomingHatched) {
                // Save the other edits, then hand over to the hatch dialog.
                const saved = await Egg.update(egg.id, updatePayload);
                setHatchingEgg({ ...egg, ...updatePayload, ...(saved || {}) });
                setIsSaving(false);
                return;
            }

            if (editData.status === 'Hatched') {
                // Already hatched: only the hatch date can change. Keep the
                // linked gecko's hatch date the same as the egg's.
                const newDate = editData.hatch_date_actual || null;
                if (!newDate) throw new Error('A hatched egg needs its hatch date.');
                if (newDate > todayLocalISO()) throw new Error('The hatch date cannot be in the future.');
                updatePayload.hatch_date_actual = newDate;
                if (egg.gecko_id && newDate !== egg.hatch_date_actual) {
                    await Gecko.update(egg.gecko_id, { hatch_date: newDate }).catch((err) =>
                        console.warn('Could not update the hatchling\'s hatch date:', err));
                }
            } else if (editData.status !== egg.status || (editData.status === 'Incubating' && egg.archived)) {
                Object.assign(updatePayload, eggStatusFields(editData.status));
            }

            await Egg.update(egg.id, updatePayload);
            onUpdate();
            onClose();
        } catch (error) {
            console.error("Failed to update egg:", error);
            setSaveError(error?.message || 'Failed to save changes. Please try again.');
        }
        setIsSaving(false);
    };

    return (
        <>
        <Dialog open={!hatchingEgg && !isDeleteOpen} onOpenChange={onClose}>
            <DialogContent className="bg-slate-900 border-slate-700 text-slate-100 max-w-2xl w-[95vw] sm:w-full">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <EggIcon className="w-6 h-6 text-emerald-400" />
                        Egg Details
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Parents */}
                    <div className="bg-slate-800 p-4 rounded-lg">
                        <h3 className="text-sm font-semibold text-slate-300 mb-2">Parents</h3>
                        <p className="text-slate-200">{sire?.name || 'Unknown'} × {dam?.name || 'Unknown'}</p>
                        {breedingPlan?.breeding_id && (
                            <p className="text-xs text-slate-400">Plan: {breedingPlan.breeding_id}</p>
                        )}
                    </div>

                    {/* Hatched before the shared hatch flow existed, the edit
                        dialog marked eggs Hatched without adding a gecko. */}
                    {egg.status === 'Hatched' && !egg.gecko_id && !isEditing && (
                        <div className="bg-amber-950/40 border border-amber-800 p-4 rounded-lg space-y-2">
                            <p className="text-sm text-amber-200">This egg is marked hatched, but no gecko was added to your collection for it.</p>
                            <Button size="sm" onClick={() => setHatchingEgg(egg)} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                                Add the hatchling
                            </Button>
                        </div>
                    )}

                    {/* Incubation Info */}
                    <div className="bg-slate-800 p-4 rounded-lg">
                        <h3 className="text-sm font-semibold text-slate-300 mb-2">Incubation</h3>
                        {egg.status === 'Incubating' ? (
                            <p className="text-emerald-400 text-lg font-semibold">Day {daysIncubating}</p>
                        ) : incubationDays !== null ? (
                            <p className="text-blue-400 text-lg font-semibold">{incubationDays} days incubated</p>
                        ) : null}
                    </div>

                    {/* Dates */}
                    <div className="space-y-3">
                        <div>
                            <Label>Lay Date</Label>
                            <Input
                                type="date"
                                value={editData.lay_date}
                                onChange={(e) => setEditData({ ...editData, lay_date: e.target.value })}
                                disabled={!isEditing}
                                className="bg-slate-800 border-slate-600"
                            />
                        </div>
                        <div>
                            <Label>Expected Hatch Date</Label>
                            <Input
                                type="date"
                                value={editData.hatch_date_expected}
                                onChange={(e) => setEditData({ ...editData, hatch_date_expected: e.target.value })}
                                disabled={!isEditing}
                                className="bg-slate-800 border-slate-600"
                            />
                        </div>
                        {becomingHatched && (
                            <p className="text-xs text-emerald-300">
                                Saving opens the hatch dialog, where you choose the hatch date, add the hatchling to your collection and note what hatched.
                            </p>
                        )}
                        {egg.status === 'Hatched' && editData.status === 'Hatched' && (
                            <div>
                                <Label>Actual Hatch Date</Label>
                                <Input
                                    type="date"
                                    value={editData.hatch_date_actual}
                                    onChange={(e) => setEditData({ ...editData, hatch_date_actual: e.target.value })}
                                    disabled={!isEditing}
                                    className="bg-slate-800 border-slate-600"
                                />
                            </div>
                        )}
                    </div>

                    {/* Status & Grade */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <Label>Status</Label>
                            <Select
                                value={editData.status}
                                onValueChange={(v) => setEditData({ ...editData, status: v })}
                                disabled={!isEditing}
                            >
                                <SelectTrigger className="bg-slate-800 border-slate-600">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-slate-800 border-slate-600">
                                    <SelectItem value="Incubating">Incubating</SelectItem>
                                    <SelectItem value="Hatched">Hatched</SelectItem>
                                    <SelectItem value="Slug">Slug</SelectItem>
                                    <SelectItem value="Infertile">Infertile</SelectItem>
                                    <SelectItem value="Stillbirth">Stillbirth</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Egg Grade</Label>
                            <Select
                                value={editData.grade || ''}
                                onValueChange={(v) => setEditData({ ...editData, grade: v })}
                                disabled={!isEditing}
                            >
                                <SelectTrigger className="bg-slate-800 border-slate-600">
                                    <SelectValue placeholder="No grade" />
                                </SelectTrigger>
                                <SelectContent className="bg-slate-800 border-slate-600">
                                    <SelectItem value="A+">A+, Excellent</SelectItem>
                                    <SelectItem value="A">A, Great</SelectItem>
                                    <SelectItem value="B">B, Good</SelectItem>
                                    <SelectItem value="C">C, Fair</SelectItem>
                                    <SelectItem value="D">D, Poor</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {saveError && (
                        <div className="bg-red-900/30 border border-red-700 rounded-lg p-3 text-sm text-red-300">
                            {saveError}
                        </div>
                    )}
                </div>

                <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
                    {isEditing ? (
                        <>
                            <Button variant="outline" onClick={() => setIsEditing(false)} className="border-slate-600">
                                Cancel
                            </Button>
                            <Button onClick={handleSave} disabled={isSaving}>
                                {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                {becomingHatched ? 'Save and record hatch' : 'Save Changes'}
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button
                                variant="outline"
                                onClick={() => setIsDeleteOpen(true)}
                                className="border-red-800 text-red-300 hover:bg-red-950 sm:mr-auto"
                            >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete egg
                            </Button>
                            <Button variant="outline" onClick={onClose} className="border-slate-600">
                                Close
                            </Button>
                            <Button onClick={() => setIsEditing(true)}>
                                Edit
                            </Button>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
        {hatchingEgg && (
            <HatchEggDialog
                egg={hatchingEgg}
                plan={breedingPlan}
                sire={sire}
                dam={dam}
                pairEggs={pairEggs}
                defaultDate={editData.hatch_date_actual || egg.hatch_date_actual || undefined}
                onClose={() => {
                    // Cancelled or done: the other edits were saved either way.
                    setHatchingEgg(null);
                    onUpdate();
                    onClose();
                }}
            />
        )}
        <DeleteEggDialog
            egg={isDeleteOpen ? egg : null}
            onClose={() => setIsDeleteOpen(false)}
            onDeleted={() => {
                setIsDeleteOpen(false);
                onUpdate();
                onClose();
            }}
        />
        </>
    );
}