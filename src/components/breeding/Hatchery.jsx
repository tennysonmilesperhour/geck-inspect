import { useState, useEffect } from 'react';
import { Egg, BreedingPlan, Gecko, User } from '@/entities/all';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Egg as EggIcon, Search, Timer, Archive, ArchiveRestore } from 'lucide-react';
import LoadingSpinner from '../shared/LoadingSpinner';
import { format, differenceInDays } from 'date-fns';
import EggDetailModal from './EggDetailModal';

export default function Hatchery() {
    const [eggs, setEggs] = useState([]);
    const [filteredEggs, setFilteredEggs] = useState([]);
    const [breedingPlans, setBreedingPlans] = useState([]);
    const [geckos, setGeckos] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [hatchAlertDays, setHatchAlertDays] = useState(60);
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
                if (currentUser?.hatch_alert_days) {
                    setHatchAlertDays(currentUser.hatch_alert_days);
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
            const [eggsData, plansData, geckosData] = await Promise.all([
                Egg.filter({ created_by: user.email }, '-lay_date'),
                BreedingPlan.filter({ created_by: user.email }),
                Gecko.filter({ created_by: user.email })
            ]);
            
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
            const daysIncubatingA = differenceInDays(today, new Date(a.lay_date));
            const daysIncubatingB = differenceInDays(today, new Date(b.lay_date));
            
            switch (sortBy) {
                case 'incubation_longest':
                    return daysIncubatingB - daysIncubatingA;
                case 'incubation_shortest':
                    return daysIncubatingA - daysIncubatingB;
                case 'lay_date_desc':
                    return new Date(b.lay_date) - new Date(a.lay_date);
                case 'lay_date_asc':
                    return new Date(a.lay_date) - new Date(b.lay_date);
                case 'hatch_date_desc':
                    return new Date(b.hatch_date_expected) - new Date(a.hatch_date_expected);
                case 'hatch_date_asc':
                    return new Date(a.hatch_date_expected) - new Date(b.hatch_date_expected);
                default:
                    return daysIncubatingB - daysIncubatingA;
            }
        });

        setFilteredEggs(result);
    }, [eggs, filters, sortBy, breedingPlans, geckos]);

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
    
    const handleArchiveEgg = async (eggId, shouldArchive, e) => {
        e.stopPropagation();
        try {
            await Egg.update(eggId, { 
                archived: shouldArchive,
                archived_date: shouldArchive ? new Date().toISOString().split('T')[0] : null
            });
            await loadData();
        } catch (error) {
            console.error("Failed to archive egg:", error);
        }
    };

    const currentYear = new Date().getFullYear();
    const allNonArchived = eggs.filter(e => !e.archived);
    const stats = {
        incubating: allNonArchived.filter(e => e.status === 'Incubating').length,
        hatchedTotal: eggs.filter(e => e.status === 'Hatched').length,
        hatchedYTD: eggs.filter(e => e.status === 'Hatched' && e.hatch_date_actual && new Date(e.hatch_date_actual).getFullYear() === currentYear).length,
        failedTotal: eggs.filter(e => ['Slug', 'Infertile', 'Stillbirth'].includes(e.status)).length,
        failedYTD: eggs.filter(e => ['Slug', 'Infertile', 'Stillbirth'].includes(e.status) && e.lay_date && new Date(e.lay_date).getFullYear() === currentYear).length,
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
                    <p className="text-2xl font-bold text-emerald-400">{stats.hatchedYTD}</p>
                    <p className="text-xs text-emerald-300 mt-1">Hatched (YTD)</p>
                </div>
                <div className="bg-red-900/30 border border-red-700/50 rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-red-400">{stats.failedTotal}</p>
                    <p className="text-xs text-red-300 mt-1">Failed (All Time)</p>
                </div>
                <div className="bg-orange-900/30 border border-orange-700/50 rounded-lg p-4 text-center sm:col-span-1 col-span-2">
                    <p className="text-2xl font-bold text-orange-400">{stats.failedYTD}</p>
                    <p className="text-xs text-orange-300 mt-1">Failed (YTD)</p>
                </div>
            </div>

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
                    const daysIncubating = differenceInDays(today, new Date(egg.lay_date));
                    const isNearHatching = daysIncubating >= hatchAlertDays && egg.status === 'Incubating';
                    
                    // Calculate incubation days for hatched eggs
                    const incubationDays = egg.status === 'Hatched' && egg.hatch_date_actual
                        ? differenceInDays(new Date(egg.hatch_date_actual), new Date(egg.lay_date))
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
                                    <Badge className={`${getStatusColor(egg.status)} text-white`}>
                                        {egg.status}
                                    </Badge>
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
                                    <p>Laid: {format(new Date(egg.lay_date), 'MMM dd, yyyy')}</p>
                                    <p>Expected: {format(new Date(egg.hatch_date_expected), 'MMM dd, yyyy')}</p>
                                    {egg.hatch_date_actual && (
                                        <p className="text-green-400">
                                            Hatched: {format(new Date(egg.hatch_date_actual), 'MMM dd, yyyy')}
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