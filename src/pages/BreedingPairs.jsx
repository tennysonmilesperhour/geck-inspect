import { useState, useEffect, useCallback, useMemo } from 'react';
import { User, Gecko, BreedingPlan, Egg } from '@/entities/all';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { HeartHandshake, Plus, Egg as EggIcon, Sparkles, Pencil, Trash2, Calendar } from 'lucide-react';
import PageSettingsPanel from '@/components/ui/PageSettingsPanel';
import usePageSettings from '@/hooks/usePageSettings';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format, addDays } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { generateHatchedGeckoIdFromEgg } from '@/components/shared/geckoIdUtils';
import SmartImage from '@/components/shared/SmartImage';

// Helper to generate Google Calendar link
const createGoogleCalendarLink = (title, start, end, description, location) => {
  const formatDate = (date) => date.toISOString().replace(/-|:|\.\d+/g, '');
  const details = {
    action: 'TEMPLATE',
    text: title,
    dates: `${formatDate(start)}/${formatDate(end)}`,
    details: description,
    location: location,
    sf: true,
    output: 'xml'
  };
  const url = new URL('https://www.google.com/calendar/render');
  Object.keys(details).forEach(key => url.searchParams.append(key, details[key]));
  return url.toString();
};

export default function BreedingPairsPage() {
    const [pairsPrefs, setPairsPrefs] = usePageSettings('breeding_pairs_prefs', {
        sortBy: '-created_date',
        showEstimatedDates: true,
        compactCards: false,
    });
    const [allGeckos, setAllGeckos] = useState([]);
    const [geckos, setGeckos] = useState([]);
    const [breedingPlans, setBreedingPlans] = useState([]);
    const [eggs, setEggs] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [editingPlan, setEditingPlan] = useState(null);

    const loadData = useCallback(async () => {
        setIsLoading(true);
        try {
            const currentUser = await User.me();
            if (currentUser) {
                const { getVisibleGeckos } = await import('@/lib/geckoAccess');
                const [userGeckos, plans, userEggs] = await Promise.all([
                    getVisibleGeckos(currentUser),
                    BreedingPlan.filter({ created_by: currentUser.email }, pairsPrefs.sortBy),
                    Egg.filter({ created_by: currentUser.email })
                ]);
                const filtered = userGeckos.filter(g => !g.notes?.startsWith('[Manual sale]'));
                setAllGeckos(filtered);
                setGeckos(filtered.filter(g => !g.archived));
                setBreedingPlans(plans);
                setEggs(userEggs);
            }
        } catch (error) {
            console.error("Failed to load data:", error);
        }
        setIsLoading(false);
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const males = geckos.filter(g => g.sex === 'Male');
    const females = geckos.filter(g => g.sex === 'Female');

    const handleHatch = async (egg, plan) => {
        const sire = allGeckos.find(g => g.id === plan.sire_id);
        const dam = allGeckos.find(g => g.id === plan.dam_id);

        if (!sire || !dam) {
            console.error("Sire or Dam not found for this plan.");
            return;
        }

        try {
            // Auto-generate the new gecko's ID using the new April 2026 format.
            // Filter `eggs` down to this pair's eggs (both laid and already
            // hatched) so generateHatchedGeckoIdFromEgg can compute clutch
            // grouping + offspring number.
            const pairEggs = eggs.filter(e => e.breeding_plan_id === plan.id);
            const newGeckoIdCode = generateHatchedGeckoIdFromEgg({
                sire,
                dam,
                egg,
                allEggsForPair: pairEggs,
            });

            // Create new gecko with auto-populated fields
            const newGecko = await Gecko.create({
                name: `${sire.name} x ${dam.name} Hatchling`,
                gecko_id_code: newGeckoIdCode,
                hatch_date: format(new Date(), 'yyyy-MM-dd'),
                sex: 'Unsexed',
                sire_id: sire.id,
                dam_id: dam.id,
                status: 'Pet',
                morphs_traits: '',
                notes: `Hatched from egg laid on ${format(new Date(egg.lay_date), 'PPP')}. From breeding pair: ${sire.name} x ${dam.name}.`,
                image_urls: []
            });

            // Update egg status
            await Egg.update(egg.id, {
                status: 'Hatched',
                hatch_date_actual: format(new Date(), 'yyyy-MM-dd'),
                gecko_id: newGecko.id
            });

            // Refresh data to show changes
            loadData();
        } catch (error) {
            console.error('Failed to hatch egg:', error);
        }
    };

    const handleEditPlan = (plan) => {
        setEditingPlan(plan);
    };

    const handleUpdatePlan = async (planId, updates) => {
        try {
            await BreedingPlan.update(planId, updates);
            setEditingPlan(null);
            loadData();
        } catch (error) {
            console.error('Failed to update breeding plan:', error);
        }
    };

    const handleDeletePlan = async (planId) => {
        if (window.confirm('Are you sure you want to delete this breeding plan? This will also delete all associated eggs.')) {
            try {
                // Delete associated eggs first
                const planEggs = eggs.filter(e => e.breeding_plan_id === planId);
                for (const egg of planEggs) {
                    await Egg.delete(egg.id);
                }

                await BreedingPlan.delete(planId);
                loadData();
            } catch (error) {
                console.error('Failed to delete breeding plan:', error);
            }
        }
    };

    // Client-side sorting for egg-based sort options
    const sortedPlans = useMemo(() => {
        const eggSorts = ['oldest_egg', 'newest_egg', 'most_eggs'];
        if (!eggSorts.includes(pairsPrefs.sortBy)) return breedingPlans;

        const getEggsForPlan = (planId) => eggs.filter(e => e.breeding_plan_id === planId && !e.archived);

        return [...breedingPlans].sort((a, b) => {
            const aEggs = getEggsForPlan(a.id);
            const bEggs = getEggsForPlan(b.id);

            if (pairsPrefs.sortBy === 'most_eggs') {
                return bEggs.length - aEggs.length;
            }

            // oldest_egg: plan whose earliest egg is oldest first
            // newest_egg: plan whose most recent egg is newest first
            const getDate = (planEggs, pickFn) => {
                if (planEggs.length === 0) return null;
                const dates = planEggs.map(e => new Date(e.lay_date).getTime()).filter(d => !isNaN(d));
                return dates.length > 0 ? pickFn(...dates) : null;
            };

            if (pairsPrefs.sortBy === 'oldest_egg') {
                const aOldest = getDate(aEggs, Math.min);
                const bOldest = getDate(bEggs, Math.min);
                if (aOldest == null && bOldest == null) return 0;
                if (aOldest == null) return 1;
                if (bOldest == null) return -1;
                return aOldest - bOldest;
            }

            // newest_egg
            const aNewest = getDate(aEggs, Math.max);
            const bNewest = getDate(bEggs, Math.max);
            if (aNewest == null && bNewest == null) return 0;
            if (aNewest == null) return 1;
            if (bNewest == null) return -1;
            return bNewest - aNewest;
        });
    }, [breedingPlans, eggs, pairsPrefs.sortBy]);

    return (
        <div className="min-h-screen bg-slate-950 p-4 md:p-8">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 gap-4">
                    <div className="text-center md:text-left">
                         <div className="flex items-center justify-center md:justify-start gap-3 mb-2">
                            <div className="w-12 h-12 bg-gradient-to-br from-pink-600 to-rose-600 rounded-xl flex items-center justify-center shadow-lg">
                                <HeartHandshake className="w-6 h-6 text-white" />
                            </div>
                            <h1 className="text-4xl font-bold text-slate-100">Breeding Pairs</h1>
                        </div>
                        <p className="text-lg text-slate-400">Manage your gecko breeding programs and track offspring.</p>
                    </div>
                    <div className="flex gap-2">
                        <PageSettingsPanel title="Breeding Pairs Settings">
                            <div>
                                <Label className="text-slate-300 text-sm mb-1 block">Sort By</Label>
                                <Select value={pairsPrefs.sortBy} onValueChange={v => setPairsPrefs({ sortBy: v })}>
                                    <SelectTrigger className="w-full h-8 text-xs">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="-created_date">Newest First</SelectItem>
                                        <SelectItem value="created_date">Oldest First</SelectItem>
                                        <SelectItem value="status">Status</SelectItem>
                                        <SelectItem value="oldest_egg">Oldest Egg Drop</SelectItem>
                                        <SelectItem value="newest_egg">Newest Egg Drop</SelectItem>
                                        <SelectItem value="most_eggs">Most Eggs</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex items-center justify-between">
                                <Label className="text-slate-300 text-sm">Show Estimated Dates</Label>
                                <Switch checked={pairsPrefs.showEstimatedDates} onCheckedChange={v => setPairsPrefs({ showEstimatedDates: v })} />
                            </div>
                            <div className="flex items-center justify-between">
                                <Label className="text-slate-300 text-sm">Compact Cards</Label>
                                <Switch checked={pairsPrefs.compactCards} onCheckedChange={v => setPairsPrefs({ compactCards: v })} />
                            </div>
                        </PageSettingsPanel>
                        <PlanPairingForm males={males} females={females} onPlanCreated={loadData} />
                    </div>
                </div>

                {/* Content */}
                {isLoading ? (
                    <div className="text-center text-slate-400">Loading breeding pairs...</div>
                ) : sortedPlans.length === 0 ? (
                     <Card className="text-center py-16 bg-slate-900 rounded-lg border border-slate-700">
                        <CardContent>
                            <HeartHandshake className="w-16 h-16 mx-auto mb-4 text-slate-500" />
                            <h3 className="text-xl font-semibold text-slate-100">No breeding pairs yet</h3>
                            <p className="text-slate-400 mt-2">Create a new breeding plan to get started.</p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className={`grid grid-cols-1 ${pairsPrefs.compactCards ? 'lg:grid-cols-3 gap-4' : 'lg:grid-cols-2 gap-8'}`}>
                        {sortedPlans.map(plan => {
                            const sire = allGeckos.find(g => g.id === plan.sire_id);
                            const dam = allGeckos.find(g => g.id === plan.dam_id);
                            const planEggs = eggs.filter(e => e.breeding_plan_id === plan.id);

                            return (
                                <BreedingPlanCard
                                    key={plan.id}
                                    plan={plan}
                                    sire={sire}
                                    dam={dam}
                                    eggs={planEggs}
                                    onDataRefresh={loadData}
                                    onHatch={handleHatch}
                                    onEdit={handleEditPlan}
                                    onDelete={handleDeletePlan}
                                    showEstimatedDates={pairsPrefs.showEstimatedDates}
                                    compact={pairsPrefs.compactCards}
                                />
                            );
                        })}
                    </div>
                )}

                {/* Edit Plan Modal */}
                {editingPlan && (
                    <EditBreedingPlanModal
                        plan={editingPlan}
                        males={males}
                        females={females}
                        onSave={handleUpdatePlan}
                        onClose={() => setEditingPlan(null)}
                    />
                )}
            </div>
        </div>
    );
}

function PlanPairingForm({ males, females, onPlanCreated }) {
    const [isOpen, setIsOpen] = useState(false);
    const [formData, setFormData] = useState({ sire_id: '', dam_id: '', pairing_date: new Date(), notes: '' });

    const handleSubmit = async (e) => {
        e.preventDefault();
        await BreedingPlan.create({
            ...formData,
            pairing_date: format(formData.pairing_date, 'yyyy-MM-dd')
        });

        // Calendar event generation is now handled within BreedingPlanCard for estimates
        // or through a separate action for specific events.
        // No longer generating ICS here.

        setIsOpen(false);
        onPlanCreated();
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button size="lg" className="bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 shadow-lg">
                    <Plus className="w-5 h-5 mr-2" />
                    Plan New Pairing
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader><DialogTitle>Plan a New Breeding Pair</DialogTitle></DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <Label>Sire (Male)</Label>
                            <Select onValueChange={v => setFormData({...formData, sire_id: v})} required>
                                <SelectTrigger><SelectValue placeholder="Choose a male" /></SelectTrigger>
                                <SelectContent>{males.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Dam (Female)</Label>
                            <Select onValueChange={v => setFormData({...formData, dam_id: v})} required>
                                <SelectTrigger><SelectValue placeholder="Choose a female" /></SelectTrigger>
                                <SelectContent>{females.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                    </div>
                     <div>
                        <Label>Pairing Date</Label>
                        <EnhancedDatePicker
                            date={formData.pairing_date}
                            onDateChange={d => setFormData({...formData, pairing_date: d})}
                        />
                    </div>
                    <div>
                        <Label>Notes</Label>
                        <Textarea value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} placeholder="Notes on this pairing..." />
                    </div>
                    <Button type="submit" className="w-full">Save Plan</Button>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function EditBreedingPlanModal({ plan, males, females, onSave, onClose }) {
    // Defensive initial state. `plan.pairing_date` can come back as null,
    // an empty string, or an invalid ISO from the DB — `new Date()` of any
    // of those yields either epoch 1970 or Invalid Date, which then
    // explodes in `format()` downstream. Fall back to today when the
    // stored value is unusable so the modal never crashes on mount.
    const parseStoredDate = (raw) => {
        if (!raw) return new Date();
        const d = new Date(raw);
        return isNaN(d.getTime()) ? new Date() : d;
    };

    const [formData, setFormData] = useState({
        sire_id: plan.sire_id || '',
        dam_id: plan.dam_id || '',
        pairing_date: parseStoredDate(plan.pairing_date),
        status: plan.status || 'Planned',
        notes: plan.notes || ''
    });

    // Radix Select requires every SelectItem to have a non-empty string
    // value. If we hand it a gecko with a null/empty id (e.g. a partially
    // created row) the entire modal render throws and the edit button
    // appears to do nothing. Filter those out up front.
    const validMales = (males || []).filter((g) => g && typeof g.id === 'string' && g.id.length > 0);
    const validFemales = (females || []).filter((g) => g && typeof g.id === 'string' && g.id.length > 0);

    const handleSubmit = async (e) => {
        e.preventDefault();
        await onSave(plan.id, {
            ...formData,
            pairing_date: format(formData.pairing_date, 'yyyy-MM-dd')
        });
    };

    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl bg-slate-900 border-slate-700 text-slate-100">
                <DialogHeader>
                    <DialogTitle className="text-slate-100">Edit Breeding Plan</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <Label>Sire (Male)</Label>
                            <Select value={formData.sire_id || ''} onValueChange={v => setFormData({...formData, sire_id: v})}>
                                <SelectTrigger><SelectValue placeholder="Choose a male" /></SelectTrigger>
                                <SelectContent>
                                    {validMales.map(g => <SelectItem key={g.id} value={g.id}>{g.name || 'Unnamed'}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Dam (Female)</Label>
                            <Select value={formData.dam_id || ''} onValueChange={v => setFormData({...formData, dam_id: v})}>
                                <SelectTrigger><SelectValue placeholder="Choose a female" /></SelectTrigger>
                                <SelectContent>
                                    {validFemales.map(g => <SelectItem key={g.id} value={g.id}>{g.name || 'Unnamed'}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div>
                        <Label>Status</Label>
                        <Select value={formData.status} onValueChange={v => setFormData({...formData, status: v})}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Planned">Planned</SelectItem>
                                <SelectItem value="Active">Active</SelectItem>
                                <SelectItem value="Successful">Successful</SelectItem>
                                <SelectItem value="Failed">Failed</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div>
                        <Label>Pairing Date</Label>
                        <EnhancedDatePicker
                            date={formData.pairing_date}
                            onDateChange={d => setFormData({...formData, pairing_date: d})}
                        />
                    </div>

                    <div>
                        <Label>Notes</Label>
                        <Textarea
                            value={formData.notes}
                            onChange={e => setFormData({...formData, notes: e.target.value})}
                            placeholder="Notes on this pairing..."
                        />
                    </div>

                    <div className="flex gap-2">
                        <Button type="submit" className="flex-1">Save Changes</Button>
                        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function BreedingPlanCard({ plan, sire, dam, eggs, onDataRefresh, onHatch, onEdit, onDelete, showEstimatedDates = true, compact = false }) {
     const [planToDelete, setPlanToDelete] = useState(null);

     const handleConfirmDelete = async () => {
         if (planToDelete) {
             await onDelete(planToDelete);
             setPlanToDelete(null);
         }
     };

     const GeckoImagePlaceholder = ({ gender }) => (
        <div className={`aspect-square w-full rounded-lg flex items-center justify-center ${gender === 'male' ? 'bg-blue-900/40' : 'bg-pink-900/40'}`}>
            <span className={`text-4xl font-bold ${gender === 'male' ? 'text-blue-400' : 'text-pink-400'}`}>{gender === 'male' ? '♂' : '♀'}</span>
        </div>
    );

    // Calculate estimated dates for calendar integration
    const pairingDate = new Date(plan.pairing_date);
    const estimatedLayDate = addDays(pairingDate, 30); // Approx. 30 days after pairing
    const estimatedHatchDate = addDays(estimatedLayDate, 65); // Approx. 65 days incubation

    const handleCalendarClick = (title, startDate, description) => {
        const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // 1 hour event
        const link = createGoogleCalendarLink(title, startDate, endDate, description, 'Your Breeding Setup');
        window.open(link, '_blank');
    };

    return (
        <Card className="bg-slate-900 border-slate-700 shadow-lg flex flex-col">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle className="text-xl text-slate-100">{sire?.name || 'Sire'} x {dam?.name || 'Dam'}</CardTitle>
                    <div className="flex items-center gap-2">
                        <Badge variant={plan.status === 'Active' ? 'default' : 'secondary'}>{plan.status}</Badge>
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                onEdit(plan);
                            }}
                            title="Edit Plan"
                            className="border-emerald-700/60 text-slate-100"
                        >
                            <Pencil className="w-4 h-4" />
                        </Button>
                        <AlertDialog open={planToDelete === plan.id} onOpenChange={(open) => { if (!open) setPlanToDelete(null); }}>
                             <Button
                                 size="sm"
                                 variant="destructive"
                                 onClick={() => setPlanToDelete(plan.id)}
                                 title="Delete Plan"
                             >
                                 <Trash2 className="w-4 h-4" />
                             </Button>
                             <AlertDialogContent className="bg-slate-900 border-slate-700">
                                 <AlertDialogHeader>
                                     <AlertDialogTitle className="text-slate-100">Delete this breeding plan?</AlertDialogTitle>
                                     <AlertDialogDescription className="text-slate-400">
                                         This will permanently delete this breeding plan and all associated eggs. This action cannot be undone.
                                     </AlertDialogDescription>
                                 </AlertDialogHeader>
                                 <AlertDialogFooter>
                                     <AlertDialogCancel className="border-slate-600 text-slate-200">Cancel</AlertDialogCancel>
                                     <AlertDialogAction onClick={handleConfirmDelete} className="bg-red-600 hover:bg-red-700 text-white">
                                         Delete Plan
                                     </AlertDialogAction>
                                 </AlertDialogFooter>
                             </AlertDialogContent>
                         </AlertDialog>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="flex-grow space-y-4">
                <div className="grid grid-cols-2 gap-4 items-center">
                    <div className="text-center">
                        {sire?.image_urls?.[0] ? <SmartImage src={sire.image_urls[0]} alt={sire.name} width={400} aspect="square" containerClassName="rounded-lg" /> : <GeckoImagePlaceholder gender="male" />}
                        <p className="mt-2 font-medium text-blue-400">{sire?.name || 'Sire not found'}</p>
                    </div>
                    <div className="text-center">
                        {dam?.image_urls?.[0] ? <SmartImage src={dam.image_urls[0]} alt={dam.name} width={400} aspect="square" containerClassName="rounded-lg" /> : <GeckoImagePlaceholder gender="female" />}
                        <p className="mt-2 font-medium text-pink-400">{dam?.name || 'Dam not found'}</p>
                    </div>
                </div>
                <div className="space-y-3">
                    <h4 className="font-semibold text-slate-200">Eggs ({eggs.length})</h4>
                    <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                        {eggs.map(egg => <EggCard key={egg.id} egg={egg} onHatch={() => onHatch(egg, plan)} />)}
                    </div>
                     <AddEggForm planId={plan.id} onEggAdded={onDataRefresh} sire={sire} dam={dam} />
                </div>

                {/* Calendar Integration */}
                {showEstimatedDates && <div className="mt-4 p-3 bg-slate-800 rounded-lg">
                    <h4 className="font-semibold text-slate-100 mb-2 flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        Add to Calendar
                    </h4>
                    <div className="flex flex-wrap gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCalendarClick(
                                `Expected Egg Lay - ${sire?.name || 'Sire'} × ${dam?.name || 'Dam'}`,
                                estimatedLayDate,
                                `Estimated egg laying date for breeding pair: ${sire?.name || 'Sire'} (${sire?.gecko_id_code || 'N/A'}) × ${dam?.name || 'Dam'} (${dam?.gecko_id_code || 'N/A'})`
                            )}
                        >
                            📅 Egg Lay Estimate
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCalendarClick(
                                `Expected Hatch - ${sire?.name || 'Sire'} × ${dam?.name || 'Dam'}`,
                                estimatedHatchDate,
                                `Estimated hatch date for eggs from breeding pair: ${sire?.name || 'Sire'} (${sire?.gecko_id_code || 'N/A'}) × ${dam?.name || 'Dam'} (${dam?.gecko_id_code || 'N/A'})`
                            )}
                        >
                            🐣 Hatch Estimate
                        </Button>
                    </div>
                </div>}
            </CardContent>
        </Card>
    );
}

function AddEggForm({ planId, onEggAdded, sire: _sire, dam: _dam }) {
    const [isOpen, setIsOpen] = useState(false);
    const [layDate, setLayDate] = useState(new Date());
    const [grade, setGrade] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        const expectedHatch = addDays(layDate, 75);
        const eggData = {
            breeding_plan_id: planId,
            lay_date: format(layDate, 'yyyy-MM-dd'),
            hatch_date_expected: format(expectedHatch, 'yyyy-MM-dd'),
            status: 'Incubating',
        };
        if (grade) eggData.grade = grade;
        await Egg.create(eggData);

        // Calendar event for expected hatch from specific egg is not generated here.
        // It can be triggered manually from the card or managed as an estimate for the pair.

        setIsOpen(false);
        onEggAdded();
    };

    return (
         <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" className="w-full"><Plus className="w-4 h-4 mr-2" />Add Egg</Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader><DialogTitle>Add an Egg to this Clutch</DialogTitle></DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <Label>Lay Date</Label>
                        <EnhancedDatePicker
                            date={layDate}
                            onDateChange={setLayDate}
                        />
                    </div>
                    <div>
                        <Label>Egg Grade (optional)</Label>
                        <Select value={grade} onValueChange={setGrade}>
                            <SelectTrigger><SelectValue placeholder="Select grade" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="A+">A+ — Excellent</SelectItem>
                                <SelectItem value="A">A — Great</SelectItem>
                                <SelectItem value="B">B — Good</SelectItem>
                                <SelectItem value="C">C — Fair</SelectItem>
                                <SelectItem value="D">D — Poor</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <Button type="submit" className="w-full">Save Egg</Button>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function EggCard({ egg, onHatch }) {
    return (
        <div className="p-3 bg-slate-800 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-2">
                <EggIcon className="w-5 h-5 text-amber-400" />
                <div>
                    <p className="text-sm font-medium text-slate-200">
                        Laid: {format(new Date(egg.lay_date), 'MMM d, yyyy')}
                    </p>
                    <p className="text-xs text-slate-400">
                        Expected Hatch: {format(new Date(egg.hatch_date_expected), 'MMM d, yyyy')}
                    </p>
                </div>
            </div>
            {egg.status === 'Incubating' ? (
                <div className="flex items-center gap-1">
                    <Button size="sm" onClick={onHatch} className="bg-green-600 text-white hover:bg-green-700">
                        <Sparkles className="w-4 h-4 mr-1" />
                        Hatch
                    </Button>
                </div>
            ) : (
                <Badge>{egg.status}</Badge>
            )}
        </div>
    );
}

// Enhanced Date Picker Component
function EnhancedDatePicker({ date, onDateChange }) {
    const [isCalendarOpen, setIsCalendarOpen] = useState(false);
    const [inputValue, setInputValue] = useState(date instanceof Date && !isNaN(date) ? format(date, 'yyyy-MM-dd') : '');

    useEffect(() => {
        if (date instanceof Date && !isNaN(date)) {
            setInputValue(format(date, 'yyyy-MM-dd'));
        } else {
            setInputValue('');
        }
    }, [date]);

    const handleInputChange = (e) => {
        const value = e.target.value;
        setInputValue(value);

        const newDate = new Date(value);
        if (!isNaN(newDate.getTime()) && value.length === 10) {
            onDateChange(newDate);
        } else if (value === '') {
            onDateChange(null);
        }
    };

    const handleCalendarSelect = (selectedDate) => {
        if (selectedDate) {
            onDateChange(selectedDate);
            setIsCalendarOpen(false);
        }
    };

    return (
        <div className="flex gap-2">
            <Input
                type="date"
                value={inputValue}
                onChange={handleInputChange}
                className="flex-1"
            />
            <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                <PopoverTrigger asChild>
                    <Button variant="outline" size="icon" className="shrink-0">
                        <CalendarIcon className="w-4 h-4" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                    <CalendarComponent
                        mode="single"
                        selected={date}
                        onSelect={handleCalendarSelect}
                        initialFocus
                    />
                </PopoverContent>
            </Popover>
        </div>
    );
}