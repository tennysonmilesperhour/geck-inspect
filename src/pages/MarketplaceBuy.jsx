import React, { useState, useEffect } from 'react';
import { Gecko, User, MarketplaceLike } from '@/entities/all';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, DollarSign, Users, MapPin, MessageSquare, Heart, Loader2, ShoppingBag } from 'lucide-react';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import EmptyState from '../components/shared/EmptyState';
import { useNavigate, Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import MessageUserButton from '../components/ui/MessageUserButton';

// Marketplace-specific Gecko Card
const MarketplaceGeckoCard = ({ gecko, owner, currentUser, isLiked, onToggleLike }) => {
    const getSexIcon = (sex) => sex === 'Male' ? '♂' : sex === 'Female' ? '♀' : '?';
    const getSexColor = (sex) => sex === 'Male' ? 'text-blue-400' : sex === 'Female' ? 'text-pink-400' : 'text-gray-400';

    return (
        <Card className="overflow-hidden group-hover:shadow-lg transition-shadow duration-300 h-full flex flex-col bg-slate-800/80 backdrop-blur-sm border-slate-700">
            <div className="aspect-square w-full overflow-hidden relative">
                <img
                    src={gecko.image_urls?.[0] || `https://ui-avatars.com/api/?name=${gecko.name.charAt(0)}&background=random`}
                    alt={gecko.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                {/* Sex icon in top left */}
                <div className="absolute top-2 left-2">
                    <span className={`${getSexColor(gecko.sex)} text-3xl font-bold drop-shadow-lg`}>
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
                        className={`absolute top-2 right-2 bg-black/50 hover:bg-black/70 ${isLiked ? 'text-pink-500' : 'text-white'}`}
                    >
                        <Heart className={`w-5 h-5 ${isLiked ? 'fill-pink-500' : ''}`} />
                    </Button>
                )}
            </div>
            <CardContent className="p-4 flex-grow flex flex-col">
                <h3 className="font-semibold text-lg truncate text-slate-100">{gecko.name}</h3>
                <p className="text-sm text-green-500 font-bold flex items-center gap-1">
                    <DollarSign className="w-4 h-4" />
                    {gecko.asking_price ? `$${gecko.asking_price}` : 'Inquire for price'}
                </p>
                <p className="text-xs text-slate-400 mt-1 line-clamp-2">{gecko.morphs_traits}</p>
                
                <div className="mt-auto pt-4 space-y-3">
                    <div className="flex items-center gap-2 text-sm text-slate-300">
                        <Link 
                            to={createPageUrl(`PublicProfile?userId=${owner?.id}`)}
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-2 group"
                        >
                            <img 
                                src={owner?.profile_image_url || `https://ui-avatars.com/api/?name=${owner?.full_name?.charAt(0)}&background=random`} 
                                className="w-6 h-6 rounded-lg group-hover:opacity-80 transition-opacity" 
                                alt={owner?.full_name}
                            />
                            <span className="truncate group-hover:underline">{owner?.full_name || 'Breeder'}</span>
                        </Link>
                    </div>
                    {owner?.location && (
                        <div className="flex items-center gap-1 text-xs text-slate-400">
                            <MapPin className="w-3 h-3" />
                            <span>{owner.location}</span>
                        </div>
                    )}
                     {currentUser && owner && currentUser.id !== owner.id && (
                        <MessageUserButton 
                           recipientEmail={owner.email}
                           recipientName={owner.full_name}
                           variant="outline"
                           size="sm"
                           className="w-full"
                        />
                    )}
                </div>
            </CardContent>
        </Card>
    );
};

export default function MarketplaceBuyPage() {
    const [geckos, setGeckos] = useState([]);
    const [owners, setOwners] = useState({});
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentUser, setCurrentUser] = useState(null);
    const [likedGeckoIds, setLikedGeckoIds] = useState(new Set());
    const navigate = useNavigate();

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                // Fetch user first (non-blocking)
                const loggedInUser = await base44.auth.me().catch(() => null);
                setCurrentUser(loggedInUser);

                // Get all geckos
                const allGeckos = await Gecko.list("-updated_date").catch(() => []);

                // Filter to public for-sale geckos
                const forSaleGeckos = (allGeckos || []).filter(g => 
                    g.status === 'For Sale' && g.is_public === true
                );
                
                // Fetch user's likes if logged in (non-blocking)
                if (loggedInUser) {
                    try {
                        const userLikes = await MarketplaceLike.filter({ user_email: loggedInUser.email });
                        setLikedGeckoIds(new Set(userLikes.map(l => l.gecko_id)));
                    } catch (e) {
                        console.log("Could not load likes");
                    }
                }
                
                const ownerEmails = [...new Set(forSaleGeckos.map(g => g.created_by))];
                
                if (ownerEmails.length > 0) {
                    try {
                        const ownerData = await User.filter({ email: { $in: ownerEmails } });
                        const ownersMap = (ownerData || []).reduce((acc, user) => {
                            acc[user.email] = user;
                            return acc;
                        }, {});
                        setOwners(ownersMap);
                    } catch (e) {
                        console.log("Could not load owners");
                        setOwners({});
                    }
                } else {
                    setOwners({});
                }

                setGeckos(forSaleGeckos);
            } catch (error) {
                console.error("Failed to fetch marketplace data:", error);
                setGeckos([]);
            }
            setIsLoading(false);
        };
        fetchData();
    }, []);

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
        navigate(createPageUrl(`GeckoDetail?id=${geckoId}`));
    };

    const filteredGeckos = geckos.filter(gecko =>
        (gecko.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (gecko.morphs_traits?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (owners[gecko.created_by]?.full_name?.toLowerCase() || '').includes(searchTerm.toLowerCase())
    );

    return (
        <div className="p-4 md:p-8 bg-slate-950 min-h-screen">
            <div className="max-w-7xl mx-auto">
                <header className="text-center mb-8">
                    <h1 className="text-4xl font-bold text-slate-100">Gecko Marketplace</h1>
                    <p className="text-lg text-slate-400 mt-2">Find your next crested gecko from breeders around the world.</p>
                </header>

                <div className="mb-8 max-w-lg mx-auto">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <Input
                            placeholder="Search by morph, gecko name, or breeder..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 h-12 text-lg bg-slate-800 border-slate-700 text-slate-100"
                        />
                    </div>
                </div>

                {isLoading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                        {filteredGeckos.map(gecko => (
                           <div key={gecko.id} onClick={() => handleViewDetails(gecko.id)} className="cursor-pointer group">
                               <MarketplaceGeckoCard 
                                   gecko={gecko} 
                                   owner={owners[gecko.created_by]} 
                                   currentUser={currentUser}
                                   isLiked={likedGeckoIds.has(gecko.id)}
                                   onToggleLike={handleToggleLike}
                               />
                           </div>
                        ))}
                    </div>
                )}
                { !isLoading && filteredGeckos.length === 0 && (
                    <div className="text-center py-16 col-span-full bg-slate-900 rounded-lg">
                        <h3 className="text-xl font-semibold text-slate-300">No geckos found</h3>
                        <p className="text-slate-400 mt-2">Try adjusting your search or check back later!</p>
                    </div>
                )}
            </div>
        </div>
    );
}