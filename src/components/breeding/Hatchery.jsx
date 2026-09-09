import { useState, useEffect } from 'react';
import { Egg, BreedingPlan, Gecko, User } from '@/entities/all';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Egg as EggIcon, Search, Timer, Archive, ArchiveRestore, Sparkles, XCircle, Thermometer, ChevronDown } from 'lucide-react';
import LoadingSpinner from '../shared/LoadingSpinner';
import { format, differenceInDays } from 'date-fns';
import { todayLocalISO, parseLocalDate } from '@/lib/dateUtils';
import EggDetailModal from './EggDetailModal';
import { generateHatchedGeckoIdFromEgg } from '../shared/geckoIdUtils';
import { currentSeasonLabel, inferSeasonLabel } from '@/lib/seasons';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useToast } from '@/components/ui/use-toast';
import {
    DEFAULT_INCUBATION_PROFILE_ID,
    INCUBATION_PROFILES,
    getEstimatedHatchDates,
    getIncubationProfile,
} from '@/lib/incubationProfiles';

export default function Hatchery() {
    const { toast } = useToast();
    const [eggs, setEggs] = useState([]);
    const [filteredEggs, setFilteredEggs] = useState([]);
    const [breedingPlans, setBreedingPlans] = useState([]);
    const [geckos, setGeckos] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [incubationProfileId, setIncubationProfileId] = useState(DEFAULT_INCUBATION_PROFILE_ID);
    const [savedIncubationProfileId, setSavedIncubationProfileId] = useState(DEFAULT_INCUBATION_PROFILE_ID);
    const [isSavingIncubation, setIsSavingIncubation] = useState(false);
    const [isTemperatureGuideOpen, setIsTemperatureGuideOpen] = useState(false);
    const [selectedEgg, setSelectedEgg] = useState(null);
    
    const [filters, setFilters] = useState({
        season: 'all',
        status: 'all',
        search: '',
        showArchived: false
    });
    
    const [sortBy, setSortBy] = useState('incubation_longest');

    useEffect(() => {
        loadData();
    }, []);
    
    // Load user's default sort preference and hatch alert days
    useEffect(() => {
        const loadUserPreference = async () => {
            try {
                const currentUser = await User.me();
                if (currentUser?.default_breeding_sort) {
                    setSortBy(currentUser.default_breeding_sort);
                }
                if (currentUser?.incubation_temperature_range) {
                    setIncubationProfileId(currentUser.incubation_temperature_range);
                    setSavedIncubationProfileId(currentUser.incubation_temperature_range);
                }
            } catch (error) {
                console.error("Failed to load user preferences:", error);
            }
        };
        loadUserPreference();
    }, []);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const user = await User.me();
            const { getVisibleGeckos } = await import('@/lib/geckoAccess');
            const [eggsData, plansData, geckosData] = await Promise.all([
                Egg.filter({ created_by: user.email }, '-lay_date'),
                BreedingPlan.filter({ created_by: user.email }),
                // Hatchery shows pairs and offspring from any collection
                // the user is a member of, not just ones they created.
                getVisibleGeckos(user)
            ]);

            // One-time backfill: hatching from this page used to leave eggs
            // un-archived, so old "Hatched" rows still showed in the default
            // view. The breeding-pair flow archives on hatch (PlanDetails);
            // mirror that here for any stragglers we find.
            const orphans = eggsData.filter(e => e.status === 'Hatched' && !e.archived);
            if (orphans.length > 0) {
                const today = todayLocalISO();
                await Promise.all(orphans.map(e =>
                    Egg.update(e.id, { archived: true, archived_date: e.hatch_date_actual || today })
                        .catch(err => console.warn(`Failed to backfill archive for egg ${e.id}:`, err))
                ));
                for (const e of orphans) {
                    e.archived = true;
                    e.archived_date = e.hatch_date_actual || today;
                }
            }

            setEggs(eggsData);
            setBreedingPlans(plansData);
            setGeckos(geckosData);
        } catch (error) {
            console.error("Failed to load hatchery data:", error);
        }
        setIsLoading(false);
    };

    useEffect(() => {
        let result = [...eggs];

        // Filter archived
        result = result.filter(egg => filters.showArchived ? egg.archived : !egg.archived);

        // Filter by season
        if (filters.season !== 'all') {
            result = result.filter(egg => {
                const plan = breedingPlans.find(p => p.id === egg.breeding_plan_id);
                return plan?.breeding_season === filters.season;
            });
        }

        // Filter by status
        if (filters.status !== 'all') {
            result = result.filter(egg => egg.status === filters.status);
        }

        // Search filter
        if (filters.search) {
            result = result.filter(egg => {
                const plan = breedingPlans.find(p => p.id === egg.breeding_plan_id);
                const sire = geckos.find(g => g.id === plan?.sire_id);
                const dam = geckos.find(g => g.id === plan?.dam_id);
                
                const searchLower = filters.search.toLowerCase();
                return (
                    sire?.name?.toLowerCase().includes(searchLower) ||
                    dam?.name?.toLowerCase().includes(searchLower) ||
                    plan?.breeding_id?.toLowerCase().includes(searchLower)
                );
            });
        }

        // Sort
        result.sort((a, b) => {
            const today = new Date();
            const daysIncubatingA = differenceInDays(today, parseLocalDate(a.lay_date));
            const daysIncubatingB = differenceInDays(today, parseLocalDate(b.lay_date));
            
            switch (sortBy) {
                case 'incubation_longest':
                    return daysIncubatingB - daysIncubatingA;
                case 'incubation_shortest':
                    return daysIncubatingA - daysIncubatingB;
                case 'lay_date_desc':
                    return new Date(b.lay_date) - new Date(a.lay_date);
                case 'lay_date_asc':
                    return new Date(a.lay_date) - new Date(b.lay_date);
                case 'hatch_date_desc': {
                    const estimateA = getEstimatedHatchDates(a.lay_date, incubationProfileId)?.estimated;
                    const estimateB = getEstimatedHatchDates(b.lay_date, incubationProfileId)?.estimated;
                    return (estimateB?.getTime() || 0) - (estimateA?.getTime() || 0);
                }
                case 'hatch_date_asc': {
                    const estimateA = getEstimatedHatchDates(a.lay_date, incubationProfileId)?.estimated;
                    const estimateB = getEstimatedHatchDates(b.lay_date, incubationProfileId)?.estimated;
                    return (estimateA?.getTime() || 0) - (estimateB?.getTime() || 0);
                }
                default:
                    return daysIncubatingB - daysIncubatingA;
            }
        });

        setFilteredEggs(result);
    }, [eggs, filters, sortBy, breedingPlans, geckos, incubationProfileId]);

    const uniqueSeasons = [...new Set(breedingPlans.map(p => p.breeding_season).filter(Boolean))];

    const getStatusColor = (status) => {
        const colors = {
            'Hatched': 'bg-green-600',
            'Incubating': 'bg-blue-600',
            'Slug': 'bg-red-600',
            'Infertile': 'bg-red-600',
            'Stillbirth': 'bg-gray-600'
        };
        return colors[status] || 'bg-gray-600';
    };

    const handleEggClick = (egg) => {
        setSelectedEgg(egg);
    };

    const incubationProfile = getIncubationProfile(incubationProfileId);
    const newEggEstimate = getEstimatedHatchDates(todayLocalISO(), incubationProfileId);
    const incubationSettingChanged = incubationProfileId !== savedIncubationProfileId;

    const handleSaveIncubationProfile = async () => {
        setIsSavingIncubation(true);
        try {
            await User.updateMyUserData({
                incubation_temperature_range: incubationProfile.id,
                hatch_alert_days: incubationProfile.alertDay,
            });

            const incubatingEggs = eggs.filter((egg) => egg.status === 'Incubating' && !egg.archived && egg.lay_date);
            const eggUpdates = await Promise.allSettled(incubatingEggs.map((egg) => {
                const estimate = getEstimatedHatchDates(egg.lay_date, incubationProfile.id);
                return Egg.update(egg.id, {
                    hatch_date_expected: format(estimate.estimated, 'yyyy-MM-dd'),
                });
            }));
            eggUpdates
                .filter((result) => result.status === 'rejected')
                .forEach((result) => console.warn('Failed to update an active egg estimate:', result.reason));

            setSavedIncubationProfileId(incubationProfile.id);
            await loadData();
            toast({
                title: 'Incubation timing updated',
                description: `Active egg estimates now use ${incubationProfile.fahrenheit}. Hatch alerts begin on day ${incubationProfile.alertDay}.`,
            });
        } catch (error) {
            console.error('Failed to save incubation profile:', error);
            toast({
                title: 'Could not update incubation timing',
                description: 'Your previous setting is still in place. Please try again.',
                variant: 'destructive',
            });
        } finally {
            setIsSavingIncubation(false);
        }
    };
    
    const handleArchiveEgg = async (eggId, shouldArchive, e) => {
        e.stopPropagation();
        try {
            await Egg.update(eggId, {
                archived: shouldArchive,
                archived_date: shouldArchive ? todayLocalISO() : null
            });
            await loadData();
        } catch (error) {
            console.error("Failed to archive egg:", error);
        }
    };

    const handleHatchEgg = async (egg, e) => {
        e.stopPropagation();
        const plan = breedingPlans.find(p => p.id === egg.breeding_plan_id);
        const sire = plan ? geckos.find(g => g.id === plan.sire_id) : null;
        const dam = plan ? geckos.find(g => g.id === plan.dam_id) : null;

        if (!plan || !sire || !dam) {
            alert("Can't auto-hatch, this egg's breeding plan, sire, or dam is missing. Open the egg to mark it manually.");
            return;
        }

        const today = todayLocalISO();
        try {
            const pairEggs = eggs.filter(e => e.breeding_plan_id === plan.id);
            const newGeckoIdCode = generateHatchedGeckoIdFromEgg({
                sire, dam, egg, allEggsForPair: pairEggs,
            });

            const newGecko = await Gecko.create({
                name: `${sire.name} x ${dam.name} Hatchling`,
                gecko_id_code: newGeckoIdCode,
                hatch_date: today,
                sex: 'Unsexed',
                sire_id: sire.id,
                dam_id: dam.id,
                status: 'Pet',
                morphs_traits: '',
                notes: `Hatched from egg laid on ${format(parseLocalDate(egg.lay_date), 'PPP')}. From breeding pair: ${sire.name} x ${dam.name}.`,
                image_urls: [],
            });

            await Egg.update(egg.id, {
                status: 'Hatched',
                hatch_date_actual: today,
                gecko_id: newGecko.id,
                archived: true,
                archived_date: today,
            });

            await loadData();
        } catch (error) {
            console.error('Failed to hatch egg:', error);
            alert(`Failed to hatch: ${error.message || 'unknown error'}`);
        }
    };

    const handleMarkFailed = async (eggId, newStatus, e) => {
        e.stopPropagation();
        try {
            await Egg.update(eggId, {
                status: newStatus,
                archived: true,
                archived_date: todayLocalISO(),
            });
            await loadData();
        } catch (error) {
            console.error('Failed to update egg status:', error);
            alert(`Failed to update status: ${error.message || 'unknown error'}`);
        }
    };

    const currentSeason = currentSeasonLabel();
    const planSeasonById = breedingPlans.reduce((acc, p) => {
        if (p?.id) acc[p.id] = p.breeding_season || null;
        return acc;
    }, {});
    const eggSeason = (egg) => {
        const fromPlan = egg.breeding_plan_id ? planSeasonById[egg.breeding_plan_id] : null;
        return fromPlan || inferSeasonLabel(egg.lay_date);
    };
    const allNonArchived = eggs.filter(e => !e.archived);
    const stats = {
        incubating: allNonArchived.filter(e => e.status === 'Incubating').length,
        hatchedTotal: eggs.filter(e => e.status === 'Hatched').length,
        hatchedSeason: eggs.filter(e => e.status === 'Hatched' && eggSeason(e) === currentSeason).length,
        failedTotal: eggs.filter(e => ['Slug', 'Infertile', 'Stillbirth'].includes(e.status)).length,
        failedSeason: eggs.filter(e => ['Slug', 'Infertile', 'Stillbirth'].includes(e.status) && eggSeason(e) === currentSeason).length,
    };

    if (isLoading) {
        return (
            <div className="flex justify-center items-center py-20">
                <LoadingSpinner />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Stats Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="bg-blue-900/30 border border-blue-700/50 rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-blue-400">{stats.incubating}</p>
                    <p className="text-xs text-blue-300 mt-1">Incubating</p>
                </div>
                <div className="bg-green-900/30 border border-green-700/50 rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-green-400">{stats.hatchedTotal}</p>
                    <p className="text-xs text-green-300 mt-1">Hatched (All Time)</p>
                </div>
                <div className="bg-emerald-900/30 border border-emerald-700/50 rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-emerald-400">{stats.hatchedSeason}</p>
                    <p className="text-xs text-emerald-300 mt-1">Hatched · {currentSeason}</p>
                </div>
                <div className="bg-red-900/30 border border-red-700/50 rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-red-400">{stats.failedTotal}</p>
                    <p className="text-xs text-red-300 mt-1">Failed (All Time)</p>
                </div>
                <div className="bg-orange-900/30 border border-orange-700/50 rounded-lg p-4 text-center sm:col-span-1 col-span-2">
                    <p className="text-2xl font-bold text-orange-400">{stats.failedSeason}</p>
                    <p className="text-xs text-orange-300 mt-1">Failed · {currentSeason}</p>
                </div>
            </div>

            <Card className="bg-slate-900 border-slate-700 overflow-hidden">
                <CardContent className="p-5 sm:p-6 space-y-5">
                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                        <div className="flex items-start gap-3">
                            <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-2.5">
                                <Thermometer className="w-5 h-5 text-emerald-400" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-slate-100">Incubation temperature</h3>
                                <p className="text-sm text-slate-400 mt-1 max-w-2xl">
                                    Choose the range your incubator usually holds. Geck Inspect will adjust hatch estimates and the default alert day for your active eggs.
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-2 lg:min-w-[360px]">
                            <Select value={incubationProfileId} onValueChange={setIncubationProfileId}>
                                <SelectTrigger className="bg-slate-800 border-slate-600 min-w-[250px]">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-slate-800 border-slate-600">
                                    {INCUBATION_PROFILES.map((profile) => (
                                        <SelectItem key={profile.id} value={profile.id}>
                                            {profile.label}: {profile.fahrenheit}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Button
                                onClick={handleSaveIncubationProfile}
                                disabled={!incubationSettingChanged || isSavingIncubation}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                            >
                                {isSavingIncubation ? 'Saving...' : 'Save range'}
                            </Button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="rounded-lg bg-slate-800/70 border border-slate-700 p-4">
                            <p className="text-xs uppercase tracking-wide text-slate-500">Typical hatch window</p>
                            <p className="text-lg font-semibold text-slate-100 mt-1">Day {incubationProfile.minDays} to {incubationProfile.maxDays}</p>
                            <p className="text-xs text-slate-400 mt-1">Around day {incubationProfile.estimatedDays}</p>
                        </div>
                        <div className="rounded-lg bg-slate-800/70 border border-slate-700 p-4">
                            <p className="text-xs uppercase tracking-wide text-slate-500">Estimated hatch date</p>
                            <p className="text-lg font-semibold text-emerald-400 mt-1">{format(newEggEstimate.estimated, 'MMM d, yyyy')}</p>
                            <p className="text-xs text-slate-400 mt-1">For an egg laid today</p>
                        </div>
                        <div className="rounded-lg bg-slate-800/70 border border-slate-700 p-4">
                            <p className="text-xs uppercase tracking-wide text-slate-500">Hatch alert begins</p>
                            <p className="text-lg font-semibold text-amber-400 mt-1">Day {incubationProfile.alertDay}</p>
                            <p className="text-xs text-slate-400 mt-1">Before the typical window opens</p>
                        </div>
                    </div>

                    <p className="text-sm text-slate-300">{incubationProfile.summary}</p>

                    <Collapsible open={isTemperatureGuideOpen} onOpenChange={setIsTemperatureGuideOpen}>
                        <CollapsibleTrigger asChild>
                            <Button variant="ghost" className="w-full justify-between px-0 text-slate-300 hover:text-white hover:bg-transparent">
                                Why breeders choose different temperature ranges
                                <ChevronDown className={`w-4 h-4 transition-transform ${isTemperatureGuideOpen ? 'rotate-180' : ''}`} />
                            </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="pt-3">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                {INCUBATION_PROFILES.map((profile) => (
                                    <div key={profile.id} className={`rounded-lg border p-4 ${profile.id === incubationProfileId ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-slate-700 bg-slate-800/50'}`}>
                                        <p className="font-semibold text-slate-100">{profile.label}</p>
                                        <p className="text-sm text-emerald-400 mt-1">{profile.fahrenheit} ({profile.celsius})</p>
                                        <p className="text-sm text-slate-400 mt-2">{profile.breederNote}</p>
                                    </div>
                                ))}
                            </div>
                            <p className="text-xs text-slate-500 mt-3">
                                These dates are planning estimates, not guarantees. Genetics, temperature swings, egg health, and incubation conditions can all change the actual hatch date. Avoid sustained temperatures above 80°F.
                            </p>
                        </CollapsibleContent>
                    </Collapsible>
                </CardContent>
            </Card>

            <Card className="bg-slate-900 border-slate-700">
                <CardContent className="p-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                        <div className="relative sm:col-span-2 md:col-span-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <Input
                                placeholder="Search lineage..."
                                value={filters.search}
                                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                                className="pl-9 bg-slate-800 border-slate-600"
                            />
                        </div>

                        <Select
                            value={filters.season}
                            onValueChange={(value) => setFilters({ ...filters, season: value })}
                        >
                            <SelectTrigger className="bg-slate-800 border-slate-600">
                                <SelectValue placeholder="All Seasons" />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-800 border-slate-600">
                                <SelectItem value="all">All Seasons</SelectItem>
                                {uniqueSeasons.map(season => (
                                    <SelectItem key={season} value={season}>{season}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select
                            value={filters.status}
                            onValueChange={(value) => setFilters({ ...filters, status: value })}
                        >
                            <SelectTrigger className="bg-slate-800 border-slate-600">
                                <SelectValue placeholder="All Statuses" />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-800 border-slate-600">
                                <SelectItem value="all">All Statuses</SelectItem>
                                <SelectItem value="Incubating">Incubating</SelectItem>
                                <SelectItem value="Hatched">Hatched</SelectItem>
                                <SelectItem value="Slug">Slug</SelectItem>
                                <SelectItem value="Infertile">Infertile</SelectItem>
                                <SelectItem value="Stillbirth">Stillbirth</SelectItem>
                            </SelectContent>
                        </Select>
                        
                        <Button
                            variant={filters.showArchived ? "default" : "outline"}
                            onClick={() => setFilters({ ...filters, showArchived: !filters.showArchived })}
                            className={`${filters.showArchived ? "bg-emerald-600" : ""} text-xs md:text-sm`}
                        >
                            {filters.showArchived ? <ArchiveRestore className="w-4 h-4 mr-1 md:mr-2" /> : <Archive className="w-4 h-4 mr-1 md:mr-2" />}
                            <span className="hidden sm:inline">{filters.showArchived ? "Show Active" : "Show Archived"}</span>
                            <span className="sm:hidden">{filters.showArchived ? "Active" : "Archived"}</span>
                        </Button>

                        <Select value={sortBy} onValueChange={setSortBy}>
                            <SelectTrigger className="bg-slate-800 border-slate-600">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-800 border-slate-600">
                                <SelectItem value="incubation_longest">Longest Incubating</SelectItem>
                                <SelectItem value="incubation_shortest">Shortest Incubating</SelectItem>
                                <SelectItem value="hatch_date_asc">Hatching Soonest</SelectItem>
                                <SelectItem value="hatch_date_desc">Hatching Latest</SelectItem>
                                <SelectItem value="lay_date_desc">Lay Date (Newest)</SelectItem>
                                <SelectItem value="lay_date_asc">Lay Date (Oldest)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredEggs.map(egg => {
                    const plan = breedingPlans.find(p => p.id === egg.breeding_plan_id);
                    const sire = geckos.find(g => g.id === plan?.sire_id);
                    const dam = geckos.find(g => g.id === plan?.dam_id);
                    const hatchedGecko = egg.gecko_id ? geckos.find(g => g.id === egg.gecko_id) : null;
                    
                    const today = new Date();
                    const daysIncubating = differenceInDays(today, parseLocalDate(egg.lay_date));
                    const isNearHatching = daysIncubating >= incubationProfile.alertDay && egg.status === 'Incubating';
                    const hatchEstimate = getEstimatedHatchDates(egg.lay_date, incubationProfile.id);

                    // Calculate incubation days for hatched eggs
                    const incubationDays = egg.status === 'Hatched' && egg.hatch_date_actual
                        ? differenceInDays(parseLocalDate(egg.hatch_date_actual), parseLocalDate(egg.lay_date))
                        : null;

                    return (
                        <Card
                            key={egg.id}
                            className={`bg-slate-800 border-slate-700 hover:border-emerald-500 transition-all cursor-pointer relative ${
                                isNearHatching ? 'ring-2 ring-amber-500 shadow-lg shadow-amber-500/50 animate-pulse' : ''
                            }`}
                            onClick={() => handleEggClick(egg)}
                        >
                            <CardContent className="p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                    <EggIcon className="w-6 h-6 text-emerald-400" />
                                    <div className="flex items-center gap-1">
                                        {egg.grade && (
                                            <Badge className={`text-xs font-bold px-1.5 ${egg.grade === 'A+' ? 'bg-emerald-500 text-white' : egg.grade === 'A' ? 'bg-green-500 text-white' : egg.grade === 'B' ? 'bg-blue-500 text-white' : egg.grade === 'C' ? 'bg-yellow-500 text-black' : 'bg-red-500 text-white'}`}>
                                                {egg.grade}
                                            </Badge>
                                        )}
                                        <Badge className={`${getStatusColor(egg.status)} text-white`}>
                                            {egg.status}
                                        </Badge>
                                    </div>
                                </div>

                                <div>
                                    <p className="text-slate-200 font-semibold">
                                        {sire?.name || 'Unknown'} × {dam?.name || 'Unknown'}
                                    </p>
                                    {plan?.breeding_season && (
                                        <p className="text-xs text-slate-400">{plan.breeding_season}</p>
                                    )}
                                </div>

                                {egg.status === 'Incubating' && (
                                    <div className={`flex items-center gap-2 p-2 rounded ${
                                        isNearHatching ? 'bg-amber-500/20 border border-amber-500/50' : 'bg-slate-700/50'
                                    }`}>
                                        <Timer className="w-4 h-4 text-emerald-400" />
                                        <div>
                                            <p className={`text-sm font-semibold ${
                                                isNearHatching ? 'text-amber-400' : 'text-emerald-400'
                                            }`}>
                                                Day {daysIncubating} of incubation
                                            </p>
                                            {isNearHatching && (
                                                <p className="text-xs text-amber-300">Ready to hatch soon!</p>
                                            )}
                                        </div>
                                    </div>
                                )}

                                <div className="text-sm text-slate-400 space-y-1">
                                    <p>Laid: {format(parseLocalDate(egg.lay_date), 'MMM dd, yyyy')}</p>
                                    {hatchEstimate && (
                                        <>
                                            <p className="text-emerald-400">Estimated hatch: {format(hatchEstimate.estimated, 'MMM dd, yyyy')}</p>
                                            <p className="text-xs">Typical window: {format(hatchEstimate.earliest, 'MMM d')} to {format(hatchEstimate.latest, 'MMM d, yyyy')}</p>
                                        </>
                                    )}
                                    {egg.hatch_date_actual && (
                                        <p className="text-green-400">
                                            Hatched: {format(parseLocalDate(egg.hatch_date_actual), 'MMM dd, yyyy')}
                                        </p>
                                    )}
                                    {incubationDays !== null && (
                                        <p className="text-blue-400 font-semibold">{incubationDays} days incubated</p>
                                    )}
                                </div>

                                {hatchedGecko && (
                                    <div className="pt-2 border-t border-slate-700">
                                        <p className="text-xs text-emerald-400">
                                            → {hatchedGecko.name}
                                        </p>
                                    </div>
                                )}

                                {egg.status === 'Incubating' && !egg.archived && (
                                    <div className="pt-2 border-t border-slate-700 flex flex-wrap gap-1.5">
                                        <Button
                                            size="sm"
                                            onClick={(e) => handleHatchEgg(egg, e)}
                                            className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white px-2"
                                        >
                                            <Sparkles className="w-3 h-3 mr-1" /> Hatched
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={(e) => handleMarkFailed(egg.id, 'Infertile', e)}
                                            className="h-7 text-xs border-slate-600 text-slate-300 hover:bg-slate-700 px-2"
                                        >
                                            <XCircle className="w-3 h-3 mr-1" /> Infertile
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={(e) => handleMarkFailed(egg.id, 'Slug', e)}
                                            className="h-7 text-xs border-slate-600 text-slate-300 hover:bg-slate-700 px-2"
                                        >
                                            Slug
                                        </Button>
                                    </div>
                                )}
                            </CardContent>
                            
                            <div className="absolute bottom-2 right-2">
                                {!egg.archived && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={(e) => handleArchiveEgg(egg.id, true, e)}
                                        className="h-5 text-[10px] md:text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-700 px-1.5 md:px-2"
                                    >
                                        <Archive className="w-2.5 h-2.5 md:w-3 md:h-3 md:mr-1" />
                                        <span className="hidden md:inline">Archive</span>
                                    </Button>
                                )}
                                
                                {egg.archived && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={(e) => handleArchiveEgg(egg.id, false, e)}
                                        className="h-5 text-[10px] md:text-xs text-emerald-400 hover:text-emerald-300 hover:bg-slate-700 px-1.5 md:px-2"
                                    >
                                        <ArchiveRestore className="w-2.5 h-2.5 md:w-3 md:h-3 md:mr-1" />
                                        <span className="hidden md:inline">Restore</span>
                                    </Button>
                                )}
                            </div>
                        </Card>
                    );
                })}
            </div>

            {filteredEggs.length === 0 && (
                <Card className="bg-slate-900 border-slate-700">
                    <CardContent className="text-center py-12">
                        <EggIcon className="w-16 h-16 mx-auto text-slate-500 mb-4" />
                        <p className="text-slate-400">No eggs found matching your filters</p>
                    </CardContent>
                </Card>
            )}
            
            {selectedEgg && (
                <EggDetailModal
                    egg={selectedEgg}
                    breedingPlan={breedingPlans.find(p => p.id === selectedEgg.breeding_plan_id)}
                    sire={geckos.find(g => g.id === breedingPlans.find(p => p.id === selectedEgg.breeding_plan_id)?.sire_id)}
                    dam={geckos.find(g => g.id === breedingPlans.find(p => p.id === selectedEgg.breeding_plan_id)?.dam_id)}
                    onClose={() => setSelectedEgg(null)}
                    onUpdate={loadData}
                />
            )}
        </div>
    );
}
