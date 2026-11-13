import React, { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useQuery } from '@tanstack/react-query';
import { lazy } from '@/lib/lazyWithRetry';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import Seo from '@/components/seo/Seo';
import { BreedingPlan, Egg } from '@/entities/all';
import useFemaleReadiness from '@/hooks/useFemaleReadiness';
import { ReadinessNote } from '@/components/breeding/BreedingReadiness';
import { api } from '@/api/appClient';
import { planSeasonYear } from '@/lib/seasons';
import { notifyFollowersNewBreedingPlan } from '@/components/notifications/NotificationService';
import PlanLimitModal, { checkPlanLimit } from '@/components/subscription/PlanLimitChecker';
// Extracted sub-components (previously inlined at the top of this file)
import BreedingPlanCard from '../components/breeding/BreedingPlanCard';
import GeneticCalculatorTab from '../components/breeding/GeneticCalculatorTab';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PlusCircle, GitBranch, Heart, ChevronDown, ChevronUp, Calendar as CalendarIcon, CalendarRange, Archive, ListTree, Search, Dna, Moon, AlertTriangle, Sparkles, ArrowRight } from 'lucide-react';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import EmptyState from '../components/shared/EmptyState';
import PageSettingsPanel from '@/components/ui/PageSettingsPanel';
import PageHeader from '@/components/shared/PageHeader';
import usePageSettings from '@/hooks/usePageSettings';
import Hatchery from '../components/breeding/Hatchery';
import BreedingValueStats from '../components/breeding/BreedingValueStats';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import { BREEDING_TABS, BREEDING_TAB_LABELS, resolveBreedingTab } from '@/components/breeding/breedingTabs';
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

// The Pairing ideas and Season tabs were pages of their own until
// November 2026 (experience review, finding H5). Their code is fetched
// only when the tab is opened, so the Breeding page is no heavier for
// members who never use them.
const PairingIdeas = lazy(() => import('./PairingPlanner').then((m) => ({ default: m.PairingIdeas })));
const SeasonTimeline = lazy(() => import('./BreedingSeason').then((m) => ({ default: m.SeasonTimeline })));

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

const TAB_ICONS = {
    active: Heart,
    hatchery: ListTree,
    'pairing-ideas': Sparkles,
    season: CalendarRange,
    genetics: Dna,
    archive: Archive,
};

const TAB_LOADING = (
    <div className="text-center py-20">
        <LoadingSpinner />
    </div>
);

// One round trip for everything the Breeding page needs. Returns
// user: null for signed-out visitors so the page can show its gate.
async function loadBreedingPage() {
    const currentUser = await api.auth.me();
    if (!currentUser) return { user: null, geckos: [], plans: [], eggs: [] };
    const { getVisibleGeckos } = await import('@/lib/geckoAccess');
    const [geckosData, plansData, eggsData] = await Promise.all([
        getVisibleGeckos(currentUser),
        BreedingPlan.filter({ created_by: currentUser.email }, '-created_date'),
        Egg.filter({ created_by: currentUser.email }),
    ]);
    return {
        user: currentUser,
        geckos: geckosData.filter(g => !g.notes?.startsWith('[Manual sale]')),
        plans: [...plansData].sort((a, b) => new Date(b.created_date) - new Date(a.created_date)),
        eggs: eggsData,
    };
}

export default function BreedingPage() {
    const { toast } = useToast();
    const [breedingPrefs, setBreedingPrefs] = usePageSettings('breeding_prefs', {
        defaultTab: 'active',
        defaultSort: 'newest',
        autoExpandCards: false,
        showValueStats: true,
    });
    const [breedingPlans, setBreedingPlans] = useState([]);
    const [allGeckos, setAllGeckos] = useState([]);
    const [geckos, setGeckos] = useState([]);
    const [allEggs, setAllEggs] = useState([]);
    const [showPairLimitModal, setShowPairLimitModal] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [pendingDeletePlanId, setPendingDeletePlanId] = useState(null);
    const [isDeletingPlan, setIsDeletingPlan] = useState(false);
    const [expandedPlanIds, setExpandedPlanIds] = useState(new Set());
    // ?tab=hatchery (Today and the guided demo link here) opens that tab
    // directly, and the old planner addresses forward to ?tab=pairing-ideas
    // and ?tab=season. A tap on a tab is not written back to the address:
    // every address change is counted as a page view.
    const [searchParams] = useSearchParams();
    const tabParam = searchParams.get('tab');
    const [activeTab, setActiveTab] = useState(
        () => resolveBreedingTab(tabParam) || resolveBreedingTab(breedingPrefs.defaultTab) || 'active',
    );
    useEffect(() => {
        const wanted = resolveBreedingTab(tabParam);
        if (wanted) setActiveTab(wanted);
    }, [tabParam]);
    // The plan whose card should scroll into view once its tab has drawn
    // (see openPlan). The card does the scrolling and then clears this.
    const [revealPlanId, setRevealPlanId] = useState(null);
    const clearReveal = useCallback(() => setRevealPlanId(null), []);

    // Six tabs do not fit a phone, so the strip scrolls sideways. Bring
    // the open tab into view (a link to the Archive tab would otherwise
    // open with its tab off the right edge). Only the strip moves.
    const tabListRef = useRef(null);
    useEffect(() => {
        const list = tabListRef.current;
        const trigger = list?.querySelector('[data-state="active"]');
        if (!list || !trigger) return;
        const listBox = list.getBoundingClientRect();
        const triggerBox = trigger.getBoundingClientRect();
        const left = triggerBox.left - listBox.left + list.scrollLeft;
        list.scrollLeft = Math.max(0, left - (list.clientWidth - triggerBox.width) / 2);
    }, [activeTab, isLoading]);

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
        breeding_season: '',
    });

    // A breeding season is the calendar year (decision D17). Left blank,
    // a plan's season is the year of its pairing date.
    const seasonForNewPlan = (plan) => {
        const typed = String(plan.breeding_season || '').trim();
        if (typed) return typed;
        return String(planSeasonYear({ pairing_date: plan.pairing_date }) || new Date().getFullYear());
    };

    const [user, setUser] = useState(null);
    const [authChecked, setAuthChecked] = useState(false);
    const { user: authUser } = useAuth();

    // Geckos, plans and eggs load through react-query (launch review F47):
    // cached for two minutes by the shared QueryClient, so coming back to
    // this page renders from cache instead of re-running three requests.
    // Local state mirrors the cache so the rest of the page is unchanged.
    const breedingQuery = useQuery({
        queryKey: ['breeding', 'page', authUser?.email || null],
        queryFn: loadBreedingPage,
    });

    useEffect(() => {
        const data = breedingQuery.data;
        if (!data) return;
        setUser(data.user);
        setAuthChecked(true);
        if (!data.user) {
            setIsLoading(false);
            return;
        }
        setAllGeckos(data.geckos);
        setGeckos(data.geckos.filter(g => !g.archived));
        setAllEggs(data.eggs);
        setBreedingPlans(data.plans);
        setIsLoading(false);
    }, [breedingQuery.data]);

    useEffect(() => {
        if (!breedingQuery.isError) return;
        console.error("Failed to load breeding data:", breedingQuery.error);
        setAuthChecked(true);
        setIsLoading(false);
    }, [breedingQuery.isError, breedingQuery.error]);

    // Existing callers (create, delete, hatch) still call loadData().
    const loadData = () => breedingQuery.refetch();

    // Gate by the user's tier's breeding-pair limit. Only plans that
    // are still "active" (not archived) count toward the cap. A guest is
    // looking at the demo's sample plans and has no plan to be over.
    const activePairCount = breedingPlans.filter(p => !p.archived).length;
    const atPairLimit = () => !user?.is_guest
        && !checkPlanLimit(user, 'breeding_pairs', activePairCount).allowed;

    // Every way into the new-plan form comes through here, so a member at
    // their pair limit is told before filling anything in (it used to be
    // checked on submit). `pairing` is the sire and dam handed over by the
    // Pairing ideas tab, so they are not picked a second time.
    const openNewPlan = (pairing = null) => {
        if (atPairLimit()) {
            setShowPairLimitModal(true);
            return;
        }
        if (pairing) {
            setNewPlan(prev => ({ ...prev, sire_id: pairing.sire_id, dam_id: pairing.dam_id }));
        }
        setIsModalOpen(true);
    };

    // Show one plan's card on its tab: the Season tab's pair names and
    // "View plan" on a pairing idea lead here.
    const openPlan = (plan) => {
        setActiveTab(plan.archived ? 'archive' : 'active');
        setExpandAllActive(false);
        setExpandAllArchive(false);
        setExpandedPlanIds(new Set([plan.id]));
        // A search left in the box could be hiding the card.
        setSearchTerm('');
        setDebouncedSearchTerm('');
        setRevealPlanId(plan.id);
    };

    const handleCreatePlan = async () => {
        if (!newPlan.sire_id || !newPlan.dam_id) {
            toast({ title: "Missing Selection", description: "Please select both a sire and a dam.", variant: "destructive" });
            return;
        }
        // Checked again here in case the count changed while the form was
        // open (a plan made in another tab, for example).
        if (atPairLimit()) {
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
                breeding_season: seasonForNewPlan(newPlan),
            };
            const createdPlan = await BreedingPlan.create(planData);
            
            // Decision D18: followers hear about a new plan only when it is
            // public (breeding_plans.is_public). New plans start private, so
            // this stays quiet unless a plan is created public.
            if (createdPlan?.is_public === true) {
                notifyFollowersNewBreedingPlan(createdPlan, sire, dam, user.email, user.full_name).catch(console.error);
            }
            
            setIsModalOpen(false);
            toast({
                title: 'Breeding plan created',
                description: `${sire?.name || 'Sire'} x ${dam?.name || 'Dam'}. Log eggs on its card as they are laid.`,
            });
            setNewPlan({
                sire_id: '',
                dam_id: '',
                breeding_id: '',
                pairing_date: todayLocalISO(),
                status: 'Planned',
                notes: '',
                breeding_season: '',
            });
            loadData();
        } catch (error) {
            // A guest's save is refused with its own "view-only" notice.
            if (error?.isGuestBlock) return;
            console.error("Failed to create breeding plan:", error);
            toast({ title: "Plan not created", description: error.message || "Please try again.", variant: "destructive" });
        }
    };

    const handleDeletePlan = (planId) => {
        // The Delete Plan button sits right above Save Changes on phones, and
        // this removes every egg too, so ask first.
        setPendingDeletePlanId(planId);
    };

    // What the delete dialog is asking about, so it can say exactly what goes.
    const planToDelete = breedingPlans.find(p => p.id === pendingDeletePlanId) || null;
    const planToDeleteEggCount = planToDelete
        ? allEggs.filter(e => e.breeding_plan_id === planToDelete.id).length
        : 0;
    const pairName = (plan) => {
        const sire = allGeckos.find(g => g.id === plan?.sire_id);
        const dam = allGeckos.find(g => g.id === plan?.dam_id);
        return sire?.name && dam?.name ? `${sire.name} x ${dam.name}` : null;
    };
    const eggWords = (n) => (n === 1 ? '1 egg' : `${n} eggs`);
    // The dialog fades out after the plan is gone; keep its wording still
    // until it has closed.
    const askedRef = useRef({ name: null, eggs: 0 });
    if (planToDelete) askedRef.current = { name: pairName(planToDelete), eggs: planToDeleteEggCount };
    const asked = askedRef.current;

    const confirmDeletePlan = async () => {
        const plan = planToDelete;
        if (!plan || isDeletingPlan) return;
        setIsDeletingPlan(true);
        try {
            const eggsToDelete = await Egg.filter({ breeding_plan_id: plan.id });
            for (const egg of eggsToDelete) {
                await Egg.delete(egg.id);
            }
            await BreedingPlan.delete(plan.id);
            setPendingDeletePlanId(null);
            toast({
                title: 'Breeding plan deleted',
                description: `${pairName(plan) || 'The plan'}${eggsToDelete.length > 0 ? ` and its ${eggWords(eggsToDelete.length)}` : ''}.`,
            });
            loadData();
        } catch (error) {
            if (error?.isGuestBlock) {
                // A guest's delete is refused with its own "view-only" notice.
                setPendingDeletePlanId(null);
                return;
            }
            console.error("Failed to delete breeding plan:", error);
            // The dialog stays open so the delete can be tried again; some
            // eggs may already be gone, so refresh what it counts.
            toast({ title: "Plan not deleted", description: error.message || "Please try again.", variant: "destructive" });
            loadData();
        } finally {
            setIsDeletingPlan(false);
        }
    };

    const handleArchivePlan = async (planId, shouldArchive) => {
        try {
            const planToUpdate = breedingPlans.find(p => p.id === planId);
            if (!planToUpdate) return;

            await BreedingPlan.update(planId, {
                archived: shouldArchive,
                archived_date: shouldArchive ? todayLocalISO() : null,
                breeding_season: planToUpdate.breeding_season || String(planSeasonYear(planToUpdate) || new Date().getFullYear()),
            });
            loadData();
        } catch (error) {
            console.error("Failed to archive breeding plan:", error);
            toast({ title: "Plan not updated", description: error.message || "Please try again.", variant: "destructive" });
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
        
        // Get egg counts and last egg dates for sorting, use hoisted allEggs, no extra fetches
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

    // The archive groups plans by season, which is the calendar year
    // (decision D17). Older "2025 Spring" style labels group under 2025.
    const archivedBySeason = archivedPlans.reduce((acc, plan) => {
        const year = planSeasonYear(plan);
        const season = year ? String(year) : 'Unknown Season';
        if (!acc[season]) {
            acc[season] = [];
        }
        acc[season].push(plan);
        return acc;
    }, {});

    const sortedSeasons = Object.keys(archivedBySeason).sort((a, b) => {
        if (a === 'Unknown Season') return 1;
        if (b === 'Unknown Season') return -1;
        return Number(b) - Number(a);
    });

    const males = geckos.filter(g => g.sex === 'Male');
    const females = geckos.filter(g => g.sex === 'Female');

    // Loaded when the pairing dialog opens, so it can say whether the
    // chosen dam is ready to breed.
    const damReadiness = useFemaleReadiness(females, isModalOpen);
    const selectedDam = females.find(g => g.id === newPlan.dam_id) || null;

    const isPlanExpanded = (planId) => {
        if (activeTab === 'active' && expandAllActive) return true;
        if (activeTab === 'archive' && expandAllArchive) return true;
        return expandedPlanIds.has(planId);
    };
    
    // Show login portal if not authenticated
    if (authChecked && !user) {
        return (
            <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center"><LoadingSpinner /></div>}>
                <LoginPortal requiredFeature="Breeding" />
            </Suspense>
        );
    }

    return (
        <div className="p-4 md:p-8 bg-slate-950 min-h-screen">
            <Seo
                title="Breeding"
                description="Plan and track your crested gecko breeding projects, manage pairings, monitor eggs, and use the genetics calculator."
                path="/Breeding"
                noIndex
                keywords={['gecko breeding', 'breeding planner', 'genetics calculator', 'hatchery']}
            />
            <div className="max-w-7xl mx-auto">
                <PageHeader
                    icon={GitBranch}
                    title="Breeding"
                    description="Pairings, eggs, pairing ideas and the season, in one place"
                    settings={
                        <PageSettingsPanel title="Breeding Settings">
                            <div>
                                <Label className="text-slate-300 text-sm mb-1 block">Default Tab</Label>
                                <Select value={breedingPrefs.defaultTab} onValueChange={v => { setBreedingPrefs({ defaultTab: v }); setActiveTab(v); }}>
                                    <SelectTrigger aria-label="Default tab" className="w-full h-8 text-xs">
                                        <SelectValue>{BREEDING_TAB_LABELS[resolveBreedingTab(breedingPrefs.defaultTab) || 'active']}</SelectValue>
                                    </SelectTrigger>
                                    <SelectContent className="z-[99999]">
                                        {BREEDING_TABS.map(({ id, label }) => (
                                            <SelectItem key={id} value={id}>{label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label className="text-slate-300 text-sm mb-1 block">Default Sort</Label>
                                <Select value={breedingPrefs.defaultSort} onValueChange={v => { setBreedingPrefs({ defaultSort: v }); setSortBy(v); }}>
                                    <SelectTrigger aria-label="Default sort" className="w-full h-8 text-xs">
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
                            <div className="flex items-center justify-between">
                                <Label className="text-slate-300 text-sm">Show Production Value</Label>
                                <Switch checked={breedingPrefs.showValueStats !== false} onCheckedChange={v => setBreedingPrefs({ showValueStats: v })} />
                            </div>
                        </PageSettingsPanel>
                    }
                >
                    {/* Held back until the plans have loaded: the pair limit
                        cannot be checked before then. */}
                    <Button onClick={() => openNewPlan()} disabled={isLoading} className="flex-1 md:flex-none">
                        <PlusCircle className="w-5 h-5 mr-2" />
                        New Breeding Plan
                    </Button>
                </PageHeader>

                {!isLoading && (
                    <BreedingValueStats
                        plans={breedingPlans}
                        eggs={allEggs}
                        geckos={allGeckos}
                        visible={breedingPrefs.showValueStats !== false}
                        onToggle={v => setBreedingPrefs({ showValueStats: v })}
                    />
                )}

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
                        setRevealPlanId(null);
                    }} className="w-full">
                        <TabsList ref={tabListRef}>
                            {BREEDING_TABS.map(({ id, label }) => {
                                const Icon = TAB_ICONS[id];
                                const count = id === 'active' ? activePlans.length
                                    : id === 'archive' ? archivedPlans.length
                                    : null;
                                return (
                                    <TabsTrigger key={id} value={id}>
                                        <Icon className="hidden sm:block w-4 h-4" aria-hidden="true" />
                                        {label}{count === null ? '' : ` (${count})`}
                                    </TabsTrigger>
                                );
                            })}
                        </TabsList>

                        <TabsContent value="active" className="mt-6">
                            {/* Search, sort, and expand controls. Expand All sits
                                next to the sort picker instead of alone on its
                                own row above the cards. */}
                            <div className="flex flex-col sm:flex-row gap-3 mb-6">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <Input
                                        type="text"
                                        placeholder="Search names or breeding ID..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="pl-10 bg-slate-900 border-slate-700"
                                    />
                                </div>
                                <div className="flex gap-3">
                                    <Select value={sortBy} onValueChange={v => { setSortBy(v); setBreedingPrefs({ defaultSort: v }); }}>
                                        <SelectTrigger aria-label="Sort pairings" className="flex-1 sm:flex-none sm:w-64 bg-slate-900 border-slate-700">
                                            <SelectValue placeholder="Sort by...">{SORT_LABELS[sortBy]}</SelectValue>
                                        </SelectTrigger>
                                        <SelectContent className="bg-slate-800 border-slate-600 text-slate-200">
                                            {Object.entries(SORT_LABELS).map(([value, label]) => (
                                                <SelectItem key={value} value={value}>{label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {activePlans.length > 0 && (
                                        <Button
                                            variant="outline"
                                            onClick={handleExpandAllActive}
                                            className="shrink-0 border-slate-600 hover:bg-slate-800"
                                        >
                                            {expandAllActive ? (
                                                <><ChevronUp className="w-4 h-4 mr-2" /> Collapse All</>
                                            ) : (
                                                <><ChevronDown className="w-4 h-4 mr-2" /> Expand All</>
                                            )}
                                        </Button>
                                    )}
                                </div>
                            </div>

                            {breedingQuery.isError ? (
                                <EmptyState
                                    icon={AlertTriangle}
                                    title="Your breeding plans could not be loaded"
                                    message="Check your connection and try again. Nothing has been changed."
                                    action={{ label: "Try again", onClick: () => loadData() }}
                                />
                            ) : activePlans.length === 0 ? (
                                <EmptyState
                                    icon={Heart}
                                    title="No Active Breeding Plans"
                                    message="Create your first breeding plan to get started!"
                                    action={{ label: "Create Breeding Plan", onClick: () => openNewPlan() }}
                                />
                            ) : (
                                <>
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
                                                <div className="space-y-6">
                                                    {Object.entries(bySpecies).sort(([a],[b]) => a.localeCompare(b)).map(([species, plans]) => (
                                                        <div key={species}>
                                                            <h2 className="text-xl font-bold text-teal-400 mb-3 flex items-center gap-2">
                                                                <span className="w-2 h-2 rounded-full bg-teal-400 inline-block"></span>
                                                                {species} <span className="text-slate-500 text-base font-normal">({plans.length})</span>
                                                            </h2>
                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                                                {plans.map(plan => (
                                                                                    <BreedingPlanCard key={plan.id} plan={plan} geckos={allGeckos} planEggs={allEggs.filter(e => e.breeding_plan_id === plan.id)} onPlanUpdate={loadData} onPlanDelete={handleDeletePlan} onPlanArchive={handleArchivePlan} isExpanded={isPlanExpanded(plan.id)} onToggleExpanded={handleToggleExpanded} showArchiveButton={true} reveal={plan.id === revealPlanId} onRevealed={clearReveal} />
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
                                            <div className="space-y-6">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                                                            reveal={plan.id === revealPlanId}
                                                            onRevealed={clearReveal}
                                                        />
                                                    ))}
                                                </div>
                                                {dormant.length > 0 && (
                                                    <div>
                                                        <h2 className="text-lg font-semibold text-slate-400 mb-4 flex items-center gap-2">
                                                            <Moon className="w-5 h-5 text-slate-500" />
                                                            Dormant Pairs ({dormant.length})
                                                        </h2>
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                                                                    reveal={plan.id === revealPlanId}
                                                                    onRevealed={clearReveal}
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

                        <TabsContent value="pairing-ideas" className="mt-6">
                            <Suspense fallback={TAB_LOADING}>
                                <PairingIdeas
                                    user={user}
                                    geckos={geckos}
                                    plans={breedingPlans}
                                    onPlanPairing={(sire, dam) => openNewPlan({ sire_id: sire.id, dam_id: dam.id })}
                                    onViewPlan={openPlan}
                                />
                            </Suspense>
                        </TabsContent>

                        <TabsContent value="season" className="mt-6">
                            <Suspense fallback={TAB_LOADING}>
                                <SeasonTimeline
                                    plans={breedingPlans}
                                    eggs={allEggs}
                                    geckos={allGeckos}
                                    onNewPlan={() => openNewPlan()}
                                    onOpenPlan={openPlan}
                                />
                            </Suspense>
                        </TabsContent>

                        <TabsContent value="genetics" className="mt-6">
                            <GeneticCalculatorTab geckos={geckos} />
                            {/* The two tools that used to sit in the "Breeding Tools"
                                row above the tabs and belong with genetics. */}
                            <nav aria-label="More genetics tools" className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-1 text-sm">
                                {[
                                    ['/calculator/learn', 'Clutch Lab'],
                                    ['/Pedigree', 'Family tree'],
                                ].map(([to, label]) => (
                                    <Link
                                        key={to}
                                        to={to}
                                        className="touch:min-h-11 inline-flex items-center gap-1 text-slate-400 underline-offset-4 hover:text-emerald-300 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 rounded-sm"
                                    >
                                        {label} <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                                    </Link>
                                ))}
                            </nav>
                        </TabsContent>

                        <TabsContent value="archive" className="mt-6">
                            {/* Search, sort, and expand controls. Expand All sits
                                next to the sort picker instead of alone on its
                                own row above the cards. */}
                            <div className="flex flex-col sm:flex-row gap-3 mb-6">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <Input
                                        type="text"
                                        placeholder="Search names or breeding ID..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="pl-10 bg-slate-900 border-slate-700"
                                    />
                                </div>
                                <div className="flex gap-3">
                                    <Select value={sortBy} onValueChange={v => { setSortBy(v); setBreedingPrefs({ defaultSort: v }); }}>
                                        <SelectTrigger aria-label="Sort pairings" className="flex-1 sm:flex-none sm:w-64 bg-slate-900 border-slate-700">
                                            <SelectValue placeholder="Sort by...">{SORT_LABELS[sortBy]}</SelectValue>
                                        </SelectTrigger>
                                        <SelectContent className="bg-slate-800 border-slate-600 text-slate-200">
                                            {Object.entries(SORT_LABELS).map(([value, label]) => (
                                                <SelectItem key={value} value={value}>{label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {archivedPlans.length > 0 && (
                                        <Button
                                            variant="outline"
                                            onClick={handleExpandAllArchive}
                                            className="shrink-0 border-slate-600 hover:bg-slate-800"
                                        >
                                            {expandAllArchive ? (
                                                <><ChevronUp className="w-4 h-4 mr-2" /> Collapse All</>
                                            ) : (
                                                <><ChevronDown className="w-4 h-4 mr-2" /> Expand All</>
                                            )}
                                        </Button>
                                    )}
                                </div>
                            </div>

                            {breedingQuery.isError ? (
                                <EmptyState
                                    icon={AlertTriangle}
                                    title="Your breeding plans could not be loaded"
                                    message="Check your connection and try again. Nothing has been changed."
                                    action={{ label: "Try again", onClick: () => loadData() }}
                                />
                            ) : archivedPlans.length === 0 ? (
                                <EmptyState
                                    icon={Archive}
                                    title="No Archived Plans"
                                    message="Archived breeding plans will appear here organized by season."
                                />
                            ) : (
                                <>
                                    <div className="space-y-6">
                                        {sortedSeasons.map(season => (
                                            <div key={season}>
                                                <h2 className="text-xl md:text-2xl font-bold text-emerald-400 mb-4 flex items-center gap-2">
                                                    <CalendarIcon className="w-5 h-5 md:w-6 md:h-6" />
                                                    {season === 'Unknown Season' ? season : `${season} season`}
                                                </h2>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                                                            reveal={plan.id === revealPlanId}
                                                            onRevealed={clearReveal}
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
                                        <SelectTrigger id="sire" className="bg-slate-800 border-slate-600">
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
                                        <SelectTrigger id="dam" className="bg-slate-800 border-slate-600">
                                            <SelectValue placeholder="Select female" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-slate-800 border-slate-600 text-slate-200">
                                            {females.map(female => {
                                                const readiness = damReadiness(female);
                                                const hint = readiness && readiness.level !== 'unknown' ? ` · ${readiness.label}` : '';
                                                return (
                                                    <SelectItem key={female.id} value={female.id}>{female.name} ({female.gecko_id_code}){hint}</SelectItem>
                                                );
                                            })}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {selectedDam && damReadiness(selectedDam) && (
                                <ReadinessNote gecko={selectedDam} readiness={damReadiness(selectedDam)} />
                            )}

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
                                        placeholder={seasonForNewPlan({ ...newPlan, breeding_season: '' })}
                                        className="bg-slate-800 border-slate-600"
                                    />
                                    <p className="text-xs text-slate-500 mt-1">A season is a calendar year. Leave blank to use the pairing date&apos;s year.</p>
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
                    currentCount={activePairCount}
                />
                {/* Kept as a dialog, not an Undo: a plan with a season of
                    eggs is not something to lose by a slip, and the eggs
                    cannot be put back. */}
                <ConfirmDialog
                    open={Boolean(planToDelete)}
                    onOpenChange={(open) => {
                        if (!open && !isDeletingPlan) setPendingDeletePlanId(null);
                    }}
                    title={asked.name ? `Delete the ${asked.name} plan?` : 'Delete this breeding plan?'}
                    description={asked.eggs > 0
                        ? `This deletes the plan and its ${eggWords(asked.eggs)}. Hatched geckos stay in your collection. This cannot be undone.`
                        : 'This deletes the plan. It has no eggs recorded. This cannot be undone.'}
                    confirmLabel={isDeletingPlan ? 'Deleting...' : asked.eggs > 0 ? 'Delete plan and eggs' : 'Delete plan'}
                    destructive
                    busy={isDeletingPlan}
                    onConfirm={confirmDeletePlan}
                />
            </div>
        </div>
    );
}