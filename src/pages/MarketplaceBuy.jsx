import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { initialsAvatarUrl } from '@/components/shared/InitialsAvatar';
import { Gecko, User, MarketplaceLike } from '@/entities/all';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import PageSettingsPanel from '@/components/ui/PageSettingsPanel';
import usePageSettings from '@/hooks/usePageSettings';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Search, DollarSign, MapPin, Heart, ShoppingBag, GitBranch, ArrowUpDown, LayoutGrid, Grid3x3, Filter } from 'lucide-react';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import EmptyState from '../components/shared/EmptyState';
import { useNavigate, Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import MessageUserButton from '../components/ui/MessageUserButton';

// Marketplace-specific Gecko Card. `size` switches between the two
// grid densities: 'regular' mirrors MyGeckos' tighter look (more cards
// per row, smaller type) and 'large' keeps the original spacious
// 4-up layout.
const MarketplaceGeckoCard = ({ gecko, owner, currentUser, isLiked, onToggleLike, onViewLineage, size = 'large' }) => {
    const getSexIcon = (sex) => sex === 'Male' ? '♂' : sex === 'Female' ? '♀' : '?';
    const getSexColor = (sex) => sex === 'Male' ? 'text-blue-400' : sex === 'Female' ? 'text-pink-400' : 'text-gray-400';

    const isRegular = size === 'regular';

    return (
        <Card className="overflow-hidden group-hover:border-emerald-500/50 group-hover:shadow-lg group-hover:shadow-emerald-500/10 transition-colors duration-200 h-full flex flex-col bg-slate-900 border-slate-800">
            <div className="aspect-square w-full overflow-hidden relative">
                <img
                    src={gecko.image_urls?.[0] || initialsAvatarUrl(gecko.name)}
                    alt={gecko.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    decoding="async"
                    onError={(e) => { e.target.src = 'https://i.imgur.com/sw9gnDp.png'; }}
                />
                {/* Sex icon in top left */}
                <div className="absolute top-2 left-2">
                    <span className={`${getSexColor(gecko.sex)} ${isRegular ? 'text-2xl' : 'text-3xl'} font-bold drop-shadow-lg`}>
                        {getSexIcon(gecko.sex)}
                    </span>
                </div>
                {currentUser && (
                    <Button
                        size="icon"
                        variant="ghost"
                        onClick={(e) => {
                            e.stopPropagation();
                            onToggleLike(gecko.id);
                        }}
                        className={`absolute top-2 right-2 ${isRegular ? 'h-7 w-7' : ''} bg-black/50 hover:bg-black/70 ${isLiked ? 'text-pink-500' : 'text-white'}`}
                    >
                        <Heart className={`${isRegular ? 'w-4 h-4' : 'w-5 h-5'} ${isLiked ? 'fill-pink-500' : ''}`} />
                    </Button>
                )}
            </div>
            <CardContent className={`${isRegular ? 'p-3' : 'p-4'} flex-grow flex flex-col`}>
                <h3 className={`font-semibold ${isRegular ? 'text-sm' : 'text-lg'} truncate text-slate-100`}>{gecko.name}</h3>
                <p className={`${isRegular ? 'text-xs' : 'text-sm'} text-emerald-400 font-bold flex items-center gap-1`}>
                    <DollarSign className={isRegular ? 'w-3 h-3' : 'w-4 h-4'} />
                    {gecko.asking_price ? `$${gecko.asking_price}` : 'Inquire for price'}
                </p>
                {gecko.morphs_traits && (
                    <p className={`${isRegular ? 'text-[10px]' : 'text-xs'} text-slate-400 mt-1 line-clamp-2`}>{gecko.morphs_traits}</p>
                )}

                <div className={`mt-auto ${isRegular ? 'pt-2 space-y-2' : 'pt-4 space-y-3'}`}>
                    <div className={`flex items-center gap-2 ${isRegular ? 'text-xs' : 'text-sm'} text-slate-300`}>
                        <Link
                            to={createPageUrl(`PublicProfile?userId=${owner?.id}`)}
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-2 group min-w-0"
                        >
                            <img
                                src={owner?.profile_image_url || initialsAvatarUrl(owner?.full_name || '')}
                                className={`${isRegular ? 'w-5 h-5' : 'w-6 h-6'} rounded-lg group-hover:opacity-80 transition-opacity shrink-0`}
                                alt={owner?.full_name}
                                loading="lazy"
                                decoding="async"
                                onError={(e) => { e.target.src = 'https://i.imgur.com/gfaW2Yg.png'; }}
                            />
                            <span className="truncate group-hover:underline">{owner?.full_name || 'Breeder'}</span>
                        </Link>
                    </div>
                    {owner?.location && !isRegular && (
                       <div className="flex items-center gap-1 text-xs text-slate-400">
                           <MapPin className="w-3 h-3" />
                           <span>{owner.location}</span>
                       </div>
                    )}
                    <div className={`flex items-center ${isRegular ? 'gap-1' : 'gap-2'}`}>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => onViewLineage(gecko.id, e)}
                            className={`flex-1 inline-flex items-center justify-center ${isRegular ? 'h-7 text-[10px] px-1.5' : 'h-9'}`}
                        >
                            <GitBranch className="w-3 h-3 mr-1 shrink-0" /> Lineage
                        </Button>
                       {currentUser && owner && currentUser.id !== owner.id && (
                           <MessageUserButton
                              recipientEmail={owner.email}
                              recipientName={owner.full_name}
                              variant="outline"
                              size="sm"
                              className={`flex-1 inline-flex items-center justify-center ${isRegular ? 'h-7 text-[10px] px-1.5' : 'h-9'}`}
                              context="marketplace_inquiry"
                           />
                       )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

export default function MarketplaceBuyPage() {
    const [buyPrefs, setBuyPrefs] = usePageSettings('marketplace_buy_prefs', {
        cardSize: 'regular',
        defaultSort: 'newest',
        defaultSexFilter: 'all',
    });
    const [geckos, setGeckos] = useState([]);
    const [owners, setOwners] = useState({});
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentUser, setCurrentUser] = useState(null);
    const [likedGeckoIds, setLikedGeckoIds] = useState(new Set());
    const [geckoOffset, setGeckoOffset] = useState(0);
    const [hasMoreGeckos, setHasMoreGeckos] = useState(true);
    const [sexFilter, setSexFilter] = useState(buyPrefs.defaultSexFilter);
    const [sortBy, setSortBy] = useState(buyPrefs.defaultSort);
    const [activeFilters, setActiveFilters] = useState(new Set());

    const MORPH_FILTERS = [
        'Lilly White', 'Axanthic', 'Cappuccino', 'Soft Scale', 'Dalmatian',
        'Harlequin', 'Pinstripe', 'Flame', 'Tiger', 'Patternless', 'Bicolor',
    ];

    const toggleFilter = (morph) => {
        setActiveFilters(prev => {
            const next = new Set(prev);
            if (next.has(morph)) next.delete(morph);
            else next.add(morph);
            return next;
        });
    };
    const cardSize = buyPrefs.cardSize;
    const setCardSize = (v) => setBuyPrefs({ cardSize: v });
    const navigate = useNavigate();

    const fetchGeckoBatch = useCallback(async (offset = 0, append = false) => {
         try {
             // Get 24 geckos at a time, filtering out empty names and junk data
             const batch = await Gecko.filter({ status: 'For Sale', is_public: true, archived: false, name: { $ne: '', $exists: true } }, "-updated_date", 24, offset).catch(() => []);
            
            if (append) {
                setGeckos(prev => [...prev, ...batch]);
            } else {
                setGeckos(batch);
            }
            
            setHasMoreGeckos(batch.length === 24);
            return batch;
        } catch (error) {
            console.error("Failed to fetch gecko batch:", error);
            return [];
        }
    }, []);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                // Fetch user first (non-blocking)
                const loggedInUser = await base44.auth.me().catch(() => null);
                setCurrentUser(loggedInUser);

                // Get initial 24 geckos
                const batch = await fetchGeckoBatch(0, false);
                
                // Fetch user's likes if logged in (non-blocking)
                if (loggedInUser) {
                    try {
                        const userLikes = await MarketplaceLike.filter({ user_email: loggedInUser.email });
                        setLikedGeckoIds(new Set(userLikes.map(l => l.gecko_id)));
                    } catch (_err) {
                        console.log("Could not load likes");
                    }
                }
                
                const ownerEmails = [...new Set(batch.map(g => g.created_by))];
                
                if (ownerEmails.length > 0) {
                    try {
                        const ownerData = await User.filter({ email: { $in: ownerEmails } });
                        const ownersMap = (ownerData || []).reduce((acc, user) => {
                            acc[user.email] = user;
                            return acc;
                        }, {});
                        setOwners(ownersMap);
                    } catch (_err) {
                        console.log("Could not load owners");
                        setOwners({});
                    }
                } else {
                    setOwners({});
                }
            } catch (error) {
                console.error("Failed to fetch marketplace data:", error);
                setGeckos([]);
            }
            setIsLoading(false);
        };
        fetchData();
    }, [fetchGeckoBatch]);

    const loadMoreGeckos = useCallback(async () => {
        setIsLoadingMore(true);
        const newOffset = geckoOffset + 24;
        const batch = await fetchGeckoBatch(newOffset, true);
        
        // Load owner data for new batch
        const newOwnerEmails = [...new Set(batch.map(g => g.created_by))];
        if (newOwnerEmails.length > 0) {
            try {
                const ownerData = await User.filter({ email: { $in: newOwnerEmails } });
                const ownersMap = ownerData.reduce((acc, user) => {
                    acc[user.email] = user;
                    return acc;
                }, {});
                setOwners(prev => ({ ...prev, ...ownersMap }));
            } catch (_err) {
                console.log("Could not load owners");
            }
        }
        
        setGeckoOffset(newOffset);
        setIsLoadingMore(false);
    }, [geckoOffset, fetchGeckoBatch]);

    const handleToggleLike = async (geckoId) => {
        if (!currentUser) return;
        
        try {
            if (likedGeckoIds.has(geckoId)) {
                // Unlike - find and delete the like
                const likes = await MarketplaceLike.filter({ gecko_id: geckoId });
                const myLike = likes.find(l => l.user_email === currentUser.email || l.created_by === currentUser.email);
                if (myLike) {
                    await MarketplaceLike.delete(myLike.id);
                }
                setLikedGeckoIds(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(geckoId);
                    return newSet;
                });
            } else {
                // Like
                await MarketplaceLike.create({ gecko_id: geckoId, user_email: currentUser.email });
                setLikedGeckoIds(prev => new Set([...prev, geckoId]));
            }
        } catch (error) {
            console.error("Failed to toggle like:", error);
        }
    };
    
    const handleViewDetails = (geckoId) => {
        // createPageUrl lowercases its input, so the query param name has to
        // be appended AFTER the call — otherwise `?id=` becomes part of the
        // lowercased string and Lineage.jsx can't read it case-sensitively.
        navigate(`${createPageUrl('GeckoDetail')}?id=${geckoId}`);
    };

    const handleViewLineage = (geckoId, e) => {
        e.stopPropagation();
        navigate(`${createPageUrl('Lineage')}?geckoId=${geckoId}`);
    };

    const filteredGeckos = useMemo(() => {
        const q = searchTerm.toLowerCase();
        let list = geckos.filter(
            (gecko) =>
                (gecko.name?.toLowerCase() || '').includes(q) ||
                (gecko.morphs_traits?.toLowerCase() || '').includes(q) ||
                (owners[gecko.created_by]?.full_name?.toLowerCase() || '').includes(q)
        );
        if (sexFilter !== 'all') {
            list = list.filter((g) => g.sex === sexFilter);
        }
        if (activeFilters.size > 0) {
            list = list.filter((g) => {
                const traits = (g.morphs_traits || '').toLowerCase() + ' ' + (g.morph_tags || []).join(' ').toLowerCase();
                return [...activeFilters].some(f => traits.includes(f.toLowerCase()));
            });
        }
        switch (sortBy) {
            case 'price_low':
                list = [...list].sort(
                    (a, b) => (a.asking_price ?? Infinity) - (b.asking_price ?? Infinity)
                );
                break;
            case 'price_high':
                list = [...list].sort(
                    (a, b) => (b.asking_price ?? -Infinity) - (a.asking_price ?? -Infinity)
                );
                break;
            case 'name':
                list = [...list].sort((a, b) =>
                    (a.name || '').localeCompare(b.name || '')
                );
                break;
            case 'newest':
            default:
                // Already sorted by updated_date desc from the server
                break;
        }
        return list;
    }, [geckos, owners, searchTerm, sexFilter, sortBy, activeFilters]);

    return (
        <div className="p-4 md:p-8 bg-slate-950 min-h-screen">
            <div className="max-w-7xl mx-auto">
                <header className="mb-6 flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    <div>
                        <h1 className="text-3xl md:text-4xl font-bold text-slate-100">
                            Gecko Marketplace
                        </h1>
                        <p className="text-sm md:text-base text-slate-400 mt-1">
                            Find your next crested gecko from breeders around the world.
                        </p>
                    </div>
                    <PageSettingsPanel title="Marketplace Settings">
                        <div>
                            <Label className="text-slate-300 text-sm mb-1 block">Card Size</Label>
                            <div className="flex gap-1">
                                {[['regular', 'Compact'], ['large', 'Spacious']].map(([val, lbl]) => (
                                    <button
                                        key={val}
                                        onClick={() => setBuyPrefs({ cardSize: val })}
                                        className={`px-3 py-1 text-xs rounded ${buyPrefs.cardSize === val ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-400'}`}
                                    >
                                        {lbl}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <Label className="text-slate-300 text-sm mb-1 block">Default Sort</Label>
                            <Select value={buyPrefs.defaultSort} onValueChange={v => { setBuyPrefs({ defaultSort: v }); setSortBy(v); }}>
                                <SelectTrigger className="w-full h-8 text-xs">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="newest">Newest First</SelectItem>
                                    <SelectItem value="price_low">Price (Low-High)</SelectItem>
                                    <SelectItem value="price_high">Price (High-Low)</SelectItem>
                                    <SelectItem value="name">Name (A-Z)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label className="text-slate-300 text-sm mb-1 block">Default Sex Filter</Label>
                            <Select value={buyPrefs.defaultSexFilter} onValueChange={v => { setBuyPrefs({ defaultSexFilter: v }); setSexFilter(v); }}>
                                <SelectTrigger className="w-full h-8 text-xs">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All</SelectItem>
                                    <SelectItem value="Male">Male</SelectItem>
                                    <SelectItem value="Female">Female</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </PageSettingsPanel>
                </header>

                {/* Filter toolbar */}
                <div className="mb-6 flex flex-col md:flex-row gap-2 md:gap-3 p-2 rounded-xl border border-slate-800 bg-slate-900/60">
                    <div className="relative flex-1 min-w-0">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <Input
                            placeholder="Search morph, gecko name, or breeder..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 h-9 bg-slate-950 border-slate-700 text-slate-100"
                        />
                    </div>
                    <div className="flex items-center gap-1 bg-slate-950 border border-slate-700 rounded-md p-0.5">
                        {[
                            { value: 'all', label: 'All' },
                            { value: 'Male', label: '♂' },
                            { value: 'Female', label: '♀' },
                        ].map((opt) => (
                            <button
                                key={opt.value}
                                type="button"
                                onClick={() => setSexFilter(opt.value)}
                                className={`px-3 h-8 rounded text-sm font-medium transition-colors ${
                                    sexFilter === opt.value
                                        ? 'bg-emerald-600 text-white'
                                        : 'text-slate-400 hover:text-slate-200'
                                }`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                    <Select value={sortBy} onValueChange={setSortBy}>
                        <SelectTrigger className="w-44 h-9 bg-slate-950 border-slate-700 text-slate-100 text-sm">
                            <div className="flex items-center gap-1.5 min-w-0">
                                <ArrowUpDown className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                <SelectValue placeholder="Sort" />
                            </div>
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-slate-700 text-slate-100">
                            <SelectItem value="newest">Newest first</SelectItem>
                            <SelectItem value="price_low">Price: low → high</SelectItem>
                            <SelectItem value="price_high">Price: high → low</SelectItem>
                            <SelectItem value="name">Name (A-Z)</SelectItem>
                        </SelectContent>
                    </Select>
                    {/* Card size toggle — 'regular' packs the grid like
                        MyGeckos, 'large' shows a roomier 4-up layout. */}
                    <div className="flex items-center gap-1 bg-slate-950 border border-slate-700 rounded-md p-0.5">
                        <button
                            type="button"
                            onClick={() => setCardSize('regular')}
                            className={`flex items-center gap-1 px-2.5 h-8 rounded text-xs font-medium transition-colors ${
                                cardSize === 'regular'
                                    ? 'bg-emerald-600 text-white'
                                    : 'text-slate-400 hover:text-slate-200'
                            }`}
                            aria-pressed={cardSize === 'regular'}
                            title="Regular card size"
                        >
                            <Grid3x3 className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Regular</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setCardSize('large')}
                            className={`flex items-center gap-1 px-2.5 h-8 rounded text-xs font-medium transition-colors ${
                                cardSize === 'large'
                                    ? 'bg-emerald-600 text-white'
                                    : 'text-slate-400 hover:text-slate-200'
                            }`}
                            aria-pressed={cardSize === 'large'}
                            title="Large card size"
                        >
                            <LayoutGrid className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Large</span>
                        </button>
                    </div>
                </div>

                {/* Morph filter toggles */}
                <div className="mb-4 flex flex-wrap items-center gap-1.5">
                    <span className="text-xs text-slate-500 mr-1 flex items-center gap-1">
                        <Filter className="w-3 h-3" /> Morphs:
                    </span>
                    {MORPH_FILTERS.map((morph) => (
                        <button
                            key={morph}
                            type="button"
                            onClick={() => toggleFilter(morph)}
                            className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                                activeFilters.has(morph)
                                    ? 'bg-emerald-600 text-white border-emerald-500'
                                    : 'bg-slate-900 text-slate-400 border-slate-700 hover:border-slate-500 hover:text-slate-200'
                            }`}
                        >
                            {morph}
                        </button>
                    ))}
                    {activeFilters.size > 0 && (
                        <button
                            type="button"
                            onClick={() => setActiveFilters(new Set())}
                            className="px-2.5 py-1 rounded-full text-xs font-medium text-red-400 border border-red-800 hover:bg-red-900/30 transition-colors"
                        >
                            Clear all
                        </button>
                    )}
                </div>

                {/* Result count */}
                {!isLoading && (
                    <p className="text-xs text-slate-500 mb-4">
                        {filteredGeckos.length} {filteredGeckos.length === 1 ? 'gecko' : 'geckos'} found
                    </p>
                )}

                {isLoading ? (
                    <div className="flex items-center justify-center py-20">
                        <LoadingSpinner />
                    </div>
                ) : (
                    <>
                        <div className={
                            cardSize === 'large'
                                ? 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6'
                                : 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4'
                        }>
                            {filteredGeckos.map(gecko => (
                               <div key={gecko.id} onClick={() => handleViewDetails(gecko.id)} className="cursor-pointer group">
                                   <MarketplaceGeckoCard
                                       gecko={gecko}
                                       owner={owners[gecko.created_by]}
                                       currentUser={currentUser}
                                       isLiked={likedGeckoIds.has(gecko.id)}
                                       onToggleLike={handleToggleLike}
                                       onViewLineage={handleViewLineage}
                                       size={cardSize}
                                   />
                               </div>
                            ))}
                        </div>
                        {hasMoreGeckos && (
                            <div className="flex justify-center mt-10">
                                <Button
                                    variant="outline"
                                    className="border-slate-600 hover:bg-slate-800 text-slate-300 px-8"
                                    disabled={isLoadingMore}
                                    onClick={loadMoreGeckos}
                                >
                                    {isLoadingMore ? 'Loading...' : 'Load More Geckos'}
                                </Button>
                            </div>
                        )}
                    </>
                )}
                { !isLoading && filteredGeckos.length === 0 && (
                    <EmptyState
                        icon={ShoppingBag}
                        title="No Geckos Found"
                        message="Try adjusting your search or check back later!"
                    />
                )}
            </div>
        </div>
    );
}