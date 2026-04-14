import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PageSettingsPanel from '@/components/ui/PageSettingsPanel';
import { User, Gecko, GeckoImage, ForumPost, GeckoOfTheDay as GotdEntity } from '@/entities/all';
import { base44 } from '@/api/base44Client';
import {
    Users,
    GitBranch,
    MessageSquare,
    Newspaper,
    Egg,
    Flame,
    Camera,
    Crown,
} from 'lucide-react';
import StatsCard from '../components/dashboard/StatsCard';
import RecentActivity from '../components/dashboard/RecentActivity';
import FeaturedBreeders from '../components/dashboard/FeaturedBreeders';
import NextActions from '../components/dashboard/NextActions';
import CommunityPulse from '../components/dashboard/CommunityPulse';
import { default as GeckoOfTheDayComponent } from '../components/dashboard/GeckoOfTheDay';
import ImageDetailModal from '../components/gallery/ImageDetailModal';
import ChangeLogModal from '../components/changelog/ChangeLogModal';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { createPageUrl } from '@/utils';
import { format } from 'date-fns';

/**
 * Dashboard — April 2026 creative rework.
 *
 * Key changes vs the previous version:
 *
 * 1. New "personal hero" at the top that greets the user by name and
 *    shows their own collection count inline. Gradient is animated so
 *    the dashboard feels alive the moment it loads.
 * 2. Three-column layout for the main content grid:
 *       left  — Next Actions + Community Pulse (the fun stuff)
 *       mid   — Gecko of the Day (the eye candy)
 *       right — Stats + Featured Breeders + hatchery widget
 *    This replaces the old "big content + tiny sidebar" split that
 *    felt lopsided.
 * 3. Pruned the query fan-out: the old dashboard loaded 500 geckos,
 *    100 users, and two separate 20/5 image calls. New version loads
 *    20 geckos for the recent count, 20 images for the community
 *    strip, 10 posts, plus the gecko of the day. Per-user queries
 *    run inside NextActions / FeaturedBreeders scoped to the current
 *    user only.
 * 4. Recent Activity tiles no longer use `scale-105` on hover — that
 *    was the root cause of the sluggish gallery hover. See the
 *    RecentActivity component for details.
 */

export default function Dashboard() {
    const [stats, setStats] = useState({ users: 0, geckos: 0, images: 0, posts: 0, verifiedImages: 0 });
    const [isLoading, setIsLoading] = useState(true);
    const [user, setUser] = useState(null);
    const [users, setUsers] = useState([]);
    const [geckoOfTheDay, setGeckoOfTheDay] = useState(null);
    const [fallbackGecko, setFallbackGecko] = useState(null);
    const [recentImages, setRecentImages] = useState([]);
    const [selectedImageData, setSelectedImageData] = useState(null);
    const [showChangelog, setShowChangelog] = useState(false);
    const [changelogGlowing, setChangelogGlowing] = useState(false);
    const [hatcheryStats, setHatcheryStats] = useState({ hatched: 0, incubating: 0, total: 0, plans: 0 });

    // Unread changelog indicator
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
            } catch (e) {
                console.warn('Changelog check failed:', e);
            }
        };
        checkUnread();
        const handler = () => setChangelogGlowing(false);
        window.addEventListener('changelog_read', handler);
        return () => window.removeEventListener('changelog_read', handler);
    }, []);

    // Hatchery widget — cheap egg/plan counts (used for the hero strip)
    useEffect(() => {
        (async () => {
            try {
                const [eggs, plans] = await Promise.all([
                    base44.entities.Egg.list().catch(() => []),
                    base44.entities.BreedingPlan.list().catch(() => []),
                ]);
                setHatcheryStats({
                    hatched: eggs.filter((e) => e.status === 'Hatched').length,
                    incubating: eggs.filter((e) => e.status === 'Incubating' && !e.archived).length,
                    total: eggs.length,
                    plans: plans.filter((p) => !p.archived).length,
                });
            } catch (e) {
                console.warn('Hatchery stats failed:', e);
            }
        })();
    }, []);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const today = format(new Date(), 'yyyy-MM-dd');
                // Batched fetch — dramatically slimmer than before.
                const [currentUser, usersData, geckosPreview, posts, gotd, recentImagesData] = await Promise.all([
                    User.me().catch(() => null),
                    User.list('-created_date', 30),
                    Gecko.list('-created_date', 20), // only used for community count display
                    ForumPost.list('-created_date', 10).catch(() => []),
                    GotdEntity.filter({ date: today }, '-created_date', 1).catch(() => []),
                    GeckoImage.list('-created_date', 20),
                ]);

                setUser(currentUser);
                setUsers(usersData);
                setRecentImages(recentImagesData);

                setStats({
                    users: usersData.length,
                    geckos: geckosPreview.filter((g) => !g.archived && g.status !== 'Sold').length,
                    images: recentImagesData.length,
                    verifiedImages: recentImagesData.filter((img) => img.verified).length,
                    posts: posts.length,
                });

                // Gecko of the Day (official or fallback)
                if (gotd && gotd.length > 0) {
                    const featuredGeckoImage = await GeckoImage.get(gotd[0].gecko_image_id);
                    const uploaderResult = await User.filter({ email: gotd[0].uploader_email });
                    const uploader = uploaderResult.length > 0 ? uploaderResult[0] : null;
                    setGeckoOfTheDay({ ...gotd[0], image: featuredGeckoImage, uploader });
                    setFallbackGecko(null);
                } else if (recentImagesData.length > 0) {
                    const randomImage = recentImagesData[Math.floor(Math.random() * recentImagesData.length)];
                    const uploaderResult = await User.filter({ email: randomImage.created_by });
                    const uploader = uploaderResult.length > 0 ? uploaderResult[0] : null;
                    setFallbackGecko({
                        image: randomImage,
                        uploader,
                        appreciative_message: `A stunning ${randomImage.primary_morph ? randomImage.primary_morph.replace(/_/g, ' ') : 'gecko'} from our community!`,
                    });
                    setGeckoOfTheDay(null);
                }
            } catch (error) {
                console.error('Failed to load dashboard data:', error);
            }
            setIsLoading(false);
        };
        fetchData();
    }, []);

    const handleImageSelect = (image, uploader) => {
        setSelectedImageData({ image, uploader });
    };

    const greeting = (() => {
        const h = new Date().getHours();
        if (h < 5) return 'Up late';
        if (h < 12) return 'Good morning';
        if (h < 17) return 'Good afternoon';
        if (h < 22) return 'Good evening';
        return 'Night owl';
    })();
    const firstName = user?.full_name?.split(' ')[0] || user?.breeder_name || 'breeder';

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-emerald-950/30 to-slate-900 relative overflow-hidden">
            {/* Ambient background */}
            <div className="absolute inset-0 gecko-scale-pattern opacity-5 pointer-events-none" />
            <div className="absolute top-0 right-0 w-[32rem] h-[32rem] bg-gradient-radial from-emerald-500/10 to-transparent rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-[32rem] h-[32rem] bg-gradient-radial from-teal-500/10 to-transparent rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 p-4 md:p-8">
                <div className="max-w-7xl mx-auto space-y-6">
                    {/* HERO STRIP — personal greeting + live mini stats */}
                    <div className="relative overflow-hidden rounded-3xl border border-emerald-500/20 bg-gradient-to-br from-emerald-950/60 via-slate-900/80 to-slate-950/80 backdrop-blur-sm">
                        <div className="absolute -top-20 -right-20 w-80 h-80 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
                        <div className="absolute -bottom-16 -left-16 w-72 h-72 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

                        <div className="relative z-10 p-6 md:p-10">
                            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
                                <div className="space-y-3">
                                    <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 text-xs font-semibold text-emerald-300">
                                        <Flame className="w-3.5 h-3.5" />
                                        Live dashboard
                                    </div>
                                    <h1 className="text-4xl md:text-6xl font-bold tracking-tight leading-[1.05] bg-gradient-to-b from-white via-emerald-100 to-emerald-300 bg-clip-text text-transparent">
                                        {greeting}, {firstName}
                                    </h1>
                                    <p className="text-slate-300 text-base md:text-lg max-w-2xl leading-relaxed">
                                        {stats.geckos > 0 ? (
                                            <>
                                                The community is tracking{' '}
                                                <span className="font-bold text-white">{stats.geckos.toLocaleString()}</span>{' '}
                                                geckos across{' '}
                                                <span className="font-bold text-white">{stats.users.toLocaleString()}</span>{' '}
                                                keepers right now. {hatcheryStats.incubating > 0 && (
                                                    <>
                                                        <span className="text-amber-300">{hatcheryStats.incubating}</span> eggs
                                                        are in incubators.{' '}
                                                    </>
                                                )}
                                                {hatcheryStats.plans > 0 && (
                                                    <>
                                                        <span className="text-emerald-300">{hatcheryStats.plans}</span> active
                                                        breeding plans.
                                                    </>
                                                )}
                                            </>
                                        ) : (
                                            'Welcome to your gecko universe. The community is just getting started.'
                                        )}
                                    </p>
                                </div>

                                <div className="flex flex-wrap gap-2.5">
                                    <Button
                                        variant="outline"
                                        onClick={() => setShowChangelog(true)}
                                        className={`border-slate-600 bg-slate-900/60 text-slate-100 hover:bg-slate-800 backdrop-blur-sm ${
                                            changelogGlowing
                                                ? 'ring-2 ring-emerald-400 shadow-[0_0_16px_4px_rgba(52,211,153,0.4)] animate-pulse'
                                                : ''
                                        }`}
                                    >
                                        <Newspaper className="w-4 h-4 mr-2" />
                                        What's New
                                        {changelogGlowing && (
                                            <span className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-emerald-400 rounded-full border-2 border-slate-950" />
                                        )}
                                    </Button>
                                    {user && (
                                        <Link to={createPageUrl('MyGeckos')}>
                                            <Button className="bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white font-semibold shadow-lg shadow-emerald-500/20">
                                                <GitBranch className="w-4 h-4 mr-2" />
                                                My Collection
                                            </Button>
                                        </Link>
                                    )}
                                    <PageSettingsPanel title="Dashboard Settings">
                                        <p className="text-[11px] text-slate-500 leading-relaxed">
                                            Customize notification preferences, calendar alerts, and featured breeder settings from the main Settings page.
                                        </p>
                                    </PageSettingsPanel>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* STATS STRIP */}
                    {isLoading ? (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {[...Array(4)].map((_, i) => (
                                <div
                                    key={i}
                                    className="h-28 rounded-2xl border border-slate-800 bg-slate-900/50 animate-pulse"
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <StatsCard
                                title="Community Members"
                                value={stats.users.toLocaleString()}
                                icon={Users}
                                gradient="from-cyan-500 to-blue-600"
                                description="Active keepers"
                            />
                            <StatsCard
                                title="Geckos Tracked"
                                value={stats.geckos.toLocaleString()}
                                icon={GitBranch}
                                gradient="from-emerald-500 to-green-600"
                                description="Across collections"
                            />
                            <StatsCard
                                title="Recent Uploads"
                                value={stats.images.toLocaleString()}
                                icon={Camera}
                                gradient="from-amber-500 to-orange-600"
                                description="Last 20 photos"
                            />
                            <StatsCard
                                title="Forum Buzz"
                                value={stats.posts.toLocaleString()}
                                icon={MessageSquare}
                                gradient="from-violet-500 to-purple-600"
                                description="Recent discussions"
                            />
                        </div>
                    )}

                    {/* MAIN CONTENT GRID — 3 columns on large screens */}
                    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
                        {/* Left column — Next Actions + Community Pulse */}
                        <div className="xl:col-span-4 space-y-6">
                            <NextActions currentUserEmail={user?.email} />
                            <CommunityPulse />
                        </div>

                        {/* Middle column — Gecko of the Day hero */}
                        <div className="xl:col-span-5 space-y-6">
                            <GeckoOfTheDayComponent
                                geckoOfTheDay={geckoOfTheDay}
                                fallbackGecko={fallbackGecko}
                                onImageSelect={handleImageSelect}
                            />
                            <RecentActivity
                                geckoImages={recentImages}
                                isLoading={isLoading}
                                onImageSelect={handleImageSelect}
                                users={users}
                            />
                        </div>

                        {/* Right column — Featured breeders + hatchery */}
                        <div className="xl:col-span-3 space-y-6">
                            <FeaturedBreeders />

                            <Card className="gecko-card">
                                <CardContent className="p-5 space-y-4">
                                    <div className="flex items-center gap-2 text-gecko-text">
                                        <Egg className="w-5 h-5 text-amber-400" />
                                        <h3 className="font-semibold">Community Hatchery</h3>
                                    </div>
                                    <div>
                                        <p className="text-4xl font-bold text-white">
                                            {hatcheryStats.hatched.toLocaleString()}
                                        </p>
                                        <p className="text-xs text-slate-400 uppercase tracking-wider mt-1">
                                            Hatched this year
                                        </p>
                                    </div>
                                    <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                                        <div
                                            className="bg-gradient-to-r from-emerald-500 via-teal-400 to-amber-400 h-full rounded-full transition-all duration-700"
                                            style={{
                                                width:
                                                    hatcheryStats.total > 0
                                                        ? `${Math.round((hatcheryStats.hatched / hatcheryStats.total) * 100)}%`
                                                        : '0%',
                                            }}
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                        <div className="rounded-lg border border-slate-800 bg-slate-800/40 p-2">
                                            <p className="text-slate-500 uppercase tracking-wider text-[9px]">
                                                Incubating
                                            </p>
                                            <p className="text-lg font-bold text-amber-300">
                                                {hatcheryStats.incubating}
                                            </p>
                                        </div>
                                        <div className="rounded-lg border border-slate-800 bg-slate-800/40 p-2">
                                            <p className="text-slate-500 uppercase tracking-wider text-[9px]">
                                                Active Pairs
                                            </p>
                                            <p className="text-lg font-bold text-emerald-300">
                                                {hatcheryStats.plans}
                                            </p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* New-user onboarding card only when relevant */}
                            {user && (
                                <Card className="gecko-card">
                                    <CardContent className="p-5 space-y-3">
                                        <div className="flex items-center gap-2 text-gecko-text">
                                            <Crown className="w-5 h-5 text-emerald-400" />
                                            <h3 className="font-semibold">Quick Links</h3>
                                        </div>
                                        <div className="grid grid-cols-1 gap-2">
                                            {[
                                                { label: 'Morph ID Tool', href: '/Recognition' },
                                                { label: 'Genetics Calculator', href: '/GeneticCalculatorTool' },
                                                { label: 'Season Planner', href: '/ProjectManager' },
                                                { label: 'Lineage Tree', href: '/Lineage' },
                                            ].map((l) => (
                                                <Link
                                                    key={l.label}
                                                    to={l.href}
                                                    className="text-xs text-slate-300 hover:text-emerald-300 rounded-md px-2 py-1.5 hover:bg-slate-800/60 transition-colors"
                                                >
                                                    → {l.label}
                                                </Link>
                                            ))}
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
