import { useState, useEffect } from 'react';
import { Gecko, Egg, BreedingPlan, User } from '@/entities/all';
import { Button } from '@/components/ui/button';
import { CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Edit, Trash2, Egg as EggIcon, Calendar as CalendarIcon } from 'lucide-react';
import { format, addDays, differenceInDays } from 'date-fns';
import { generateHatchedGeckoIdFromEgg } from '@/components/shared/geckoIdUtils';

/**
 * Expanded-state view of a single breeding plan — shows all eggs with
 * editable lay/hatch dates, status dropdowns, and the Edit Plan modal.
 * Extracted from src/pages/Breeding.jsx as part of the hairball cleanup.
 * Body unchanged; only the imports are new.
 */
export default function PlanDetails({ plan, geckos, onPlanUpdate, onPlanDelete, onOpenCopulationModal, onOpenEggCheckModal, planEggs, isEditModalOpen, setIsEditModalOpen }) {
    const eggs = planEggs.filter(egg => !egg.archived).sort((a, b) => new Date(b.lay_date) - new Date(a.lay_date));
    const [editedPlan, setEditedPlan] = useState(plan);
    const [editingHatchDate, setEditingHatchDate] = useState(null); // eggId to edit
    const [editedEggs, setEditedEggs] = useState({});

    useEffect(() => {
        setEditedPlan(plan);
    }, [plan]);

    const [eggToDelete, setEggToDelete] = useState(null);

    const handleDeleteEgg = (eggId) => {
        setEggToDelete(eggId);
    };

    const handleConfirmDeleteEgg = async () => {
        if (!eggToDelete) return;
        try {
            await Egg.update(eggToDelete, {
                archived: true,
                archived_date: new Date().toISOString().split('T')[0]
            });
            onPlanUpdate();
        } catch (error) {
            console.error("Failed to archive egg:", error);
        }
        setEggToDelete(null);
    };

    const _handleAddNewEggs = async (count) => {
        const today = new Date();
        const newLayDate = today.toISOString().split('T')[0];

        // Load user preferences for hatch alert days
        const currentUser = await User.me();
        const hatchAlertDays = currentUser?.hatch_alert_days || 60;
        const expectedHatch = addDays(today, hatchAlertDays);

        try {
            for (let i = 0; i < count; i++) {
                await Egg.create({
                    breeding_plan_id: plan.id,
                    lay_date: newLayDate,
                    hatch_date_expected: expectedHatch.toISOString().split('T')[0],
                    status: 'Incubating'
                });
            }

            // Update egg check count
            const newCount = (plan.egg_check_count || 0) + 1;
            await BreedingPlan.update(plan.id, { egg_check_count: newCount });

            onPlanUpdate();
        } catch (error) {
            console.error("Failed to add eggs:", error);
        }
    };

    const handleUpdateEggStatus = async (eggId, status) => {
        const updateData = { status };
        const currentEgg = eggs.find(e => e.id === eggId);

        // Auto-archive any egg that isn't incubating
        if (status !== 'Incubating') {
            updateData.archived = true;
            updateData.archived_date = new Date().toISOString().split('T')[0];
        }

        if (status === 'Hatched' && currentEgg?.status !== 'Hatched') {
            const hatchDate = new Date().toISOString().split('T')[0];
            updateData.hatch_date_actual = hatchDate;

            // Create gecko automatically if not already linked
            if (!currentEgg.gecko_id) {
                try {
                    const sire = geckos.find(g => g.id === plan.sire_id);
                    const dam = geckos.find(g => g.id === plan.dam_id);

                    // Pull every egg for this plan so generateHatchedGeckoIdFromEgg
                    // can group by clutch (lay_date) and derive offspring number
                    // + egg letter for the new ID format.
                    const allEggs = await Egg.filter({ breeding_plan_id: plan.id });

                    // Simple 1-based offspring number for the human-readable name
                    // — the ID code carries the authoritative sequence.
                    const hatchedEggsWithGeckos = allEggs.filter(e => e.status === 'Hatched' && e.gecko_id);
                    const offspringNumber = hatchedEggsWithGeckos.length + 1;

                    // Generate name: SireName x DamName #1
                    const geckoName = `${sire?.name || 'Unknown'} x ${dam?.name || 'Unknown'} #${offspringNumber}`;

                    // New April 2026 format: (SiFirst2)(DaFirst2)(offspringNum)(egg letter)(YY)
                    const geckoIdCode = generateHatchedGeckoIdFromEgg({
                        sire,
                        dam,
                        egg: currentEgg,
                        allEggsForPair: allEggs,
                    });

                    // Calculate incubation days
                    const incubationDays = differenceInDays(new Date(hatchDate), new Date(currentEgg.lay_date));

                    // Create the gecko
                    const newGecko = await Gecko.create({
                        name: geckoName,
                        gecko_id_code: geckoIdCode,
                        hatch_date: hatchDate,
                        sex: 'Unsexed', // Default to unsexed, can be updated later
                        sire_id: plan.sire_id,
                        dam_id: plan.dam_id,
                        status: 'Pet', // Default to pet, can be updated later
                        notes: `Hatched from breeding plan: ${plan.breeding_id || plan.id}`,
                        incubation_days: incubationDays
                    });

                    // Link gecko to egg
                    updateData.gecko_id = newGecko.id;

                    // Notify any listening pages (MyGeckos in particular)
                    // that the user's gecko list has changed, so caches can
                    // invalidate and the new gecko shows up on navigation.
                    window.dispatchEvent(new CustomEvent('geckos_changed', {
                        detail: { action: 'created', geckoId: newGecko.id }
                    }));
                } catch (error) {
                    console.error("Failed to create gecko:", error);
                    // Decide whether to proceed with egg status update if gecko creation fails
                    // For now, we'll log and continue to update egg status
                }
            }
        }

        try {
            await Egg.update(eggId, updateData);
            onPlanUpdate();
        } catch (error) {
            console.error("Failed to update egg status:", error);
        }
    };

    const handleUpdateHatchDate = async (eggId, newDate) => {
        if (!newDate) {
            setEditingHatchDate(null);
            return;
        }
        try {
            await Egg.update(eggId, { hatch_date_actual: newDate });
            setEditingHatchDate(null);
            onPlanUpdate();
        } catch (error) {
            console.error("Failed to update hatch date:", error);
        }
    };

    const handleHatchEgg = async (eggId) => {
        await handleUpdateEggStatus(eggId, 'Hatched');
    };

    const handleAddToCalendar = async (egg) => {
        try {
            const sire = geckos.find(g => g.id === plan.sire_id);
            const dam = geckos.find(g => g.id === plan.dam_id);

            const title = `Gecko Egg Hatching - ${sire?.name || 'Unknown Sire'} x ${dam?.name || 'Unknown Dam'}`;
            const description = `Expected hatch date for egg laid on ${format(new Date(egg.lay_date), 'MMM dd, yyyy')}`;
            const startDate = new Date(egg.hatch_date_expected);

            const encodedTitle = encodeURIComponent(title);
            const encodedDescription = encodeURIComponent(description);
            const formatDate = (date) => date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
            const startFormatted = formatDate(startDate);
            const endFormatted = formatDate(addDays(startDate, 1));

            const calendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodedTitle}&dates=${startFormatted}/${endFormatted}&details=${encodedDescription}`;

            window.open(calendarUrl, '_blank');
        } catch (error) {
            console.error("Failed to generate calendar event:", error);
        }
    };


    const handleUpdatePlan = async () => {
        await onPlanUpdate(editedPlan);
        setIsEditModalOpen(false);
    };

    const handleSaveEggEdit = async (eggId, eggData) => {
        await Egg.update(eggId, { lay_date: eggData.lay_date, hatch_date_expected: eggData.hatch_date_expected });
        setEditedEggs(prev => ({ ...prev, [eggId]: {} }));
        onPlanUpdate();
    };

    const handleCancelEggEdit = (eggId) => {
        setEditedEggs(prev => ({ ...prev, [eggId]: {} }));
    };

    const handleEggFieldChange = (eggId, field, value) => {
        setEditedEggs(prev => ({ ...prev, [eggId]: { ...prev[eggId], [field]: value } }));
    };

    const handleStartEggEdit = (egg) => {
        setEditedEggs(prev => ({ ...prev, [egg.id]: { editing: true, lay_date: egg.lay_date, hatch_date_expected: egg.hatch_date_expected } }));
    };

    const StatusDisplay = ({ egg }) => {
        if (editingHatchDate === egg.id) {
            return (
                <Input
                    type="date"
                    defaultValue={egg.hatch_date_actual ? format(new Date(egg.hatch_date_actual), 'yyyy-MM-dd') : ''}
                    onBlur={(e) => handleUpdateHatchDate(egg.id, e.target.value)}
                    autoFocus
                    className="bg-slate-800 border-slate-600 h-9 w-full"
                />
            );
        }

        const statusConfig = {
            'Hatched': {
                className: "bg-transparent text-green-400 border-green-400 hover:bg-green-900/20",
                text: egg.hatch_date_actual ? `Hatched ${format(new Date(egg.hatch_date_actual), 'MM/dd/yy')}` : 'Hatched'
            },
            'Incubating': {
                className: "bg-transparent text-blue-400 border-blue-400 hover:bg-blue-900/20",
                text: "Incubating"
            },
            'Slug': {
                className: "bg-transparent text-red-400 border-red-400 hover:bg-red-900/20",
                text: "Slug"
            },
            'Infertile': {
                className: "bg-transparent text-red-400 border-red-400 hover:bg-red-900/20",
                text: "Infertile"
            },
            'Stillbirth': {
                className: "bg-transparent text-slate-400 border-slate-400 hover:bg-slate-700/20",
                text: "Stillbirth"
            }
        };

        const config = statusConfig[egg.status] || { className: "bg-transparent text-slate-400 border-slate-400", text: egg.status };
        const baseClasses = "cursor-pointer text-xs font-semibold px-3 py-2 rounded-md border w-full text-center h-9 truncate transition-colors flex items-center justify-center";

        // Only Incubating eggs get the dropdown (limited to Infertile/Failed)
        if (egg.status === 'Incubating') {
            return (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button className={`${baseClasses} ${config.className}`}>
                            {config.text}
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="bg-slate-800 border-slate-600 text-slate-200 z-50">
                        <DropdownMenuItem onClick={() => handleUpdateEggStatus(egg.id, 'Infertile')}>Infertile</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleUpdateEggStatus(egg.id, 'Slug')}>Failed / Slug</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            );
        }

        return (
            <div className={`${baseClasses} ${config.className}`}>{config.text}</div>
        );
    };

    return (
        <CardContent className="border-t border-slate-700 p-4 md:p-6">
            <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-3">
                <div className="flex flex-wrap gap-2 w-full sm:w-auto items-center justify-end ml-auto">
                   <Button variant="outline" size="sm" className="border-slate-600 hover:bg-slate-800 h-9" onClick={onOpenCopulationModal}>
                       Record Lock
                   </Button>
                   <Button variant="outline" size="sm" className="border-emerald-600 text-emerald-400 hover:bg-emerald-900/20 h-9" onClick={onOpenEggCheckModal}>
                       {plan.egg_check_day ? 'Edit' : 'Set'} Egg Check
                   </Button>
                   <Button variant="outline" size="sm" className="border-emerald-700 hover:bg-emerald-900 h-9 text-emerald-300" onClick={() => setIsEditModalOpen(true)}>
                       <Edit size={14} className="mr-2"/> Edit Plan
                   </Button>
                </div>
            </div>

            {eggs.length > 0 ? (
                <div className="space-y-4">
                    {eggs.map(egg => {
                        const eggEdit = editedEggs[egg.id] || {};
                        const isEditingEgg = !!eggEdit.editing;
                        return (
                        <div key={egg.id} className="bg-slate-800 p-4 rounded-lg space-y-3">
                            {/* Egg Info Section */}
                            <div className="flex items-start gap-3">
                                <EggIcon className="w-6 h-6 text-emerald-400 flex-shrink-0 mt-1" />
                                <div className="flex-1 min-w-0">
                                    {isEditingEgg ? (
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-2">
                                                <Label className="text-xs text-slate-400 w-24">Lay Date:</Label>
                                                <Input type="date" className="bg-slate-700 border-slate-600 h-8 text-sm"
                                                    value={eggEdit.lay_date || egg.lay_date}
                                                    onChange={e => handleEggFieldChange(egg.id, 'lay_date', e.target.value)}
                                                />
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Label className="text-xs text-slate-400 w-24">Expected Hatch:</Label>
                                                <Input type="date" className="bg-slate-700 border-slate-600 h-8 text-sm"
                                                    value={eggEdit.hatch_date_expected || egg.hatch_date_expected}
                                                    onChange={e => handleEggFieldChange(egg.id, 'hatch_date_expected', e.target.value)}
                                                />
                                            </div>
                                            <div className="flex gap-2">
                                                <Button size="sm" className="h-7 text-xs" onClick={() => handleSaveEggEdit(egg.id, eggEdit)}>Save</Button>
                                                <Button size="sm" variant="outline" className="border-slate-600 h-7 text-xs" onClick={() => handleCancelEggEdit(egg.id)}>Cancel</Button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                            <div>
                                                <p className="text-slate-200 text-sm font-medium">Laid: {format(new Date(egg.lay_date), 'MMM dd, yyyy')}</p>
                                                <p className="text-xs text-slate-400">Expected Hatch: {format(new Date(egg.hatch_date_expected), 'MMM dd, yyyy')}</p>
                                                {egg.gecko_id && (
                                                    <p className="text-xs text-green-400 mt-1">✓ Gecko created in collection</p>
                                                )}
                                            </div>
                                            <Button size="sm" variant="ghost" className="text-slate-400 hover:text-slate-200 h-7 text-xs px-2" onClick={() => handleStartEggEdit(egg)}>
                                                <Edit size={12} className="mr-1" /> Edit
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Status and Actions — single flex row so everything
                                stays aligned side by side. StatusDisplay and
                                Hatched! stretch to fill; icon buttons stay fixed. */}
                            <div className="flex items-center gap-2">
                                <div className="flex-1 min-w-0">
                                    <StatusDisplay egg={egg} />
                                </div>

                                {egg.status === 'Incubating' && (
                                    <Button
                                        size="sm"
                                        className="h-9 flex-1"
                                        onClick={() => handleHatchEgg(egg.id)}
                                    >
                                        Hatched!
                                    </Button>
                                )}
                                <Button
                                    size="icon"
                                    variant="outline"
                                    onClick={() => handleAddToCalendar(egg)}
                                    className="border-slate-600 hover:bg-slate-700 h-9 w-9 flex-shrink-0"
                                    title="Add to Calendar"
                                >
                                    <CalendarIcon className="w-4 h-4" />
                                </Button>
                                    <AlertDialog open={eggToDelete === egg.id} onOpenChange={(open) => { if (!open) setEggToDelete(null); }}>
                                       <Button
                                           size="icon"
                                           variant="destructive"
                                           onClick={() => handleDeleteEgg(egg.id)}
                                           className="bg-red-900/50 hover:bg-red-900/80 border border-red-500/30 text-red-400 h-9 w-9 flex-shrink-0"
                                           title="Delete Egg"
                                       >
                                           <Trash2 className="w-4 h-4" />
                                       </Button>
                                       <AlertDialogContent className="bg-slate-900 border-slate-700">
                                           <AlertDialogHeader>
                                               <AlertDialogTitle className="text-slate-100">Archive this egg?</AlertDialogTitle>
                                               <AlertDialogDescription className="text-slate-400">
                                                   This will archive the egg record and hide it from the active list. You can view archived eggs in the Hatchery.
                                               </AlertDialogDescription>
                                           </AlertDialogHeader>
                                           <AlertDialogFooter>
                                               <AlertDialogCancel className="bg-slate-800 text-slate-200 border-slate-600">Cancel</AlertDialogCancel>
                                               <AlertDialogAction onClick={handleConfirmDeleteEgg} className="bg-red-700 hover:bg-red-800">
                                                   Archive Egg
                                               </AlertDialogAction>
                                           </AlertDialogFooter>
                                       </AlertDialogContent>
                                    </AlertDialog>
                            </div>
                        </div>
                    );
                    })}
                </div>
            ) : (
                <p className="text-slate-400 text-center py-6">No eggs have been recorded for this pairing yet.</p>
            )
            }

            {/* Edit Plan Modal */}
            <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
                <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Edit Breeding Plan</DialogTitle>
                    </DialogHeader>
                     <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="breeding_id">Breeding ID</Label>
                            <Input
                                id="breeding_id"
                                placeholder="e.g., BP001, Flame-01, etc."
                                value={editedPlan.breeding_id || ''}
                                onChange={e => setEditedPlan({...editedPlan, breeding_id: e.target.value})}
                                className="bg-slate-800 border-slate-600"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="pairing_date">Pairing Date</Label>
                            <Input id="pairing_date" type="date" value={editedPlan.pairing_date ? format(new Date(editedPlan.pairing_date), 'yyyy-MM-dd') : ''} onChange={e => setEditedPlan({...editedPlan, pairing_date: e.target.value})} className="bg-slate-800 border-slate-600"/>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="status">Status</Label>
                             <Select value={editedPlan.status} onValueChange={v => setEditedPlan({...editedPlan, status: v})}>
                                <SelectTrigger className="bg-slate-800 border-slate-600"><SelectValue /></SelectTrigger>
                                <SelectContent className="bg-slate-800 border-slate-600 text-slate-200">
                                    <SelectItem value="Planned">Planned</SelectItem>
                                    <SelectItem value="Active">Active</SelectItem>
                                    <SelectItem value="Successful">Successful</SelectItem>
                                    <SelectItem value="Failed">Failed</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="expected_lay_interval">Expected Lay Interval (days)</Label>
                            <p className="text-xs text-slate-400">Card glows when this many days have passed since the last egg lay.</p>
                            <Input
                                id="expected_lay_interval"
                                type="number"
                                min="1"
                                max="90"
                                value={editedPlan.expected_lay_interval ?? 31}
                                onChange={e => setEditedPlan({...editedPlan, expected_lay_interval: parseInt(e.target.value) || 31})}
                                className="bg-slate-800 border-slate-600"
                            />
                        </div>
                    </div>
                    <DialogFooter className="flex-col sm:flex-row gap-2">
                        <Button
                            variant="destructive"
                            onClick={() => {
                                onPlanDelete(plan.id);
                                setIsEditModalOpen(false);
                            }}
                            className="w-full sm:w-auto"
                        >
                            <Trash2 size={14} className="mr-2" />
                            Delete Plan
                        </Button>
                        <Button onClick={handleUpdatePlan} className="w-full sm:w-auto">Save Changes</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </CardContent>
    );
}
