import React, { useState, useEffect, Suspense } from 'react';
import Seo from '@/components/seo/Seo';
import { Gecko, BreedingPlan, Egg } from '@/entities/all';
import { base44 } from '@/api/base44Client';
import { notifyFollowersNewBreedingPlan } from '@/components/notifications/NotificationService';
import PlanLimitModal, { checkPlanLimit } from '@/components/subscription/PlanLimitChecker';
// Extracted sub-components (previously inlined at the top of this file)
import BreedingPlanCard from '../components/breeding/BreedingPlanCard';
import GeneticCalculatorTab from '../components/breeding/GeneticCalculatorTab';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PlusCircle, GitBranch, Heart, ChevronDown, ChevronUp, Calendar as CalendarIcon, Archive, ListTree, Search, Dna, Moon } from 'lucide-react';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import EmptyState from '../components/shared/EmptyState';
import PageSettingsPanel from '@/components/ui/PageSettingsPanel';
import usePageSettings from '@/hooks/usePageSettings';
import Hatchery from '../components/breeding/Hatchery';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";


import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from '@/components/ui/use-toast';
import { todayLocalISO } from '@/lib/dateUtils';

const LoginPortal = React.lazy(() => import('../components/auth/LoginPortal'));

const SORT_LABELS = {
    newest: 'Newest First',
    laying_active: 'Active Laying First',
    laying_dormant: 'Dormant First',
    time_newest: 'Paired Most Recently',
    time_oldest: 'Paired Longest Ago',
    eggs_high: 'Most Eggs',
    eggs_low: 'Least Eggs',
    last_egg_recent: 'Latest Egg Drop',
    last_egg_oldest: 'Oldest Egg Drop',
    species: 'Species (A-Z)',
};

const TAB_LABELS = {
    active: 'Active Plans',
    hatchery: 'Hatchery',
    genetics: 'Genetics',
    archive: 'Archive',
};

export default function BreedingPage() {
    const { toast } = useToast();
    const [breedingPrefs, setBreedingPrefs] = usePageSettings('breeding_prefs', {
        defaultTab: 'active',
        defaultSort: 'newest',
        autoExpandCards: false,
    });
    const [breedingPlans, setBreedingPlans] = useState([]);
    const [allGeckos, setAllGeckos] = useState([]);
    const [geckos, setGeckos] = useState([]);
    const [allEggs, setAllEggs] = useState([]);
    const [showPairLimitModal, setShowPairLimitModal] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [expandedPlanIds, setExpandedPlanIds] = useState(new Set());
    const [activeTab, setActiveTab] = useState(breedingPrefs.defaultTab);

    const [expandAllActive, setExpandAllActive] = useState(breedingPrefs.autoExpandCards);
    const [expandAllArchive, setExpandAllArchive] = useState(false);

    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
    const [sortBy, setSortBy] = useState(breedingPrefs.defaultSort);

    // Debounce search input by 300ms
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearchTerm(searchTerm), 300);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    const [newPlan, setNewPlan] = useState({
        sire_id: '',
        dam_id: '',
        breeding_id: '',
        pairing_date: todayLocalISO(),
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
            
            const [geckosData, plansData, eggsData] = await Promise.all([
                Gecko.filter({ created_by: currentUser.email }),
                BreedingPlan.filter({ created_by: currentUser.email }, '-created_date'),
                Egg.filter({ created_by: currentUser.email })
            ]);
            const filtered = geckosData.filter(g => !g.notes?.startsWith('[Manual sale]'));
            setAllGeckos(filtered);
            setGeckos(filtered.filter(g => !g.archived));
            setAllEggs(eggsData);
            setBreedingPlans(plansData.sort((a,b) => new Date(b.created_date) - new Date(a.created_date)));
        } catch (error) {
            console.error("Failed to load breeding data:", error);
            setAuthChecked(true);
        }
        setIsLoading(false);
    };
    
    const handleCreatePlan = async () => {
        if (!newPlan.sire_id || !newPlan.dam_id) {
            toast({ title: "Missing Selection", description: "Please select both a sire and a dam.", variant: "destructive" });
            return;
        }
        // Gate by the user's tier's breeding-pair limit. Only plans that
        // are still "active" (not archived) count toward the cap.
        const activePairCount = breedingPlans.filter(p => !p.archived).length;
        const limitCheck = checkPlanLimit(user, 'breeding_pairs', activePairCount);
        if (!limitCheck.allowed) {
            setIsModalOpen(false);
            setShowPairLimitModal(true);
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
            
            // Notify followers of new breeding plan
            notifyFollowersNewBreedingPlan(createdPlan, sire, dam, user.email, user.full_name).catch(console.error);
            
            setIsModalOpen(false);
            setNewPlan({
                sire_id: '',
                dam_id: '',
                breeding_id: '',
                pairing_date: todayLocalISO(),
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
                archived_date: shouldArchive ? todayLocalISO() : null,
                breeding_season: planToUpdate.breeding_season || getCurrentSeason() 
            });
            loadData();
        } catch (error) {
            console.error("Failed to archive breeding plan:", error);
        }
    };

    const handleToggleExpanded = (planId) => {
        // If expand all is active, don't change state to keep all plans expanded
        if (expandAllActive || expandAllArchive) {
            return;
        }
        
        setExpandedPlanIds(prev => {
            const newSet = new Set(prev);
            const isExpanding = !newSet.has(planId);
            
            // Check if desktop view (window width >= 1024px for lg breakpoint)
            const isDesktop = window.innerWidth >= 1024;
            
            if (isExpanding) {
                // Add the clicked plan
                newSet.add(planId);
                
                // Only expand adjacent on desktop
                if (isDesktop) {
                    const currentPlans = activeTab === 'active' ? activePlans : archivedPlans;
                    const planIndex = currentPlans.findIndex(p => p.id === planId);
                    
                    if (planIndex !== -1) {
                        // Find adjacent plan in the same row (for 2-column grid)
                        const adjacentIndex = planIndex % 2 === 0 ? planIndex + 1 : planIndex - 1;
                        if (adjacentIndex >= 0 && adjacentIndex < currentPlans.length) {
                            newSet.add(currentPlans[adjacentIndex].id);
                        }
                    }
                }
            } else {
                // Collapsing
                newSet.delete(planId);
                
                // Only collapse adjacent on desktop
                if (isDesktop) {
                    const currentPlans = activeTab === 'active' ? activePlans : archivedPlans;
                    const planIndex = currentPlans.findIndex(p => p.id === planId);
                    
                    if (planIndex !== -1) {
                        const adjacentIndex = planIndex % 2 === 0 ? planIndex + 1 : planIndex - 1;
                        if (adjacentIndex >= 0 && adjacentIndex < currentPlans.length) {
                            newSet.delete(currentPlans[adjacentIndex].id);
                        }
                    }
                }
            }
            
            return newSet;
        });
    };

    const handleExpandAllActive = () => {
        const newState = !expandAllActive;
        setExpandAllActive(newState);
        if (!newState) {
            setExpandedPlanIds(new Set());
        }
        setExpandAllArchive(false);
    };

    const handleExpandAllArchive = () => {
        const newState = !expandAllArchive;
        setExpandAllArchive(newState);
        if (!newState) {
            setExpandedPlanIds(new Set());
        }
        setExpandAllActive(false);
    };

    // Filter and sort breeding plans
    const filterAndSortPlans = (plans) => {
        // Filter by search term
        let filtered = plans.filter(plan => {
            const sire = allGeckos.find(g => g.id === plan.sire_id);
            const dam = allGeckos.find(g => g.id === plan.dam_id);
            const searchLower = debouncedSearchTerm.toLowerCase();
            
            return (
                sire?.name?.toLowerCase().includes(searchLower) ||
                dam?.name?.toLowerCase().includes(searchLower) ||
                plan.breeding_id?.toLowerCase().includes(searchLower)
            );
        });
        
        // Get egg counts and last egg dates for sorting — use hoisted allEggs, no extra fetches
        const plansWithData = filtered.map((plan) => {
            const eggs = allEggs.filter(e => e.breeding_plan_id === plan.id);
            const sorted = [...eggs].sort((a, b) => new Date(b.lay_date) - new Date(a.lay_date));
            return { ...plan, eggCount: eggs.length, lastEggDate: sorted[0]?.lay_date ?? null };
        });

        const sortFn = (a, b) => {
            switch (sortBy) {
                case 'eggs_low':
                    return a.eggCount - b.eggCount;
                case 'eggs_high':
                    return b.eggCount - a.eggCount;
                case 'last_egg_recent':
                    if (!a.lastEggDate && !b.lastEggDate) return 0;
                    if (!a.lastEggDate) return 1;
                    if (!b.lastEggDate) return -1;
                    return new Date(b.lastEggDate) - new Date(a.lastEggDate);
                case 'last_egg_oldest':
                    if (!a.lastEggDate && !b.lastEggDate) return 0;
                    if (!a.lastEggDate) return 1;
                    if (!b.lastEggDate) return -1;
                    return new Date(a.lastEggDate) - new Date(b.lastEggDate);
                case 'time_newest':
                    return new Date(b.pairing_date || b.created_date) - new Date(a.pairing_date || a.created_date);
                case 'time_oldest':
                    return new Date(a.pairing_date || a.created_date) - new Date(b.pairing_date || b.created_date);
                case 'laying_active':
                    return (a.laying_active === false ? 1 : 0) - (b.laying_active === false ? 1 : 0);
                case 'laying_dormant':
                    return (b.laying_active === false ? 1 : 0) - (a.laying_active === false ? 1 : 0);
                case 'species': {
                    const sireA = allGeckos.find(g => g.id === a.sire_id);
                    const sireB = allGeckos.find(g => g.id === b.sire_id);
                    const spA = sireA?.species || 'Crested Gecko';
                    const spB = sireB?.species || 'Crested Gecko';
                    return spA.localeCompare(spB);
                }
                case 'newest':
                default:
                    return new Date(b.created_date) - new Date(a.created_date);
            }
        };

        // For active plans: separate dormant from active, sort each group independently,
        // then place dormant section below active section (ignore dormant/active sort options which handle their own ordering)
        if (!plans.some(p => p.archived)) {
            const activeLaying = plansWithData.filter(p => p.laying_active !== false);
            const dormant = plansWithData.filter(p => p.laying_active === false);
            activeLaying.sort(sortFn);
            dormant.sort(sortFn);
            return [...activeLaying, ...dormant];
        }

        // For archived plans: sort normally
        plansWithData.sort(sortFn);
        return plansWithData;
    };
    
    const [filteredActivePlans, setFilteredActivePlans] = useState([]);
    const [filteredArchivedPlans, setFilteredArchivedPlans] = useState([]);
    
    useEffect(() => {
        const active = breedingPlans.filter(plan => !plan.archived);
        const archived = breedingPlans.filter(plan => plan.archived);
        setFilteredActivePlans(filterAndSortPlans(active));
        setFilteredArchivedPlans(filterAndSortPlans(archived));
    }, [breedingPlans, allEggs, debouncedSearchTerm, sortBy, allGeckos]);
    
    const activePlans = filteredActivePlans;
    const archivedPlans = filteredArchivedPlans;

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
        if (activeTab === 'active' && expandAllActive) return true;
        if (activeTab === 'archive' && expandAllArchive) return true;
        return expandedPlanIds.has(planId);
    };
    
    // Show login portal if not authenticated
    if (authChecked && !user) {
        return (
            <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center"><LoadingSpinner /></div>}>
                <LoginPortal requiredFeature="Breeding Management" />
            </Suspense>
        );
    }

    return (
        <div className="p-4 md:p-8 bg-slate-950 min-h-screen">
            <Seo
                title="Breeding Management"
                description="Plan and track your crested gecko breeding projects — manage pairings, monitor eggs, and use the genetics calculator."
                path="/Breeding"
                noIndex
                keywords={['gecko breeding', 'breeding planner', 'genetics calculator', 'hatchery']}
            />
            <div className="max-w-7xl mx-auto">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                    <div>
                        <h1 className="text-2xl md:text-4xl font-bold text-slate-100 flex items-center gap-3">
                            <GitBranch className="w-8 h-8 md:w-10 md:h-10 text-emerald-500" />
                            Breeding Management
                        </h1>
                        <p className="text-slate-400 mt-2 text-sm md:text-base">Plan and track your gecko breeding projects</p>
                    </div>
                    <div className="flex gap-2 w-full md:w-auto">
                        <PageSettingsPanel title="Breeding Settings">
                            <div>
                                <Label className="text-slate-300 text-sm mb-1 block">Default Tab</Label>
                                <Select value={breedingPrefs.defaultTab} onValueChange={v => { setBreedingPrefs({ defaultTab: v }); setActiveTab(v); }}>
                                    <SelectTrigger className="w-full h-8 text-xs">
                                        <SelectValue>{TAB_LABELS[breedingPrefs.defaultTab]}</SelectValue>
                                    </SelectTrigger>
                                    <SelectContent className="z-[99999]">
                                        {Object.entries(TAB_LABELS).map(([value, label]) => (
                                            <SelectItem key={value} value={value}>{label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label className="text-slate-300 text-sm mb-1 block">Default Sort</Label>
                                <Select value={breedingPrefs.defaultSort} onValueChange={v => { setBreedingPrefs({ defaultSort: v }); setSortBy(v); }}>
                                    <SelectTrigger className="w-full h-8 text-xs">
                                        <SelectValue>{SORT_LABELS[breedingPrefs.defaultSort]}</SelectValue>
                                    </SelectTrigger>
                                    <SelectContent className="z-[99999]">
                                        {Object.entries(SORT_LABELS).map(([value, label]) => (
                                            <SelectItem key={value} value={value}>{label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex items-center justify-between">
                                <Label className="text-slate-300 text-sm">Auto-expand Cards</Label>
                                <Switch checked={breedingPrefs.autoExpandCards} onCheckedChange={v => { setBreedingPrefs({ autoExpandCards: v }); setExpandAllActive(v); }} />
                            </div>
                        </PageSettingsPanel>
                        <Button onClick={() => setIsModalOpen(true)} className="flex-1 md:flex-none">
                            <PlusCircle className="w-5 h-5 mr-2" />
                            New Breeding Plan
                        </Button>
                    </div>
                </div>

                {isLoading ? (
                    <div className="text-center py-20">
                        <LoadingSpinner />
                    </div>
                ) : (
                    <Tabs value={activeTab} onValueChange={(value) => {
                        setActiveTab(value);
                        setExpandedPlanIds(new Set());
                        setExpandAllActive(false);
                        setExpandAllArchive(false);
                    }} className="w-full">
                        <TabsList className="flex w-full bg-slate-950 border border-slate-700 rounded-md p-1.5 gap-1">
                            <TabsTrigger value="active" className="flex-1 data-[state=active]:bg-emerald-900/70 data-[state=active]:text-emerald-200 data-[state=active]:border data-[state=active]:border-emerald-700/60 data-[state=active]:shadow-none text-slate-400 hover:text-slate-200 hover:bg-slate-800 text-xs md:text-sm px-2 rounded-sm transition-colors">
                                <span className="hidden md:inline">Active Plans ({activePlans.length})</span>
                                <span className="md:hidden">Active ({activePlans.length})</span>
                            </TabsTrigger>
                            <TabsTrigger value="hatchery" className="flex-1 data-[state=active]:bg-emerald-900/70 data-[state=active]:text-emerald-200 data-[state=active]:border data-[state=active]:border-emerald-700/60 data-[state=active]:shadow-none text-slate-400 hover:text-slate-200 hover:bg-slate-800 text-xs md:text-sm px-2 rounded-sm transition-colors">
                                <ListTree className="w-3 h-3 md:w-4 md:h-4 md:mr-2" />
                                <span className="hidden sm:inline">The Hatchery</span>
                                <span className="sm:hidden">Hatchery</span>
                            </TabsTrigger>
                            <TabsTrigger value="genetics" className="flex-1 data-[state=active]:bg-emerald-900/70 data-[state=active]:text-emerald-200 data-[state=active]:border data-[state=active]:border-emerald-700/60 data-[state=active]:shadow-none text-slate-400 hover:text-slate-200 hover:bg-slate-800 text-xs md:text-sm px-2 rounded-sm transition-colors">
                                <Dna className="w-3 h-3 md:w-4 md:h-4 md:mr-2" />
                                <span className="hidden sm:inline">Genetics</span>
                                <span className="sm:hidden">DNA</span>
                            </TabsTrigger>
                            <TabsTrigger value="archive" className="flex-1 data-[state=active]:bg-emerald-900/70 data-[state=active]:text-emerald-200 data-[state=active]:border data-[state=active]:border-emerald-700/60 data-[state=active]:shadow-none text-slate-400 hover:text-slate-200 hover:bg-slate-800 text-xs md:text-sm px-2 rounded-sm transition-colors">
                                <Archive className="w-3 h-3 md:w-4 md:h-4 md:mr-2" />
                                <span className="hidden md:inline">Archive ({archivedPlans.length})</span>
                                <span className="md:hidden">({archivedPlans.length})</span>
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="active" className="mt-6">
                            {/* Search and Sort Controls */}
                            <div className="flex flex-col sm:flex-row gap-3 mb-6">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <Input
                                        type="text"
                                        placeholder="Search by gecko names or breeding ID..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="pl-10 bg-slate-900 border-slate-700"
                                    />
                                </div>
                                <Select value={sortBy} onValueChange={v => { setSortBy(v); setBreedingPrefs({ defaultSort: v }); }}>
                                    <SelectTrigger className="w-full sm:w-64 bg-slate-900 border-slate-700">
                                        <SelectValue placeholder="Sort by...">{SORT_LABELS[sortBy]}</SelectValue>
                                    </SelectTrigger>
                                    <SelectContent className="bg-slate-800 border-slate-600 text-slate-200">
                                        {Object.entries(SORT_LABELS).map(([value, label]) => (
                                            <SelectItem key={value} value={value}>{label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {activePlans.length === 0 ? (
                                <EmptyState
                                    icon={Heart}
                                    title="No Active Breeding Plans"
                                    message="Create your first breeding plan to get started!"
                                    action={{ label: "Create Breeding Plan", onClick: () => setIsModalOpen(true) }}
                                />
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
                                    {sortBy === 'species' ? (
                                        (() => {
                                            const bySpecies = activePlans.reduce((acc, plan) => {
                                                const sire = allGeckos.find(g => g.id === plan.sire_id);
                                                const sp = sire?.species || 'Crested Gecko';
                                                if (!acc[sp]) acc[sp] = [];
                                                acc[sp].push(plan);
                                                return acc;
                                            }, {});
                                            return (
                                                <div className="space-y-8">
                                                    {Object.entries(bySpecies).sort(([a],[b]) => a.localeCompare(b)).map(([species, plans]) => (
                                                        <div key={species}>
                                                            <h2 className="text-xl font-bold text-teal-400 mb-3 flex items-center gap-2">
                                                                <span className="w-2 h-2 rounded-full bg-teal-400 inline-block"></span>
                                                                {species} <span className="text-slate-500 text-base font-normal">({plans.length})</span>
                                                            </h2>
                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                                                                                {plans.map(plan => (
                                                                                    <BreedingPlanCard key={plan.id} plan={plan} geckos={allGeckos} planEggs={allEggs.filter(e => e.breeding_plan_id === plan.id)} onPlanUpdate={loadData} onPlanDelete={handleDeletePlan} onPlanArchive={handleArchivePlan} isExpanded={isPlanExpanded(plan.id)} onToggleExpanded={handleToggleExpanded} showArchiveButton={true} />
                                                                                ))}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            );
                                        })()
                                    ) : (
                                    (() => {
                                        const activeLaying = activePlans.filter(p => p.laying_active !== false);
                                        const dormant = activePlans.filter(p => p.laying_active === false);
                                        return (
                                            <div className="space-y-8">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                                                                     {activeLaying.map(plan => (
                                                        <BreedingPlanCard
                                                            key={plan.id}
                                                            plan={plan}
                                                            geckos={allGeckos}
                                                            planEggs={allEggs.filter(e => e.breeding_plan_id === plan.id)}
                                                            onPlanUpdate={loadData}
                                                            onPlanDelete={handleDeletePlan}
                                                            onPlanArchive={handleArchivePlan}
                                                            isExpanded={isPlanExpanded(plan.id)}
                                                            onToggleExpanded={handleToggleExpanded}
                                                            showArchiveButton={true}
                                                        />
                                                    ))}
                                                </div>
                                                {dormant.length > 0 && (
                                                    <div>
                                                        <h2 className="text-lg font-semibold text-slate-400 mb-4 flex items-center gap-2">
                                                            <Moon className="w-5 h-5 text-slate-500" />
                                                            Dormant Pairs ({dormant.length})
                                                        </h2>
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                                                                             {dormant.map(plan => (
                                                                <BreedingPlanCard
                                                                    key={plan.id}
                                                                    plan={plan}
                                                                    geckos={allGeckos}
                                                                    planEggs={allEggs.filter(e => e.breeding_plan_id === plan.id)}
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
                                                )}
                                            </div>
                                        );
                                    })()
                                    )}
                                </>
                            )}
                        </TabsContent>

                        <TabsContent value="hatchery" className="mt-6">
                            <Hatchery />
                        </TabsContent>

                        <TabsContent value="genetics" className="mt-6">
                            <GeneticCalculatorTab geckos={geckos} />
                        </TabsContent>

                        <TabsContent value="archive" className="mt-6">
                            {/* Search and Sort Controls */}
                            <div className="flex flex-col sm:flex-row gap-3 mb-6">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <Input
                                        type="text"
                                        placeholder="Search by gecko names or breeding ID..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="pl-10 bg-slate-900 border-slate-700"
                                    />
                                </div>
                                <Select value={sortBy} onValueChange={v => { setSortBy(v); setBreedingPrefs({ defaultSort: v }); }}>
                                    <SelectTrigger className="w-full sm:w-64 bg-slate-900 border-slate-700">
                                        <SelectValue placeholder="Sort by...">{SORT_LABELS[sortBy]}</SelectValue>
                                    </SelectTrigger>
                                    <SelectContent className="bg-slate-800 border-slate-600 text-slate-200">
                                        {Object.entries(SORT_LABELS).map(([value, label]) => (
                                            <SelectItem key={value} value={value}>{label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {archivedPlans.length === 0 ? (
                                <EmptyState
                                    icon={Archive}
                                    title="No Archived Plans"
                                    message="Archived breeding plans will appear here organized by season."
                                />
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
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                                                        {archivedBySeason[season].map(plan => (
                                                        <BreedingPlanCard
                                                            key={plan.id}
                                                            plan={plan}
                                                            geckos={allGeckos}
                                                            planEggs={allEggs.filter(e => e.breeding_plan_id === plan.id)}
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
                            >
                                Create Plan
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
                <PlanLimitModal
                    isOpen={showPairLimitModal}
                    onClose={() => setShowPairLimitModal(false)}
                    limitType="breeding_pairs"
                    currentCount={breedingPlans.filter(p => !p.archived).length}
                />
            </div>
        </div>
    );
}