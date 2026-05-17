import { useState, useEffect } from 'react';
import { initialsAvatarUrl } from '@/components/shared/InitialsAvatar';
import { User, Gecko, UserFollow, BreedingPlan, WeightRecord } from '@/entities/all';
import { notifyNewFollower } from '@/components/notifications/NotificationService';
import { useLocation } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Users, MapPin, Globe, UserPlus, UserMinus, ShoppingCart, GitBranch, Heart, Instagram, Facebook, Youtube, FileText, Store } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { createPageUrl } from '@/utils';
import { useNavigate } from 'react-router-dom';
import GeckoCard from '../components/my-geckos/GeckoCard';
import Seo from '@/components/seo/Seo';
import { ORG_ID, SITE_URL } from '@/lib/organization-schema';

// Build a ProfilePage + Person JSON-LD graph for the currently-loaded
// breeder. Surfaces the breeder as a recognized entity to AI assistants
// answering "is X a real crested gecko breeder" or "who is X" ,  pulls
// every social handle the user has filled in into Person.sameAs.
function buildProfileJsonLd(profileUser, counts) {
  const params = new URLSearchParams();
  if (profileUser.id) params.set('userId', profileUser.id);
  else if (profileUser.email) params.set('email', profileUser.email);
  const path = `/PublicProfile?${params.toString()}`;
  const url = `${SITE_URL}${path}`;
  const sameAs = [
    profileUser.website_url,
    profileUser.facebook_url,
    profileUser.youtube_url,
    profileUser.instagram_handle && `https://instagram.com/${profileUser.instagram_handle}`,
    profileUser.tiktok_handle && `https://tiktok.com/@${profileUser.tiktok_handle}`,
  ].filter(Boolean);
  const addressParts = [profileUser.city, profileUser.state_province, profileUser.country].filter(Boolean);
  return [
    {
      '@type': 'ProfilePage',
      '@id': `${url}#profilepage`,
      url,
      name: `${profileUser.full_name} on Geck Inspect`,
      dateCreated: profileUser.created_date || undefined,
      dateModified: profileUser.updated_date || undefined,
      isPartOf: { '@id': `${SITE_URL}/#website` },
      publisher: { '@id': ORG_ID },
      mainEntity: {
        '@type': 'Person',
        '@id': `${url}#person`,
        name: profileUser.full_name,
        ...(profileUser.business_name && { affiliation: { '@type': 'Organization', name: profileUser.business_name } }),
        ...(profileUser.bio && { description: profileUser.bio }),
        ...(profileUser.profile_image_url && { image: profileUser.profile_image_url }),
        ...(addressParts.length > 0 && {
          address: {
            '@type': 'PostalAddress',
            ...(profileUser.city && { addressLocality: profileUser.city }),
            ...(profileUser.state_province && { addressRegion: profileUser.state_province }),
            ...(profileUser.country && { addressCountry: profileUser.country }),
          },
        }),
        knowsAbout: ['Crested gecko', 'Correlophus ciliatus', 'Reptile husbandry', 'Gecko breeding'],
        ...(sameAs.length > 0 && { sameAs }),
      },
      ...(counts && counts.forSale > 0 && {
        about: {
          '@type': 'OfferCatalog',
          name: `${profileUser.full_name} ,  geckos for sale`,
          numberOfItems: counts.forSale,
        },
      }),
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
        { '@type': 'ListItem', position: 2, name: 'Community', item: `${SITE_URL}/CommunityConnect` },
        { '@type': 'ListItem', position: 3, name: profileUser.full_name, item: url },
      ],
    },
  ];
}

export default function PublicProfile() {
    const location = useLocation();
    const navigate = useNavigate();
    const { toast } = useToast();
    const [profileUser, setProfileUser] = useState(null);
    const [_userGeckos, setUserGeckos] = useState([]);
    const [forSaleGeckos, setForSaleGeckos] = useState([]);
    const [breedingGeckos, setBreedingGeckos] = useState([]);
    const [collectionGeckos, setCollectionGeckos] = useState([]);
    const [_breedingPlans, setBreedingPlans] = useState([]);
    const [weightRecords, setWeightRecords] = useState([]);
    const [currentUser, setCurrentUser] = useState(null);
    const [isFollowing, setIsFollowing] = useState(false);
    const [followRecord, setFollowRecord] = useState(null);
    const [storePage, setStorePage] = useState(null);
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
                        const myFollows = await UserFollow.filter({ follower_email: loggedInUser.email });
                        const existingFollow = myFollows.find(f => f.following_email === user.email);
                        if (existingFollow) {
                            setIsFollowing(true);
                            setFollowRecord(existingFollow);
                        }
                    } catch (err) {
                        console.error("Error checking follow status:", err);
                    }
                }
                
                // Fetch user's public geckos and their weight records
                const [geckos, weights] = await Promise.all([
                    Gecko.filter({ created_by: user.email, is_public: true, archived: false }),
                    WeightRecord.filter({ created_by: user.email }).catch(() => [])
                ]);
                setUserGeckos(geckos);
                setWeightRecords(weights);
                
                // Categorize geckos - geckos can appear in multiple categories
                setForSaleGeckos(geckos.filter(g => g.status === 'For Sale'));
                setBreedingGeckos(geckos.filter(g => ['Ready to Breed', 'Proven', 'Future Breeder'].includes(g.status)));
                // Collection shows ALL geckos except sold ones
                setCollectionGeckos(geckos.filter(g => g.status !== 'Sold'));
                
                // Fetch public breeding plans
                const plans = await BreedingPlan.filter({ created_by: user.email, is_public: true }).catch(() => []);
                setBreedingPlans(plans);

                // Fetch published store page (if any) so we can surface a
                // "Visit my store" pill next to the website link.
                const { data: storeData } = await supabase
                    .from('breeder_store_pages')
                    .select('slug, is_published, title')
                    .eq('owner_email', user.email)
                    .eq('is_published', true)
                    .maybeSingle();
                setStorePage(storeData || null);

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
                const myFollows = await UserFollow.filter({ follower_email: currentUser.email });
                const existingFollow = myFollows.find(f => f.following_email === profileUser.email);
                
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
    
    const profilePath = profileUser.id
        ? `/PublicProfile?userId=${profileUser.id}`
        : `/PublicProfile?email=${encodeURIComponent(profileUser.email)}`;
    const profileDescription = profileUser.bio
        ? `${profileUser.full_name} ,  ${profileUser.bio.slice(0, 200)}`
        : `${profileUser.full_name}'s public crested gecko profile on Geck Inspect ,  collection, breeders, and listings.`;

    return (
        <div className="bg-slate-950 min-h-screen">
            <Seo
                title={`${profileUser.full_name} ,  Crested Gecko Breeder Profile`}
                description={profileDescription}
                path={profilePath}
                image={profileUser.profile_image_url || profileUser.cover_image_url || undefined}
                imageAlt={`${profileUser.full_name} ,  Geck Inspect profile`}
                keywords={[
                    'crested gecko breeder',
                    `${profileUser.full_name} crested gecko`,
                    profileUser.business_name && profileUser.business_name.toLowerCase(),
                    'gecko collection',
                ].filter(Boolean)}
                jsonLd={buildProfileJsonLd(profileUser, {
                    forSale: forSaleGeckos.length,
                    breeding: breedingGeckos.length,
                    collection: collectionGeckos.length,
                })}
            />
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
                            src={profileUser.profile_image_url || initialsAvatarUrl(profileUser.full_name)}
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
                            {(storePage || profileUser.website_url || profileUser.instagram_handle || profileUser.facebook_url || profileUser.youtube_url || profileUser.tiktok_handle) && (
                                <div className="flex flex-wrap gap-2 pt-2">
                                    {profileUser.website_url && (
                                        <a href={profileUser.website_url} target="_blank" rel="noopener noreferrer">
                                            <Button size="sm" variant="outline" className="border-slate-600 hover:bg-slate-700">
                                                <Globe className="w-4 h-4" />
                                            </Button>
                                        </a>
                                    )}
                                    {storePage?.slug && (
                                        <a href={`/store/${storePage.slug}`} target="_blank" rel="noopener noreferrer">
                                            <Button size="sm" variant="outline" className="border-emerald-500/50 hover:bg-emerald-500/20 text-emerald-300 gap-1.5">
                                                <Store className="w-4 h-4" />
                                                <span className="text-xs font-medium">Visit store</span>
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

                    {profileUser.store_policy && (
                        <Card className="bg-slate-900 border-slate-700">
                            <CardHeader><CardTitle className="text-slate-200 flex items-center gap-2"><FileText className="w-4 h-4" />Store Policy</CardTitle></CardHeader>
                            <CardContent>
                                <p className="text-sm text-slate-300 whitespace-pre-wrap">{profileUser.store_policy}</p>
                            </CardContent>
                        </Card>
                    )}
                </div>
                <div className="md:col-span-2">
                    {(() => {
                        const showBreeders = profileUser.show_breeders_publicly !== false;
                        const tabCount = showBreeders ? 3 : 2;
                        const gridClass = tabCount === 3 ? 'grid-cols-3' : 'grid-cols-2';
                        return (
                    <Tabs defaultValue="for-sale" className="w-full">
                        <TabsList className={`grid w-full ${gridClass} mb-6 bg-slate-800`}>
                            <TabsTrigger value="for-sale" className="data-[state=active]:bg-orange-600">
                                <ShoppingCart className="w-4 h-4 mr-2" />
                                For Sale ({forSaleGeckos.length})
                            </TabsTrigger>
                            {showBreeders && (
                                <TabsTrigger value="breeders" className="data-[state=active]:bg-pink-600">
                                    <GitBranch className="w-4 h-4 mr-2" />
                                    Breeders ({breedingGeckos.length})
                                </TabsTrigger>
                            )}
                            <TabsTrigger value="collection" className="data-[state=active]:bg-blue-600">
                                <Heart className="w-4 h-4 mr-2" />
                                Collection ({collectionGeckos.length})
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="for-sale">
                            {forSaleGeckos.length > 0 ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {forSaleGeckos.slice(0, 24).map(gecko => (
                                        <GeckoCard key={gecko.id} gecko={gecko} weightRecords={weightRecords} isOwner={false} onView={(g) => navigate(createPageUrl(`GeckoDetail?id=${g.id}`))} onEdit={() => {}} />
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-12 bg-slate-800 rounded-lg">
                                    <ShoppingCart className="w-12 h-12 mx-auto text-slate-500 mb-4"/>
                                    <p className="text-slate-400">No geckos currently for sale.</p>
                                </div>
                            )}
                        </TabsContent>

                        {showBreeders && (
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
                                                {breedingGeckos.filter(g => g.sex === 'Male').slice(0, 24).map(gecko => (
                                                    <GeckoCard key={gecko.id} gecko={gecko} weightRecords={weightRecords} isOwner={false} onView={(g) => navigate(createPageUrl(`GeckoDetail?id=${g.id}`))} onEdit={() => {}} />
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
                                                {breedingGeckos.filter(g => g.sex === 'Female').slice(0, 24).map(gecko => (
                                                    <GeckoCard key={gecko.id} gecko={gecko} weightRecords={weightRecords} isOwner={false} onView={(g) => navigate(createPageUrl(`GeckoDetail?id=${g.id}`))} onEdit={() => {}} />
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
                                                {breedingGeckos.filter(g => g.sex === 'Unsexed').slice(0, 24).map(gecko => (
                                                    <GeckoCard key={gecko.id} gecko={gecko} weightRecords={weightRecords} isOwner={false} onView={(g) => navigate(createPageUrl(`GeckoDetail?id=${g.id}`))} onEdit={() => {}} />
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
                        )}

                        <TabsContent value="collection">
                            {collectionGeckos.length > 0 ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {collectionGeckos.slice(0, 24).map(gecko => (
                                        <GeckoCard key={gecko.id} gecko={gecko} weightRecords={weightRecords} isOwner={false} onView={(g) => navigate(createPageUrl(`GeckoDetail?id=${g.id}`))} onEdit={() => {}} />
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
                        );
                    })()}
                </div>
            </div>
        </div>
    );
}