import React, { useState, useEffect } from "react";
import { User, Gecko, GeckoImage, ForumPost, GeckoOfTheDay as GotdEntity } from "@/entities/all"; // Renamed GeckoOfTheDay to avoid conflict
import { base44 } from '@/api/base44Client';
import { BarChart3, Users, GitBranch, Image as ImageIcon, MessageSquare, Star, Sparkles, Eye, Newspaper, Egg, GraduationCap } from 'lucide-react';
import StatsCard from "../components/dashboard/StatsCard";
import RecentActivity from "../components/dashboard/RecentActivity";
import TrainingProgress from "../components/dashboard/TrainingProgress";
import { default as GeckoOfTheDayComponent } from '../components/dashboard/GeckoOfTheDay';
import ImageDetailModal from '../components/gallery/ImageDetailModal';
import ChangeLogModal from '../components/changelog/ChangeLogModal';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from 'date-fns';


export default function Dashboard() {
    const [stats, setStats] = useState({ users: 0, geckos: 0, images: 0, posts: 0, verifiedImages: 0 });
    const [isLoading, setIsLoading] = useState(true);
    const [user, setUser] = useState(null);
    const [users, setUsers] = useState([]);
    const [geckoOfTheDay, setGeckoOfTheDay] = useState(null);
    const [fallbackGecko, setFallbackGecko] = useState(null);
    const [recentImages, setRecentImages] = useState([]);
    const [allImages, setAllImages] = useState([]);
    const [selectedImageData, setSelectedImageData] = useState(null);
    const [showChangelog, setShowChangelog] = useState(false);
    const [changelogGlowing, setChangelogGlowing] = useState(false);
    const [trainingPageEnabled, setTrainingPageEnabled] = useState(false);
    const [hatcheryStats, setHatcheryStats] = useState({ hatched: 0, incubating: 0, total: 0, plans: 0 });
    const [userGeckoCount, setUserGeckoCount] = useState(null);

    // Check if there's an unread published changelog
    useEffect(() => {
        const checkUnread = async () => {
            try {
                const latest = await base44.entities.ChangeLog.filter({ is_published: true }, '-published_date', 1);
                if (latest && latest.length > 0) {
                    const lastRead = localStorage.getItem('changelog_last_read');
                    if (!lastRead || new Date(latest[0].published_date) > new Date(lastRead)) {
                        setChangelogGlowing(true);
                    }
                }
            } catch (e) {}
        };
        checkUnread();
        const handler = () => setChangelogGlowing(false);
        window.addEventListener('changelog_read', handler);
        return () => window.removeEventListener('changelog_read', handler);
    }, []);

    useEffect(() => {
        base44.entities.PageConfig.filter({ page_name: 'Training' })
            .then(async configs => {
                const enabled = configs.some(c => c.is_enabled);
                setTrainingPageEnabled(enabled);
                if (!enabled) {
                    const [eggs, plans] = await Promise.all([
                        base44.entities.Egg.list().catch(() => []),
                        base44.entities.BreedingPlan.list().catch(() => [])
                    ]);
                    setHatcheryStats({
                        hatched: eggs.filter(e => e.status === 'Hatched').length,
                        incubating: eggs.filter(e => e.status === 'Incubating' && !e.archived).length,
                        total: eggs.length,
                        plans: plans.filter(p => !p.archived).length
                    });
                }
            })
            .catch(() => setTrainingPageEnabled(false));
    }, []);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const today = format(new Date(), 'yyyy-MM-dd');
                const [currentUser, usersData, geckos, posts, gotd, allGeckoImages, recentImagesData] = await Promise.all([
                    User.me().catch(() => null),
                    User.list('-created_date', 100),
                    // Limited to 500 — only used for community count stat on dashboard
                    Gecko.list('-created_date', 500),
                    ForumPost.list('-created_date', 10).catch(() => []),
                    GotdEntity.filter({ date: today }, '-created_date', 1).catch(() => []),
                    GeckoImage.list('-created_date', 20),
                    GeckoImage.list('-created_date', 5)
                ]);

                setUser(currentUser);
                setUsers(usersData); // Set the fetched users data
                setAllImages(allGeckoImages);
                setRecentImages(recentImagesData);

                // How many geckos does the current user actually own?
                if (currentUser?.email) {
                    Gecko.filter({ created_by: currentUser.email })
                        .then(r => setUserGeckoCount(Array.isArray(r) ? r.filter(g => !g.archived).length : 0))
                        .catch(() => setUserGeckoCount(0));
                } else {
                    setUserGeckoCount(0);
                }
                
                setStats({
                    users: usersData.length,
                    geckos: geckos.filter(g => !g.archived && g.status !== 'Sold').length,
                    images: allGeckoImages.length,
                    verifiedImages: allGeckoImages.filter(img => img.verified).length,
                    posts: posts.length,
                });

                // Handle Gecko of the Day
                if (gotd && gotd.length > 0) {
                    const featuredGeckoImage = await GeckoImage.get(gotd[0].gecko_image_id);
                    const uploaderResult = await User.filter({ email: gotd[0].uploader_email });
                    const uploader = uploaderResult.length > 0 ? uploaderResult[0] : null; // Robust check for uploader
                    setGeckoOfTheDay({ ...gotd[0], image: featuredGeckoImage, uploader });
                    setFallbackGecko(null); // Clear fallback if official GOTD exists
                } else {
                    // No official gecko of the day, create a fallback
                    if (allGeckoImages.length > 0) {
                        const randomImage = allGeckoImages[Math.floor(Math.random() * allGeckoImages.length)];
                        // Assuming `created_by` on GeckoImage is the user's email for this filter to work as intended.
                        // If it's a user ID, User.get(randomImage.created_by) would be more appropriate.
                        const uploaderResult = await User.filter({ email: randomImage.created_by }); 
                        const uploader = uploaderResult.length > 0 ? uploaderResult[0] : null; // Robust check for uploader
                        setFallbackGecko({
                            image: randomImage,
                            uploader,
                            appreciative_message: `A stunning ${randomImage.primary_morph ? randomImage.primary_morph.replace(/_/g, ' ') : 'gecko'} from our community!`
                        });
                    } else {
                        setFallbackGecko(null);
                    }
                    setGeckoOfTheDay(null); // Ensure official GOTD is null
                }

            } catch (error) {
                console.error("Failed to load dashboard data:", error);
            }
            setIsLoading(false);
        };
        fetchData();
    }, []);

    const handleImageSelect = (image, uploader) => {
        setSelectedImageData({ image, uploader });
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-emerald-950/30 to-slate-900 relative overflow-hidden">
            {/* Ambient background effects */}
            <div className="absolute inset-0 gecko-scale-pattern opacity-5"></div>
            <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-radial from-emerald-500/10 to-transparent rounded-full blur-3xl"></div>
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-radial from-green-500/10 to-transparent rounded-full blur-3xl"></div>
            
            <div className="relative z-10 p-6 md:p-8">
                <div className="max-w-7xl mx-auto space-y-8">
                    {/* Enhanced header */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                        <div className="space-y-2">
                            <h1 className="text-4xl md:text-5xl font-bold text-gecko-text text-glow tracking-tight">
                                Dashboard
                            </h1>
                            <p className="text-gecko-text-muted text-lg max-w-2xl leading-relaxed">
                                Welcome back to your gecko universe. Here's what's happening in the community.
                            </p>
                        </div>
                        <div className="flex gap-3 flex-wrap">
                            <Button
                                variant="outline"
                                onClick={() => setShowChangelog(true)}
                                className={`border-gecko-border text-gecko-text hover:bg-gecko-hover backdrop-blur-sm transition-all duration-300 hover:scale-105 relative ${changelogGlowing ? 'ring-2 ring-emerald-400 shadow-[0_0_16px_4px_rgba(52,211,153,0.5)] animate-pulse' : ''}`}
                            >
                                <Newspaper className="w-4 h-4 mr-2" />
                                What's New
                                {changelogGlowing && (
                                    <span className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-emerald-400 rounded-full border-2 border-slate-950" />
                                )}
                            </Button>
                            {user && (
                                <>
                                    <Link to={createPageUrl('MyGeckos')}>
                                        <Button variant="outline" className="border-gecko-border text-gecko-text hover:bg-gecko-hover backdrop-blur-sm transition-all duration-300 hover:scale-105">
                                            <Users className="w-4 h-4 mr-2" />
                                            My Collection
                                        </Button>
                                    </Link>
                                    {trainingPageEnabled && (
                                        <Link to={createPageUrl('Training')}>
                                            <Button className="bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white font-semibold shadow-lg gecko-glow transition-all duration-300 hover:scale-105">
                                                <Sparkles className="w-4 h-4 mr-2" />
                                                Train AI Model
                                            </Button>
                                        </Link>
                                    )}
                                </>
                            )}
                        </div>
                    </div>

                    {/* Empty-state onboarding hero — shown only when the
                        authenticated user has zero geckos in their collection.
                        Experienced users never see this. */}
                    {!isLoading && user && userGeckoCount === 0 && (
                        <div className="relative overflow-hidden rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-900/40 via-slate-900/60 to-slate-900/40 backdrop-blur-sm p-6 md:p-10">
                            <div className="absolute -top-10 -right-10 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
                            <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                                <div className="max-w-2xl space-y-3">
                                    <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/20 border border-emerald-500/30 px-3 py-1 text-xs font-semibold text-emerald-300">
                                        <Sparkles className="w-3.5 h-3.5" />
                                        Welcome to Geck Inspect
                                    </div>
                                    <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
                                        Add your first gecko to get started
                                    </h2>
                                    <p className="text-slate-300 leading-relaxed">
                                        Track weights, plan breedings, visualize lineages, and identify morphs with AI.
                                        It takes about 30 seconds to add your first gecko.
                                    </p>
                                </div>
                                <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                                    <Link to={createPageUrl('MyGeckos')} className="flex-1 md:flex-none">
                                        <Button
                                            size="lg"
                                            className="w-full bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white font-semibold shadow-lg shadow-emerald-500/20"
                                        >
                                            <GitBranch className="w-4 h-4 mr-2" />
                                            Add First Gecko
                                        </Button>
                                    </Link>
                                    <Button
                                        size="lg"
                                        variant="outline"
                                        onClick={() => window.dispatchEvent(new CustomEvent('open_tutorial'))}
                                        className="border-slate-600 text-slate-200 hover:bg-slate-800"
                                    >
                                        <GraduationCap className="w-4 h-4 mr-2" />
                                        Quick tutorial
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Enhanced stats grid */}
                    {isLoading ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            {[...Array(4)].map((_, i) => (
                                <div key={i} className="gecko-card h-40">
                                    <div className="p-6 space-y-4">
                                        <div className="h-4 bg-gecko-surface rounded animate-pulse"></div>
                                        <div className="h-8 bg-gecko-surface rounded animate-pulse"></div>
                                        <div className="h-3 bg-gecko-surface rounded w-2/3 animate-pulse"></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            <StatsCard 
                                title="Community Members" 
                                value={stats.users.toLocaleString()} 
                                icon={Users} 
                                gradient="from-cyan-500 to-blue-600"
                                description="Active gecko enthusiasts"
                            />
                            <StatsCard 
                                title="Geckos Tracked" 
                                value={stats.geckos.toLocaleString()} 
                                icon={GitBranch} 
                                gradient="from-emerald-500 to-green-600"
                                description="Individual geckos in collections"
                            />
                            <StatsCard 
                                title="AI Training Images" 
                                value={stats.images.toLocaleString()} 
                                icon={ImageIcon} 
                                gradient="from-amber-500 to-orange-600"
                                description="Photos training our AI"
                            />
                            <StatsCard 
                                title="Forum Discussions" 
                                value={stats.posts.toLocaleString()} 
                                icon={MessageSquare} 
                                gradient="from-violet-500 to-purple-600"
                                description="Community conversations"
                            />
                        </div>
                    )}
                    
                    {/* Enhanced content grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                        <div className="lg:col-span-2 space-y-8">
                            <GeckoOfTheDayComponent 
                                geckoOfTheDay={geckoOfTheDay} 
                                fallbackGecko={fallbackGecko}
                                onImageSelect={handleImageSelect} // Pass onImageSelect
                            />
                            <RecentActivity 
                                geckoImages={recentImages} 
                                isLoading={isLoading}
                                onImageSelect={handleImageSelect} // Pass onImageSelect
                                users={users} // Pass all fetched users
                            />
                        </div>
                        <div className="space-y-8">
                            {trainingPageEnabled ? (
                                <TrainingProgress totalImages={stats.images} verifiedImages={stats.verifiedImages} isLoading={isLoading} />
                            ) : (
                                <Card className="gecko-card">
                                    <CardHeader>
                                        <CardTitle className="text-gecko-text text-glow flex items-center gap-2">
                                            <Egg className="w-5 h-5 text-gecko-accent" />
                                            Community Hatchery
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="flex justify-between items-center">
                                            <span className="text-gecko-text-muted text-sm">Geckos Hatched</span>
                                            <span className="text-3xl font-bold text-gecko-text">{hatcheryStats.hatched.toLocaleString()}</span>
                                        </div>
                                        <div className="w-full bg-gecko-surface rounded-full h-2.5">
                                            <div
                                                className="bg-gradient-to-r from-emerald-500 to-green-400 h-2.5 rounded-full transition-all duration-700"
                                                style={{ width: hatcheryStats.total > 0 ? `${Math.round((hatcheryStats.hatched / hatcheryStats.total) * 100)}%` : '0%' }}
                                            />
                                        </div>
                                        <div className="flex justify-between text-xs text-gecko-text-muted">
                                            <span>🥚 {hatcheryStats.incubating} currently incubating</span>
                                            <span>🐊 {hatcheryStats.plans} active breeding pairs</span>
                                        </div>
                                        <p className="text-gecko-text-muted text-sm leading-relaxed">
                                            Geckos successfully hatched through the community's breeding programs.
                                        </p>
                                    </CardContent>
                                </Card>
                            )}
                            {/* Small "new user" card — shown only to fresh accounts.
                                The big hero above covers the zero-gecko case; this
                                small card is a tidier reminder for anyone with a
                                handful of geckos but who hasn't finished the tour. */}
                            {userGeckoCount !== null && userGeckoCount < 3 && (
                                <Card className="gecko-card">
                                    <CardHeader>
                                        <CardTitle className="text-gecko-text text-glow flex items-center gap-2">
                                            <Sparkles className="w-5 h-5 text-gecko-accent" />
                                            New to Geck Inspect?
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <p className="text-gecko-text-muted leading-relaxed">
                                            Start your journey by adding geckos to your collection or help train our AI with gecko photos.
                                        </p>
                                        <div className="flex flex-col gap-3">
                                            <Link to={createPageUrl('MyGeckos')}>
                                                <Button variant="outline" className="w-full border-gecko-border hover:bg-gecko-hover backdrop-blur-sm transition-all duration-300 hover:scale-105">
                                                    <Users className="w-4 h-4 mr-2" />
                                                    Build My Collection
                                                </Button>
                                            </Link>
                                            <Button
                                                className="w-full bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white font-semibold gecko-glow transition-all duration-300 hover:scale-105"
                                                onClick={() => window.dispatchEvent(new CustomEvent('open_tutorial'))}
                                            >
                                                <GraduationCap className="w-4 h-4 mr-2" />
                                                Start Tutorial
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                    </div>
                </div>
            </div>
            
            {selectedImageData && (
                <ImageDetailModal
                    data={selectedImageData}
                    onClose={() => setSelectedImageData(null)}
                />
            )}
            <ChangeLogModal isOpen={showChangelog} onClose={() => setShowChangelog(false)} />
        </div>
    );
}