import React, { useState, useEffect, useCallback } from 'react';
import Seo from '@/components/seo/Seo';
import { Gecko, WeightRecord, FeedingGroup } from '@/entities/all';
import { base44 } from '@/api/base44Client';
import { PlusCircle, Search, Users, Grid3x3, List, ArrowUpDown, Archive, ArchiveRestore, Download, FileText, FileSpreadsheet } from 'lucide-react';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import EmptyState from '../components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import PageSettingsPanel from '../components/ui/PageSettingsPanel';
import usePageSettings from '@/hooks/usePageSettings';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import GeckoCard from '../components/my-geckos/GeckoCard';
import GeckoForm from '../components/my-geckos/GeckoForm';
import CSVImportModal from '../components/my-geckos/CSVImportModal';
import GeckoDetailModal from '../components/my-geckos/GeckoDetailModal';
import GeckoFilters from '../components/my-geckos/GeckoFilters';
import ArchiveReasonDialog from '../components/my-geckos/ArchiveReasonDialog';
import { toast } from '@/components/ui/use-toast';
import { AnimatePresence, motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import PlanLimitModal, { getGeckoLimit } from '../components/subscription/PlanLimitChecker';
import { todayLocalISO } from '@/lib/dateUtils';
import { exportGeckosCSV, exportGeckosPDF } from '@/lib/exportUtils';
import { captureEvent } from '@/lib/posthog';
import { useGeckoFilters } from '@/hooks/useGeckoFilters';
import { retryApiCall } from '@/lib/layoutCache';

const LoginPortal = React.lazy(() => import('../components/auth/LoginPortal'));

export default function MyGeckosPage() {
    const [geckos, setGeckos] = useState([]);
    const [weightRecords, setWeightRecords] = useState([]);
    const scrollPositionRef = React.useRef(0);
    const [isLoading, setIsLoading] = useState(true);
    const [user, setUser] = useState(null);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [selectedGecko, setSelectedGecko] = useState(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [viewMode, setViewMode] = useState('card'); // 'card' or 'list'
    const [sortBy, setSortBy] = useState('date_added'); // sorting option
    const [filters, setFilters] = useState({
        sexes: [],
        statuses: [],
        traits: [],
        morphTags: [],
        feedingGroupIds: [],
        weightMin: '',
        weightMax: ''
    });
    const [showUpgradeModal, setShowUpgradeModal] = useState(false);
    const [showArchived, setShowArchived] = useState(false);
    const [archiveDialogGeckoId, setArchiveDialogGeckoId] = useState(null);
    const [feedingGroups, setFeedingGroups] = useState([]);
    const [idSettings] = usePageSettings('gecko_id_settings', {
        founderFormat: '{PREFIX}{NUM}-{YY}',
        hatchlingFormat: '{SIRE}{DAM}{NUM}{LETTER}{YY}',
        prefix: '',
        inheritanceMode: 'breeder_prefix',
    });

    // No incremental paging — the dual server-side offset + client-side
    // visibleCount that used to live here was producing random counts and
    // losing its "Load more" button on re-renders. Simple batch fetch is
    // correct and snappy. 500 is generous enough to include archived geckos
    // that might have old created_date values.
    const GECKO_FETCH_LIMIT = 500;

    useEffect(() => {
        FeedingGroup.list()
            .then(setFeedingGroups)
            .catch((err) => console.error('Failed to load feeding groups:', err));
    }, []);

    // Load every gecko the current user owns, up to GECKO_FETCH_LIMIT. Reads
    // from the rate-limited cache when possible, otherwise does a single
    // Supabase round trip.
    const loadGeckos = useCallback(async () => {
        if (!user) return;
        setIsLoading(true);
        try {
            const [userGeckos, userWeights] = await retryApiCall(async () =>
                Promise.all([
                    Gecko.filter({ created_by: user.email }, '-created_date', GECKO_FETCH_LIMIT),
                    WeightRecord.filter({ created_by: user.email }, '-record_date'),
                ])
            );
            setGeckos(userGeckos);
            setWeightRecords(userWeights);
        } catch (error) {
            console.error('Failed to load geckos:', error);
            toast({
                title: 'Error Loading Geckos',
                description: 'Unable to load your gecko collection. Please try again in a moment.',
                variant: 'destructive',
            });
        } finally {
            setIsLoading(false);
        }
    }, [user]);

    // Effect to handle initial user loading
    useEffect(() => {
        const fetchUser = async () => {
            try {
                const currentUser = await retryApiCall(async () => base44.auth.me());
                setUser(currentUser);
            } catch (error) {
                console.error("Failed to load initial user:", error);
                setUser(null);
                setIsLoading(false);
            }
        };
        fetchUser();
    }, []); // Run once to fetch user

    // Effect to load geckos when user is available or changes
    useEffect(() => {
        if (user) {
            loadGeckos();
        }
    }, [user, loadGeckos]);

    // Listen for cross-page gecko-list changes (e.g. a new gecko auto-created
    // when hatching an egg on the Breeding page). Any page that mutates the
    // gecko collection should dispatch a 'geckos_changed' window event; we
    // invalidate our cache and reload so the new gecko appears immediately
    // when the user navigates back here.
    useEffect(() => {
        const handler = () => {
            if (!user?.email) return;
            loadGeckos();
        };
        window.addEventListener('geckos_changed', handler);
        return () => window.removeEventListener('geckos_changed', handler);
    }, [user, loadGeckos]);

    // Effect to update selectedGecko after geckos list reloads
    useEffect(() => {
        if (selectedGecko && geckos.length > 0) {
            const updatedSelectedGecko = geckos.find(g => g.id === selectedGecko.id);
            if (updatedSelectedGecko !== selectedGecko) {
                setSelectedGecko(updatedSelectedGecko || null);
            }
        } else if (selectedGecko && geckos.length === 0) {
            setSelectedGecko(null);
        }
    }, [geckos, selectedGecko]);

    const handleOpenDetailModal = (gecko) => {
        setSelectedGecko(gecko);
        setIsDetailModalOpen(true);
        setIsFormOpen(false);
    };

    const handleCloseDetailModal = () => {
        setIsDetailModalOpen(false);
        setSelectedGecko(null);
        // Refresh geckos when modal closes to show updated weight or other changes
        loadGeckos();
    };

    const handleEdit = (gecko) => {
        // Save current scroll position before opening form
        scrollPositionRef.current = window.scrollY;
        setSelectedGecko(gecko);
        setIsDetailModalOpen(false);
        setIsFormOpen(true);
    };

    const handleDelete = async (geckoId) => {
        try {
            await retryApiCall(async () => {
                return await Gecko.delete(geckoId);
            });

            setGeckos(prev => prev.filter(g => g.id !== geckoId));
            setSelectedGecko(null);
            setIsFormOpen(false);
            setIsDetailModalOpen(false);

            toast({
                title: "Gecko Deleted",
                description: "The gecko has been permanently removed. Revenue data was preserved in business tools.",
            });
        } catch (error) {
            console.error("Failed to delete gecko:", error);
            toast({
                title: "Error",
                description: "Failed to delete the gecko. Please try again in a moment.",
                variant: "destructive",
            });
        }
    };

    const handleArchiveGecko = async (geckoId, shouldArchive, reason) => {
        // If archiving and no reason given yet, show dialog
        if (shouldArchive && !reason) {
            setArchiveDialogGeckoId(geckoId);
            return;
        }

        try {
            const updateData = shouldArchive
                ? { archived: true, archived_date: todayLocalISO(), archive_reason: reason || null }
                : { archived: false, archived_date: null, archive_reason: null };

            await retryApiCall(async () => Gecko.update(geckoId, updateData));

            if (user) ;

            await loadGeckos();
            setIsDetailModalOpen(false);
            setSelectedGecko(null);
            setArchiveDialogGeckoId(null);

            toast({
                title: shouldArchive ? "Gecko Archived" : "Gecko Unarchived",
                description: shouldArchive ? "Moved to archive" : "Restored to collection"
            });
        } catch (error) {
            console.error("Failed to archive gecko:", error);
            toast({ title: "Error", description: "Failed to archive gecko. Please try again.", variant: "destructive" });
        }
    };

    const handleArchiveReasonConfirm = (reason) => {
        handleArchiveGecko(archiveDialogGeckoId, true, reason);
    };

    const handleFormSubmit = async (geckoData, isNew) => {
        const savedScroll = scrollPositionRef.current;
        setIsFormOpen(false);
        setSelectedGecko(null);

        // Analytics: distinguish new-gecko creation from edits so the funnel
        // can see "first gecko" vs "updated a gecko".
        captureEvent(isNew ? 'gecko_added' : 'gecko_updated', {
            sex: geckoData?.sex || null,
            status: geckoData?.status || null,
            has_image: Array.isArray(geckoData?.image_urls) && geckoData.image_urls.length > 0,
            has_lineage: Boolean(geckoData?.sire_id || geckoData?.dam_id || geckoData?.sire_name || geckoData?.dam_name),
        });

        // Notify any other page listening on the gecko list (Dashboard,
        // Lineage, Breeding, etc.) so their caches can invalidate.
        window.dispatchEvent(new CustomEvent('geckos_changed', {
            detail: { action: isNew ? 'created' : 'updated' }
        }));

        if (user) {
            window.scrollTo({ top: savedScroll, behavior: 'instant' });
            setTimeout(() => {
                loadGeckos().then(() => {
                    window.scrollTo({ top: savedScroll, behavior: 'instant' });
                });
            }, 100);
        }
    };

    const handleFormCancel = () => {
        const savedScroll = scrollPositionRef.current;
        setIsFormOpen(false);
        setSelectedGecko(null);
        // Restore scroll position on cancel too
        setTimeout(() => {
            window.scrollTo({ top: savedScroll, behavior: 'instant' });
        }, 50);
    };

    const handleImportComplete = async () => {
        if (user) {
            // Delay so the batch import finishes writing before we refetch.
            setTimeout(() => {
                loadGeckos();
            }, 1000);
        }
    };

    // Filtering + sorting extracted to useGeckoFilters hook

    const handleClearFilters = () => {
        setFilters({
            sexes: [],
            statuses: [],
            traits: [],
            morphTags: [],
            feedingGroupIds: [],
            species: [],
            weightMin: '',
            weightMax: ''
        });
    };

    const filteredAndSortedGeckos = useGeckoFilters(geckos, weightRecords, {
        filters, sortBy, searchTerm, showArchived,
    });
    // We render every gecko we've loaded; the server already capped the
    // fetch at GECKO_FETCH_LIMIT and filters/search are pure.
    const visibleGeckos = filteredAndSortedGeckos;

    if (!user && !isLoading) {
        return (
            <React.Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center"><LoadingSpinner /></div>}>
                <LoginPortal requiredFeature="My Gecko Collection" />
            </React.Suspense>
        );
    }

    return (
        <div className="min-h-screen bg-slate-950 p-4 md:p-8">
            <Seo
                title="My Geckos"
                description="Manage your crested gecko collection — track morphs, weights, breeding history, and care records."
                path="/MyGeckos"
                noIndex
                keywords={['gecko collection', 'crested gecko tracker', 'morph tracker']}
            />
            <div className="max-w-7xl mx-auto">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                    <div>
                        <h1 className="text-4xl font-bold text-slate-100">
                            {showArchived ? 'Archived Geckos' : 'My Gecko Collection'}
                        </h1>
                        <p className="text-slate-400 mt-1">Manage your geckos, track their lineage, and plan breedings.</p>
                    </div>
                    <div className="flex gap-2 items-center">
                        <PageSettingsPanel title="Collection Settings">
                            <div className="flex items-center justify-between">
                                <Label className="text-slate-300 text-sm">Default View</Label>
                                <div className="flex gap-1">
                                    <button onClick={() => setViewMode('card')} className={`px-2 py-1 text-xs rounded ${viewMode === 'card' ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-400'}`}>Card</button>
                                    <button onClick={() => setViewMode('list')} className={`px-2 py-1 text-xs rounded ${viewMode === 'list' ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-400'}`}>List</button>
                                </div>
                            </div>
                            <div className="flex items-center justify-between">
                                <Label className="text-slate-300 text-sm">Show Archived</Label>
                                <Switch checked={showArchived} onCheckedChange={setShowArchived} />
                            </div>
                            <div>
                                <Label className="text-slate-300 text-sm mb-1 block">Default Sort</Label>
                                <Select value={sortBy} onValueChange={setSortBy}>
                                    <SelectTrigger className="w-full h-8 text-xs">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="date_added">Date Added</SelectItem>
                                        <SelectItem value="name">Name (A-Z)</SelectItem>
                                        <SelectItem value="hatch_date_newest">Hatch Date (Newest)</SelectItem>
                                        <SelectItem value="hatch_date_oldest">Hatch Date (Oldest)</SelectItem>
                                        <SelectItem value="sex">Sex</SelectItem>
                                        <SelectItem value="status">Status</SelectItem>
                                        <SelectItem value="weight_heaviest">Weight (Heaviest)</SelectItem>
                                        <SelectItem value="weight_lightest">Weight (Lightest)</SelectItem>
                                            <SelectItem value="species">Species (A-Z)</SelectItem>
                                            {showArchived && <SelectItem value="archive_reason">Archive Reason</SelectItem>}
                                        </SelectContent>
                                        </Select>
                                        </div>
                                        <div className="border-t border-slate-700 pt-3 mt-1">
                                            <Label className="text-slate-300 text-sm font-medium block mb-1">Gecko ID Format</Label>
                                            <p className="text-[11px] text-slate-500 leading-snug mb-2">
                                                The full customizer — inheritance modes, presets, and live preview — lives in Settings.
                                            </p>
                                            <a
                                                href="/Settings#id-logic"
                                                className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-300 hover:text-emerald-200"
                                            >
                                                Customize ID logic →
                                            </a>
                                        </div>
                                        </PageSettingsPanel>
                        {/* All header buttons use explicit emerald styling with
                             arbitrary rgba() values so they render consistently
                             whether or not Layout.jsx's global
                             `button:not([data-state])` emerald override applies.
                             The Export button is wrapped in DropdownMenuTrigger,
                             which gives it data-state — so without explicit
                             classes it escaped the global rule and rendered
                             with a grey border, misaligned against its siblings. */}
                        <Button
                            variant="outline"
                            onClick={() => { setShowArchived(!showArchived); loadGeckos(); }}
                            className="border-emerald-700/60 bg-[rgba(6,95,70,0.35)] text-slate-100 hover:bg-[rgba(4,120,87,0.5)] hover:border-emerald-500/70"
                        >
                            {showArchived ? (
                                <>
                                    <ArchiveRestore className="w-5 h-5 mr-2" />
                                    Active
                                </>
                            ) : (
                                <>
                                    <Archive className="w-5 h-5 mr-2" />
                                    Archive
                                </>
                            )}
                        </Button>
                        {!showArchived && (
                            <>
                                <Button variant="outline" className="border-emerald-700/60 bg-[rgba(6,95,70,0.35)] text-slate-100 hover:bg-[rgba(4,120,87,0.5)] hover:border-emerald-500/70" onClick={() => setIsImportModalOpen(true)}>
                                    Import from CSV
                                </Button>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button
                                            variant="outline"
                                            className="border-emerald-700/60 bg-[rgba(6,95,70,0.35)] text-slate-100 hover:bg-[rgba(4,120,87,0.5)] hover:border-emerald-500/70"
                                            disabled={!filteredAndSortedGeckos || filteredAndSortedGeckos.length === 0}
                                        >
                                            <Download className="w-4 h-4 mr-2" />
                                            Export
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent
                                        align="end"
                                        className="bg-slate-900 border-slate-700 text-slate-100"
                                    >
                                        <DropdownMenuItem
                                            className="focus:bg-slate-800 focus:text-white cursor-pointer"
                                            onClick={() => {
                                                try {
                                                    const name = exportGeckosCSV(filteredAndSortedGeckos);
                                                    captureEvent('roster_exported', {
                                                        format: 'csv',
                                                        count: filteredAndSortedGeckos.length,
                                                    });
                                                    toast({
                                                        title: 'CSV exported',
                                                        description: `Saved ${filteredAndSortedGeckos.length} geckos to ${name}`,
                                                    });
                                                } catch (err) {
                                                    toast({
                                                        title: 'Export failed',
                                                        description: err.message,
                                                        variant: 'destructive',
                                                    });
                                                }
                                            }}
                                        >
                                            <FileSpreadsheet className="w-4 h-4 mr-2 text-emerald-400" />
                                            Download as CSV
                                            <span className="ml-auto text-xs text-slate-500">.csv</span>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                            className="focus:bg-slate-800 focus:text-white cursor-pointer"
                                            onClick={() => {
                                                try {
                                                    const name = exportGeckosPDF(filteredAndSortedGeckos, {
                                                        title: `${user?.full_name || user?.email || 'My'} Gecko Roster`,
                                                        userName: user?.full_name || user?.email,
                                                    });
                                                    captureEvent('roster_exported', {
                                                        format: 'pdf',
                                                        count: filteredAndSortedGeckos.length,
                                                    });
                                                    toast({
                                                        title: 'PDF exported',
                                                        description: `Saved ${filteredAndSortedGeckos.length} geckos to ${name}`,
                                                    });
                                                } catch (err) {
                                                    toast({
                                                        title: 'Export failed',
                                                        description: err.message,
                                                        variant: 'destructive',
                                                    });
                                                }
                                            }}
                                        >
                                            <FileText className="w-4 h-4 mr-2 text-emerald-400" />
                                            Download as PDF
                                            <span className="ml-auto text-xs text-slate-500">.pdf</span>
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                                <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => {
                                    const limit = getGeckoLimit(user);
                                    if (geckos.filter(g => !g.archived).length >= limit) {
                                        setShowUpgradeModal(true);
                                        return;
                                    }
                                    setSelectedGecko(null);
                                    setIsFormOpen(true);
                                    setIsDetailModalOpen(false);
                                }}>
                                    <PlusCircle className="w-5 h-5 mr-2" />
                                    Add Gecko
                                </Button>
                            </>
                        )}
                    </div>
                </div>

                <div className="mb-6">
                    {/* Toolbar — single row: search (grows) + sort + view + filters */}
                    <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-3 p-2 rounded-xl border border-slate-800 bg-slate-900/60">
                        <div className="relative flex-1 min-w-0">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                            <Input
                                type="text"
                                placeholder="Search by name, ID, morph, or tag..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10 h-9 bg-slate-950 border-slate-700 text-slate-100 focus-visible:ring-emerald-500/40"
                            />
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            <Select value={sortBy} onValueChange={setSortBy}>
                                <SelectTrigger className="w-44 !h-8 !min-h-0 bg-slate-950 border-slate-700 text-slate-100 !text-xs py-1">
                                    <div className="flex items-center gap-1.5 min-w-0">
                                        <ArrowUpDown className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                        <SelectValue placeholder="Sort" />
                                    </div>
                                </SelectTrigger>
                                <SelectContent className="z-[99999]">
                                    <SelectItem value="date_added">Date Added (Newest)</SelectItem>
                                    <SelectItem value="name">Name (A-Z)</SelectItem>
                                    <SelectItem value="hatch_date_newest">Hatch Date (Newest)</SelectItem>
                                    <SelectItem value="hatch_date_oldest">Hatch Date (Oldest)</SelectItem>
                                    <SelectItem value="sex">Sex</SelectItem>
                                    <SelectItem value="status">Status</SelectItem>
                                    <SelectItem value="weight_heaviest">Weight (Heaviest)</SelectItem>
                                    <SelectItem value="weight_lightest">Weight (Lightest)</SelectItem>
                                    <SelectItem value="species">Species (A-Z)</SelectItem>
                                    {showArchived && <SelectItem value="archive_reason">Archive Reason</SelectItem>}
                                </SelectContent>
                            </Select>
                            <div className="flex items-center bg-slate-950 rounded-md p-0.5 border border-slate-700">
                                <button
                                    type="button"
                                    onClick={() => setViewMode('card')}
                                    className={`h-8 w-8 rounded flex items-center justify-center transition-colors ${viewMode === 'card' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                                    aria-label="Card view"
                                >
                                    <Grid3x3 className="w-4 h-4" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setViewMode('list')}
                                    className={`h-8 w-8 rounded flex items-center justify-center transition-colors ${viewMode === 'list' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                                    aria-label="List view"
                                >
                                    <List className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Filters panel — slimmer than before. Opens inline below the toolbar. */}
                    <div className="mt-3">
                        <GeckoFilters
                            filters={filters}
                            onFiltersChange={setFilters}
                            onClearFilters={handleClearFilters}
                            feedingGroups={feedingGroups}
                        />
                    </div>
                </div>

                {isLoading ? (
                    <div className="text-center py-20">
                        <LoadingSpinner />
                    </div>
                ) : (
                    <>
                        {filteredAndSortedGeckos.length > 0 ? (
                            sortBy === 'species' ? (
                                // Species-grouped view
                                (() => {
                                    const bySpecies = filteredAndSortedGeckos.reduce((acc, g) => {
                                        const s = g.species || 'Crested Gecko';
                                        if (!acc[s]) acc[s] = [];
                                        acc[s].push(g);
                                        return acc;
                                    }, {});
                                    return (
                                        <div className="space-y-8">
                                            {Object.entries(bySpecies).sort(([a],[b]) => a.localeCompare(b)).map(([species, speciesGeckos]) => (
                                                <div key={species}>
                                                    <h2 className="text-xl font-bold text-teal-400 mb-3 flex items-center gap-2">
                                                        <span className="w-2 h-2 rounded-full bg-teal-400 inline-block"></span>
                                                        {species} <span className="text-slate-500 text-base font-normal">({speciesGeckos.length})</span>
                                                    </h2>
                                                    {viewMode === 'card' ? (
                                                        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                                                            {speciesGeckos.map(gecko => (
                                                                <GeckoCard key={gecko.id} gecko={gecko} weightRecords={weightRecords} feedingGroups={feedingGroups} onView={handleOpenDetailModal} onEdit={handleEdit} />
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <div className="space-y-2">
                                                            {speciesGeckos.map(gecko => (
                                                                <div key={gecko.id} className="bg-slate-900 border border-slate-700 rounded-lg p-2 md:p-4 hover:border-emerald-600 transition-colors cursor-pointer flex items-center gap-3" onClick={() => handleOpenDetailModal(gecko)}>
                                                                    <img src={gecko.image_urls?.[0] || 'https://i.imgur.com/sw9gnDp.png'} alt={gecko.name} className="w-12 h-12 object-cover rounded-lg flex-shrink-0" loading="lazy" decoding="async" />
                                                                    <div className="flex-1 min-w-0">
                                                                        <h3 className="font-bold text-slate-100 truncate">{gecko.name}</h3>
                                                                        <div className="flex flex-wrap gap-1 mt-1">
                                                                            <Badge variant="outline" className={gecko.sex === 'Male' ? 'border-blue-500 text-blue-400 text-xs' : gecko.sex === 'Female' ? 'border-pink-500 text-pink-400 text-xs' : 'border-slate-500 text-slate-400 text-xs'}>{gecko.sex}</Badge>
                                                                            <Badge className="bg-slate-600 text-xs">{gecko.status}</Badge>
                                                                        </div>
                                                                    </div>
                                                                    <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); handleEdit(gecko); }} className="border-slate-600 text-xs">Edit</Button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    );
                                })()
                            ) : viewMode === 'card' ? (
                                    <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                                        <AnimatePresence>
                                            {visibleGeckos.map(gecko => (
                                                <motion.div
                                                    key={gecko.id}
                                                    layout
                                                    initial={{ opacity: 0, scale: 0.8 }}
                                                    animate={{ opacity: 1, scale: 1 }}
                                                    exit={{ opacity: 0, scale: 0.8 }}
                                                    transition={{ duration: 0.3 }}
                                                >
                                                    <GeckoCard
                                                        gecko={gecko}
                                                        weightRecords={weightRecords}
                                                        feedingGroups={feedingGroups}
                                                        onView={handleOpenDetailModal}
                                                        onEdit={handleEdit}
                                                    />

                                                </motion.div>
                                            ))}
                                        </AnimatePresence>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        <AnimatePresence mode="popLayout">
                                            {visibleGeckos.map(gecko => (
                                                <motion.div
                                                    key={gecko.id}
                                                    layout
                                                    initial={{ opacity: 0, x: -20 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    exit={{ opacity: 0, x: 20 }}
                                                    transition={{ duration: 0.2 }}
                                                    className="bg-slate-900 border border-slate-700 rounded-lg p-2 md:p-4 hover:border-emerald-600 transition-colors cursor-pointer"
                                                    onClick={() => handleOpenDetailModal(gecko)}
                                                >
                                                    <div className="flex items-center gap-2 md:gap-4">
                                                        <img
                                                                    src={gecko.image_urls?.[0] || 'https://i.imgur.com/sw9gnDp.png'}
                                                                    alt={gecko.name}
                                                                    className="w-12 h-12 md:w-20 md:h-20 object-cover rounded-lg flex-shrink-0"
                                                                    loading="lazy"
                                                                    decoding="async"
                                                                    onError={(e) => { e.target.src = 'https://i.imgur.com/sw9gnDp.png'; }}
                                                                />
                                                        <div className="flex-1 min-w-0">
                                                            {/* Mobile: Name only */}
                                                            <div className="md:hidden">
                                                                <h3 className="text-sm font-bold text-slate-100 truncate">{gecko.name}</h3>
                                                            </div>
                                                            
                                                            {/* Desktop: Full info */}
                                                            <div className="hidden md:block">
                                                                <div className="flex items-center gap-2 mb-1">
                                                                    <h3 className="text-lg font-bold text-slate-100 truncate">{gecko.name}</h3>
                                                                    {gecko.gecko_id_code && (
                                                                        <Badge variant="outline" className="text-xs border-slate-500 text-slate-300 bg-slate-800">
                                                                            {gecko.gecko_id_code}
                                                                        </Badge>
                                                                    )}
                                                                </div>
                                                                <div className="flex flex-wrap items-center gap-2 text-sm">
                                                                    <Badge className={
                                                                        gecko.status === 'Proven' ? 'bg-emerald-600' :
                                                                        gecko.status === 'Ready to Breed' ? 'bg-green-600' :
                                                                        gecko.status === 'For Sale' ? 'bg-orange-600' :
                                                                        'bg-slate-600'
                                                                    }>
                                                                        {gecko.status}
                                                                    </Badge>
                                                                    <Badge variant="outline" className={
                                                                        gecko.sex === 'Male' ? 'border-blue-500 text-blue-400 bg-blue-900/30' :
                                                                        gecko.sex === 'Female' ? 'border-pink-500 text-pink-400 bg-pink-900/30' :
                                                                        'border-slate-500 text-slate-400 bg-slate-800'
                                                                    }>
                                                                        {gecko.sex}
                                                                    </Badge>
                                                                    {(() => { const r = weightRecords.filter(w => w.gecko_id === gecko.id); const w = r.length > 0 ? [...r].sort((a,b) => new Date(b.record_date)-new Date(a.record_date))[0].weight_grams : (gecko.weight_grams ?? null); return w != null ? <span className="text-slate-400 text-xs bg-slate-800 px-2 py-0.5 rounded-full border border-slate-700">{w}g</span> : null; })()}
                                                                    {gecko.hatch_date && (
                                                                        <span className="text-slate-400 text-xs bg-slate-800 px-2 py-0.5 rounded-full border border-slate-700">
                                                                            Born: {new Date(gecko.hatch_date).toLocaleDateString()}
                                                                        </span>
                                                                    )}
                                                                    {gecko.sex === 'Female' && gecko.is_gravid && (
                                                                       <span className="text-xs bg-pink-900/40 border border-pink-700 text-pink-300 px-2 py-0.5 rounded-full">💕 Gravid</span>
                                                                    )}
                                                                    {gecko.species && gecko.species !== 'Crested Gecko' && (
                                                                       <span className="text-xs bg-teal-900/40 border border-teal-700 text-teal-300 px-2 py-0.5 rounded-full">{gecko.species}</span>
                                                                    )}
                                                                    {showArchived && gecko.archive_reason && (
                                                                        <span className={`text-xs px-2 py-0.5 rounded-full border ${
                                                                            gecko.archive_reason === 'death' ? 'border-red-700 text-red-400 bg-red-900/20' :
                                                                            gecko.archive_reason === 'sold' ? 'border-blue-700 text-blue-400 bg-blue-900/20' :
                                                                            'border-slate-600 text-slate-400 bg-slate-800'
                                                                        }`}>
                                                                            {gecko.archive_reason === 'death' ? 'Passed Away' : gecko.archive_reason === 'sold' ? 'Sold' : 'Other'}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                {gecko.morphs_traits && (
                                                                    <p className="text-sm text-slate-400 mt-1 truncate">{gecko.morphs_traits}</p>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="flex gap-2 flex-shrink-0">
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleEdit(gecko);
                                                                }}
                                                                className="border-slate-600 hover:bg-slate-800 text-xs md:text-sm px-2 md:px-4 h-8"
                                                            >
                                                                <span className="hidden sm:inline">Edit</span>
                                                                <span className="sm:hidden">✏️</span>
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            ))}
                                        </AnimatePresence>
                                    </div>
                                    )
                                    ) : (
                                    <EmptyState
                                icon={Users}
                                title="No Geckos Found"
                                message="Add your first gecko to get started!"
                            />
                        )}

                        {geckos.length >= GECKO_FETCH_LIMIT && (
                            <div className="mt-8 text-center text-xs text-slate-500">
                                Showing the {GECKO_FETCH_LIMIT} most recent geckos. If you need to see older entries, narrow the filters or search.
                            </div>
                        )}

                        <AnimatePresence>
                            {isFormOpen && (
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 20 }}
                                    transition={{ duration: 0.3 }}
                                >
                                    <GeckoForm
                                        gecko={selectedGecko}
                                        userGeckos={geckos}
                                        currentUser={user}
                                        onSubmit={handleFormSubmit}
                                        onCancel={handleFormCancel}
                                        onDelete={handleDelete}
                                        feedingGroups={feedingGroups}
                                        idSettings={idSettings}
                                    />
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </>
                )}

                <CSVImportModal
                    isOpen={isImportModalOpen}
                    onClose={() => setIsImportModalOpen(false)}
                    onImportComplete={handleImportComplete}
                />

                {/* Detail Modal - only show when not in form mode */}
                {isDetailModalOpen && selectedGecko && !isFormOpen && (
                    <GeckoDetailModal
                        gecko={selectedGecko}
                        allGeckos={geckos}
                        currentUser={user}
                        onClose={handleCloseDetailModal}
                        onUpdate={() => loadGeckos()}
                        onEdit={handleEdit}
                        onArchive={handleArchiveGecko}
                        onDelete={handleDelete}
                    />
                )}

                {/* Archive Reason Dialog */}
                <ArchiveReasonDialog
                    open={!!archiveDialogGeckoId}
                    geckoName={geckos.find(g => g.id === archiveDialogGeckoId)?.name || 'Gecko'}
                    onConfirm={handleArchiveReasonConfirm}
                    onCancel={() => setArchiveDialogGeckoId(null)}
                />

                {/* Plan Limit Modal */}
                <PlanLimitModal
                    isOpen={showUpgradeModal}
                    onClose={() => setShowUpgradeModal(false)}
                    limitType="geckos"
                    currentCount={geckos.length}
                />
            </div>
        </div>
    );
}