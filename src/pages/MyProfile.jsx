import React, { useState, useEffect } from 'react';
import { User, Gecko, GeckoImage, ForumPost, ForumComment, DirectMessage, Notification, MorphReferenceImage, UserBadge, UserActivity, BreedingPlan, WeightRecord } from '@/entities/all';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Camera, MapPin, Link as LinkIcon, Calendar, Users, MessageSquare, Image as ImageIcon, Heart, Edit, Save, X, Loader2, Upload, Star, ShoppingCart, GitBranch, Globe, Instagram, Facebook, Youtube } from 'lucide-react';
import { UploadFile } from '@/integrations/Core';
import { useToast } from "@/components/ui/use-toast";
import { useNavigate } from 'react-router-dom';
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { format } from 'date-fns';
import GeckoCard from '../components/my-geckos/GeckoCard';
import { createPageUrl } from '@/utils';
import { Link } from 'react-router-dom';

const USER_LEVELS = [
  { geckos: 1, title: "New Collector", badge: "🥚" }, { geckos: 2, title: "Gecko Keeper", badge: "🦎" },
  { geckos: 5, title: "Hobbyist", badge: "🌿" }, { geckos: 10, title: "Enthusiast", badge: "⭐" },
  { geckos: 15, title: "Dedicated Keeper", badge: "🌱" }, { geckos: 20, title: "Breeder", badge: "❤️‍🔥" },
  { geckos: 30, title: "Pro Breeder", badge: "🏆" }, { geckos: 40, title: "Expert Breeder", badge: "🧬" },
  { geckos: 50, title: "Master Breeder", badge: "👑" }, { geckos: 75, title: "Grandmaster", badge: "🌌" },
  { geckos: 100, title: "Living Legend", badge: "💫" }, { geckos: 150, title: "Gecko Tycoon", badge: "💼" },
  { geckos: 200, title: "Scale Sovereign", badge: "🏰" }, { geckos: 300, title: "Reptile Royalty", badge: "⚜️" },
  { geckos: 500, title: "Crested King", badge: "🦁" },
];
const EXPERT_LEVELS = [
  { level: 1, title: "Apprentice Trainer", points: 10, badge: "🌱" }, { level: 2, title: "Skilled Recognizer", points: 50, badge: "🧠" },
  { level: 3, title: "Master Annotator", points: 100, badge: "✍️" }, { level: 4, title: "AI Virtuoso", points: 250, badge: "🤖" },
  { level: 5, title: "Gecko AI Grandmaster", points: 500, badge: "🌟" }
];
const COMMUNITY_LEVELS = [
  { level: 1, title: "New Contributor", points: 1, badge: "📝" }, { level: 2, title: "Active Talker", points: 5, badge: "🗣️" },
  { level: 3, title: "Forum Regular", points: 10, badge: "💬" }, { level: 4, title: "Community Pillar", points: 25, badge: "🏛️" },
  { level: 5, title: "Gecko Guru", points: 50, badge: "🎓" },
];

const getLevelInfo = (count, levels, key = 'geckos') => {
    // Levels should be sorted ascending by `key` for this logic to work correctly
    // The provided level arrays are already sorted this way.
    const currentLevel = [...levels].reverse().find(level => count >= level[key]) || levels[0];
    const nextLevel = levels.find(level => count < level[key]);
    return { currentLevel, nextLevel };
};

const AchievementProgress = ({ title, icon, currentCount, levels, levelKey }) => {
    const { currentLevel, nextLevel } = getLevelInfo(currentCount, levels, levelKey);

    let progressValue;
    let displayProgressNumerator = currentCount;
    let displayProgressDenominator;

    if (nextLevel) {
        // Determine the starting point for progress calculation for the current segment
        // If currentCount is less than the first level's requirement, start from 0
        const startOfCurrentSegment = currentLevel === levels[0] && currentCount < levels[0][levelKey] ? 0 : currentLevel[levelKey];
        const endOfCurrentSegment = nextLevel[levelKey];
        
        displayProgressDenominator = nextLevel[levelKey];

        if (endOfCurrentSegment - startOfCurrentSegment > 0) {
            progressValue = ((currentCount - startOfCurrentSegment) / (endOfCurrentSegment - startOfCurrentSegment)) * 100;
        } else {
            progressValue = 0; // Avoid division by zero if start and end are the same (e.g., if levels[0][key] is 0)
        }
        progressValue = Math.max(0, Math.min(100, progressValue)); // Clamp between 0 and 100
    } else {
        // Max level achieved
        progressValue = 100;
        displayProgressDenominator = currentCount; // For display, just show currentCount
    }

    return (
        <div className="bg-slate-800/50 p-4 rounded-lg">
            <div className="flex items-center gap-3 mb-3">
                {icon}
                <h4 className="font-semibold text-slate-200">{title}</h4>
            </div>
            <div className="flex items-center gap-4">
                <span className="text-2xl">{currentLevel.badge}</span>
                <div className="flex-1">
                    <p className="text-sm font-medium text-slate-300">{currentLevel.title}</p>
                    <Progress value={progressValue} className="mt-1 h-2" />
                    <div className="flex justify-between items-center text-xs text-slate-400 mt-1">
                        <span>{nextLevel ? `${displayProgressNumerator} / ${displayProgressDenominator}` : `${displayProgressNumerator} ${levelKey === 'points' ? 'Points' : 'Geckos'}`}</span>
                        {nextLevel ? <span>Next: {nextLevel.title}</span> : <span className="font-bold text-emerald-400">Max Level!</span>}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default function MyProfile() {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [activeTab, setActiveTab] = useState('overview');
    const { toast } = useToast();
    
    // User stats with fallbacks
    const [userStats, setUserStats] = useState({
        geckos: 0,
        images: 0, // This is morph submissions (used for AI training points)
        forumPosts: 0,
        comments: 0,
        messages: 0,
        notifications: 0,
        morphSubmissions: 0
    });
    
    const [editData, setEditData] = useState({});
    const [userBadges, setUserBadges] = useState([]);
    
    // Gecko collections for overview display
    const [userGeckos, setUserGeckos] = useState([]);
    const [forSaleGeckos, setForSaleGeckos] = useState([]);
    const [breedingGeckos, setBreedingGeckos] = useState([]);
    const [collectionGeckos, setCollectionGeckos] = useState([]);
    const [breedingPlans, setBreedingPlans] = useState([]);
    const [weightRecords, setWeightRecords] = useState([]);

    const syncEditData = (currentUser) => {
        if (!currentUser) return;
        setEditData({
            bio: currentUser.bio || '',
            location: currentUser.location || '',
            website_url: currentUser.website_url || '',
            instagram_handle: currentUser.instagram_handle || '',
            breeder_name: currentUser.breeder_name || '',
            years_experience: currentUser.years_experience || 0,
            // Add settings data
            email_notifications_enabled: currentUser.email_notifications_enabled ?? true,
            email_notification_types: currentUser.email_notification_types || [],
            calendar_alerts_enabled: currentUser.calendar_alerts_enabled ?? true,
            profile_public: currentUser.profile_public ?? true,
            show_username_on_images: currentUser.show_username_on_images ?? true,
            allow_profile_clicks: currentUser.allow_profile_clicks ?? true,
            public_title_preference: currentUser.public_title_preference || 'collection',
            sidebar_badge_preference: currentUser.sidebar_badge_preference || 'collection'
        });
    };

    useEffect(() => {
        const loadUserData = async () => {
            setIsLoading(true);
            try {
                const currentUser = await User.me();
                setUser(currentUser);
                syncEditData(currentUser);

                // Load user badges, geckos, and weight records
                const [badges, geckos, plans, weights] = await Promise.all([
                    UserBadge.filter({ user_email: currentUser.email }),
                    Gecko.filter({ created_by: currentUser.email }),
                    BreedingPlan.filter({ created_by: currentUser.email }).catch(() => []),
                    WeightRecord.filter({ created_by: currentUser.email }).catch(() => [])
                ]);
                
                setUserBadges(badges);
                setUserGeckos(geckos);
                setBreedingPlans(plans);
                setWeightRecords(weights);
                
                // Categorize geckos - geckos can appear in multiple categories
                setForSaleGeckos(geckos.filter(g => g.status === 'For Sale'));
                setBreedingGeckos(geckos.filter(g => ['Ready to Breed', 'Proven', 'Future Breeder'].includes(g.status)));
                // Collection shows ALL geckos except sold ones
                setCollectionGeckos(geckos.filter(g => g.status !== 'Sold'));

                // Load stats with heavy rate limit protection
                const loadStatsWithFallback = async () => {
                    const stats = { geckos: 0, images: 0, forumPosts: 0, comments: 0, messages: 0, notifications: 0, morphSubmissions: 0 };
                    
                    try {
                        // Use Promise.allSettled to prevent one failure from breaking everything
                        const results = await Promise.allSettled([
                            Gecko.filter({ created_by: currentUser.email }),
                            GeckoImage.filter({ created_by: currentUser.email }),
                            ForumPost.filter({ created_by: currentUser.email }),
                            ForumComment.filter({ created_by: currentUser.email }),
                            DirectMessage.filter({ sender_email: currentUser.email }),
                            Notification.filter({ user_email: currentUser.email }),
                            MorphReferenceImage.filter({ submitted_by_email: currentUser.email })
                        ]);

                        // Safely extract results
                        if (results[0].status === 'fulfilled') stats.geckos = results[0].value.length;
                        if (results[1].status === 'fulfilled') stats.images = results[1].value.length; // Morph submissions via images
                        if (results[2].status === 'fulfilled') stats.forumPosts = results[2].value.length;
                        if (results[3].status === 'fulfilled') stats.comments = results[3].value.length;
                        if (results[4].status === 'fulfilled') stats.messages = results[4].value.length;
                        if (results[5].status === 'fulfilled') stats.notifications = results[5].value.length;
                        if (results[6].status === 'fulfilled') stats.morphSubmissions = results[6].value.length;

                        setUserStats(stats);
                    } catch (error) {
                        console.error("Failed to load user stats:", error);
                        // Use fallback stats if everything fails
                        setUserStats(stats);
                    }
                };

                // Delay stats loading to spread out API calls
                setTimeout(loadStatsWithFallback, 1000);

            } catch (error) {
                console.error("Failed to load user data:", error);
                setUser(null);
            }
            setIsLoading(false);
        };
        loadUserData();
    }, []);

    const handleSave = async () => {
        if (!user) return;
        setIsSaving(true);
        try {
            await User.updateMyUserData(editData);
            const updatedUser = { ...user, ...editData };
            setUser(updatedUser);
            
            // Update the global cache if it exists
            if (window.dataCache) {
                window.dataCache.set('current_user', updatedUser);
            }

            toast({ title: "Success", description: "Profile updated successfully." });
            
            // Exit editing mode only on overview tab after successful save
            if (activeTab === 'overview') {
                setIsEditing(false);
            }
        } catch (error) {
            console.error("Failed to update profile:", error);
            toast({ title: "Error", description: "Failed to update profile.", variant: "destructive" });
        }
        setIsSaving(false);
    };

    const handleCancelEdit = () => {
        syncEditData(user); // Reset edit data to match current user state
        setIsEditing(false);
    };

    const handleImageUpload = async (file, type) => {
        if (!file) return;

        setIsUploading(true);
        try {
            const { file_url } = await UploadFile({ file });
            const updateData = type === 'profile' ? { profile_image_url: file_url } : { cover_image_url: file_url };
            await User.updateMyUserData(updateData);
            setUser(prevUser => ({ ...prevUser, ...updateData }));
            toast({
                title: "Success!",
                description: `${type === 'profile' ? 'Profile' : 'Cover'} image updated successfully.`,
            });
        } catch (error) {
            console.error("Failed to upload image:", error);
            toast({
                title: "Upload Failed",
                description: "There was an error uploading your image. Please try again.",
                variant: "destructive",
            });
        } finally {
            setIsUploading(false);
        }
    };

    const handleSettingChange = (key, value) => {
        setEditData({...editData, [key]: value});
    };

    const handleNotificationTypeToggle = (type) => {
        const currentTypes = editData.email_notification_types || [];
        const newTypes = currentTypes.includes(type) 
            ? currentTypes.filter(t => t !== type)
            : [...currentTypes, type];
        setEditData({...editData, email_notification_types: newTypes});
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
            </div>
        );
    }

    if (!user) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-slate-100 mb-4">Access Denied</h2>
                    <p className="text-slate-400">You need to be logged in to view this page.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-slate-950 min-h-screen">
            {/* Cover Image */}
            <div className="relative h-48 md:h-64 bg-slate-800">
                {isUploading && (
                    <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-20">
                        <Loader2 className="w-8 h-8 animate-spin text-white" />
                    </div>
                )}
                {user.cover_image_url && (
                    <img src={user.cover_image_url} alt="Cover" className="w-full h-full object-cover" />
                )}
                <div className="absolute inset-0 bg-black bg-opacity-40"></div>
                <div className="absolute bottom-4 right-4">
                    <Button asChild size="sm" className="bg-black/50 hover:bg-black/70 cursor-pointer">
                         <label>
                            <Camera className="w-4 h-4 mr-2" />
                            Update Cover
                            <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => handleImageUpload(e.target.files[0], 'cover')}
                                className="sr-only"
                                disabled={isUploading}
                            />
                        </label>
                    </Button>
                </div>
            </div>

            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Profile Header */}
                <div className="-mt-12 sm:-mt-16 sm:flex sm:items-end sm:space-x-5 relative z-10">
                    {/* Profile Image */}
                    <div className="relative group">
                        <img
                            className="h-24 w-24 rounded-full ring-4 ring-slate-950 sm:h-32 sm:w-32 object-cover"
                            src={user.profile_image_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.full_name)}&background=84A98C&color=fff`}
                            alt={user.full_name}
                        />
                        <label className="absolute inset-0 flex items-center justify-center cursor-pointer rounded-full overflow-hidden">
                            <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <Camera className="w-6 h-6 text-white" />
                            </div>
                            <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => handleImageUpload(e.target.files[0], 'profile')}
                                className="sr-only"
                                disabled={isUploading}
                            />
                        </label>
                    </div>
                    
                    <div className="mt-6 sm:flex-1 sm:min-w-0 sm:flex sm:items-center sm:justify-end sm:space-x-6 sm:pb-1">
                        <div className="sm:hidden md:block mt-6 min-w-0 flex-1">
                            <h1 className="text-2xl font-bold text-slate-100 truncate">{user.full_name}</h1>
                            {user.location && (
                                <p className="text-sm text-slate-400 flex items-center gap-2 mt-1">
                                    <MapPin className="w-4 h-4" />
                                    {user.location}
                                </p>
                            )}
                            {user.bio && !isEditing && (
                                <p className="text-sm text-slate-300 mt-2">{user.bio}</p>
                            )}
                        </div>
                        <div className="mt-6 flex flex-col justify-stretch space-y-3 sm:flex-row sm:space-y-0 sm:space-x-4">
                            {!isEditing ? (
                                <Button onClick={() => setIsEditing(true)} variant="outline" className="border-slate-600 hover:bg-slate-800">
                                    <Edit className="w-4 h-4 mr-2" />
                                    Edit Profile
                                </Button>
                            ) : (
                                <div className="flex gap-2">
                                    {/* These save/cancel buttons are for the main header if editing covers multiple sections */}
                                    {/* The overview tab now has its own save button for profile info */}
                                    {activeTab !== 'overview' && ( 
                                        <Button onClick={handleSave} disabled={isSaving} className="bg-emerald-600 hover:bg-emerald-700">
                                            {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                                            Save
                                        </Button>
                                    )}
                                    <Button onClick={handleCancelEdit} variant="outline" disabled={isSaving}>
                                        <X className="w-4 h-4 mr-2" />
                                        Cancel
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Mobile Header */}
                <div className="block sm:hidden mt-6 min-w-0 flex-1">
                    <h1 className="text-2xl font-bold text-slate-100 truncate">{user.full_name}</h1>
                    {(user.location || editData.location) && !isEditing && (
                        <p className="text-sm text-slate-400 flex items-center gap-2 mt-1">
                            <MapPin className="w-4 h-4" />
                            {user.location || editData.location}
                        </p>
                    )}
                    {user.bio && !isEditing && (
                        <p className="text-sm text-slate-300 mt-2">{user.bio}</p>
                    )}
                </div>

                {/* Tabs */}
                <div className="mt-8">
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                        <TabsList className="grid w-full grid-cols-2 bg-slate-800">
                            <TabsTrigger value="overview" className="data-[state=active]:bg-slate-700">Overview</TabsTrigger>
                            <TabsTrigger value="settings" className="data-[state=active]:bg-slate-700">Settings</TabsTrigger>
                        </TabsList>

                        <TabsContent value="overview" className="space-y-6">
                            {isEditing ? (
                                <Card className="bg-slate-900 border-slate-700">
                                    <CardHeader>
                                        <CardTitle className="text-slate-100">Edit Profile Information</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div>
                                            <Label htmlFor="bio" className="block text-sm font-medium text-slate-300 mb-2">Bio</Label>
                                            <Textarea
                                                id="bio"
                                                value={editData.bio}
                                                onChange={(e) => setEditData({...editData, bio: e.target.value})}
                                                placeholder="Tell us about yourself..."
                                                className="bg-slate-800 border-slate-600 text-slate-100"
                                            />
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <Label htmlFor="location" className="block text-sm font-medium text-slate-300 mb-2">Location</Label>
                                                <Input
                                                    id="location"
                                                    value={editData.location}
                                                    onChange={(e) => setEditData({...editData, location: e.target.value})}
                                                    placeholder="City, Country"
                                                    className="bg-slate-800 border-slate-600 text-slate-100"
                                                />
                                            </div>
                                            <div>
                                                <Label htmlFor="website_url" className="block text-sm font-medium text-slate-300 mb-2">Website</Label>
                                                <Input
                                                    id="website_url"
                                                    value={editData.website_url}
                                                    onChange={(e) => setEditData({...editData, website_url: e.target.value})}
                                                    placeholder="https://yourwebsite.com"
                                                    className="bg-slate-800 border-slate-600 text-slate-100"
                                                />
                                            </div>
                                            <div>
                                                <Label htmlFor="instagram_handle" className="block text-sm font-medium text-slate-300 mb-2">Instagram</Label>
                                                <Input
                                                    id="instagram_handle"
                                                    value={editData.instagram_handle}
                                                    onChange={(e) => setEditData({...editData, instagram_handle: e.target.value})}
                                                    placeholder="@yourusername"
                                                    className="bg-slate-800 border-slate-600 text-slate-100"
                                                />
                                            </div>
                                            <div>
                                                <Label htmlFor="breeder_name" className="block text-sm font-medium text-slate-300 mb-2">Breeder Name</Label>
                                                <Input
                                                    id="breeder_name"
                                                    value={editData.breeder_name}
                                                    onChange={(e) => setEditData({...editData, breeder_name: e.target.value})}
                                                    placeholder="Your breeding business name"
                                                    className="bg-slate-800 border-slate-600 text-slate-100"
                                                />
                                            </div>
                                        </div>
                                        <div className="flex justify-end pt-4">
                                            <Button onClick={handleSave} disabled={isSaving} className="bg-emerald-600 hover:bg-emerald-700">
                                                {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                                                Save Changes
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            ) : (
                            <>
                            {/* Achievement Progress */}
                            <Card className="bg-slate-900 border-slate-700">
                                <CardHeader>
                                    <CardTitle className="text-xl text-slate-100">Achievement Progress</CardTitle>
                                </CardHeader>
                                <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    <AchievementProgress 
                                        title="Collection Level"
                                        icon={<Users className="w-5 h-5 text-emerald-400" />}
                                        currentCount={userStats.geckos}
                                        levels={USER_LEVELS}
                                        levelKey="geckos"
                                    />
                                    <AchievementProgress 
                                        title="Community Level"
                                        icon={<MessageSquare className="w-5 h-5 text-purple-400" />}
                                        currentCount={userStats.forumPosts + userStats.comments} // Sum posts and comments for community points
                                        levels={COMMUNITY_LEVELS}
                                        levelKey="points"
                                    />
                                </CardContent>
                            </Card>

                            {/* Earned Badges */}
                            {userBadges.length > 0 && (
                                <Card className="bg-slate-900 border-slate-700">
                                    <CardHeader>
                                        <CardTitle className="text-xl text-slate-100">Earned Badges</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="flex flex-wrap gap-4">
                                            {userBadges.map((badge) => (
                                                <div key={badge.id} className="text-center p-3 bg-slate-800 rounded-lg w-32 flex flex-col items-center justify-between">
                                                    <span className="text-4xl">{badge.badge_icon}</span>
                                                    <div className="mt-2">
                                                        <p className="text-sm font-semibold text-slate-200">{badge.badge_name}</p>
                                                        <p className="text-xs text-slate-400 leading-tight">{badge.badge_description}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            {/* About Section */}
                            <Card className="bg-slate-900 border-slate-700">
                                <CardHeader><CardTitle className="text-slate-200">About</CardTitle></CardHeader>
                                <CardContent className="space-y-4">
                                    <p className="text-slate-300">{user.bio || 'No bio provided.'}</p>
                                    {(user.city || user.state_province || user.country) && (
                                        <p className="text-sm text-slate-400 flex items-center gap-1">
                                            <MapPin className="w-4 h-4" />
                                            {[user.city, user.state_province, user.country].filter(Boolean).join(', ')}
                                        </p>
                                    )}
                                    {(user.website_url || user.instagram_handle || user.facebook_url || user.youtube_url || user.tiktok_handle) && (
                                        <div className="flex flex-wrap gap-2 pt-2">
                                            {user.website_url && (
                                                <a href={user.website_url} target="_blank" rel="noopener noreferrer">
                                                    <Button size="sm" variant="outline" className="border-slate-600 hover:bg-slate-700">
                                                        <Globe className="w-4 h-4" />
                                                    </Button>
                                                </a>
                                            )}
                                            {user.instagram_handle && (
                                                <a href={`https://instagram.com/${user.instagram_handle}`} target="_blank" rel="noopener noreferrer">
                                                    <Button size="sm" variant="outline" className="border-pink-500/50 hover:bg-pink-500/20 text-pink-400">
                                                        <Instagram className="w-4 h-4" />
                                                    </Button>
                                                </a>
                                            )}
                                            {user.facebook_url && (
                                                <a href={user.facebook_url} target="_blank" rel="noopener noreferrer">
                                                    <Button size="sm" variant="outline" className="border-blue-500/50 hover:bg-blue-500/20 text-blue-400">
                                                        <Facebook className="w-4 h-4" />
                                                    </Button>
                                                </a>
                                            )}
                                            {user.youtube_url && (
                                                <a href={user.youtube_url} target="_blank" rel="noopener noreferrer">
                                                    <Button size="sm" variant="outline" className="border-red-500/50 hover:bg-red-500/20 text-red-400">
                                                        <Youtube className="w-4 h-4" />
                                                    </Button>
                                                </a>
                                            )}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            {/* Gecko Collections Tabs */}
                            <Tabs defaultValue="collection" className="w-full">
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
                                                <GeckoCard key={gecko.id} gecko={gecko} weightRecords={weightRecords} isOwner={true} onView={(g) => navigate(createPageUrl(`GeckoDetail?id=${g.id}`))} onEdit={() => navigate(createPageUrl('MyGeckos'))} />
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
                                            {breedingGeckos.filter(g => g.sex === 'Male').length > 0 && (
                                                <div>
                                                    <h3 className="text-lg font-semibold text-blue-400 mb-4 flex items-center gap-2">
                                                        <span className="text-2xl">♂</span> Males ({breedingGeckos.filter(g => g.sex === 'Male').length})
                                                    </h3>
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                                        {breedingGeckos.filter(g => g.sex === 'Male').map(gecko => (
                                                            <GeckoCard key={gecko.id} gecko={gecko} weightRecords={weightRecords} isOwner={true} onView={(g) => navigate(createPageUrl(`GeckoDetail?id=${g.id}`))} onEdit={() => navigate(createPageUrl('MyGeckos'))} />
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                            
                                            {breedingGeckos.filter(g => g.sex === 'Female').length > 0 && (
                                                <div>
                                                    <h3 className="text-lg font-semibold text-pink-400 mb-4 flex items-center gap-2">
                                                        <span className="text-2xl">♀</span> Females ({breedingGeckos.filter(g => g.sex === 'Female').length})
                                                    </h3>
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                                        {breedingGeckos.filter(g => g.sex === 'Female').map(gecko => (
                                                            <GeckoCard key={gecko.id} gecko={gecko} isOwner={true} onView={(g) => navigate(createPageUrl(`GeckoDetail?id=${g.id}`))} onEdit={() => navigate(createPageUrl('MyGeckos'))} />
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="text-center py-12 bg-slate-800 rounded-lg">
                                            <GitBranch className="w-12 h-12 mx-auto text-slate-500 mb-4"/>
                                            <p className="text-slate-400">No breeders listed.</p>
                                        </div>
                                    )}
                                </TabsContent>

                                <TabsContent value="collection">
                                    {collectionGeckos.length > 0 ? (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                            {collectionGeckos.map(gecko => (
                                                <GeckoCard key={gecko.id} gecko={gecko} isOwner={true} onView={(g) => navigate(createPageUrl(`GeckoDetail?id=${g.id}`))} onEdit={() => navigate(createPageUrl('MyGeckos'))} />
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center py-12 bg-slate-800 rounded-lg">
                                            <Users className="w-12 h-12 mx-auto text-slate-500 mb-4"/>
                                            <p className="text-slate-400">No geckos in collection.</p>
                                        </div>
                                    )}
                                </TabsContent>
                            </Tabs>
                            </>
                            )}
                        </TabsContent>

                        <TabsContent value="settings" className="space-y-6">
                            {/* Privacy Settings */}
                            <Card className="bg-slate-900 border-slate-700">
                                <CardHeader>
                                    <CardTitle className="text-slate-100">Privacy Settings</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <Label htmlFor="profile-public" className="text-slate-200 font-medium">Public Profile</Label>
                                            <p className="text-sm text-slate-400">Make your profile visible to other users</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-slate-400">
                                                {editData.profile_public ? 'Public' : 'Private'}
                                            </span>
                                            <Switch
                                                id="profile-public"
                                                checked={editData.profile_public}
                                                onCheckedChange={(checked) => handleSettingChange('profile_public', checked)}
                                            />
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <Label htmlFor="show-username" className="text-slate-200 font-medium">Show Username on Images</Label>
                                            <p className="text-sm text-slate-400">Display your name on photos you upload</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-slate-400">
                                                {editData.show_username_on_images ? 'Show' : 'Hide'}
                                            </span>
                                            <Switch
                                                id="show-username"
                                                checked={editData.show_username_on_images}
                                                onCheckedChange={(checked) => handleSettingChange('show_username_on_images', checked)}
                                            />
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between">
                                        <div>
                                            <Label htmlFor="allow-clicks" className="text-slate-200 font-medium">Allow Profile Clicks</Label>
                                            <p className="text-sm text-slate-400">Let others click to view your profile</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-slate-400">
                                                {editData.allow_profile_clicks ? 'Allow' : 'Block'}
                                            </span>
                                            <Switch
                                                id="allow-clicks"
                                                checked={editData.allow_profile_clicks}
                                                onCheckedChange={(checked) => handleSettingChange('allow_profile_clicks', checked)}
                                            />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Notification Settings */}
                            <Card className="bg-slate-900 border-slate-700">
                                <CardHeader>
                                    <CardTitle className="text-slate-100">Notification Settings</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <Label htmlFor="email-notifications" className="text-slate-200 font-medium">Email Notifications</Label>
                                            <p className="text-sm text-slate-400">Receive notifications via email</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-slate-400">
                                                {editData.email_notifications_enabled ? 'Enabled' : 'Disabled'}
                                            </span>
                                            <Switch
                                                id="email-notifications"
                                                checked={editData.email_notifications_enabled}
                                                onCheckedChange={(checked) => handleSettingChange('email_notifications_enabled', checked)}
                                            />
                                        </div>
                                    </div>

                                    {editData.email_notifications_enabled && (
                                        <div className="ml-4 space-y-3 border-l-2 border-slate-700 pl-4">
                                            {[
                                                { key: 'level_up', label: 'Level Up Notifications', desc: 'When you reach new levels' },
                                                { key: 'expert_status', label: 'Expert Status Changes', desc: 'When your expert status changes' },
                                                { key: 'new_message', label: 'New Messages', desc: 'When someone sends you a message' },
                                                { key: 'gecko_of_day', label: 'Gecko of the Day', desc: 'When your gecko is featured' },
                                                { key: 'forum_replies', label: 'Forum Replies', desc: 'Replies to your posts' },
                                                { key: 'breeding_updates', label: 'Breeding Updates', desc: 'Breeding calendar events' },
                                                { key: 'announcements', label: 'Platform Announcements', desc: 'Important platform updates' }
                                            ].map((notif) => (
                                                <div key={notif.key} className="flex items-center justify-between">
                                                    <div>
                                                        <Label className="text-slate-300 text-sm">{notif.label}</Label>
                                                        <p className="text-xs text-slate-500">{notif.desc}</p>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs text-slate-400">
                                                            {editData.email_notification_types?.includes(notif.key) ? 'On' : 'Off'}
                                                        </span>
                                                        <Switch
                                                            checked={editData.email_notification_types?.includes(notif.key) || false}
                                                            onCheckedChange={() => handleNotificationTypeToggle(notif.key)}
                                                        />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <div className="flex items-center justify-between">
                                        <div>
                                            <Label htmlFor="calendar-alerts" className="text-slate-200 font-medium">Calendar Alerts</Label>
                                            <p className="text-sm text-slate-400">Breeding event reminders</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-slate-400">
                                                {editData.calendar_alerts_enabled ? 'Enabled' : 'Disabled'}
                                            </span>
                                            <Switch
                                                id="calendar-alerts"
                                                checked={editData.calendar_alerts_enabled}
                                                onCheckedChange={(checked) => handleSettingChange('calendar_alerts_enabled', checked)}
                                            />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Save Settings */}
                            <div className="flex justify-end">
                                <Button onClick={handleSave} disabled={isSaving} className="bg-emerald-600 hover:bg-emerald-700">
                                    {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                                    Save All Settings
                                </Button>
                            </div>
                        </TabsContent>
                    </Tabs>
                </div>
            </div>
        </div>
    );
}