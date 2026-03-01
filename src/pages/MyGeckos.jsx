import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { User, Gecko, WeightRecord, FeedingGroup } from '@/entities/all';
import { base44 } from '@/api/base44Client';
import { PlusCircle, Loader2, Search, Users, Grid3x3, List, ArrowUpDown, UserPlus, Archive, ArchiveRestore } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import GeckoCard from '../components/my-geckos/GeckoCard';
import GeckoForm from '../components/my-geckos/GeckoForm';
import CSVImportModal from '../components/my-geckos/CSVImportModal';
import GeckoDetailModal from '../components/my-geckos/GeckoDetailModal';
import GeckoFilters from '../components/my-geckos/GeckoFilters';
import { toast } from '@/components/ui/use-toast';
import { AnimatePresence, motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import PlanLimitModal, { checkPlanLimit, getGeckoLimit } from '../components/subscription/PlanLimitChecker';

// Enhanced cache specifically for MyGeckos page
class MyGeckosCache {
    constructor() {
        this.cache = new Map();
        this.timestamps = new Map();
        this.requestTimestamps = new Map();
        this.CACHE_DURATION = 5 * 60 * 1000; // 5 minutes for user data
        this.MIN_REQUEST_INTERVAL = 10000; // 10 seconds minimum between requests
    }

    canMakeRequest(key) {
        const lastRequest = this.requestTimestamps.get(key);
        return !lastRequest || (Date.now() - lastRequest) > this.MIN_REQUEST_INTERVAL;
    }

    markRequest(key) {
        this.requestTimestamps.set(key, Date.now());
    }

    get(key) {
        const timestamp = this.timestamps.get(key);
        if (timestamp && (Date.now() - timestamp) < this.CACHE_DURATION) {
            return this.cache.get(key);
        }
        return null;
    }

    set(key, data) {
        this.cache.set(key, data);
        this.timestamps.set(key, Date.now());
    }

    invalidate(key) {
        this.cache.delete(key);
        this.timestamps.delete(key);
        this.requestTimestamps.delete(key);
    }

    clear() {
        this.cache.clear();
        this.timestamps.clear();
        this.requestTimestamps.clear();
    }
}

const geckosCache = new MyGeckosCache();

// Retry function with exponential backoff
const retryWithBackoff = async (fn, maxRetries = 3, initialDelay = 2000) => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            if (error.response?.status === 429 && attempt < maxRetries) {
                const delay = initialDelay * Math.pow(2, attempt - 1);
                console.log(`Rate limited, waiting ${delay}ms before retry ${attempt}/${maxRetries}`);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }
            throw error;
        }
    }
};

export default function MyGeckosPage() {
    const [geckos, setGeckos] = useState([]);
    const [weightRecords, setWeightRecords] = useState([]);
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
    const [feedingGroups, setFeedingGroups] = useState([]);

    useEffect(() => {
        FeedingGroup.list().then(setFeedingGroups).catch(() => {});
    }, []);

    // Enhanced loadGeckos with caching and rate limiting
    // Now uses `user` from state and is dependent on it.
    const loadGeckos = useCallback(async (forceRefresh = false) => {
        if (!user) return; // Use the `user` state directly

        setIsLoading(true);
        const cacheKey = `geckos_${user.email}`; // Use `user` state

        try {
            // Check cache first unless forcing refresh
            if (!forceRefresh) {
                const cachedGeckos = geckosCache.get(cacheKey);
                if (cachedGeckos) {
                    console.log('Using cached gecko data');
                    setGeckos(cachedGeckos);
                    setIsLoading(false);
                    return;
                }
            }

            // Check if we can make a request
            if (!geckosCache.canMakeRequest(cacheKey)) {
                console.log('Rate limit protection: using existing data');
                setIsLoading(false);
                return;
            }

            // Mark request being made
            geckosCache.markRequest(cacheKey);

            // Make API call with retry logic - fetch both geckos and weights
            const [userGeckos, userWeights] = await retryWithBackoff(async () => {
                return await Promise.all([
                    Gecko.filter({ created_by: user.email }, '-created_date'),
                    WeightRecord.filter({ created_by: user.email }, '-record_date')
                ]);
            });

            // Cache the results
            geckosCache.set(cacheKey, userGeckos);
            geckosCache.set(`weights_${user.email}`, userWeights);
            setGeckos(userGeckos);
            setWeightRecords(userWeights);

        } catch (error) {
            console.error("Failed to load geckos:", error);

            // If we have cached data, use it as fallback
            const fallbackGeckos = geckosCache.get(cacheKey);
            const fallbackWeights = geckosCache.get(`weights_${user.email}`);
            if (fallbackGeckos) {
                console.log('Using fallback cached data due to error');
                setGeckos(fallbackGeckos);
                if (fallbackWeights) setWeightRecords(fallbackWeights);
            } else {
                // Show error toast only if no fallback data
                toast({
                    title: "Error Loading Geckos",
                    description: "Unable to load your gecko collection. Please try again in a moment.",
                    variant: "destructive",
                });
            }
        } finally {
            setIsLoading(false);
        }
    }, [user]); // Add `user` to dependencies

    // Effect to handle initial user loading
    useEffect(() => {
        const fetchUser = async () => {
            try {
                const currentUser = await retryWithBackoff(async () => base44.auth.me());
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
    }, [user, loadGeckos]); // loadGeckos depends on user, so this ensures it runs when user is ready.

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
        loadGeckos(true);
    };

    const handleEdit = (gecko) => {
        setSelectedGecko(gecko);
        setIsDetailModalOpen(false); // Close detail modal first
        setIsFormOpen(true);        // Then open form
    };

    const handleDelete = async (geckoId) => {
        try {
            await retryWithBackoff(async () => {
                return await Gecko.delete(geckoId);
            });

            // Update local state immediately for better UX
            setGeckos(prev => prev.filter(g => g.id !== geckoId));
            setSelectedGecko(null);
            setIsFormOpen(false);
            setIsDetailModalOpen(false);

            // Invalidate cache
            if (user) {
                const cacheKey = `geckos_${user.email}`;
                geckosCache.invalidate(cacheKey);
            }

            toast({
                title: "Gecko Deleted",
                description: "The gecko has been successfully removed from your collection.",
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

    const handleArchiveGecko = async (geckoId, shouldArchive) => {
        try {
            await retryWithBackoff(async () => {
                return await Gecko.update(geckoId, {
                    archived: shouldArchive,
                    archived_date: shouldArchive ? new Date().toISOString().split('T')[0] : null
                });
            });

            if (user) {
                const cacheKey = `geckos_${user.email}`;
                geckosCache.invalidate(cacheKey);
            }

            await loadGeckos(true);
            setIsDetailModalOpen(false);
            setSelectedGecko(null);

            toast({
                title: shouldArchive ? "Gecko Archived" : "Gecko Unarchived",
                description: shouldArchive ? "Moved to archive" : "Restored to collection"
            });
        } catch (error) {
            console.error("Failed to archive gecko:", error);
            toast({
                title: "Error",
                description: "Failed to archive gecko. Please try again.",
                variant: "destructive"
            });
        }
    };

    const handleFormSubmit = async (geckoData, isNew) => {
        setIsFormOpen(false);
        setSelectedGecko(null);

        if (user) {
            // Invalidate cache to force fresh data
            const cacheKey = `geckos_${user.email}`;
            geckosCache.invalidate(cacheKey);

            // Add small delay to ensure database is updated
            setTimeout(() => {
                loadGeckos(true);
            }, 500);
        }
    };

    const handleFormCancel = () => {
        setIsFormOpen(false);
        setSelectedGecko(null);
    };

    const handleImportComplete = async () => {
        if (user) {
            // Invalidate cache and reload
            const cacheKey = `geckos_${user.email}`;
            geckosCache.invalidate(cacheKey);

            // Add delay for import to complete
            setTimeout(() => {
                loadGeckos(true);
            }, 1000);
        }
    };

    const applyFilters = (geckosToFilter) => {
        let result = [...geckosToFilter];

        // Filter by sex
        if (filters.sexes.length > 0) {
            result = result.filter(g => filters.sexes.includes(g.sex));
        }

        // Filter by status
        if (filters.statuses.length > 0) {
            result = result.filter(g => filters.statuses.includes(g.status));
        }

        // Filter by weight range
        if (filters.weightMin) {
            const min = parseFloat(filters.weightMin);
            result = result.filter(g => g.weight_grams && g.weight_grams >= min);
        }
        if (filters.weightMax) {
            const max = parseFloat(filters.weightMax);
            result = result.filter(g => g.weight_grams && g.weight_grams <= max);
        }

        // Filter by traits (must have ALL selected traits)
        if (filters.traits.length > 0) {
            result = result.filter(g => {
                if (!g.morphs_traits) return false;
                const morphsLower = g.morphs_traits.toLowerCase();
                return filters.traits.every(trait => morphsLower.includes(trait.toLowerCase()));
            });
        }

        // Filter by morph tags
        if (filters.morphTags && filters.morphTags.length > 0) {
            result = result.filter(g => {
                if (!g.morph_tags || g.morph_tags.length === 0) return false;
                return filters.morphTags.every(tag => g.morph_tags.includes(tag));
            });
        }

        // Filter by feeding group
        if (filters.feedingGroupIds && filters.feedingGroupIds.length > 0) {
            result = result.filter(g => filters.feedingGroupIds.includes(g.feeding_group_id));
        }

        return result;
    };

    const getSortedGeckos = (geckosToSort) => {
        const sorted = [...geckosToSort];
        
        switch(sortBy) {
            case 'name':
                return sorted.sort((a, b) => a.name.localeCompare(b.name));
            case 'date_added':
                return sorted.sort((a, b) => new Date(b.created_date).getTime() - new Date(a.created_date).getTime());
            case 'hatch_date_newest':
                return sorted.sort((a, b) => {
                    if (!a.hatch_date && !b.hatch_date) return 0;
                    if (!a.hatch_date) return 1;
                    if (!b.hatch_date) return -1;
                    return new Date(b.hatch_date).getTime() - new Date(a.hatch_date).getTime();
                });
            case 'hatch_date_oldest':
                return sorted.sort((a, b) => {
                    if (!a.hatch_date && !b.hatch_date) return 0;
                    if (!a.hatch_date) return 1;
                    if (!b.hatch_date) return -1;
                    return new Date(a.hatch_date).getTime() - new Date(b.hatch_date).getTime();
                });
            case 'status':
                const statusOrder = ['Proven', 'Ready to Breed', 'Future Breeder', 'Holdback', 'For Sale', 'Pet', 'Sold'];
                return sorted.sort((a, b) => {
                    const aIndex = statusOrder.indexOf(a.status);
                    const bIndex = statusOrder.indexOf(b.status);
                    if (aIndex === -1 && bIndex === -1) return a.status.localeCompare(b.status);
                    if (aIndex === -1) return 1;
                    if (bIndex === -1) return -1;
                    return aIndex - bIndex;
                });
            case 'weight_heaviest':
                return sorted.sort((a, b) => {
                    const aWeight = a.weight_grams || 0;
                    const bWeight = b.weight_grams || 0;
                    return bWeight - aWeight;
                });
            case 'weight_lightest':
                return sorted.sort((a, b) => {
                    const aWeight = a.weight_grams || Infinity;
                    const bWeight = b.weight_grams || Infinity;
                    if (aWeight === Infinity && bWeight === Infinity) return 0;
                    if (aWeight === Infinity) return 1;
                    if (bWeight === Infinity) return -1;
                    return aWeight - bWeight;
                });
            case 'sex':
                return sorted.sort((a, b) => {
                    const sexOrder = { 'Male': 0, 'Female': 1, 'Unsexed': 2 };
                    return (sexOrder[a.sex] || 3) - (sexOrder[b.sex] || 3);
                });
            default:
                return sorted;
        }
    };

    const handleClearFilters = () => {
        setFilters({
            sexes: [],
            statuses: [],
            traits: [],
            morphTags: [],
            feedingGroupIds: [],
            weightMin: '',
            weightMax: ''
        });
    };

    const searchFiltered = geckos
        .filter(gecko => showArchived ? gecko.archived : !gecko.archived)
        .filter(gecko =>
            gecko.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            gecko.gecko_id_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            gecko.morphs_traits?.toLowerCase().includes(searchTerm.toLowerCase())
        );
    
    const filteredAndSortedGeckos = getSortedGeckos(applyFilters(searchFiltered));

    if (!user && !isLoading) {
        const LoginPortal = React.lazy(() => import('../components/auth/LoginPortal'));
        return (
            <React.Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center"><Loader2 className="w-12 h-12 text-emerald-500 animate-spin" /></div>}>
                <LoginPortal requiredFeature="My Gecko Collection" />
            </React.Suspense>
        );
    }

    return (
        <div className="min-h-screen bg-slate-950 p-4 md:p-8">
            <div className="max-w-7xl mx-auto">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                    <div>
                        <h1 className="text-4xl font-bold text-slate-100">
                            {showArchived ? 'Archived Geckos' : 'My Gecko Collection'}
                        </h1>
                        <p className="text-slate-400 mt-1">Manage your geckos, track their lineage, and plan breedings.</p>
                    </div>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            onClick={() => setShowArchived(!showArchived)}
                            className="border-slate-600 hover:bg-slate-800"
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
                                <Button variant="outline" className="border-slate-600 hover:bg-slate-800" onClick={() => setIsImportModalOpen(true)}>
                                    Import from CSV
                                </Button>
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

                <div className="mb-6 space-y-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <Input
                            type="text"
                            placeholder="Search by name, ID, or morph..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 h-10 bg-slate-800 border-slate-600 text-slate-100"
                        />
                    </div>

                    <GeckoFilters 
                        filters={filters}
                        onFiltersChange={setFilters}
                        onClearFilters={handleClearFilters}
                        feedingGroups={feedingGroups}
                    />

                    {/* View Controls */}
                    <div className="flex flex-wrap items-center gap-4 justify-between">
                        <div className="flex items-center gap-2">
                            <ArrowUpDown className="w-4 h-4 text-emerald-400" />
                            <span className="text-sm text-emerald-400 leading-10">Sort by:</span>
                            <Select value={sortBy} onValueChange={setSortBy}>
                                <SelectTrigger className="w-48 h-10 bg-emerald-900/80 border-emerald-600 text-emerald-100 hover:bg-emerald-800 focus:ring-emerald-500 focus:ring-1">
                                    <SelectValue placeholder="Sort by" />
                                </SelectTrigger>
                                <SelectContent className="bg-emerald-900/95 border-emerald-600 text-emerald-100 z-[99999]">
                                    <SelectItem value="date_added" className="text-emerald-100 focus:bg-emerald-600 focus:text-white hover:bg-emerald-700">Date Added (Newest)</SelectItem>
                                    <SelectItem value="name" className="text-emerald-100 focus:bg-emerald-600 focus:text-white hover:bg-emerald-700">Name (A-Z)</SelectItem>
                                    <SelectItem value="hatch_date_newest" className="text-emerald-100 focus:bg-emerald-600 focus:text-white hover:bg-emerald-700">Hatch Date (Newest)</SelectItem>
                                    <SelectItem value="hatch_date_oldest" className="text-emerald-100 focus:bg-emerald-600 focus:text-white hover:bg-emerald-700">Hatch Date (Oldest)</SelectItem>
                                    <SelectItem value="sex" className="text-emerald-100 focus:bg-emerald-600 focus:text-white hover:bg-emerald-700">Sex</SelectItem>
                                    <SelectItem value="status" className="text-emerald-100 focus:bg-emerald-600 focus:text-white hover:bg-emerald-700">Status</SelectItem>
                                    <SelectItem value="weight_heaviest" className="text-emerald-100 focus:bg-emerald-600 focus:text-white hover:bg-emerald-700">Weight (Heaviest)</SelectItem>
                                    <SelectItem value="weight_lightest" className="text-emerald-100 focus:bg-emerald-600 focus:text-white hover:bg-emerald-700">Weight (Lightest)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="flex items-center gap-2 bg-slate-900 rounded-lg p-1 border border-slate-700">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setViewMode('card')}
                                className={viewMode === 'card' ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'text-slate-400 hover:text-slate-200'}
                            >
                                <Grid3x3 className="w-4 h-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setViewMode('list')}
                                className={viewMode === 'list' ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'text-slate-400 hover:text-slate-200'}
                            >
                                <List className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                </div>

                {isLoading ? (
                    <div className="text-center py-20">
                        <Loader2 className="w-12 h-12 text-emerald-500 animate-spin mx-auto" />
                    </div>
                ) : (
                    <>
                        {!isFormOpen && (
                            filteredAndSortedGeckos.length > 0 ? (
                                viewMode === 'card' ? (
                                    <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                                        <AnimatePresence>
                                            {filteredAndSortedGeckos.map(gecko => (
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
                                            {filteredAndSortedGeckos.map(gecko => (
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
                                                                    {gecko.weight_grams !== undefined && (
                                                                        <span className="text-slate-400 text-xs bg-slate-800 px-2 py-0.5 rounded-full border border-slate-700">{gecko.weight_grams}g</span>
                                                                    )}
                                                                    {gecko.hatch_date && (
                                                                        <span className="text-slate-400 text-xs bg-slate-800 px-2 py-0.5 rounded-full border border-slate-700">
                                                                            Born: {new Date(gecko.hatch_date).toLocaleDateString()}
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
                                <div className="text-center py-20 bg-slate-900 rounded-lg">
                                    <Users className="w-16 h-16 mx-auto text-slate-500 mb-4" />
                                    <h3 className="text-xl font-semibold text-slate-300">No Geckos Found</h3>
                                    <p className="text-slate-400 mt-2">Add your first gecko to get started!</p>
                                </div>
                            )
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
                        onClose={handleCloseDetailModal}
                        onUpdate={() => loadGeckos(true)}
                        onEdit={handleEdit}
                        onArchive={handleArchiveGecko}
                    />
                )}

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