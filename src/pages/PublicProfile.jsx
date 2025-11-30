import React, { useState, useEffect } from 'react';
import { User, Gecko, UserFollow, Notification, BreedingPlan } from '@/entities/all';
import { notifyNewFollower } from '@/components/notifications/NotificationService';
import { useLocation, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Users, MapPin, Globe, UserPlus, UserMinus, ShoppingCart, GitBranch, Heart, Instagram, Facebook, Youtube } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { createPageUrl } from '@/utils';
import GeckoCard from '../components/my-geckos/GeckoCard';

export default function PublicProfile() {
    const location = useLocation();
    const { toast } = useToast();
    const [profileUser, setProfileUser] = useState(null);
    const [userGeckos, setUserGeckos] = useState([]);
    const [forSaleGeckos, setForSaleGeckos] = useState([]);
    const [breedingGeckos, setBreedingGeckos] = useState([]);
    const [collectionGeckos, setCollectionGeckos] = useState([]);
    const [breedingPlans, setBreedingPlans] = useState([]);
    const [currentUser, setCurrentUser] = useState(null);
    const [isFollowing, setIsFollowing] = useState(false);
    const [followRecord, setFollowRecord] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchProfileData = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const params = new URLSearchParams(location.search);
                const userId = params.get('userId');
                const userEmail = params.get('email');

                if (!userId && !userEmail) {
                    setError("No user specified.");
                    setIsLoading(false);
                    return;
                }
                
                const loggedInUser = await User.me().catch(() => null);
                setCurrentUser(loggedInUser);
                
                // Fetch user by ID or email
                let user = null;
                if (userId) {
                    const users = await User.filter({ id: userId });
                    user = users && users.length > 0 ? users[0] : null;
                } else if (userEmail) {
                    const users = await User.filter({ email: userEmail });
                    user = users && users.length > 0 ? users[0] : null;
                }

                // Profiles are public by default now
                if (!user) {
                     setError("This profile does not exist.");
                     setIsLoading(false);
                     return;
                }
                
                setProfileUser(user);

                // Check if current user is following this profile
                if (loggedInUser && loggedInUser.email !== user.email) {
                    try {
                        // RLS allows reading where follower_email matches current user
                        const allFollows = await UserFollow.list();
                        const existingFollow = allFollows.find(f => 
                            f.follower_email === loggedInUser.email && 
                            f.following_email === user.email
                        );
                        if (existingFollow) {
                            setIsFollowing(true);
                            setFollowRecord(existingFollow);
                        }
                    } catch (err) {
                        console.error("Error checking follow status:", err);
                    }
                }
                
                // Fetch user's public geckos
                const geckos = await Gecko.filter({ created_by: user.email, is_public: true });
                setUserGeckos(geckos);
                
                // Categorize geckos
                setForSaleGeckos(geckos.filter(g => g.status === 'For Sale'));
                setBreedingGeckos(geckos.filter(g => ['Ready to Breed', 'Proven', 'Future Breeder'].includes(g.status)));
                setCollectionGeckos(geckos.filter(g => !['For Sale', 'Ready to Breed', 'Proven', 'Future Breeder', 'Sold'].includes(g.status)));
                
                // Fetch public breeding plans
                const plans = await BreedingPlan.filter({ created_by: user.email, is_public: true }).catch(() => []);
                setBreedingPlans(plans);

            } catch (err) {
                console.error("Error fetching public profile:", err);
                setError("Could not load profile.");
            }
            setIsLoading(false);
        };

        fetchProfileData();
    }, [location.search]);

    const handleFollowToggle = async () => {
        if (!currentUser) {
            toast({ title: "Login required", description: "Please log in to follow users" });
            return;
        }

        try {
            if (isFollowing && followRecord) {
                await UserFollow.delete(followRecord.id);
                setIsFollowing(false);
                setFollowRecord(null);
                toast({ title: "Unfollowed", description: `You've unfollowed ${profileUser.full_name}` });
            } else {
                // Check if already following to prevent duplicates
                const allFollows = await UserFollow.list();
                const existingFollow = allFollows.find(f => 
                    f.follower_email === currentUser.email && 
                    f.following_email === profileUser.email
                );
                
                if (existingFollow) {
                    setIsFollowing(true);
                    setFollowRecord(existingFollow);
                    toast({ title: "Already Following", description: `You're already following ${profileUser.full_name}` });
                    return;
                }
                
                const newFollow = await UserFollow.create({
                    follower_email: currentUser.email,
                    following_email: profileUser.email
                });
                setIsFollowing(true);
                setFollowRecord(newFollow);
                
                // Notify the user they have a new follower
                try {
                    await notifyNewFollower(profileUser.email, currentUser.email, currentUser.full_name);
                } catch (notifyErr) {
                    console.error("Failed to send follow notification:", notifyErr);
                }
                
                toast({ title: "Following!", description: `You're now following ${profileUser.full_name}` });
            }
        } catch (error) {
            console.error('Failed to toggle follow:', error);
            toast({ title: "Error", description: "Failed to update follow status", variant: "destructive" });
        }
    };

    if (isLoading) {
        return <div className="flex justify-center items-center h-screen bg-slate-950"><Loader2 className="w-16 h-16 text-emerald-500 animate-spin" /></div>;
    }

    if (error) {
        return <div className="text-center p-8 bg-slate-950 min-h-screen text-red-400">{error}</div>;
    }

    if (!profileUser) {
        return null;
    }
    
    return (
        <div className="bg-slate-950 min-h-screen">
            <div className="relative h-48 md:h-64 bg-slate-800">
                {profileUser.cover_image_url && (
                    <img src={profileUser.cover_image_url} alt="Cover" className="w-full h-full object-cover"/>
                )}
            </div>
            
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
                <div className="-mt-12 sm:-mt-16 sm:flex sm:items-end sm:space-x-5 relative z-10">
                    <div className="flex">
                        <img 
                            className="h-24 w-24 rounded-lg ring-4 ring-slate-950 sm:h-32 sm:w-32 object-cover" 
                            src={profileUser.profile_image_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(profileUser.full_name)}&background=84A98C&color=fff`}
                            alt={profileUser.full_name}
                        />
                    </div>
                    <div className="mt-6 sm:flex-1 sm:min-w-0 sm:flex sm:items-center sm:justify-end sm:space-x-6 sm:pb-1">
                        <div className="sm:hidden md:block mt-6 min-w-0 flex-1">
                            <h1 className="text-2xl font-bold text-slate-100 truncate">{profileUser.full_name}</h1>
                            {profileUser.location && (
                                <p className="text-sm text-slate-400 flex items-center gap-2 mt-1">
                                    <MapPin className="w-4 h-4" />
                                    {profileUser.location}
                                </p>
                            )}
                        </div>
                        {currentUser && currentUser.email !== profileUser.email && (
                            <Button
                                onClick={handleFollowToggle}
                                className={isFollowing ? 'bg-slate-700 hover:bg-slate-600' : 'bg-emerald-600 hover:bg-emerald-700'}
                            >
                                {isFollowing ? (
                                    <><UserMinus className="w-4 h-4 mr-2" /> Unfollow</>
                                ) : (
                                    <><UserPlus className="w-4 h-4 mr-2" /> Follow</>
                                )}
                            </Button>
                        )}
                    </div>
                </div>
                 <div className="block sm:hidden mt-6 min-w-0 flex-1">
                    <h1 className="text-2xl font-bold text-slate-100 truncate">{profileUser.full_name}</h1>
                    {profileUser.location && (
                        <p className="text-sm text-slate-400 flex items-center gap-2 mt-1">
                            <MapPin className="w-4 h-4" />
                            {profileUser.location}
                        </p>
                    )}
                </div>
            </div>

            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="md:col-span-1 space-y-6">
                    <Card className="bg-slate-900 border-slate-700">
                        <CardHeader><CardTitle className="text-slate-200">About</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            <p className="text-slate-300">{profileUser.bio || 'No bio provided.'}</p>
                            {(profileUser.city || profileUser.state_province || profileUser.country) && (
                                <p className="text-sm text-slate-400 flex items-center gap-1">
                                    <MapPin className="w-4 h-4" />
                                    {[profileUser.city, profileUser.state_province, profileUser.country].filter(Boolean).join(', ')}
                                </p>
                            )}
                            {(profileUser.website_url || profileUser.instagram_handle || profileUser.facebook_url || profileUser.youtube_url || profileUser.tiktok_handle) && (
                                <div className="flex flex-wrap gap-2 pt-2">
                                    {profileUser.website_url && (
                                        <a href={profileUser.website_url} target="_blank" rel="noopener noreferrer">
                                            <Button size="sm" variant="outline" className="border-slate-600 hover:bg-slate-700">
                                                <Globe className="w-4 h-4" />
                                            </Button>
                                        </a>
                                    )}
                                    {profileUser.instagram_handle && (
                                        <a href={`https://instagram.com/${profileUser.instagram_handle}`} target="_blank" rel="noopener noreferrer">
                                            <Button size="sm" variant="outline" className="border-pink-500/50 hover:bg-pink-500/20 text-pink-400">
                                                <Instagram className="w-4 h-4" />
                                            </Button>
                                        </a>
                                    )}
                                    {profileUser.facebook_url && (
                                        <a href={profileUser.facebook_url} target="_blank" rel="noopener noreferrer">
                                            <Button size="sm" variant="outline" className="border-blue-500/50 hover:bg-blue-500/20 text-blue-400">
                                                <Facebook className="w-4 h-4" />
                                            </Button>
                                        </a>
                                    )}
                                    {profileUser.youtube_url && (
                                        <a href={profileUser.youtube_url} target="_blank" rel="noopener noreferrer">
                                            <Button size="sm" variant="outline" className="border-red-500/50 hover:bg-red-500/20 text-red-400">
                                                <Youtube className="w-4 h-4" />
                                            </Button>
                                        </a>
                                    )}
                                    {profileUser.tiktok_handle && (
                                        <a href={`https://tiktok.com/@${profileUser.tiktok_handle}`} target="_blank" rel="noopener noreferrer">
                                            <Button size="sm" variant="outline" className="border-slate-500/50 hover:bg-slate-500/20 text-slate-300">
                                                <span className="font-bold text-sm">TT</span>
                                            </Button>
                                        </a>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
                <div className="md:col-span-2">
                    <Tabs defaultValue="for-sale" className="w-full">
                        <TabsList className="grid w-full grid-cols-3 mb-6 bg-slate-800">
                            <TabsTrigger value="for-sale" className="data-[state=active]:bg-orange-600">
                                <ShoppingCart className="w-4 h-4 mr-2" />
                                For Sale ({forSaleGeckos.length})
                            </TabsTrigger>
                            <TabsTrigger value="breeders" className="data-[state=active]:bg-pink-600">
                                <GitBranch className="w-4 h-4 mr-2" />
                                Breeders ({breedingGeckos.length})
                            </TabsTrigger>
                            <TabsTrigger value="collection" className="data-[state=active]:bg-blue-600">
                                <Heart className="w-4 h-4 mr-2" />
                                Collection ({collectionGeckos.length})
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="for-sale">
                            {forSaleGeckos.length > 0 ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {forSaleGeckos.map(gecko => (
                                        <GeckoCard key={gecko.id} gecko={gecko} onEdit={() => {}} onDelete={() => {}} onCardClick={() => {}} isPublicView={true}/>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-12 bg-slate-800 rounded-lg">
                                    <ShoppingCart className="w-12 h-12 mx-auto text-slate-500 mb-4"/>
                                    <p className="text-slate-400">No geckos currently for sale.</p>
                                </div>
                            )}
                        </TabsContent>

                        <TabsContent value="breeders">
                            {breedingGeckos.length > 0 ? (
                                <div className="space-y-8">
                                    {/* Males Section */}
                                    {breedingGeckos.filter(g => g.sex === 'Male').length > 0 && (
                                        <div>
                                            <h3 className="text-lg font-semibold text-blue-400 mb-4 flex items-center gap-2">
                                                <span className="text-2xl">♂</span> Males ({breedingGeckos.filter(g => g.sex === 'Male').length})
                                            </h3>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                                {breedingGeckos.filter(g => g.sex === 'Male').map(gecko => (
                                                    <GeckoCard key={gecko.id} gecko={gecko} onEdit={() => {}} onDelete={() => {}} onCardClick={() => {}} isPublicView={true}/>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    
                                    {/* Females Section */}
                                    {breedingGeckos.filter(g => g.sex === 'Female').length > 0 && (
                                        <div>
                                            <h3 className="text-lg font-semibold text-pink-400 mb-4 flex items-center gap-2">
                                                <span className="text-2xl">♀</span> Females ({breedingGeckos.filter(g => g.sex === 'Female').length})
                                            </h3>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                                {breedingGeckos.filter(g => g.sex === 'Female').map(gecko => (
                                                    <GeckoCard key={gecko.id} gecko={gecko} onEdit={() => {}} onDelete={() => {}} onCardClick={() => {}} isPublicView={true}/>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    
                                    {/* Unsexed Section */}
                                    {breedingGeckos.filter(g => g.sex === 'Unsexed').length > 0 && (
                                        <div>
                                            <h3 className="text-lg font-semibold text-slate-400 mb-4 flex items-center gap-2">
                                                <span className="text-2xl">?</span> Unsexed ({breedingGeckos.filter(g => g.sex === 'Unsexed').length})
                                            </h3>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                                {breedingGeckos.filter(g => g.sex === 'Unsexed').map(gecko => (
                                                    <GeckoCard key={gecko.id} gecko={gecko} onEdit={() => {}} onDelete={() => {}} onCardClick={() => {}} isPublicView={true}/>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="text-center py-12 bg-slate-800 rounded-lg">
                                    <GitBranch className="w-12 h-12 mx-auto text-slate-500 mb-4"/>
                                    <p className="text-slate-400">No public breeders listed.</p>
                                </div>
                            )}
                        </TabsContent>

                        <TabsContent value="collection">
                            {collectionGeckos.length > 0 ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {collectionGeckos.map(gecko => (
                                        <GeckoCard key={gecko.id} gecko={gecko} onEdit={() => {}} onDelete={() => {}} onCardClick={() => {}} isPublicView={true}/>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-12 bg-slate-800 rounded-lg">
                                    <Users className="w-12 h-12 mx-auto text-slate-500 mb-4"/>
                                    <p className="text-slate-400">No public collection geckos.</p>
                                </div>
                            )}
                        </TabsContent>
                    </Tabs>
                </div>
            </div>
        </div>
    );
}