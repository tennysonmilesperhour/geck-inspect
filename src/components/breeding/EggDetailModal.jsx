import { useState } from 'react';
import { Egg } from '@/entities/all';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Egg as EggIcon } from 'lucide-react';
import { differenceInDays } from 'date-fns';

export default function EggDetailModal({ egg, breedingPlan, sire, dam, onClose, onUpdate }) {
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState(null);
    const [editData, setEditData] = useState({
        lay_date: egg.lay_date,
        hatch_date_expected: egg.hatch_date_expected,
        hatch_date_actual: egg.hatch_date_actual || '',
        status: egg.status,
        grade: egg.grade || '',
    });

    const daysIncubating = differenceInDays(new Date(), new Date(egg.lay_date));
    const incubationDays = egg.status === 'Hatched' && egg.hatch_date_actual
        ? differenceInDays(new Date(egg.hatch_date_actual), new Date(egg.lay_date))
        : null;

    const handleSave = async () => {
        setIsSaving(true);
        setSaveError(null);
        try {
            // Supabase rejects empty strings for date columns and enum fields —
            // convert them to null so the update goes through.
            const updatePayload = {
                lay_date: editData.lay_date || null,
                hatch_date_expected: editData.hatch_date_expected || null,
                hatch_date_actual: editData.hatch_date_actual || null,
                status: editData.status,
                grade: editData.grade || null,
            };

            if (editData.status !== 'Incubating') {
                updatePayload.archived = true;
                updatePayload.archived_date = new Date().toISOString().split('T')[0];
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
        <Dialog open={true} onOpenChange={onClose}>
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
                        {egg.status === 'Hatched' && (
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
                                    <SelectItem value="A+">A+ — Excellent</SelectItem>
                                    <SelectItem value="A">A — Great</SelectItem>
                                    <SelectItem value="B">B — Good</SelectItem>
                                    <SelectItem value="C">C — Fair</SelectItem>
                                    <SelectItem value="D">D — Poor</SelectItem>
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

                <DialogFooter>
                    {isEditing ? (
                        <>
                            <Button variant="outline" onClick={() => setIsEditing(false)} className="border-slate-600">
                                Cancel
                            </Button>
                            <Button onClick={handleSave} disabled={isSaving}>
                                {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                Save Changes
                            </Button>
                        </>
                    ) : (
                        <>
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
    );
}