import { useState } from 'react';
import { Egg } from '@/entities/all';
import { Button } from '@/components/ui/button';
import { CardContent } from '@/components/ui/card';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Edit, Trash2, Archive, Egg as EggIcon, Calendar as CalendarIcon } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { todayLocalISO, parseLocalDate } from '@/lib/dateUtils';
import { eggStatusFields } from '@/lib/hatchEgg';
import { useToast } from '@/components/ui/use-toast';
import PairingValuePanel from './PairingValuePanel';
import HatchEggDialog from './HatchEggDialog';
import DeleteEggDialog from './DeleteEggDialog';

/**
 * Expanded-state view of a single breeding plan, shows all eggs with
 * editable lay/hatch dates, status dropdowns, and the Edit Plan modal.
 */
export default function PlanDetails({ plan, geckos, onPlanUpdate, onOpenCopulationModal, onOpenEggCheckModal, planEggs, setIsEditModalOpen }) {
    const eggs = planEggs.filter(egg => !egg.archived).sort((a, b) => new Date(b.lay_date) - new Date(a.lay_date));
    const [editedEggs, setEditedEggs] = useState({});
    const { toast } = useToast();

    // Archive and delete are separate actions: archiving keeps the record
    // (Hatchery archive, breeding history), deleting removes it for good.
    const [eggToArchive, setEggToArchive] = useState(null);
    const [eggToDelete, setEggToDelete] = useState(null);
    // Hatching goes through the shared dialog (src/lib/hatchEgg.js).
    const [eggToHatch, setEggToHatch] = useState(null);

    const sire = geckos.find(g => g.id === plan.sire_id);
    const dam = geckos.find(g => g.id === plan.dam_id);

    const handleConfirmArchiveEgg = async () => {
        if (!eggToArchive) return;
        try {
            await Egg.update(eggToArchive, {
                archived: true,
                archived_date: todayLocalISO()
            });
            onPlanUpdate();
        } catch (error) {
            console.error("Failed to archive egg:", error);
            toast({ title: 'Egg not archived', description: error.message || 'Please try again.', variant: 'destructive' });
        }
        setEggToArchive(null);
    };

    // Infertile, Slug or Stillbirth. Hatched has its own dialog.
    const handleUpdateEggStatus = async (eggId, status) => {
        try {
            await Egg.update(eggId, eggStatusFields(status));
            onPlanUpdate();
        } catch (error) {
            console.error("Failed to update egg status:", error);
            toast({ title: 'Egg not updated', description: error.message || 'Please try again.', variant: 'destructive' });
        }
    };

    const handleAddToCalendar = async (egg) => {
        try {
            const title = `Gecko Egg Hatching - ${sire?.name || 'Unknown Sire'} x ${dam?.name || 'Unknown Dam'}`;
            const description = `Expected hatch date for egg laid on ${format(parseLocalDate(egg.lay_date), 'MMM dd, yyyy')}`;
            const startDate = parseLocalDate(egg.hatch_date_expected);

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
        const statusConfig = {
            'Hatched': {
                className: "bg-transparent text-green-400 border-green-400 hover:bg-green-900/20",
                text: egg.hatch_date_actual ? `Hatched ${format(parseLocalDate(egg.hatch_date_actual), 'MM/dd/yy')}` : 'Hatched'
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
        const baseClasses = "cursor-pointer text-xs font-semibold px-3 py-2 rounded-md border w-full text-center h-9 touch:min-h-11 truncate transition-colors flex items-center justify-center";

        // Only Incubating eggs get the dropdown (the ways an egg can fail)
        if (egg.status === 'Incubating') {
            return (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button className={`touch:min-h-11 ${baseClasses} ${config.className}`}>
                            {config.text}
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="bg-slate-800 border-slate-600 text-slate-200 z-50">
                        <DropdownMenuItem onClick={() => handleUpdateEggStatus(egg.id, 'Infertile')}>Infertile</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleUpdateEggStatus(egg.id, 'Slug')}>Failed or Slug</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleUpdateEggStatus(egg.id, 'Stillbirth')}>Stillbirth</DropdownMenuItem>
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
            <PairingValuePanel
                plan={plan}
                sire={sire}
                dam={dam}
                eggs={planEggs}
            />
            <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-3">
                <div className="flex flex-wrap gap-2 w-full sm:w-auto items-center justify-start sm:justify-end ml-auto">
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
                                                <Button size="sm" className="h-9 md:h-7 text-xs" onClick={() => handleSaveEggEdit(egg.id, eggEdit)}>Save</Button>
                                                <Button size="sm" variant="outline" className="border-slate-600 h-9 md:h-7 text-xs" onClick={() => handleCancelEggEdit(egg.id)}>Cancel</Button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex items-start sm:items-center justify-between gap-2">
                                            <div>
                                                <p className="text-slate-200 text-sm font-medium">Laid: {format(parseLocalDate(egg.lay_date), 'MMM dd, yyyy')}</p>
                                                <p className="text-xs text-slate-400">Expected Hatch: {egg.hatch_date_expected ? format(parseLocalDate(egg.hatch_date_expected), 'MMM dd, yyyy') : 'Not set'}</p>
                                                {egg.gecko_id && (
                                                    <p className="text-xs text-green-400 mt-1">✓ Gecko created in collection</p>
                                                )}
                                            </div>
                                            <Button size="sm" variant="ghost" className="text-slate-400 hover:text-slate-200 h-9 md:h-7 text-xs px-2" onClick={() => handleStartEggEdit(egg)}>
                                                <Edit size={12} className="mr-1" /> Edit
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Status and Actions, single flex row so everything
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
                                        onClick={() => setEggToHatch(egg)}
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
                                <Button
                                    size="icon"
                                    variant="outline"
                                    onClick={() => setEggToArchive(egg.id)}
                                    className="border-slate-600 hover:bg-slate-700 h-9 w-9 flex-shrink-0"
                                    title="Archive egg"
                                    aria-label="Archive egg"
                                >
                                    <Archive className="w-4 h-4" />
                                </Button>
                                <Button
                                    size="icon"
                                    variant="destructive"
                                    onClick={() => setEggToDelete(egg)}
                                    className="bg-red-900/50 hover:bg-red-900/80 border border-red-500/30 text-red-400 h-9 w-9 flex-shrink-0"
                                    title="Delete egg"
                                    aria-label="Delete egg"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    );
                    })}
                </div>
            ) : (
                <p className="text-slate-400 text-center py-6">No eggs have been recorded for this pairing yet.</p>
            )
            }

            <AlertDialog open={!!eggToArchive} onOpenChange={(open) => { if (!open) setEggToArchive(null); }}>
                <AlertDialogContent className="bg-slate-900 border-slate-700">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-slate-100">Archive this egg?</AlertDialogTitle>
                        <AlertDialogDescription className="text-slate-400">
                            The egg leaves this list but keeps its record. You can find it, and restore it, under Show Archived in the Hatchery.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="bg-slate-800 text-slate-200 border-slate-600">Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirmArchiveEgg} className="bg-emerald-700 hover:bg-emerald-800">
                            Archive egg
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <DeleteEggDialog
                egg={eggToDelete}
                onClose={() => setEggToDelete(null)}
                onDeleted={() => { setEggToDelete(null); onPlanUpdate(); }}
            />

            {eggToHatch && (
                <HatchEggDialog
                    egg={eggToHatch}
                    plan={plan}
                    sire={sire}
                    dam={dam}
                    pairEggs={planEggs}
                    onClose={() => setEggToHatch(null)}
                    onHatched={onPlanUpdate}
                />
            )}

            {/* The Edit Plan button opens the card's dialog (PlanEditDialog in
                BreedingPlanCard). A second copy here stacked on top of it. */}
        </CardContent>
    );
}
