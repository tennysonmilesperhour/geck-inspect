import React, { useState, useEffect } from 'react';
import { User, Gecko, UserFollow, Notification, BreedingPlan } from '@/entities/all';
import { notifyNewFollower } from '@/components/notifications/NotificationService';
import { useLocation, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Users, MapPin, Link as LinkIcon, UserPlus, UserMinus, ShoppingCart, GitBranch, Heart } from 'lucide-react';
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
                    const followRecords = await UserFollow.filter({
                        follower_email: loggedInUser.email,
                        following_email: user.email
                    });
                    if (followRecords.length > 0) {
                        setIsFollowing(true);
                        setFollowRecord(followRecords[0]);
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
                const newFollow = await UserFollow.create({
                    follower_email: currentUser.email,
                    following_email: profileUser.email
                });
                setIsFollowing(true);
                setFollowRecord(newFollow);
                
                // Notify the user they have a new follower
                await notifyNewFollower(profileUser.email, currentUser.email, currentUser.full_name);
                
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
                            className="h-24 w-24 rounded-full ring-4 ring-slate-950 sm:h-32 sm:w-32 object-cover" 
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
                        <CardContent>
                            <p className="text-slate-300">{profileUser.bio || 'No bio provided.'}</p>
                            {(profileUser.city || profileUser.state_province || profileUser.country) && (
                                <p className="text-sm text-slate-400 flex items-center gap-1 mt-3">
                                    <MapPin className="w-4 h-4" />
                                    {[profileUser.city, profileUser.state_province, profileUser.country].filter(Boolean).join(', ')}
                                </p>
                            )}
                            {profileUser.website_url && (
                                <a href={profileUser.website_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-emerald-400 hover:text-emerald-300 mt-4">
                                    <LinkIcon className="w-4 h-4" />
                                    <span>{profileUser.website_url.replace(/https?:\/\//, '')}</span>
                                </a>
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
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {breedingGeckos.map(gecko => (
                                        <GeckoCard key={gecko.id} gecko={gecko} onEdit={() => {}} onDelete={() => {}} onCardClick={() => {}} isPublicView={true}/>
                                    ))}
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