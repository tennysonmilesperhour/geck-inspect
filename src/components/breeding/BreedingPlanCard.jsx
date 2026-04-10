import React, { useState } from 'react';
import { Egg, BreedingPlan, User } from '@/entities/all';
import { Button } from '@/components/ui/button';
import { Card, CardFooter, CardHeader } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  PlusCircle,
  Edit,
  ChevronDown,
  ChevronUp,
  Egg as EggIcon,
  Calendar as CalendarIcon,
  Archive,
  ArchiveRestore,
  Sparkles,
  Dna,
  Leaf,
  Moon,
} from 'lucide-react';
import { format, addDays, differenceInDays } from 'date-fns';
import { generateCalendarEvent } from '@/functions/generateCalendarEvent';
import GeneticsModal from './GeneticsModal';
import PlanDetails from './PlanDetails';

/**
 * A single breeding plan card — collapsed view shows sire/dam thumbnails,
 * pairing name, egg-check countdown, and quick-add buttons. Expanded view
 * renders <PlanDetails/> inline. Extracted from src/pages/Breeding.jsx as
 * part of the hairball cleanup. Body unchanged; only the imports are new.
 */
export default function BreedingPlanCard({ plan, geckos, planEggs, onPlanUpdate, onPlanDelete, onPlanArchive, isExpanded, onToggleExpanded, showArchiveButton = true }) {
    const getGecko = (id) => geckos.find(g => g.id === id);
    const sire = getGecko(plan.sire_id);
    const dam = getGecko(plan.dam_id);

    const [isCopulationModalOpen, setIsCopulationModalOpen] = useState(false);
    const [copulationDate, setCopulationDate] = useState(new Date().toISOString().split('T')[0]);
    const [copulationNotes, setCopulationNotes] = useState('');
    const [isEggCheckModalOpen, setIsEggCheckModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isGeneticsOpen, setIsGeneticsOpen] = useState(false);
    const [eggCheckDay, setEggCheckDay] = useState(plan.egg_check_day || 15);

    // Derive egg data from hoisted prop — no individual fetches
    const sortedEggs = [...planEggs].sort((a, b) => new Date(b.lay_date) - new Date(a.lay_date));
    const lastEggDate = sortedEggs.length > 0 ? sortedEggs[0].lay_date : null;
    const eggsLaid = planEggs.filter(e => !e.archived).length;
    const incubating = planEggs.filter(e => e.status === 'Incubating' && !e.archived).length;
    const hatched = planEggs.filter(e => e.status === 'Hatched').length;
    const failed = planEggs.filter(e => ['Slug', 'Infertile', 'Stillbirth'].includes(e.status)).length;
    const eggCounts = { incubating, hatched, failed, eggsLaid };

    // Calculate days since last egg
    const daysSinceLastEgg = lastEggDate
        ? differenceInDays(new Date(), new Date(lastEggDate))
        : null;

    // Glow when past expected lay interval (default 31 days)
    const expectedLayInterval = plan.expected_lay_interval ?? 31;
    const shouldGlow = daysSinceLastEgg !== null && daysSinceLastEgg >= expectedLayInterval;

    const handleOpenCopulationModal = () => {
        setCopulationDate(new Date().toISOString().split('T')[0]);
        setCopulationNotes('');
        setIsCopulationModalOpen(true);
    };

    const handleOpenEggCheckModal = () => {
        setEggCheckDay(plan.egg_check_day || 15);
        setIsEggCheckModalOpen(true);
    };

    const handleQuickAddEggs = async (count) => {
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

    const handleSaveCopulation = async () => {
        if (!copulationDate) return;

        try {
            const updatedCopulationEvents = [
                ...(plan.copulation_events || []),
                {
                    date: copulationDate,
                    notes: copulationNotes
                }
            ];

            await BreedingPlan.update(plan.id, {
                copulation_events: updatedCopulationEvents
            });
            onPlanUpdate();

            setIsCopulationModalOpen(false);
        } catch (error) {
            console.error("Failed to add copulation event:", error);
        }
    };

    const handleSaveEggCheckDay = async () => {
        try {
            const updateData = {
                egg_check_day: eggCheckDay,
            };

            // If this is the first time setting the check day, also set first egg lay date
            if (!plan.first_egg_lay_date) {
                const today = new Date();
                today.setDate(eggCheckDay);
                updateData.first_egg_lay_date = today.toISOString().split('T')[0];
            }

            await BreedingPlan.update(plan.id, updateData);
            onPlanUpdate();
            setIsEggCheckModalOpen(false);
        } catch (error) {
            console.error("Failed to set egg check day:", error);
        }
    };

    const handleAddEggCheckToCalendar = async () => {
        if (!plan.egg_check_day) return;

        try {
            const sireName = sire?.name || 'N/A';
            const damName = dam?.name || 'N/A';

            // Start from today or the first egg lay date
            const baseDate = plan.first_egg_lay_date ? new Date(plan.first_egg_lay_date) : new Date();
            baseDate.setDate(plan.egg_check_day);

            // If the day has passed this month, start from next month
            const today = new Date();
            if (baseDate < today) {
                baseDate.setMonth(baseDate.getMonth() + 1);
            }

            const title = `🥚 Egg Check: ${sireName} x ${damName}`;
            const description = `Monthly egg check for breeding pair. Eggs laid so far: ${plan.egg_check_count || 0}`;

            const { data: icsContent } = await generateCalendarEvent({
                title,
                description,
                startTime: baseDate.toISOString(),
                endTime: addDays(baseDate, 1).toISOString(),
                repeatMonthly: true,
                repeatCount: 12 // Repeat for 12 months
            });

            const blob = new Blob([icsContent], { type: 'text/calendar' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'egg_check_reminder.ics';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error("Failed to generate egg check calendar event:", error);
        }
    };

    const handleAddCopulationToCalendar = async (copulationEvent) => {
        try {
            const sireName = sire?.name || 'N/A';
            const damName = dam?.name || 'N/A';
            const estimatedLayDate = addDays(new Date(copulationEvent.date), 30);

            const { data: icsContent } = await generateCalendarEvent({
                eventType: 'copulation',
                date: copulationEvent.date,
                title: `Copulation: ${sireName} x ${damName}`,
                description: copulationEvent.notes || '',
                estimatedLayDate: format(estimatedLayDate, 'yyyy-MM-dd'),
                startTime: new Date(copulationEvent.date).toISOString(),
                endTime: addDays(new Date(copulationEvent.date), 1).toISOString()
            });

            const blob = new Blob([icsContent], { type: 'text/calendar' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'copulation_event.ics';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error("Failed to generate calendar event:", error);
        }
    };

    return (
        <>
            <Card key={plan.id} className={`bg-slate-900 border-slate-700 text-slate-300 flex flex-col overflow-hidden transition-all ${shouldGlow ? 'ring-2 ring-white/30 shadow-[0_0_20px_4px_rgba(255,255,255,0.12)]' : ''}`}>
                <CardHeader className="p-0 relative">
                    <div className="flex flex-col sm:flex-row justify-between items-stretch min-w-0">
                        <div className="flex flex-1 flex-col sm:flex-row min-w-0">
                            <div className="flex w-full sm:w-32 lg:w-40 flex-shrink-0">
                                <div className="w-1/2 h-32 sm:h-28 lg:h-32 overflow-hidden">
                                    <img
                                        src={sire?.image_urls?.[0] || 'https://i.imgur.com/sw9gnDp.png'}
                                        alt={sire?.name}
                                        className="w-full h-full object-cover"
                                        loading="lazy"
                                        decoding="async"
                                    />
                                </div>
                                <div className="w-1/2 h-32 sm:h-28 lg:h-32 overflow-hidden">
                                    <img
                                        src={dam?.image_urls?.[0] || 'https://i.imgur.com/sw9gnDp.png'}
                                        alt={dam?.name}
                                        className="w-full h-full object-cover"
                                        loading="lazy"
                                        decoding="async"
                                    />
                                </div>
                            </div>
                            <div className="p-3 sm:p-4 sm:ml-3 lg:ml-4 flex flex-col justify-center flex-1 min-w-0">
                                {/* Days Since Last Egg */}
                                {daysSinceLastEgg !== null && (
                                    <div className="text-sm text-slate-400 mb-1">
                                        {daysSinceLastEgg} day{daysSinceLastEgg !== 1 ? 's' : ''} since last egg
                                    </div>
                                )}

                                <div className="font-bold text-base sm:text-lg lg:text-xl text-slate-100 break-words truncate">
                                    {sire?.name || 'N/A'} & {dam?.name || 'N/A'}
                                </div>
                                {sire?.species && sire.species !== 'Crested Gecko' && (
                                    <div className="text-xs text-teal-400 font-medium truncate">{sire.species}</div>
                                )}
                                {plan.breeding_id && (
                                    <div className="text-xs sm:text-sm text-slate-400 truncate">ID: {plan.breeding_id}</div>
                                )}

                                {/* Egg Check Day Display */}
                                {plan.egg_check_day && (
                                    <div
                                        className="mt-3 relative cursor-pointer group"
                                        onClick={handleOpenEggCheckModal}
                                    >
                                        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-green-500 rounded-lg blur opacity-30 group-hover:opacity-50 transition-opacity animate-pulse"></div>
                                        <div className="relative bg-gradient-to-br from-emerald-600 to-green-600 p-3 rounded-lg border-2 border-emerald-400 shadow-lg">
                                            <div className="flex items-center justify-between gap-2">
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <CalendarIcon className="w-4 h-4 text-white" />
                                                        <span className="text-xs font-semibold text-white uppercase tracking-wide">Monthly Egg Check</span>
                                                    </div>
                                                    <div className="text-2xl font-bold text-white mt-1">
                                                        Day {plan.egg_check_day}
                                                    </div>
                                                    <div className="text-xs text-emerald-100 mt-1">
                                                        {plan.egg_check_count || 0} clutch{(plan.egg_check_count || 0) !== 1 ? 'es' : ''} laid
                                                    </div>
                                                </div>
                                                <Sparkles className="w-6 h-6 text-emerald-200 animate-pulse" />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="flex gap-2 mt-2 justify-end flex-wrap">
                                    <Button
                                        size="sm"
                                        className="text-xs sm:text-sm"
                                        onClick={(e) => { e.stopPropagation(); handleQuickAddEggs(1); }}
                                    >
                                        <PlusCircle size={14} className="mr-1" /> <span className="hidden sm:inline">Add 1 Egg</span><span className="sm:hidden">+1</span>
                                    </Button>
                                    <Button
                                        size="sm"
                                        className="text-xs sm:text-sm"
                                        onClick={(e) => { e.stopPropagation(); handleQuickAddEggs(2); }}
                                    >
                                        <PlusCircle size={14} className="mr-1" /> <span className="hidden sm:inline">Add 2 Eggs</span><span className="sm:hidden">+2</span>
                                    </Button>
                                </div>
                            </div>
                        </div>

                    </div>
                </CardHeader>

                {isExpanded && (
                    <>
                        {plan.copulation_events && plan.copulation_events.length > 0 && (
                            <div className="px-4 md:px-6 pb-4">
                                <h5 className="text-sm md:text-md font-semibold text-slate-300 mb-2">Copulation Events</h5>
                                <div className="space-y-2">
                                    {plan.copulation_events.map((event, index) => (
                                        <div key={index} className="flex flex-col md:flex-row justify-between items-start md:items-center bg-slate-800 p-3 rounded-lg gap-2">
                                            <div className="w-full md:w-auto">
                                                <p className="text-slate-200 text-sm md:text-base">Date: {format(new Date(event.date), 'MMM dd, yyyy')}</p>
                                                {event.notes && <p className="text-xs text-slate-400">{event.notes}</p>}
                                                <p className="text-xs text-slate-500">Estimated lay date: {format(addDays(new Date(event.date), 30), 'MMM dd, yyyy')}</p>
                                            </div>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => handleAddCopulationToCalendar(event)}
                                                className="border-slate-600 hover:bg-slate-700 w-full md:w-auto"
                                            >
                                                <CalendarIcon className="w-4 h-4 mr-1" />
                                                Add to Calendar
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        <PlanDetails
                            plan={plan}
                            geckos={geckos}
                            planEggs={planEggs}
                            onPlanUpdate={onPlanUpdate}
                            onPlanDelete={onPlanDelete}
                            onOpenCopulationModal={handleOpenCopulationModal}
                            onOpenEggCheckModal={handleOpenEggCheckModal}
                            isEditModalOpen={isEditModalOpen}
                            setIsEditModalOpen={setIsEditModalOpen}
                        />
                    </>
                )}

                <CardFooter className="bg-emerald-950/50 p-3 flex flex-wrap gap-2 justify-between items-center">
                    <div className="flex gap-2 flex-wrap items-center">
                        <Button variant="outline" size="sm" className="border-emerald-700 hover:bg-emerald-900 text-xs h-8 text-emerald-300" onClick={() => onToggleExpanded(plan.id)}>
                            {isExpanded ? <><ChevronUp size={14} className="mr-1" /> Collapse</> : <><ChevronDown size={14} className="mr-1" /> Expand</>}
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className={`text-xs h-8 ${plan.laying_active !== false ? 'border-green-600 text-green-400 hover:bg-green-900/20' : 'border-slate-600 text-slate-400 hover:bg-slate-800'}`}
                            onClick={async () => {
                                const goingDormant = plan.laying_active !== false;
                                await BreedingPlan.update(plan.id, {
                                    laying_active: !goingDormant,
                                    dormant_since: goingDormant ? new Date().toISOString().split('T')[0] : null
                                });
                                onPlanUpdate();
                            }}
                            title={plan.laying_active !== false ? 'Active laying season — click to mark dormant' : 'Dormant — click to mark active'}
                        >
                            {plan.laying_active !== false ? (
                                <><Leaf size={14} className="mr-1" /> Active</>
                            ) : (
                                <>
                                    <Moon size={14} className="mr-1" /> Dormant
                                    {plan.dormant_since && (() => {
                                        const days = Math.floor((new Date() - new Date(plan.dormant_since)) / 86400000);
                                        return days > 0 ? <span className="ml-1 text-slate-500">({days}d)</span> : null;
                                    })()}
                                </>
                            )}
                        </Button>
                        {showArchiveButton && (
                            <Button
                                variant="outline"
                                size="sm"
                                className="border-yellow-600 text-yellow-500 hover:bg-yellow-900/20 text-xs h-8"
                                onClick={() => onPlanArchive(plan.id, !plan.archived)}
                            >
                                {plan.archived ? <ArchiveRestore size={14} className="mr-1" /> : <Archive size={14} className="mr-1" />}
                                {plan.archived ? 'Unarchive' : 'Archive'}
                            </Button>
                        )}
                        <Button variant="outline" size="sm" className="border-slate-600 hover:bg-slate-800 text-xs h-8" onClick={() => setIsEditModalOpen(true)}>
                            <Edit size={14} className="mr-1" /> Edit
                        </Button>
                        <Button variant="outline" size="sm" className="border-purple-700 text-purple-300 hover:bg-purple-900/30 text-xs h-8" onClick={() => setIsGeneticsOpen(true)}>
                            <Dna size={14} className="mr-1" /> Genetics
                        </Button>
                    </div>

                    <div className="flex gap-1 flex-wrap">
                        {eggCounts.eggsLaid > 0 && (
                            <div className="relative group/tip">
                                <div className="bg-amber-100 text-amber-900 text-xs px-1.5 py-0.5 rounded flex items-center gap-1 cursor-default">
                                    <EggIcon className="w-3 h-3" />
                                    {eggCounts.eggsLaid}
                                </div>
                                <div className="pointer-events-none absolute bottom-full right-0 mb-1.5 px-2 py-1 bg-slate-800 text-slate-100 text-xs rounded shadow-lg whitespace-nowrap opacity-0 group-hover/tip:opacity-100 transition-opacity duration-150 z-50">
                                    Eggs incubating
                                </div>
                            </div>
                        )}
                        {eggCounts.hatched > 0 && (
                            <div className="relative group/tip">
                                <div className="bg-green-600 text-white text-xs px-1.5 py-0.5 rounded cursor-default">
                                    ✓ {eggCounts.hatched}
                                </div>
                                <div className="pointer-events-none absolute bottom-full right-0 mb-1.5 px-2 py-1 bg-slate-800 text-slate-100 text-xs rounded shadow-lg whitespace-nowrap opacity-0 group-hover/tip:opacity-100 transition-opacity duration-150 z-50">
                                    Hatched
                                </div>
                            </div>
                        )}
                        {eggCounts.failed > 0 && (
                            <div className="relative group/tip">
                                <div className="bg-yellow-600 text-white text-xs px-1.5 py-0.5 rounded cursor-default">
                                    ✗ {eggCounts.failed}
                                </div>
                                <div className="pointer-events-none absolute bottom-full right-0 mb-1.5 px-2 py-1 bg-slate-800 text-slate-100 text-xs rounded shadow-lg whitespace-nowrap opacity-0 group-hover/tip:opacity-100 transition-opacity duration-150 z-50">
                                    Failed / Slug / Infertile
                                </div>
                            </div>
                        )}
                    </div>
                </CardFooter>
            </Card>

            {/* Copulation Recording Modal */}
            <Dialog open={isCopulationModalOpen} onOpenChange={setIsCopulationModalOpen}>
                <DialogContent className="bg-slate-900 border-slate-700 text-slate-300">
                    <DialogHeader>
                        <DialogTitle className="text-slate-100">Record Lock Event</DialogTitle>
                        <DialogDescription className="text-slate-400">Record when this pair was observed locking.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div>
                            <Label htmlFor="cop-date">Date</Label>
                            <Input
                                id="cop-date"
                                type="date"
                                value={copulationDate}
                                onChange={(e) => setCopulationDate(e.target.value)}
                                className="bg-slate-800 border-slate-600"
                            />
                        </div>
                        <div>
                            <Label htmlFor="cop-notes">Notes (Optional)</Label>
                            <Textarea
                                id="cop-notes"
                                value={copulationNotes}
                                onChange={(e) => setCopulationNotes(e.target.value)}
                                placeholder="Any observations about the pairing..."
                                className="bg-slate-800 border-slate-600"
                            />
                        </div>
                        <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-3 text-sm text-blue-300">
                            <p className="font-semibold mb-1">📅 Estimated Timeline</p>
                            <p>Lay Date: ~{format(addDays(new Date(copulationDate), 30), 'MMM dd, yyyy')}</p>
                            <p>Hatch Date: ~{format(addDays(new Date(copulationDate), 90), 'MMM dd, yyyy')}</p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsCopulationModalOpen(false)} className="border-slate-600">
                            Cancel
                        </Button>
                        <Button onClick={handleSaveCopulation}>
                            Save Event
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Genetics Calculator Modal */}
            <GeneticsModal
                isOpen={isGeneticsOpen}
                onClose={() => setIsGeneticsOpen(false)}
                sire={sire}
                dam={dam}
            />

            {/* Egg Check Day Modal */}
            <Dialog open={isEggCheckModalOpen} onOpenChange={setIsEggCheckModalOpen}>
                <DialogContent className="bg-slate-900 border-slate-700 text-slate-300">
                    <DialogHeader>
                        <DialogTitle className="text-slate-100">Set Monthly Egg Check Day</DialogTitle>
                        <DialogDescription className="text-slate-400">
                            Choose which day of each month to check for eggs from this breeding pair.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div>
                            <Label htmlFor="egg-check-day">Day of Month (1-31)</Label>
                            <Input
                                id="egg-check-day"
                                type="number"
                                min="1"
                                max="31"
                                value={eggCheckDay}
                                onChange={(e) => setEggCheckDay(parseInt(e.target.value))}
                                className="bg-slate-800 border-slate-600"
                            />
                        </div>
                        {plan.egg_check_count > 0 && (
                            <div className="bg-emerald-900/20 border border-emerald-700 rounded-lg p-3">
                                <p className="text-sm text-emerald-300">
                                    <strong>Current count:</strong> {plan.egg_check_count} clutch{plan.egg_check_count !== 1 ? 'es' : ''} laid
                                </p>
                            </div>
                        )}
                        <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-3 text-sm text-blue-300">
                            <p className="font-semibold mb-2">💡 Tips:</p>
                            <ul className="list-disc list-inside space-y-1">
                                <li>Female geckos typically lay eggs every 30 days during breeding season</li>
                                <li>Set a consistent day to check for new clutches</li>
                                <li>Add this to your calendar to get monthly reminders for 12 months</li>
                            </ul>
                        </div>
                    </div>
                    <DialogFooter className="flex-col sm:flex-row gap-2">
                        {plan.egg_check_day && (
                            <Button
                                variant="outline"
                                onClick={handleAddEggCheckToCalendar}
                                className="border-emerald-600 text-emerald-400 hover:bg-emerald-900/20 w-full sm:w-auto"
                            >
                                <CalendarIcon className="w-4 h-4 mr-2" />
                                Add to Calendar (12 months)
                            </Button>
                        )}
                        <Button variant="outline" onClick={() => setIsEggCheckModalOpen(false)} className="border-slate-600 w-full sm:w-auto">
                            Cancel
                        </Button>
                        <Button onClick={handleSaveEggCheckDay} className="w-full sm:w-auto">
                            Save
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
