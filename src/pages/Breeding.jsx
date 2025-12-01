import React, { useState, useEffect, Suspense } from 'react';
import { Gecko, BreedingPlan, Egg, User } from '@/entities/all';
import { base44 } from '@/api/base44Client';
import { notifyFollowersNewBreedingPlan } from '@/components/notifications/NotificationService';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { PlusCircle, Loader2, GitBranch, Heart, Edit, Trash2, ChevronDown, ChevronUp, Egg as EggIcon, Calendar as CalendarIcon, Archive, ArchiveRestore, Sparkles, ListTree } from 'lucide-react';
import Hatchery from '../components/breeding/Hatchery';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { format, addDays, addMonths } from 'date-fns';
import { generateCalendarEvent } from '@/functions/generateCalendarEvent';

function PlanDetails({ plan, geckos, onPlanUpdate, onPlanDelete }) {
    const [eggs, setEggs] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editedPlan, setEditedPlan] = useState(plan);
    const [editingHatchDate, setEditingHatchDate] = useState(null); // eggId to edit

    const loadEggs = async () => {
        setIsLoading(true);
        try {
            const planEggs = await Egg.filter({ breeding_plan_id: plan.id }, '-lay_date');
            setEggs(planEggs);
        } catch (error) {
            console.error("Failed to load eggs:", error);
        }
        setIsLoading(false);
    };

    useEffect(() => {
        loadEggs();
    }, [plan.id]);

    const handleDeleteEgg = async (eggId) => {
        if (window.confirm("Are you sure you want to permanently delete this egg record?")) {
            try {
                await Egg.delete(eggId);
                loadEggs();
            } catch (error) {
                console.error("Failed to delete egg:", error);
            }
        }
    };

    const handleAddNewEggs = async (count) => {
        const today = new Date();
        const newLayDate = today.toISOString().split('T')[0];
        const expectedHatch = addDays(today, 65);
        
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
            
            loadEggs();
            onPlanUpdate(); // Refresh plan data
        } catch (error) {
            console.error("Failed to add eggs:", error);
        }
    };

    const handleUpdateEggStatus = async (eggId, status) => {
        const updateData = { status };
        const currentEgg = eggs.find(e => e.id === eggId);
        
        if (status === 'Hatched' && currentEgg?.status !== 'Hatched') {
            const hatchDate = new Date().toISOString().split('T')[0];
            updateData.hatch_date_actual = hatchDate;
            
            // Create gecko automatically if not already linked
            if (!currentEgg.gecko_id) {
                try {
                    const sire = geckos.find(g => g.id === plan.sire_id);
                    const dam = geckos.find(g => g.id === plan.dam_id);
                    
                    // Count existing offspring from this breeding plan this season that have a gecko_id
                    const allEggs = await Egg.filter({ breeding_plan_id: plan.id });
                    const hatchedEggsWithGeckos = allEggs.filter(e => e.status === 'Hatched' && e.gecko_id);
                    const offspringNumber = hatchedEggsWithGeckos.length + 1; // +1 for the current egg being hatched
                    
                    // Generate name: SireName x DamName #1
                    const geckoName = `${sire?.name || 'Unknown'} x ${dam?.name || 'Unknown'} #${offspringNumber}`;
                    
                    // Generate ID code from parent IDs
                    const sireCode = sire?.gecko_id_code || 'UNK';
                    const damCode = dam?.gecko_id_code || 'UNK';
                    const geckoIdCode = `${sireCode}x${damCode}-${offspringNumber}`;
                    
                    // Create the gecko
                    const newGecko = await Gecko.create({
                        name: geckoName,
                        gecko_id_code: geckoIdCode,
                        hatch_date: hatchDate,
                        sex: 'Unsexed', // Default to unsexed, can be updated later
                        sire_id: plan.sire_id,
                        dam_id: plan.dam_id,
                        status: 'Pet', // Default to pet, can be updated later
                        notes: `Hatched from breeding plan: ${plan.breeding_id || plan.id}`
                    });
                    
                    // Link gecko to egg
                    updateData.gecko_id = newGecko.id;
                } catch (error) {
                    console.error("Failed to create gecko:", error);
                    // Decide whether to proceed with egg status update if gecko creation fails
                    // For now, we'll log and continue to update egg status
                }
            }
        }
        
        try {
            await Egg.update(eggId, updateData);
            loadEggs();
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
            loadEggs();
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

        return (
             <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <div
                        className={`${baseClasses} ${config.className}`}
                        onClick={(e) => {
                            if (egg.status === 'Hatched') {
                                e.preventDefault();
                                e.stopPropagation();
                                setEditingHatchDate(egg.id);
                            }
                        }}
                    >
                        {config.text}
                    </div>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="bg-slate-800 border-slate-600 text-slate-200">
                    <DropdownMenuItem onClick={() => handleUpdateEggStatus(egg.id, 'Hatched')}>Hatched</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleUpdateEggStatus(egg.id, 'Incubating')}>Incubating</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleUpdateEggStatus(egg.id, 'Slug')}>Slug</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleUpdateEggStatus(egg.id, 'Infertile')}>Infertile</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleUpdateEggStatus(egg.id, 'Stillbirth')}>Stillbirth</DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        );
    };

    return (
        <CardContent className="border-t border-slate-700 p-4 md:p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
                 <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                    <Button variant="outline" size="sm" className="border-slate-600 hover:bg-slate-800 flex-1 sm:flex-none" onClick={() => setIsEditModalOpen(true)}>
                        <Edit size={14} className="mr-2"/> Edit Plan
                    </Button>
                    <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 flex-1 sm:flex-none" onClick={() => handleAddNewEggs(1)}>
                        <PlusCircle size={14} className="mr-2" /> Add 1 Egg
                    </Button>
                     <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 flex-1 sm:flex-none" onClick={() => handleAddNewEggs(2)}>
                        <PlusCircle size={14} className="mr-2" /> Add 2 Eggs
                    </Button>
                 </div>
            </div>

            {isLoading ? (
                <div className="text-center"><Loader2 className="w-6 h-6 text-emerald-500 animate-spin mx-auto" /></div>
            ) : eggs.length > 0 ? (
                <div className="space-y-4">
                    {eggs.map(egg => (
                        <div key={egg.id} className="bg-slate-800 p-4 rounded-lg space-y-3">
                            {/* Egg Info Section */}
                            <div className="flex items-start gap-3">
                                <EggIcon className="w-6 h-6 text-emerald-400 flex-shrink-0 mt-1" />
                                <div className="flex-1 min-w-0">
                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                        <div>
                                            <p className="text-slate-200 text-sm font-medium">Laid: {format(new Date(egg.lay_date), 'MMM dd, yyyy')}</p>
                                            <p className="text-xs text-slate-400">Expected Hatch: {format(new Date(egg.hatch_date_expected), 'MMM dd, yyyy')}</p>
                                            {egg.gecko_id && (
                                                <p className="text-xs text-green-400 mt-1">✓ Gecko created in collection</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Status and Actions Section */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                                <div className="sm:col-span-1 lg:col-span-2">
                                    <StatusDisplay egg={egg} />
                                </div>
                                
                                <div className="flex gap-2 sm:col-span-1 lg:col-span-2">
                                    {egg.status === 'Incubating' && (
                                        <Button 
                                            size="sm" 
                                            className="bg-green-600 hover:bg-green-700 h-9 flex-1"
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
                                    <Button 
                                        size="icon" 
                                        variant="destructive"
                                        onClick={() => handleDeleteEgg(egg.id)}
                                        className="bg-red-900/50 hover:bg-red-900/80 border border-red-500/30 text-red-400 h-9 w-9 flex-shrink-0"
                                        title="Delete Egg"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <p className="text-slate-400 text-center py-6">No eggs have been recorded for this pairing yet.</p>
            )}

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
                        <Button onClick={handleUpdatePlan} className="bg-emerald-600 hover:bg-emerald-700 w-full sm:w-auto">Save Changes</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </CardContent>
    );
}

function BreedingPlanCard({ plan, geckos, onPlanUpdate, onPlanDelete, onPlanArchive, isExpanded, onToggleExpanded, showArchiveButton = true }) {
    const getGecko = (id) => geckos.find(g => g.id === id);
    const sire = getGecko(plan.sire_id);
    const dam = getGecko(plan.dam_id);
    
    const [isCopulationModalOpen, setIsCopulationModalOpen] = useState(false);
    const [copulationDate, setCopulationDate] = useState(new Date().toISOString().split('T')[0]);
    const [copulationNotes, setCopulationNotes] = useState('');
    const [isEggCheckModalOpen, setIsEggCheckModalOpen] = useState(false);
    const [eggCheckDay, setEggCheckDay] = useState(plan.egg_check_day || 15);

    const handleOpenCopulationModal = () => {
        setCopulationDate(new Date().toISOString().split('T')[0]);
        setCopulationNotes('');
        setIsCopulationModalOpen(true);
    };
    
    const handleOpenEggCheckModal = () => {
        setEggCheckDay(plan.egg_check_day || 15);
        setIsEggCheckModalOpen(true);
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
            <Card key={plan.id} className="bg-slate-900 border-slate-700 text-slate-300 flex flex-col overflow-hidden">
                <CardHeader className="p-0">
                    <div className="flex flex-col md:flex-row justify-between items-stretch">
                        <div className="flex flex-1 flex-col md:flex-row">
                            <div className="flex w-full md:w-auto">
                                <img 
                                    src={sire?.image_urls?.[0] || 'https://via.placeholder.com/100'} 
                                    alt={sire?.name} 
                                    className="w-1/2 md:w-20 h-32 md:h-20 object-cover" 
                                />
                                <img 
                                    src={dam?.image_urls?.[0] || 'https://via.placeholder.com/100'} 
                                    alt={dam?.name} 
                                    className="w-1/2 md:w-20 h-32 md:h-20 object-cover" 
                                />
                            </div>
                            <div className="p-4 md:ml-4 flex flex-col justify-center flex-1">
                                <div className="font-bold text-lg md:text-xl text-slate-100 break-words">
                                    {sire?.name || 'N/A'} & {dam?.name || 'N/A'}
                                </div>
                                {plan.breeding_id && (
                                    <div className="text-sm text-slate-400">ID: {plan.breeding_id}</div>
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
                                
                                <div className="flex gap-2 mt-2">
                                    <Button 
                                        variant="outline" 
                                        size="sm" 
                                        className="border-slate-600 hover:bg-slate-800 flex-1 md:flex-none text-xs md:text-sm" 
                                        onClick={(e) => { e.stopPropagation(); handleOpenCopulationModal(); }}
                                    >
                                        Record Copulation
                                    </Button>
                                    <Button 
                                        variant="outline" 
                                        size="sm" 
                                        className="border-emerald-600 text-emerald-400 hover:bg-emerald-900/20 flex-1 md:flex-none text-xs md:text-sm" 
                                        onClick={(e) => { e.stopPropagation(); handleOpenEggCheckModal(); }}
                                    >
                                        {plan.egg_check_day ? 'Edit' : 'Set'} Egg Check
                                    </Button>
                                </div>
                            </div>
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onToggleExpanded(plan.id)}
                            className="text-slate-400 hover:text-slate-200 self-center md:self-start m-2"
                        >
                            {isExpanded ? <ChevronUp className="w-6 h-6"/> : <ChevronDown className="w-6 h-6"/>}
                        </Button>
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
                            onPlanUpdate={onPlanUpdate}
                            onPlanDelete={onPlanDelete}
                        />
                    </>
                )}

                <CardFooter className="bg-slate-800/50 p-3 flex flex-wrap gap-2 justify-between">
                    <div className="flex gap-2 flex-wrap">
                        <Button variant="outline" size="sm" className="border-slate-600 hover:bg-slate-800 text-xs" onClick={() => onToggleExpanded(plan.id)}>
                            {isExpanded ? <><ChevronUp size={14} className="mr-1" /> Collapse</> : <><ChevronDown size={14} className="mr-1" /> Expand</>}
                        </Button>
                        {showArchiveButton && (
                            <Button
                                variant="outline"
                                size="sm"
                                className="border-yellow-600 text-yellow-600 hover:bg-yellow-900/20 text-xs"
                                onClick={() => onPlanArchive(plan.id, !plan.archived)}
                            >
                                {plan.archived ? <ArchiveRestore size={14} className="mr-1" /> : <Archive size={14} className="mr-1" />}
                                {plan.archived ? 'Unarchive' : 'Archive'}
                            </Button>
                        )}
                    </div>
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="sm" className="text-xs">
                                <Trash2 size={14} className="mr-1" /> Delete
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="bg-slate-900 border-slate-700">
                            <AlertDialogHeader>
                                <AlertDialogTitle className="text-slate-100">Are you sure?</AlertDialogTitle>
                                <AlertDialogDescription className="text-slate-400">
                                    This will permanently delete this breeding plan and all associated eggs. This action cannot be undone.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel className="bg-slate-800 text-slate-300 border-slate-600">Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => onPlanDelete(plan.id)} className="bg-red-600 hover:bg-red-700">
                                    Delete
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </CardFooter>
            </Card>

            {/* Copulation Recording Modal */}
            <Dialog open={isCopulationModalOpen} onOpenChange={setIsCopulationModalOpen}>
                <DialogContent className="bg-slate-900 border-slate-700 text-slate-300">
                    <DialogHeader>
                        <DialogTitle className="text-slate-100">Record Copulation Event</DialogTitle>
                        <DialogDescription className="text-slate-400">Record when this pair was observed copulating.</DialogDescription>
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
                        <Button onClick={handleSaveCopulation} className="bg-emerald-600 hover:bg-emerald-700">
                            Save Event
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            
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
                        <Button onClick={handleSaveEggCheckDay} className="bg-emerald-600 hover:bg-emerald-700 w-full sm:w-auto">
                            Save
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

export default function BreedingPage() {
    const [breedingPlans, setBreedingPlans] = useState([]);
    const [geckos, setGeckos] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [expandedPlanId, setExpandedPlanId] = useState(null);
    const [activeTab, setActiveTab] = useState('active');

    const [expandAllActive, setExpandAllActive] = useState(false);
    const [expandAllArchive, setExpandAllArchive] = useState(false);

    const [newPlan, setNewPlan] = useState({
        sire_id: '',
        dam_id: '',
        breeding_id: '',
        pairing_date: new Date().toISOString().split('T')[0],
        status: 'Planned',
        notes: '',
        breeding_season: ''
    });

    const getCurrentSeason = () => {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();
        
        if (month >= 2 && month <= 4) return `${year} Spring`;
        if (month >= 5 && month <= 7) return `${year} Summer`;
        if (month >= 8 && month <= 10) return `${year} Fall`;
        return `${year} Winter`;
    };

    useEffect(() => {
        loadData();
    }, []);

    const [user, setUser] = useState(null);
    const [authChecked, setAuthChecked] = useState(false);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const currentUser = await base44.auth.me();
            setUser(currentUser);
            setAuthChecked(true);
            
            if (!currentUser) {
                // User not authenticated
                setIsLoading(false);
                return;
            }
            
            const [geckosData, plansData] = await Promise.all([
                Gecko.filter({ created_by: currentUser.email }),
                BreedingPlan.filter({ created_by: currentUser.email }, '-created_date')
            ]);
            setGeckos(geckosData);
            setBreedingPlans(plansData.sort((a,b) => new Date(b.created_date) - new Date(a.created_date)));
        } catch (error) {
            console.error("Failed to load breeding data:", error);
            setAuthChecked(true);
        }
        setIsLoading(false);
    };
    
    const handleCreatePlan = async () => {
        if (!newPlan.sire_id || !newPlan.dam_id) {
            alert('Please select both a sire and a dam.');
            return;
        }
        try {
            // Auto-generate breeding_id if not provided
            const sire = geckos.find(g => g.id === newPlan.sire_id);
            const dam = geckos.find(g => g.id === newPlan.dam_id);
            
            let breedingId = newPlan.breeding_id;
            if (!breedingId) {
                const sireCode = sire?.gecko_id_code || 'UNK';
                const damCode = dam?.gecko_id_code || 'UNK';
                breedingId = `${sireCode}x${damCode}`;
            }
            
            const planData = {
                ...newPlan,
                breeding_id: breedingId,
                breeding_season: newPlan.breeding_season || getCurrentSeason()
            };
            const createdPlan = await BreedingPlan.create(planData);
            
            // Notify followers if plan is public
            if (createdPlan.is_public) {
                const currentUser = await base44.auth.me();
                notifyFollowersNewBreedingPlan(createdPlan, sire, dam, currentUser.email, currentUser.full_name).catch(console.error);
            }
            
            setIsModalOpen(false);
            setNewPlan({
                sire_id: '',
                dam_id: '',
                breeding_id: '',
                pairing_date: new Date().toISOString().split('T')[0],
                status: 'Planned',
                notes: '',
                breeding_season: ''
            });
            loadData();
        } catch (error) {
            console.error("Failed to create breeding plan:", error);
        }
    };

    const handleDeletePlan = async (planId) => {
        try {
            const eggsToDelete = await Egg.filter({ breeding_plan_id: planId });
            for (const egg of eggsToDelete) {
                await Egg.delete(egg.id);
            }
            await BreedingPlan.delete(planId);
            loadData();
        } catch (error) {
            console.error("Failed to delete breeding plan:", error);
        }
    };

    const handleArchivePlan = async (planId, shouldArchive) => {
        try {
            const planToUpdate = breedingPlans.find(p => p.id === planId);
            if (!planToUpdate) return;

            await BreedingPlan.update(planId, {
                archived: shouldArchive,
                archived_date: shouldArchive ? new Date().toISOString().split('T')[0] : null,
                breeding_season: planToUpdate.breeding_season || getCurrentSeason() 
            });
            loadData();
        } catch (error) {
            console.error("Failed to archive breeding plan:", error);
        }
    };

    const handleToggleExpanded = (planId) => {
        if (expandedPlanId === planId) {
            setExpandedPlanId(null);
        } else {
            setExpandedPlanId(planId);
            if (activeTab === 'active' && expandAllActive) {
                setExpandAllActive(false);
            } else if (activeTab === 'archive' && expandAllArchive) {
                setExpandAllArchive(false);
            }
        }
    };

    const handleExpandAllActive = () => {
        const newState = !expandAllActive;
        setExpandAllActive(newState);
        if (newState) {
            setExpandedPlanId('all_active');
        } else {
            setExpandedPlanId(null);
        }
        setExpandAllArchive(false);
    };

    const handleExpandAllArchive = () => {
        const newState = !expandAllArchive;
        setExpandAllArchive(newState);
        if (newState) {
            setExpandedPlanId('all_archive');
        } else {
            setExpandedPlanId(null);
        }
        setExpandAllActive(false);
    };

    const activePlans = breedingPlans.filter(plan => !plan.archived);
    const archivedPlans = breedingPlans.filter(plan => plan.archived);

    const archivedBySeason = archivedPlans.reduce((acc, plan) => {
        const season = plan.breeding_season || 'Unknown Season';
        if (!acc[season]) {
            acc[season] = [];
        }
        acc[season].push(plan);
        return acc;
    }, {});

    const sortedSeasons = Object.keys(archivedBySeason).sort((a, b) => {
        const getYear = (s) => parseInt(s.split(' ')[0]);
        const getSeasonOrder = (s) => {
            const seasonName = s.split(' ')[1];
            switch (seasonName) {
                case 'Winter': return 0;
                case 'Spring': return 1;
                case 'Summer': return 2;
                case 'Fall': return 3;
                default: return 4;
            }
        };

        const yearA = getYear(a);
        const yearB = getYear(b);

        if (yearB !== yearA) return yearB - yearA;
        
        return getSeasonOrder(a) - getSeasonOrder(b);
    });


    const males = geckos.filter(g => g.sex === 'Male');
    const females = geckos.filter(g => g.sex === 'Female');

    const isPlanExpanded = (planId) => {
        if (activeTab === 'active' && expandedPlanId === 'all_active') return true;
        if (activeTab === 'archive' && expandedPlanId === 'all_archive') return true;
        return expandedPlanId === planId;
    };
    
    // Show login portal if not authenticated
    if (authChecked && !user) {
        const LoginPortal = React.lazy(() => import('../components/auth/LoginPortal'));
        return (
            <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center"><Loader2 className="w-12 h-12 text-emerald-500 animate-spin" /></div>}>
                <LoginPortal requiredFeature="Breeding Management" />
            </Suspense>
        );
    }

    return (
        <div className="p-4 md:p-8 bg-slate-950 min-h-screen">
            <div className="max-w-7xl mx-auto">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                    <div>
                        <h1 className="text-2xl md:text-4xl font-bold text-slate-100 flex items-center gap-3">
                            <GitBranch className="w-8 h-8 md:w-10 md:h-10 text-emerald-500" />
                            Breeding Management
                        </h1>
                        <p className="text-slate-400 mt-2 text-sm md:text-base">Plan and track your gecko breeding projects</p>
                    </div>
                    <Button onClick={() => setIsModalOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 w-full md:w-auto">
                        <PlusCircle className="w-5 h-5 mr-2" />
                        New Breeding Plan
                    </Button>
                </div>

                {isLoading ? (
                    <div className="text-center py-20">
                        <Loader2 className="w-12 h-12 text-emerald-500 animate-spin mx-auto" />
                    </div>
                ) : (
                    <Tabs value={activeTab} onValueChange={(value) => {
                        setActiveTab(value);
                        setExpandedPlanId(null);
                        setExpandAllActive(false);
                        setExpandAllArchive(false);
                    }} className="w-full">
                        <TabsList className="grid w-full grid-cols-3 bg-slate-900 h-11">
                            <TabsTrigger value="active" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-sm">
                                Active Plans ({activePlans.length})
                            </TabsTrigger>
                            <TabsTrigger value="hatchery" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-sm">
                                <ListTree className="w-4 h-4 mr-2" />
                                The Hatchery
                            </TabsTrigger>
                            <TabsTrigger value="archive" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-sm">
                                <Archive className="w-4 h-4 mr-2" />
                                Archive ({archivedPlans.length})
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="active" className="mt-6">
                            {activePlans.length === 0 ? (
                                <Card className="bg-slate-900 border-slate-700">
                                    <CardContent className="text-center py-20">
                                        <Heart className="w-16 h-16 mx-auto text-slate-500 mb-4" />
                                        <h3 className="text-xl font-semibold text-slate-300 mb-2">No Active Breeding Plans</h3>
                                        <p className="text-slate-400 mb-6">Create your first breeding plan to get started!</p>
                                        <Button onClick={() => setIsModalOpen(true)} className="bg-emerald-600 hover:bg-emerald-700">
                                            <PlusCircle className="w-5 h-5 mr-2" />
                                            Create Breeding Plan
                                        </Button>
                                    </CardContent>
                                </Card>
                            ) : (
                                <>
                                    <div className="flex justify-end mb-4">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={handleExpandAllActive}
                                            className="border-slate-600 hover:bg-slate-800"
                                        >
                                            {expandAllActive ? (
                                                <><ChevronUp className="w-4 h-4 mr-2" /> Collapse All</>
                                            ) : (
                                                <><ChevronDown className="w-4 h-4 mr-2" /> Expand All</>
                                            )}
                                        </Button>
                                    </div>
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
                                        {activePlans.map(plan => (
                                            <BreedingPlanCard
                                                key={plan.id}
                                                plan={plan}
                                                geckos={geckos}
                                                onPlanUpdate={loadData}
                                                onPlanDelete={handleDeletePlan}
                                                onPlanArchive={handleArchivePlan}
                                                isExpanded={isPlanExpanded(plan.id)}
                                                onToggleExpanded={handleToggleExpanded}
                                                showArchiveButton={true}
                                            />
                                        ))}
                                    </div>
                                </>
                            )}
                        </TabsContent>

                        <TabsContent value="hatchery" className="mt-6">
                            <Hatchery />
                        </TabsContent>

                        <TabsContent value="archive" className="mt-6">
                            {archivedPlans.length === 0 ? (
                                <Card className="bg-slate-900 border-slate-700">
                                    <CardContent className="text-center py-20">
                                        <Archive className="w-16 h-16 mx-auto text-slate-500 mb-4" />
                                        <h3 className="text-xl font-semibold text-slate-300 mb-2">No Archived Plans</h3>
                                        <p className="text-slate-400">Archived breeding plans will appear here organized by season.</p>
                                    </CardContent>
                                </Card>
                            ) : (
                                <>
                                    <div className="flex justify-end mb-4">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={handleExpandAllArchive}
                                            className="border-slate-600 hover:bg-slate-800"
                                        >
                                            {expandAllArchive ? (
                                                <><ChevronUp className="w-4 h-4 mr-2" /> Collapse All</>
                                            ) : (
                                                <><ChevronDown className="w-4 h-4 mr-2" /> Expand All</>
                                            )}
                                        </Button>
                                    </div>
                                    <div className="space-y-8">
                                        {sortedSeasons.map(season => (
                                            <div key={season}>
                                                <h2 className="text-xl md:text-2xl font-bold text-emerald-400 mb-4 flex items-center gap-2">
                                                    <CalendarIcon className="w-5 h-5 md:w-6 md:h-6" />
                                                    {season}
                                                </h2>
                                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
                                                    {archivedBySeason[season].map(plan => (
                                                        <BreedingPlanCard
                                                            key={plan.id}
                                                            plan={plan}
                                                            geckos={geckos}
                                                            onPlanUpdate={loadData}
                                                            onPlanDelete={handleDeletePlan}
                                                            onPlanArchive={handleArchivePlan}
                                                            isExpanded={isPlanExpanded(plan.id)}
                                                            onToggleExpanded={handleToggleExpanded}
                                                            showArchiveButton={true}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}
                        </TabsContent>
                    </Tabs>
                )}

                {/* Create Plan Modal */}
                <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                    <DialogContent className="bg-slate-900 border-slate-700 text-slate-300 max-w-2xl">
                        <DialogHeader>
                            <DialogTitle className="text-slate-100">Create New Breeding Plan</DialogTitle>
                            <DialogDescription className="text-slate-400">Select a sire and dam to create a new pairing.</DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="sire">Sire (Male)</Label>
                                    <Select value={newPlan.sire_id} onValueChange={(v) => setNewPlan({...newPlan, sire_id: v})}>
                                        <SelectTrigger className="bg-slate-800 border-slate-600">
                                            <SelectValue placeholder="Select male" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-slate-800 border-slate-600 text-slate-200">
                                            {males.map(male => (
                                                <SelectItem key={male.id} value={male.id}>{male.name} ({male.gecko_id_code})</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label htmlFor="dam">Dam (Female)</Label>
                                    <Select value={newPlan.dam_id} onValueChange={(v) => setNewPlan({...newPlan, dam_id: v})}>
                                        <SelectTrigger className="bg-slate-800 border-slate-600">
                                            <SelectValue placeholder="Select female" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-slate-800 border-slate-600 text-slate-200">
                                            {females.map(female => (
                                                <SelectItem key={female.id} value={female.id}>{female.name} ({female.gecko_id_code})</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="breeding_id">Breeding ID (Optional)</Label>
                                    <Input
                                        id="breeding_id"
                                        value={newPlan.breeding_id}
                                        onChange={(e) => setNewPlan({...newPlan, breeding_id: e.target.value})}
                                        placeholder="e.g., BP-2024-001"
                                        className="bg-slate-800 border-slate-600"
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="pairing_date">Pairing Date</Label>
                                    <Input
                                        id="pairing_date"
                                        type="date"
                                        value={newPlan.pairing_date}
                                        onChange={(e) => setNewPlan({...newPlan, pairing_date: e.target.value})}
                                        className="bg-slate-800 border-slate-600"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="status">Status</Label>
                                    <Select value={newPlan.status} onValueChange={(v) => setNewPlan({...newPlan, status: v})}>
                                        <SelectTrigger className="bg-slate-800 border-slate-600">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="bg-slate-800 border-slate-600 text-slate-200">
                                            <SelectItem value="Planned">Planned</SelectItem>
                                            <SelectItem value="Active">Active</SelectItem>
                                            <SelectItem value="Successful">Successful</SelectItem>
                                            <SelectItem value="Failed">Failed</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label htmlFor="breeding_season">Season (Optional)</Label>
                                    <Input
                                        id="breeding_season"
                                        value={newPlan.breeding_season}
                                        onChange={(e) => setNewPlan({...newPlan, breeding_season: e.target.value})}
                                        placeholder={getCurrentSeason()}
                                        className="bg-slate-800 border-slate-600"
                                    />
                                    <p className="text-xs text-slate-500 mt-1">Leave blank to auto-assign current season</p>
                                </div>
                            </div>

                            <div>
                                <Label htmlFor="notes">Notes</Label>
                                <Textarea
                                    id="notes"
                                    value={newPlan.notes}
                                    onChange={(e) => setNewPlan({...newPlan, notes: e.target.value})}
                                    placeholder="Goals, expected outcomes, genetic info, etc..."
                                    className="bg-slate-800 border-slate-600"
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsModalOpen(false)} className="border-slate-600">
                                Cancel
                            </Button>
                            <Button 
                                onClick={handleCreatePlan} 
                                disabled={!newPlan.sire_id || !newPlan.dam_id}
                                className="bg-emerald-600 hover:bg-emerald-700"
                            >
                                Create Plan
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    );
}