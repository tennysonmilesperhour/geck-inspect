import React, { useState, useEffect } from 'react';
import { Gecko, User, MarketplaceLike } from '@/entities/all';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Heart, Loader2, DollarSign, MapPin, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import MessageUserButton from '../components/ui/MessageUserButton';

export default function LikedGeckosPage() {
    const [likedGeckos, setLikedGeckos] = useState([]);
    const [likes, setLikes] = useState([]);
    const [owners, setOwners] = useState({});
    const [isLoading, setIsLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState(null);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const user = await base44.auth.me();
                if (!user) {
                    setIsLoading(false);
                    return;
                }
                setCurrentUser(user);

                // Get user's likes (filter by created_by since that's how RLS works)
                const userLikes = await MarketplaceLike.list();
                setLikes(userLikes);

                if (userLikes.length === 0) {
                    setIsLoading(false);
                    return;
                }

                // Get the liked geckos
                const geckoIds = userLikes.map(l => l.gecko_id);
                const geckos = await Gecko.filter({ id: { $in: geckoIds } });
                setLikedGeckos(geckos);

                // Get owners
                const ownerEmails = [...new Set(geckos.map(g => g.created_by))];
                if (ownerEmails.length > 0) {
                    const ownerData = await User.filter({ email: { $in: ownerEmails } });
                    const ownersMap = ownerData.reduce((acc, u) => {
                        acc[u.email] = u;
                        return acc;
                    }, {});
                    setOwners(ownersMap);
                }
            } catch (error) {
                console.error("Failed to fetch liked geckos:", error);
            }
            setIsLoading(false);
        };
        fetchData();
    }, []);

    const handleUnlike = async (geckoId) => {
        const like = likes.find(l => l.gecko_id === geckoId);
        if (like) {
            await MarketplaceLike.delete(like.id);
            setLikes(likes.filter(l => l.id !== like.id));
            setLikedGeckos(likedGeckos.filter(g => g.id !== geckoId));
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
            </div>
        );
    }

    if (!currentUser) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center text-center p-4">
                <div>
                    <Heart className="w-16 h-16 mx-auto text-slate-600 mb-4" />
                    <h2 className="text-2xl font-bold text-slate-100">Sign in to view your likes</h2>
                    <p className="text-slate-400 mt-2">You need to be logged in to save and view liked geckos.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-950 p-4 md:p-8">
            <div className="max-w-7xl mx-auto">
                <header className="text-center mb-8">
                    <h1 className="text-4xl font-bold text-slate-100 flex items-center justify-center gap-3">
                        <Heart className="w-10 h-10 text-pink-500 fill-pink-500" />
                        Liked Geckos
                    </h1>
                    <p className="text-lg text-slate-400 mt-2">Your saved marketplace favorites</p>
                </header>

                {likedGeckos.length === 0 ? (
                    <div className="text-center py-20 bg-slate-900 rounded-lg">
                        <Heart className="w-16 h-16 mx-auto text-slate-600 mb-4" />
                        <h3 className="text-xl font-semibold text-slate-300">No liked geckos yet</h3>
                        <p className="text-slate-400 mt-2">Browse the marketplace and tap the heart to save geckos you love!</p>
                        <Link to={createPageUrl('MarketplaceBuy')}>
                            <Button className="mt-4">
                                Browse Marketplace
                            </Button>
                        </Link>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                        {likedGeckos.map(gecko => {
                            const owner = owners[gecko.created_by];
                            return (
                                <Card key={gecko.id} className="overflow-hidden bg-slate-900 border-slate-700 hover:border-pink-500/50 transition-all">
                                    <div className="aspect-square w-full overflow-hidden relative group">
                                        <Link to={createPageUrl(`GeckoDetail?id=${gecko.id}`)}>
                                            <img
                                                src={gecko.image_urls?.[0] || 'https://i.imgur.com/sw9gnDp.png'}
                                                alt={gecko.name}
                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                            />
                                        </Link>
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            onClick={() => handleUnlike(gecko.id)}
                                            className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-pink-500"
                                        >
                                            <Trash2 className="w-5 h-5" />
                                        </Button>
                                        {gecko.status !== 'For Sale' && (
                                            <div className="absolute top-2 left-2 bg-orange-600 text-white text-xs px-2 py-1 rounded">
                                                {gecko.status === 'Sold' ? 'Sold' : 'No longer for sale'}
                                            </div>
                                        )}
                                    </div>
                                    <CardContent className="p-4">
                                        <Link to={createPageUrl(`GeckoDetail?id=${gecko.id}`)}>
                                            <h3 className="font-semibold text-lg text-slate-100 hover:text-emerald-400">{gecko.name}</h3>
                                        </Link>
                                        <p className="text-sm text-green-500 font-bold flex items-center gap-1">
                                            <DollarSign className="w-4 h-4" />
                                            {gecko.asking_price ? `$${gecko.asking_price}` : 'Inquire'}
                                        </p>
                                        <p className="text-xs text-slate-400 mt-1 line-clamp-2">{gecko.morphs_traits}</p>
                                        
                                        {owner && (
                                            <div className="mt-3 pt-3 border-t border-slate-700">
                                                <Link 
                                                    to={createPageUrl(`PublicProfile?email=${encodeURIComponent(owner.email)}`)}
                                                    className="flex items-center gap-2 text-sm text-slate-300 hover:text-emerald-400"
                                                >
                                                    <img 
                                                        src={owner.profile_image_url || `https://ui-avatars.com/api/?name=${owner.full_name}&background=10b981&color=fff`}
                                                        className="w-6 h-6 rounded-full"
                                                        alt={owner.full_name}
                                                    />
                                                    <span>{owner.full_name}</span>
                                                </Link>
                                                {(owner.city || owner.country) && (
                                                    <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                                                        <MapPin className="w-3 h-3" />
                                                        {[owner.city, owner.country].filter(Boolean).join(', ')}
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}