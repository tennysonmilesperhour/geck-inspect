import React, { useState, useEffect } from 'react';
import { useCallback } from 'react';
import { User, Gecko, UserFollow, ForumCategory, ForumPost, UserActivity } from '@/entities/all';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { 
    Search, Users, MapPin, Globe, ShoppingCart, GitBranch, Heart, 
    UserPlus, UserCheck, ExternalLink, MessageSquare, ThumbsUp, Eye, 
    PlusCircle, Pin, Loader2, Rss, Activity
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { formatDistanceToNow } from 'date-fns';

// Breeder Card Component
function BreederCard({ breeder, currentUser, isFollowing, onFollow, onUnfollow, geckoCounts, coverImage }) {
    const counts = geckoCounts[breeder.email] || { selling: 0, breeding: 0, keeping: 0 };
    const cardCover = breeder.cover_image_url || coverImage;

    return (
        <Card className="bg-slate-900 border-slate-700 hover:border-emerald-500/50 transition-all overflow-hidden flex flex-col">
            {/* Cover Image — always rendered for consistent card height */}
            <div className="h-24 w-full overflow-hidden flex-shrink-0">
                {cardCover ? (
                    <img
                        src={cardCover}
                        alt="Cover"
                        className="w-full h-full object-cover"
                        loading="lazy"
                        decoding="async"
                    />
                ) : (
                    <div className="w-full h-full bg-gradient-to-br from-emerald-950/60 to-slate-800" />
                )}
            </div>
            <CardContent className="p-4 -mt-10 relative flex-1 flex flex-col">
                <div className="flex items-start gap-4 flex-1">
                    <img
                        src={breeder.profile_image_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(breeder.full_name || 'User')}&background=10b981&color=fff`}
                        alt={breeder.full_name}
                        className="w-20 h-20 rounded-full object-cover border-2 border-emerald-500/30 flex-shrink-0 ring-4 ring-slate-900"
                        loading="lazy"
                        decoding="async"
                    />
                    <div className="flex-1 min-w-0 flex flex-col">
                        <div className="flex items-center justify-between">
                            <div>
                                <Link
                                    to={createPageUrl(`PublicProfile?email=${encodeURIComponent(breeder.email)}`)}
                                    className="font-bold text-slate-100 hover:text-emerald-400 transition-colors"
                                >
                                    {breeder.full_name}
                                </Link>
                                {breeder.business_name && (
                                    <p className="text-sm text-emerald-400">{breeder.business_name}</p>
                                )}
                            </div>
                            {currentUser && currentUser.email !== breeder.email && (
                                <Button
                                    size="sm"
                                    variant={isFollowing ? "outline" : "default"}
                                    onClick={() => isFollowing ? onUnfollow(breeder.email) : onFollow(breeder.email)}
                                    className={isFollowing ? "border-slate-600" : ""}
                                >
                                    {isFollowing ? (
                                        <><UserCheck className="w-4 h-4 mr-1" /> Following</>
                                    ) : (
                                        <><UserPlus className="w-4 h-4 mr-1" /> Follow</>
                                    )}
                                </Button>
                            )}
                        </div>

                        <p className="text-sm text-slate-400 flex items-center gap-1 mt-1 min-h-[1.25rem]">
                            {(breeder.city || breeder.state_province || breeder.country) ? (
                                <>
                                    <MapPin className="w-3 h-3 flex-shrink-0" />
                                    {[breeder.city, breeder.state_province, breeder.country].filter(Boolean).join(', ')}
                                </>
                            ) : (
                                <span className="text-slate-600 italic">No location set</span>
                            )}
                        </p>

                        <p className="text-sm text-slate-300 mt-2 line-clamp-2 min-h-[2.5rem]">
                            {breeder.bio || <span className="text-slate-600 italic">No bio yet</span>}
                        </p>

                        <div className="flex flex-wrap gap-2 mt-3 min-h-[1.5rem]">
                            {counts.selling > 0 && (
                                <Badge variant="outline" className="text-orange-400 border-orange-400/30">
                                    <ShoppingCart className="w-3 h-3 mr-1" />
                                    {counts.selling} For Sale
                                </Badge>
                            )}
                            {counts.breeding > 0 && (
                                <Badge variant="outline" className="text-pink-400 border-pink-400/30">
                                    <GitBranch className="w-3 h-3 mr-1" />
                                    {counts.breeding} Breeding
                                </Badge>
                            )}
                            {counts.keeping > 0 && (
                                <Badge variant="outline" className="text-blue-400 border-blue-400/30">
                                    <Users className="w-3 h-3 mr-1" />
                                    {counts.keeping} Collection
                                </Badge>
                            )}
                        </div>

                        {breeder.looking_for && breeder.looking_for.length > 0 && (
                            <div className="mt-2">
                                <p className="text-xs text-slate-500 mb-1">Looking for:</p>
                                <div className="flex flex-wrap gap-1">
                                    {breeder.looking_for.slice(0, 3).map((item, idx) => (
                                        <Badge key={idx} className="bg-purple-900/50 text-purple-300 text-xs">
                                            {item}
                                        </Badge>
                                    ))}
                                    {breeder.looking_for.length > 3 && (
                                        <Badge className="bg-slate-700 text-slate-400 text-xs">
                                            +{breeder.looking_for.length - 3} more
                                        </Badge>
                                    )}
                                </div>
                            </div>
                        )}

                        <div className="flex gap-2 mt-auto pt-3">
                            <Link to={createPageUrl(`PublicProfile?email=${encodeURIComponent(breeder.email)}`)}>
                                <Button size="sm" variant="outline" className="border-slate-600 text-xs">
                                    <ExternalLink className="w-3 h-3 mr-1" /> View Profile
                                </Button>
                            </Link>
                            {breeder.website && (
                                <a href={breeder.website} target="_blank" rel="noopener noreferrer">
                                    <Button size="sm" variant="outline" className="border-slate-600 text-xs">
                                        <Globe className="w-3 h-3 mr-1" /> Website
                                    </Button>
                                </a>
                            )}
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

// Forum Tab Component
function ForumTab() {
    const [categories, setCategories] = useState([]);
    const [posts, setPosts] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState(null);
    const [showCreatePost, setShowCreatePost] = useState(false);
    const [newPost, setNewPost] = useState({ title: '', content: '', category_id: '' });

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const [user, fetchedCategories, fetchedPosts] = await Promise.all([
                    base44.auth.me().catch(() => null),
                    ForumCategory.list(),
                    ForumPost.list('-created_date')
                ]);
                
                const sortedCategories = fetchedCategories.sort((a,b) => a.order_position - b.order_position);
                setCurrentUser(user);
                setCategories(sortedCategories);
                setPosts(fetchedPosts);
            } catch (error) {
                console.error("Failed to load forum data:", error);
            }
            setIsLoading(false);
        };
        fetchData();
    }, []);

    const handleCreatePost = async () => {
        if (!newPost.title || !newPost.content || !newPost.category_id || !currentUser) return;
        try {
            const createdPost = await ForumPost.create({
                ...newPost,
                author_name: currentUser.full_name,
            });
            setPosts([createdPost, ...posts]);
            setShowCreatePost(false);
            setNewPost({ title: '', content: '', category_id: '' });
        } catch (error) {
            console.error("Failed to create post:", error);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-end">
                {currentUser && (
                    <Button onClick={() => setShowCreatePost(!showCreatePost)}>
                        <PlusCircle className="w-4 h-4 mr-2" />
                        {showCreatePost ? 'Cancel' : 'Create New Post'}
                    </Button>
                )}
            </div>

            {showCreatePost && (
                <Card className="bg-slate-900 border-slate-700">
                    <CardHeader>
                        <CardTitle className="text-slate-100">Create a New Post</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Input
                            placeholder="Post Title"
                            value={newPost.title}
                            onChange={(e) => setNewPost({ ...newPost, title: e.target.value })}
                            className="bg-slate-800 border-slate-600"
                        />
                        <Textarea
                            placeholder="What's on your mind?"
                            value={newPost.content}
                            onChange={(e) => setNewPost({ ...newPost, content: e.target.value })}
                            className="h-32 bg-slate-800 border-slate-600"
                        />
                        <Select onValueChange={(value) => setNewPost({ ...newPost, category_id: value })}>
                            <SelectTrigger className="bg-slate-800 border-slate-600">
                                <SelectValue placeholder="Select a category" />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-800 border-slate-600">
                                {categories.map(cat => (
                                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </CardContent>
                    <CardFooter>
                        <Button onClick={handleCreatePost}>Submit Post</Button>
                    </CardFooter>
                </Card>
            )}

            {categories.map(category => {
                const categoryPosts = posts.filter(p => p.category_id === category.id);
                if (categoryPosts.length === 0) return null;
                return (
                    <div key={category.id}>
                        <h2 className="text-xl font-bold text-slate-200 mb-3">{category.name}</h2>
                        <Card className="bg-slate-900 border-slate-700">
                            <CardContent className="p-0 divide-y divide-slate-700">
                                {categoryPosts.map(post => (
                                    <Link key={post.id} to={`/ForumPost?id=${post.id}`} className="p-4 flex items-center justify-between hover:bg-slate-800/50 transition-colors cursor-pointer block">
                                        <div className="flex items-center gap-4">
                                            <MessageSquare className="w-5 h-5 text-slate-500 flex-shrink-0" />
                                            <div>
                                                <p className="font-semibold text-slate-100 hover:text-emerald-400">{post.title}</p>
                                                <p className="text-sm text-slate-400">
                                                    by {post.author_name} • {formatDistanceToNow(new Date(post.created_date), { addSuffix: true })}
                                                </p>
                                            </div>
                                            {post.is_pinned && <Pin className="w-4 h-4 text-orange-500" />}
                                        </div>
                                        <div className="flex items-center gap-4 text-sm text-slate-500">
                                            <div className="flex items-center gap-1">
                                                <ThumbsUp className="w-4 h-4" />
                                                <span>{post.liked_by_users?.length || 0}</span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <Eye className="w-4 h-4" />
                                                <span>{post.view_count || 0}</span>
                                            </div>
                                        </div>
                                    </Link>
                                ))}
                            </CardContent>
                        </Card>
                    </div>
                );
            })}
        </div>
    );
}

// Following Feed Component
function FollowingFeed({ currentUser, following, allUsers }) {
    const [activities, setActivities] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchActivities = async () => {
            if (!currentUser || following.length === 0) {
                setIsLoading(false);
                return;
            }
            
            try {
                // Get recent activities from users we follow
                const allActivities = await UserActivity.list('-created_date', 50);
                const followingActivities = allActivities.filter(a => 
                    following.includes(a.user_email)
                );
                setActivities(followingActivities.slice(0, 20));
            } catch (error) {
                console.error("Failed to load activities:", error);
            }
            setIsLoading(false);
        };
        fetchActivities();
    }, [currentUser, following]);

    const getActivityIcon = (type) => {
        switch(type) {
            case 'new_gecko': return '🦎';
            case 'new_post': return '📝';
            case 'new_comment': return '💬';
            case 'ai_training': return '🤖';
            case 'new_breeding_plan': return '💕';
            case 'gecko_for_sale': return '🏷️';
            default: return '⭐';
        }
    };

    const getActivityText = (type) => {
        switch(type) {
            case 'new_gecko': return 'added a new gecko';
            case 'new_post': return 'created a forum post';
            case 'new_comment': return 'commented on a post';
            case 'ai_training': return 'contributed to AI training';
            case 'new_breeding_plan': return 'started a new breeding plan';
            case 'gecko_for_sale': return 'listed a gecko for sale';
            default: return 'was active';
        }
    };

    const getUserName = (email) => {
        const user = allUsers.find(u => u.email === email);
        return user?.full_name || email.split('@')[0];
    };

    if (!currentUser) {
        return (
            <Card className="bg-slate-900 border-slate-700">
                <CardContent className="py-8 text-center">
                    <Users className="w-12 h-12 mx-auto text-slate-500 mb-4" />
                    <p className="text-slate-400">Log in to see updates from breeders you follow.</p>
                </CardContent>
            </Card>
        );
    }

    if (following.length === 0) {
        return (
            <Card className="bg-slate-900 border-slate-700">
                <CardContent className="py-8 text-center">
                    <UserPlus className="w-12 h-12 mx-auto text-slate-500 mb-4" />
                    <p className="text-slate-400">You're not following anyone yet.</p>
                    <p className="text-slate-500 text-sm mt-2">Follow some breeders to see their activity here!</p>
                </CardContent>
            </Card>
        );
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
            </div>
        );
    }

    return (
        <Card className="bg-slate-900 border-slate-700">
            <CardHeader>
                <CardTitle className="text-slate-100 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-emerald-400" />
                    Recent Activity from People You Follow
                </CardTitle>
            </CardHeader>
            <CardContent>
                {activities.length > 0 ? (
                    <div className="space-y-3">
                        {activities.map((activity) => (
                            <div key={activity.id} className="flex items-start gap-3 p-3 bg-slate-800 rounded-lg hover:bg-slate-700/50 transition-colors">
                                <span className="text-xl">{getActivityIcon(activity.activity_type)}</span>
                                <div className="flex-1 min-w-0">
                                    <p className="text-slate-300 text-sm">
                                        <Link 
                                            to={createPageUrl(`PublicProfile?email=${encodeURIComponent(activity.user_email)}`)}
                                            className="font-semibold text-emerald-400 hover:text-emerald-300"
                                        >
                                            {getUserName(activity.user_email)}
                                        </Link>
                                        {' '}{getActivityText(activity.activity_type)}
                                    </p>
                                    <p className="text-xs text-slate-500 mt-1">
                                        {formatDistanceToNow(new Date(activity.created_date), { addSuffix: true })}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-8 text-slate-400">
                        <Rss className="w-12 h-12 mx-auto text-slate-500 mb-4" />
                        <p>No recent activity from people you follow.</p>
                        <p className="text-sm text-slate-500 mt-2">Check back later for updates!</p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

export default function CommunityConnectPage() {
    const [breeders, setBreeders] = useState([]);
    const [currentUser, setCurrentUser] = useState(null);
    const [following, setFollowing] = useState([]);
    const [geckoCounts, setGeckoCounts] = useState({});
    const [geckoCoverImages, setGeckoCoverImages] = useState({});
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [locationFilter, setLocationFilter] = useState('');
    const [breederOffset, setBreederOffset] = useState(0);
    const [hasMoreBreeders, setHasMoreBreeders] = useState(true);

    const fetchBreederBatch = useCallback(async (offset = 0) => {
        try {
            return await User.list(undefined, 24, offset).catch(() => []);
        } catch (error) {
            console.error("Failed to fetch breeder batch:", error);
            return [];
        }
    }, []);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                // Fetch user first
                const user = await base44.auth.me().catch(() => null);
                setCurrentUser(user);

                // Fetch initial 24 breeders and all geckos
                const initialBreeders = await fetchBreederBatch(0);
                const allGeckos = await Gecko.list().catch(() => []);

                // Filter to public, non-archived geckos only
                const publicGeckos = (allGeckos || []).filter(g => g.is_public !== false && !g.archived);

                // Calculate gecko counts and cover images per user
                const counts = {};
                const coverImages = {};
                publicGeckos.forEach(gecko => {
                    if (!counts[gecko.created_by]) {
                        counts[gecko.created_by] = { selling: 0, breeding: 0, keeping: 0 };
                    }
                    // Skip Sold geckos entirely from counts
                    if (gecko.status === 'Sold') return;
                    // All active geckos count toward collection
                    counts[gecko.created_by].keeping++;
                    // For Sale
                    if (gecko.status === 'For Sale') {
                        counts[gecko.created_by].selling++;
                    }
                    // Breeding-related statuses
                    if (['Ready to Breed', 'Proven', 'Future Breeder'].includes(gecko.status)) {
                        counts[gecko.created_by].breeding++;
                    }
                    // Save first gecko image as potential cover
                    if (!coverImages[gecko.created_by] && gecko.image_urls?.length > 0) {
                        coverImages[gecko.created_by] = gecko.image_urls[0];
                    }
                });
                setGeckoCounts(counts);
                setGeckoCoverImages(coverImages);

                // Filter to public breeders
                const publicBreeders = (initialBreeders || []).filter(u => 
                    u.is_public_profile !== false && // Not explicitly set to false
                    u.profile_public !== false // Not explicitly set to false
                );
                setBreeders(publicBreeders);
                setHasMoreBreeders(initialBreeders.length === 24);

                // Get following list if logged in
                if (user) {
                    try {
                        const userFollows = await UserFollow.filter({ follower_email: user.email });
                        const followingEmails = (userFollows || []).map(f => f.following_email);
                        setFollowing(followingEmails);
                    } catch (e) {
                        console.log("Could not load follows");
                    }
                }

            } catch (error) {
                console.error("Failed to load community data:", error);
                setBreeders([]);
            }
            setIsLoading(false);
        };
        fetchData();
    }, [fetchBreederBatch]);

    const loadMoreBreeders = useCallback(async () => {
        const newOffset = breederOffset + 24;
        const batch = await fetchBreederBatch(newOffset);
        const publicBatch = (batch || []).filter(u => 
            u.is_public_profile !== false && 
            u.profile_public !== false
        );
        setBreeders(prev => [...prev, ...publicBatch]);
        setHasMoreBreeders(batch.length === 24);
        setBreederOffset(newOffset);
    }, [breederOffset, fetchBreederBatch]);

    const handleFollow = async (email) => {
        if (!currentUser) return;
        try {
            await UserFollow.create({
                follower_email: currentUser.email,
                following_email: email
            });
            setFollowing([...following, email]);
        } catch (error) {
            console.error("Failed to follow:", error);
        }
    };

    const handleUnfollow = async (email) => {
        if (!currentUser) return;
        try {
            const myFollows = await UserFollow.filter({ follower_email: currentUser.email });
            const followRecord = myFollows.find(f => f.following_email === email);
            if (followRecord) {
                await UserFollow.delete(followRecord.id);
                setFollowing(following.filter(e => e !== email));
            }
        } catch (error) {
            console.error("Failed to unfollow:", error);
        }
    };

    const filteredBreeders = breeders.filter(breeder => {
        const searchLower = searchTerm.toLowerCase();
        const nameMatch = breeder.full_name?.toLowerCase().includes(searchLower);
        const businessMatch = breeder.business_name?.toLowerCase().includes(searchLower);
        const cityMatch = breeder.city?.toLowerCase().includes(searchLower);
        const stateMatch = breeder.state_province?.toLowerCase().includes(searchLower);
        const countryMatch = breeder.country?.toLowerCase().includes(searchLower);
        const regionMatch = breeder.region?.toLowerCase().includes(searchLower);
        
        const matchesSearch = !searchTerm || nameMatch || businessMatch || cityMatch || stateMatch || countryMatch || regionMatch;
        
        const locationLower = locationFilter.toLowerCase();
        const matchesLocation = !locationFilter || 
            breeder.city?.toLowerCase().includes(locationLower) ||
            breeder.state_province?.toLowerCase().includes(locationLower) ||
            breeder.country?.toLowerCase().includes(locationLower) ||
            breeder.region?.toLowerCase().includes(locationLower);
        
        return matchesSearch && matchesLocation;
    }).sort((a, b) => {
        const aCount = geckoCounts[a.email] || { selling: 0, breeding: 0, keeping: 0 };
        const bCount = geckoCounts[b.email] || { selling: 0, breeding: 0, keeping: 0 };
        const aTotalGeckos = aCount.selling + aCount.breeding + aCount.keeping;
        const bTotalGeckos = bCount.selling + bCount.breeding + bCount.keeping;
        
        // Priority 1: Users with ANY geckos above those with none
        if (aTotalGeckos > 0 && bTotalGeckos === 0) return -1;
        if (bTotalGeckos > 0 && aTotalGeckos === 0) return 1;
        
        // Priority 2: Among users with no geckos, sort by profile completeness
        if (aTotalGeckos === 0 && bTotalGeckos === 0) {
            const aHasProfileImage = !!a.profile_image_url;
            const bHasProfileImage = !!b.profile_image_url;
            const aHasCoverImage = !!a.cover_image_url;
            const bHasCoverImage = !!b.cover_image_url;
            
            // Users with profile image above those without
            if (aHasProfileImage && !bHasProfileImage) return -1;
            if (bHasProfileImage && !aHasProfileImage) return 1;
            
            // Users with cover image above those without
            if (aHasCoverImage && !bHasCoverImage) return -1;
            if (bHasCoverImage && !aHasCoverImage) return 1;
            
            return (a.full_name || '').localeCompare(b.full_name || '');
        }
        
        // Priority 3: Among users with geckos, sort by for sale first
        if (aCount.selling > 0 && bCount.selling === 0) return -1;
        if (bCount.selling > 0 && aCount.selling === 0) return 1;
        
        // Priority 4: Those with breeding projects
        if (aCount.breeding > 0 && bCount.breeding === 0) return -1;
        if (bCount.breeding > 0 && aCount.breeding === 0) return 1;
        
        // Priority 5: By number of geckos for sale
        if (aCount.selling !== bCount.selling) return bCount.selling - aCount.selling;
        
        // Priority 6: By total geckos
        if (aTotalGeckos !== bTotalGeckos) return bTotalGeckos - aTotalGeckos;
        
        // Default: alphabetical
        return (a.full_name || '').localeCompare(b.full_name || '');
    });

    return (
        <div className="min-h-screen bg-slate-950 p-4 md:p-8">
            <div className="max-w-6xl mx-auto">
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold text-slate-100 mb-2">Community Connect</h1>
                    <p className="text-slate-400">Find breeders, connect with enthusiasts, and join the discussion.</p>
                </div>

                <Tabs defaultValue="breeders" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 mb-6 bg-slate-950 border border-slate-700 p-1.5 gap-1">
                        <TabsTrigger value="breeders" className="data-[state=active]:bg-transparent data-[state=active]:text-slate-100 data-[state=active]:shadow-none text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-sm transition-colors">
                            <Users className="w-4 h-4 mr-2" />
                            Find Breeders
                        </TabsTrigger>
                        <TabsTrigger value="forum" className="data-[state=active]:bg-transparent data-[state=active]:text-slate-100 data-[state=active]:shadow-none text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-sm transition-colors">
                            <MessageSquare className="w-4 h-4 mr-2" />
                            Forum
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="breeders">
                        {/* Following Feed Section */}
                        {currentUser && following.length > 0 && (
                            <div className="mb-8">
                                <FollowingFeed 
                                    currentUser={currentUser} 
                                    following={following} 
                                    allUsers={breeders}
                                />
                            </div>
                        )}

                        {/* Search and Filters */}
                        <div className="flex flex-col md:flex-row gap-4 mb-6">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                <Input
                                    placeholder="Search by name, business, or location..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-10 bg-slate-900 border-slate-700 text-white"
                                />
                            </div>
                            <div className="relative md:w-64">
                                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                <Input
                                    placeholder="Filter by location..."
                                    value={locationFilter}
                                    onChange={(e) => setLocationFilter(e.target.value)}
                                    className="pl-10 bg-slate-900 border-slate-700 text-white"
                                />
                            </div>
                        </div>

                        {isLoading ? (
                            <div className="flex items-center justify-center py-20">
                                <Loader2 className="w-12 h-12 text-emerald-500 animate-spin" />
                            </div>
                        ) : filteredBreeders.length > 0 ? (
                            <>
                                <div className="grid md:grid-cols-2 gap-4">
                                    {filteredBreeders.map(breeder => (
                                        <BreederCard
                                            key={breeder.id}
                                            breeder={breeder}
                                            currentUser={currentUser}
                                            isFollowing={following.includes(breeder.email)}
                                            onFollow={handleFollow}
                                            onUnfollow={handleUnfollow}
                                            geckoCounts={geckoCounts}
                                            coverImage={geckoCoverImages[breeder.email]}
                                        />
                                    ))}
                                </div>
                                {hasMoreBreeders && (
                                    <div className="flex justify-center mt-8">
                                        <Button
                                            variant="outline"
                                            className="border-slate-600 hover:bg-slate-800 text-slate-300 px-8"
                                            onClick={loadMoreBreeders}
                                        >
                                            Load More Breeders
                                        </Button>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="text-center py-20 bg-slate-900 rounded-lg">
                                <Users className="w-16 h-16 mx-auto text-slate-500 mb-4" />
                                <h3 className="text-xl font-semibold text-slate-300">No Breeders Found</h3>
                                <p className="text-slate-400 mt-2">
                                    {searchTerm || locationFilter 
                                        ? "Try adjusting your search criteria."
                                        : "No public profiles available yet."}
                                </p>
                            </div>
                        )}
                    </TabsContent>

                    <TabsContent value="forum">
                        <ForumTab />
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}