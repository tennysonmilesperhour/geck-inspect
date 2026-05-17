import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Seo from '@/components/seo/Seo';
import PageSettingsPanel from '@/components/ui/PageSettingsPanel';
import usePageSettings from '@/hooks/usePageSettings';
import { User, GeckoImage, ForumPost, GeckoOfTheDay as GotdEntity } from '@/entities/all';
import { base44 } from '@/api/base44Client';
import { supabase } from '@/lib/supabaseClient';
import {
    Users,
    GitBranch,
    MessageSquare,
    Newspaper,
    Egg,
    Flame,
    Camera,
    Crown,
    Eye,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import StatsCard from '../components/dashboard/StatsCard';
import RecentActivity from '../components/dashboard/RecentActivity';
import FeaturedBreeders from '../components/dashboard/FeaturedBreeders';
import NextActions from '../components/dashboard/NextActions';
import CommunityPulse from '../components/dashboard/CommunityPulse';
import { default as GeckoOfTheDayComponent } from '../components/dashboard/GeckoOfTheDay';
import MyStoreButton from '../components/dashboard/MyStoreButton';
import DailyPromptCard from '../components/dashboard/DailyPromptCard';
import LiveFeed from '../components/dashboard/LiveFeed';
import WelcomeShelf from '../components/dashboard/WelcomeShelf';
import IdNeedsPanel from '../components/dashboard/IdNeedsPanel';
import ImageDetailModal from '../components/gallery/ImageDetailModal';
import ChangeLogModal from '../components/changelog/ChangeLogModal';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { createPageUrl, getDisplayName } from '@/utils';
import { format } from 'date-fns';

/**
 * Dashboard ,  April 2026 creative rework.
 *
 * Key changes vs the previous version:
 *
 * 1. New "personal hero" at the top that greets the user by name and
 *    shows their own collection count inline. Gradient is animated so
 *    the dashboard feels alive the moment it loads.
 * 2. Three-column layout for the main content grid:
 *       left  ,  Next Actions + Community Pulse (the fun stuff)
 *       mid   ,  Gecko of the Day (the eye candy)
 *       right ,  Stats + Featured Breeders + hatchery widget
 *    This replaces the old "big content + tiny sidebar" split that
 *    felt lopsided.
 * 3. Pruned the query fan-out: the old dashboard loaded 500 geckos,
 *    100 users, and two separate 20/5 image calls. New version loads
 *    20 geckos for the recent count, 20 images for the community
 *    strip, 10 posts, plus the gecko of the day. Per-user queries
 *    run inside NextActions / FeaturedBreeders scoped to the current
 *    user only.
 * 4. Recent Activity tiles no longer use `scale-105` on hover ,  that
 *    was the root cause of the sluggish gallery hover. See the
 *    RecentActivity component for details.
 */

export default function Dashboard() {
    const [dashPrefs, setDashPrefs] = usePageSettings('dashboard_prefs', {
        showGeckoOfTheDay: true,
        showFeaturedBreeders: true,
        showCommunityPulse: true,
        showHatchery: true,
        compactStats: false,
        showLiveFeed: true,
        showIdNeeds: true,
        showWelcomeShelf: true,
    });
    const [stats, setStats] = useState({ users: 0, geckos: 0, images: 0, posts: 0, verifiedImages: 0 });
    const [personalStats, setPersonalStats] = useState({ geckos: 0, pairings: 0 });
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

    // Hatchery widget ,  cheap egg/plan counts (used for the hero strip)
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
                // Batched fetch ,  dramatically slimmer than before.
                // Community-wide counts (keepers, geckos) come from the
                // landing_stats RPC so the dashboard cards match the
                // numbers shown on the public landing page. The other
                // values are intentionally samples (labeled "Recent
                // Uploads" / "Forum Buzz" / recent discussions).
                const [currentUser, usersData, communityStats, posts, gotd, recentImagesData] = await Promise.all([
                    User.me().catch(() => null),
                    User.list('-created_date', 30),
                    supabase.rpc('landing_stats').then(({ data, error }) => (error ? null : data)).catch(() => null),
                    ForumPost.list('-created_date', 10).catch(() => []),
                    GotdEntity.filter({ date: today }, '-created_date', 1).catch(() => []),
                    // Only show photos uploaded by real users in the
                    // community strip. The scraper inserts gecko_images
                    // rows with NULL created_by; this filter excludes
                    // them so trophy / award / press shots don't leak
                    // into the Latest Community Uploads rail.
                    GeckoImage.filter({ created_by: { $ne: null } }, '-created_date', 20).catch(() => []),
                ]);

                setUser(currentUser);
                setUsers(usersData);
                setRecentImages(recentImagesData);

                setStats({
                    users: Number(communityStats?.keepers ?? usersData.length) || 0,
                    geckos: Number(communityStats?.geckos ?? 0) || 0,
                    images: recentImagesData.length,
                    verifiedImages: recentImagesData.filter((img) => img.verified).length,
                    posts: posts.length,
                });

                // Personal tally: lightweight count-only queries so the
                // stat cards can juxtapose what's yours against what the
                // community is doing. Both head:true so we never pull
                // the actual rows over the wire.
                if (currentUser?.email) {
                    const [{ count: myGeckos }, { count: myPairings }] = await Promise.all([
                        supabase
                            .from('geckos')
                            .select('id', { count: 'exact', head: true })
                            .eq('created_by', currentUser.email)
                            .or('archived.is.null,archived.eq.false'),
                        supabase
                            .from('breeding_plans')
                            .select('id', { count: 'exact', head: true })
                            .eq('created_by', currentUser.email)
                            .or('archived.is.null,archived.eq.false'),
                    ]);
                    setPersonalStats({
                        geckos: myGeckos || 0,
                        pairings: myPairings || 0,
                    });
                }

                // Gecko of the Day (official or fallback)
                if (gotd && gotd.length > 0) {
                    const featuredGeckoImage = await GeckoImage.get(gotd[0].gecko_image_id);
                    const uploaderResult = await User.filter({ email: gotd[0].uploader_email });
                    const uploader = uploaderResult.length > 0 ? uploaderResult[0] : null;
                    setGeckoOfTheDay({ ...gotd[0], image: featuredGeckoImage, uploader });
                    setFallbackGecko(null);
                } else if (recentImagesData.length > 0) {
                    const randomImage = recentImagesData[Math.floor(Math.random() * recentImagesData.length)];
                    const uploaderResult = randomImage.created_by
                        ? await User.filter({ email: randomImage.created_by })
                        : [];
                    const uploader = uploaderResult.length > 0 ? uploaderResult[0] : null;
                    setFallbackGecko({ image: randomImage, uploader });
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

    const now = new Date();
    const greeting = (() => {
        const h = now.getHours();
        if (h < 5) return 'Burning the midnight oil';
        if (h < 12) return 'Good morning';
        if (h < 17) return 'Good afternoon';
        if (h < 22) return 'Good evening';
        return 'Night owl';
    })();
    const firstName = getDisplayName(user).split(' ')[0];
    const todayLabel = format(now, "EEEE 'in the hatchery'");

    // Seasonal flavor: rotates the hero kicker by month so the page
    // feels written by someone actually keeping crested geckos through
    // a breeding year, not a static template.
    const seasonalKicker = (() => {
        const m = now.getMonth(); // 0 = Jan
        if (m >= 2 && m <= 4) return 'Breeding season is on. Who is pairing up this week?';
        if (m >= 5 && m <= 7) return 'Hatchling parade season. New faces dropping daily.';
        if (m >= 8 && m <= 9) return 'Late-season eggs and growth weights. The home stretch.';
        if (m === 10) return 'Diapause prep month. Time to cool things down.';
        return 'Cozy off-season. Plan your next pairings while the geckos rest.';
    })();

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-emerald-950/30 to-slate-900 relative overflow-hidden">
            <Seo
                title="Dashboard"
                description="Your crested gecko breeding dashboard ,  track your collection, hatchery stats, community activity, and gecko of the day."
                path="/Dashboard"
                noIndex
                keywords={['gecko dashboard', 'breeding tracker', 'hatchery stats']}
            />
            {/* Ambient background */}
            <div className="absolute inset-0 gecko-scale-pattern opacity-5 pointer-events-none" />
            <div className="absolute inset-0 dashboard-aurora opacity-60 pointer-events-none" />
            <div className="absolute top-0 right-0 w-[32rem] h-[32rem] bg-gradient-radial from-emerald-500/10 to-transparent rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-[32rem] h-[32rem] bg-gradient-radial from-teal-500/10 to-transparent rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 p-4 md:p-8">
                <div className="max-w-7xl mx-auto space-y-6">
                    {/* HERO STRIP ,  personal greeting + live mini stats */}
                    <div className="relative overflow-hidden rounded-3xl border border-emerald-500/20 bg-gradient-to-br from-emerald-950/60 via-slate-900/80 to-slate-950/80 backdrop-blur-sm dashboard-card-hover">
                        <div className="absolute inset-0 dashboard-aurora opacity-50 pointer-events-none" />
                        <div className="absolute -top-20 -right-20 w-80 h-80 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
                        <div className="absolute -bottom-16 -left-16 w-72 h-72 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

                        <div className="relative z-10 p-6 md:p-10">
                            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
                                <div className="space-y-3">
                                    <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 text-xs font-semibold text-emerald-300">
                                        <Flame className="w-3.5 h-3.5" />
                                        {todayLabel}
                                    </div>
                                    <h1 className="text-4xl md:text-6xl font-bold tracking-tight leading-[1.05] bg-gradient-to-b from-white via-emerald-100 to-emerald-300 bg-clip-text text-transparent">
                                        {greeting}, {firstName}
                                    </h1>
                                    <p className="text-slate-300 text-base md:text-lg max-w-2xl leading-relaxed">
                                        {stats.geckos > 0 ? (
                                            <>
                                                Right now,{' '}
                                                <span className="font-bold text-white">{stats.users.toLocaleString()}</span>{' '}
                                                keepers are tracking{' '}
                                                <span className="font-bold text-white">{stats.geckos.toLocaleString()}</span>{' '}
                                                crested geckos together.{' '}
                                                {hatcheryStats.incubating > 0 && (
                                                    <>
                                                        <span className="text-amber-300">{hatcheryStats.incubating}</span>{' '}
                                                        {hatcheryStats.incubating === 1 ? 'egg is' : 'eggs are'} warming up,{' '}
                                                    </>
                                                )}
                                                {hatcheryStats.plans > 0 && (
                                                    <>
                                                        and{' '}
                                                        <span className="text-emerald-300">{hatcheryStats.plans}</span>{' '}
                                                        breeding {hatcheryStats.plans === 1 ? 'plan is' : 'plans are'} in motion.
                                                    </>
                                                )}
                                            </>
                                        ) : (
                                            "Fresh dashboard, no geckos logged yet. Add your first one and watch the lineage tree grow."
                                        )}
                                    </p>
                                    <p className="text-emerald-300/70 text-sm md:text-base italic">
                                        {seasonalKicker}
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
                                    {user && <MyStoreButton user={user} />}
                                    {user?.id && (
                                        <a
                                            href={`/PublicProfile?userId=${user.id}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            <Button
                                                variant="outline"
                                                className="border-slate-600 bg-slate-900/60 text-slate-100 hover:bg-slate-800 backdrop-blur-sm"
                                            >
                                                <Eye className="w-4 h-4 mr-2" />
                                                Preview profile
                                            </Button>
                                        </a>
                                    )}
                                    <PageSettingsPanel title="Dashboard Settings">
                                        <div className="flex items-center justify-between">
                                            <Label className="text-slate-300 text-sm">Gecko of the Day</Label>
                                            <Switch checked={dashPrefs.showGeckoOfTheDay} onCheckedChange={v => setDashPrefs({ showGeckoOfTheDay: v })} />
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <Label className="text-slate-300 text-sm">Featured Breeders</Label>
                                            <Switch checked={dashPrefs.showFeaturedBreeders} onCheckedChange={v => setDashPrefs({ showFeaturedBreeders: v })} />
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <Label className="text-slate-300 text-sm">Community Pulse</Label>
                                            <Switch checked={dashPrefs.showCommunityPulse} onCheckedChange={v => setDashPrefs({ showCommunityPulse: v })} />
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <Label className="text-slate-300 text-sm">Hatchery Widget</Label>
                                            <Switch checked={dashPrefs.showHatchery} onCheckedChange={v => setDashPrefs({ showHatchery: v })} />
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <Label className="text-slate-300 text-sm">Compact Stats</Label>
                                            <Switch checked={dashPrefs.compactStats} onCheckedChange={v => setDashPrefs({ compactStats: v })} />
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <Label className="text-slate-300 text-sm">Community Live Feed</Label>
                                            <Switch checked={dashPrefs.showLiveFeed} onCheckedChange={v => setDashPrefs({ showLiveFeed: v })} />
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <Label className="text-slate-300 text-sm">Help ID Panel</Label>
                                            <Switch checked={dashPrefs.showIdNeeds} onCheckedChange={v => setDashPrefs({ showIdNeeds: v })} />
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <Label className="text-slate-300 text-sm">Welcome Shelf</Label>
                                            <Switch checked={dashPrefs.showWelcomeShelf} onCheckedChange={v => setDashPrefs({ showWelcomeShelf: v })} />
                                        </div>
                                    </PageSettingsPanel>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* STATS STRIP */}
                    {isLoading ? (
                        <div className={`grid grid-cols-2 md:grid-cols-4 gap-4 ${dashPrefs.compactStats ? 'max-w-3xl' : ''}`}>
                            {[...Array(4)].map((_, i) => (
                                <div
                                    key={i}
                                    className={`${dashPrefs.compactStats ? 'h-16' : 'h-28'} rounded-2xl border border-slate-800 bg-slate-900/50 animate-pulse`}
                                />
                            ))}
                        </div>
                    ) : user ? (
                        // Signed-in keepers see their own numbers next to the
                        // community totals so the stats feel personal, not
                        // abstract. Two cards yours, two cards the community.
                        <div className={`grid grid-cols-2 md:grid-cols-4 gap-4 ${dashPrefs.compactStats ? 'max-w-3xl' : ''}`}>
                            <StatsCard
                                title="Your Geckos"
                                value={personalStats.geckos.toLocaleString()}
                                icon={GitBranch}
                                gradient="from-emerald-500 to-green-600"
                                description={dashPrefs.compactStats ? '' : 'In your collection'}
                            />
                            <StatsCard
                                title="Your Pairings"
                                value={personalStats.pairings.toLocaleString()}
                                icon={Egg}
                                gradient="from-pink-500 to-rose-600"
                                description={dashPrefs.compactStats ? '' : 'Active breeding plans'}
                            />
                            <StatsCard
                                title="Community Geckos"
                                value={stats.geckos.toLocaleString()}
                                icon={Users}
                                gradient="from-cyan-500 to-blue-600"
                                description={dashPrefs.compactStats ? '' : `Across ${stats.users.toLocaleString()} keepers`}
                            />
                            <StatsCard
                                title="Forum Threads"
                                value={stats.posts.toLocaleString()}
                                icon={MessageSquare}
                                gradient="from-violet-500 to-purple-600"
                                description={dashPrefs.compactStats ? '' : 'Buzzing now'}
                            />
                        </div>
                    ) : (
                        // Signed-out / guest view: pure community stats.
                        <div className={`grid grid-cols-2 md:grid-cols-4 gap-4 ${dashPrefs.compactStats ? 'max-w-3xl' : ''}`}>
                            <StatsCard
                                title="Keepers"
                                value={stats.users.toLocaleString()}
                                icon={Users}
                                gradient="from-cyan-500 to-blue-600"
                                description={dashPrefs.compactStats ? '' : 'In the community'}
                            />
                            <StatsCard
                                title="Crested Geckos"
                                value={stats.geckos.toLocaleString()}
                                icon={GitBranch}
                                gradient="from-emerald-500 to-green-600"
                                description={dashPrefs.compactStats ? '' : 'Tracked together'}
                            />
                            <StatsCard
                                title="Fresh Photos"
                                value={stats.images.toLocaleString()}
                                icon={Camera}
                                gradient="from-amber-500 to-orange-600"
                                description={dashPrefs.compactStats ? '' : 'Just uploaded'}
                            />
                            <StatsCard
                                title="Forum Threads"
                                value={stats.posts.toLocaleString()}
                                icon={MessageSquare}
                                gradient="from-violet-500 to-purple-600"
                                description={dashPrefs.compactStats ? '' : 'Buzzing now'}
                            />
                        </div>
                    )}

                    {dashPrefs.showWelcomeShelf && <WelcomeShelf currentUserEmail={user?.email} />}

                    <DailyPromptCard />

                    {/* MAIN CONTENT GRID ,  3 columns on large screens */}
                    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
                        {/* Left column ,  Next Actions + Community Pulse */}
                        <div className="xl:col-span-4 space-y-6">
                            <NextActions currentUserEmail={user?.email} />
                            {dashPrefs.showCommunityPulse && <CommunityPulse />}
                            {dashPrefs.showLiveFeed && <LiveFeed currentUserEmail={user?.email} />}
                        </div>

                        {/* Middle column ,  Gecko of the Day hero */}
                        <div className="xl:col-span-5 space-y-6">
                            {dashPrefs.showGeckoOfTheDay && (
                                <GeckoOfTheDayComponent
                                    geckoOfTheDay={geckoOfTheDay}
                                    fallbackGecko={fallbackGecko}
                                    onImageSelect={handleImageSelect}
                                />
                            )}
                            <RecentActivity
                                geckoImages={recentImages}
                                isLoading={isLoading}
                                onImageSelect={handleImageSelect}
                                users={users}
                            />
                        </div>

                        {/* Right column ,  Featured breeders + hatchery */}
                        <div className="xl:col-span-3 space-y-6">
                            {dashPrefs.showIdNeeds && <IdNeedsPanel currentUserEmail={user?.email} />}
                            {dashPrefs.showFeaturedBreeders && <FeaturedBreeders />}

                            {dashPrefs.showHatchery && <Card className="gecko-card">
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
                            </Card>}

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
                                                { label: 'Genetics Calculator', href: '/calculator' },
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
