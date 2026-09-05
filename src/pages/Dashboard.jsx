import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import Seo from '@/components/seo/Seo';
import usePageSettings from '@/hooks/usePageSettings';
import { User, GeckoImage, ForumPost, GeckoOfTheDay as GotdEntity } from '@/entities/all';
import { api } from '@/api/appClient';
import { supabase } from '@/lib/supabaseClient';
import { isGuestMode } from '@/lib/guestMode';
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
import StatsCard from '../components/dashboard/StatsCard';
import RecentActivity from '../components/dashboard/RecentActivity';
import FeaturedBreeders from '../components/dashboard/FeaturedBreeders';
import NextActions from '../components/dashboard/NextActions';
import EnclosureClimate from '../components/iot/EnclosureClimate';
import CommunityPulse from '../components/dashboard/CommunityPulse';
import { default as GeckoOfTheDayComponent } from '../components/dashboard/GeckoOfTheDay';
import MyStoreButton from '../components/dashboard/MyStoreButton';
import DailyPromptCard from '../components/dashboard/DailyPromptCard';
import LiveFeed from '../components/dashboard/LiveFeed';
import WelcomeShelf from '../components/dashboard/WelcomeShelf';
import IncubatorTimeline from '../components/dashboard/IncubatorTimeline';
import IdNeedsPanel from '../components/dashboard/IdNeedsPanel';
import ImageDetailModal from '../components/gallery/ImageDetailModal';
import ChangeLogModal from '../components/changelog/ChangeLogModal';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { createPageUrl, getDisplayName } from '@/utils';
import { format } from 'date-fns';

const EMPTY_LIST = [];
const EMPTY_STATS = { users: 0, geckos: 0, images: 0, posts: 0, verifiedImages: 0 };
const EMPTY_PERSONAL = { geckos: 0, pairings: 0 };
const EMPTY_HATCHERY = { hatched: 0, incubating: 0, total: 0, plans: 0 };

/** Count-only query: PostgREST returns the number, never the rows. */
async function headCount(table, refine) {
    const query = supabase.from(table).select('id', { count: 'exact', head: true });
    const { count, error } = await refine(query);
    if (error) throw error;
    return count || 0;
}

/**
 * Community-wide dashboard data in one batch. Counts for keepers and
 * geckos come from the landing_stats RPC so the dashboard matches the
 * public landing page; the rest are intentionally small samples ("Recent
 * Uploads", "Forum Buzz"). Gecko of the Day is resolved here too so the
 * whole thing is one cache entry.
 */
async function loadCommunityDashboard() {
    const today = format(new Date(), 'yyyy-MM-dd');
    const [usersData, communityStats, posts, gotd, recentImagesData] = await Promise.all([
        User.list('-created_date', 30).catch(() => []),
        supabase.rpc('landing_stats').then(({ data, error }) => (error ? null : data)).catch(() => null),
        ForumPost.list('-created_date', 10).catch(() => []),
        GotdEntity.filter({ date: today }, '-created_date', 1).catch(() => []),
        // Only photos uploaded by real members: the scraper inserts rows
        // with NULL created_by, and those must not reach the community rail.
        GeckoImage.filter({ created_by: { $ne: null } }, '-created_date', 20).catch(() => []),
    ]);

    const stats = {
        users: Number(communityStats?.keepers ?? usersData.length) || 0,
        geckos: Number(communityStats?.geckos ?? 0) || 0,
        images: recentImagesData.length,
        verifiedImages: recentImagesData.filter((img) => img.verified).length,
        posts: posts.length,
    };

    let geckoOfTheDay = null;
    let fallbackGecko = null;
    if (gotd && gotd.length > 0) {
        const [featuredGeckoImage, uploaderResult] = await Promise.all([
            GeckoImage.get(gotd[0].gecko_image_id).catch(() => null),
            User.filter({ email: gotd[0].uploader_email }).catch(() => []),
        ]);
        geckoOfTheDay = { ...gotd[0], image: featuredGeckoImage, uploader: uploaderResult[0] || null };
    } else if (recentImagesData.length > 0) {
        const randomImage = recentImagesData[Math.floor(Math.random() * recentImagesData.length)];
        const uploaderResult = randomImage.created_by
            ? await User.filter({ email: randomImage.created_by }).catch(() => [])
            : [];
        fallbackGecko = { image: randomImage, uploader: uploaderResult[0] || null };
    }

    return { users: usersData, recentImages: recentImagesData, stats, geckoOfTheDay, fallbackGecko };
}

/** The member's own gecko and pairing counts for the stat cards. */
async function loadPersonalCounts(email) {
    const own = (q) => q.eq('created_by', email).or('archived.is.null,archived.eq.false');
    const [geckos, pairings] = await Promise.all([
        headCount('geckos', own),
        headCount('breeding_plans', own),
    ]);
    return { geckos, pairings };
}

/**
 * Hatchery strip counts. These used to download every egg and every
 * breeding plan the member could see and count them in the browser.
 */
async function loadHatcheryCounts(email) {
    const mine = (q) => q.eq('created_by', email);
    const [hatched, incubating, total, plans] = await Promise.all([
        headCount('eggs', (q) => mine(q).eq('status', 'Hatched')),
        headCount('eggs', (q) => mine(q).eq('status', 'Incubating').or('archived.is.null,archived.eq.false')),
        headCount('eggs', mine),
        headCount('breeding_plans', (q) => mine(q).or('archived.is.null,archived.eq.false')),
    ]);
    return { hatched, incubating, total, plans };
}

/**
 * Dashboard, April 2026 creative rework.
 *
 * Key changes vs the previous version:
 *
 * 1. New "personal hero" at the top that greets the user by name and
 *    shows their own collection count inline. Gradient is animated so
 *    the dashboard feels alive the moment it loads.
 * 2. Three-column layout for the main content grid:
 *       left, Next Actions + Community Pulse (the fun stuff)
 *       mid  , Gecko of the Day (the eye candy)
 *       right, Stats + Featured Breeders + hatchery widget
 *    This replaces the old "big content + tiny sidebar" split that
 *    felt lopsided.
 * 3. Pruned the query fan-out: the old dashboard loaded 500 geckos,
 *    100 users, and two separate 20/5 image calls. New version loads
 *    20 geckos for the recent count, 20 images for the community
 *    strip, 10 posts, plus the gecko of the day. Per-user queries
 *    run inside NextActions / FeaturedBreeders scoped to the current
 *    user only.
 * 4. Recent Activity tiles no longer use `scale-105` on hover, that
 *    was the root cause of the sluggish gallery hover. See the
 *    RecentActivity component for details.
 */

export default function Dashboard() {
    const [dashPrefs] = usePageSettings('dashboard_prefs', {
        showGeckoOfTheDay: true,
        showFeaturedBreeders: true,
        showCommunityPulse: true,
        showHatchery: true,
        compactStats: false,
        showLiveFeed: true,
        showIdNeeds: true,
        showWelcomeShelf: true,
    });
    const [selectedImageData, setSelectedImageData] = useState(null);
    const [showChangelog, setShowChangelog] = useState(false);
    const [changelogGlowing, setChangelogGlowing] = useState(false);

    // Data loading goes through react-query (launch review F47). Each
    // block is cached by the shared QueryClient, so leaving the dashboard
    // and coming back within staleTime renders from cache instead of
    // re-running the whole fan-out on every visit.
    const meQuery = useQuery({
        queryKey: ['dashboard', 'me'],
        queryFn: () => User.me().catch(() => null),
        staleTime: 5 * 60 * 1000,
    });
    const user = meQuery.data ?? null;
    const email = user?.email || null;

    const communityQuery = useQuery({
        queryKey: ['dashboard', 'community', format(new Date(), 'yyyy-MM-dd')],
        queryFn: loadCommunityDashboard,
        staleTime: 5 * 60 * 1000,
    });
    const community = communityQuery.data;
    const users = community?.users ?? EMPTY_LIST;
    const recentImages = community?.recentImages ?? EMPTY_LIST;
    const geckoOfTheDay = community?.geckoOfTheDay ?? null;
    const fallbackGecko = community?.fallbackGecko ?? null;
    const stats = community?.stats ?? EMPTY_STATS;

    const personalQuery = useQuery({
        queryKey: ['dashboard', 'personal', email],
        queryFn: () => loadPersonalCounts(email),
        enabled: Boolean(email),
    });
    const personalStats = personalQuery.data ?? EMPTY_PERSONAL;

    const hatcheryQuery = useQuery({
        queryKey: ['dashboard', 'hatchery', email],
        queryFn: () => loadHatcheryCounts(email),
        enabled: Boolean(email),
    });
    const hatcheryStats = hatcheryQuery.data ?? EMPTY_HATCHERY;

    // Unread changelog indicator
    const changelogQuery = useQuery({
        queryKey: ['dashboard', 'changelog-latest'],
        queryFn: () => api.entities.ChangeLog.filter({ is_published: true }, '-published_date', 1).catch(() => []),
        staleTime: 10 * 60 * 1000,
    });
    useEffect(() => {
        const latest = changelogQuery.data?.[0];
        if (!latest) return;
        const lastRead = localStorage.getItem('changelog_last_read');
        if (!lastRead || new Date(latest.published_date) > new Date(lastRead)) {
            setChangelogGlowing(true);
        }
    }, [changelogQuery.data]);
    useEffect(() => {
        const handler = () => setChangelogGlowing(false);
        window.addEventListener('changelog_read', handler);
        return () => window.removeEventListener('changelog_read', handler);
    }, []);

    const isLoading = meQuery.isLoading || communityQuery.isLoading;

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
    const todayLabel = format(now, 'EEEE, MMM d');

    // Seasonal flavor: rotates the hero kicker by month so the page
    // feels written by someone actually keeping crested geckos through
    // a breeding year, not a static template.
    const seasonalKicker = (() => {
        const m = now.getMonth(); // 0 = Jan
        if (m >= 2 && m <= 4) return 'Most breeders are pairing up this month.';
        if (m >= 5 && m <= 7) return 'Hatchlings are coming out. Good time to set up grow-out tubs.';
        if (m >= 8 && m <= 9) return 'Late season. Keep an eye on female weights as clutches slow down.';
        if (m === 10) return 'Cooler nights. Cresties eat less around now, that is normal.';
        return 'Off-season. A good time to review pairings for next year.';
    })();

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-emerald-950/30 to-slate-900 relative overflow-hidden">
            <Seo
                title="Dashboard"
                description="Your crested gecko breeding dashboard, track your collection, hatchery stats, community activity, and gecko of the day."
                path="/Dashboard"
                noIndex
                keywords={['gecko dashboard', 'breeding tracker', 'hatchery stats']}
            />
            {/* Ambient background */}
            <div className="absolute inset-0 gecko-scale-pattern opacity-5 pointer-events-none" />
            <div className="absolute top-0 right-0 w-[32rem] h-[32rem] bg-gradient-radial from-emerald-500/10 to-transparent rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-[32rem] h-[32rem] bg-gradient-radial from-teal-500/10 to-transparent rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 p-4 md:p-8">
                <div className="max-w-7xl mx-auto space-y-6">
                    {/* HERO STRIP, personal greeting + live mini stats */}
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
                                        {(personalStats.geckos > 0 || !user || isGuestMode()) ? (
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
                                            'No geckos logged yet. Add your first one to start tracking your collection.'
                                        )}
                                    </p>
                                    <p className="text-emerald-300/70 text-sm md:text-base italic">
                                        {seasonalKicker}
                                    </p>
                                </div>

                                <div className="flex flex-wrap gap-2.5">
                                    {/* Order: primary action (My Collection) first, then
                                        store curation, then passive views (Preview, What's New). */}
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
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ACTIVATION: a signed-in keeper with no animals yet gets
                        the one thing that matters first, not community totals
                        and breeder tools. */}
                    {!isLoading && user && !isGuestMode() && personalStats.geckos === 0 && (
                        <Card className="gecko-card border-emerald-500/30 bg-emerald-950/20">
                            <CardContent className="p-5 md:p-6 flex flex-col md:flex-row md:items-center gap-4">
                                <div className="flex-1">
                                    <p className="text-lg font-semibold text-slate-100">Start with one gecko</p>
                                    <p className="text-sm text-slate-400 mt-1">
                                        Add your first crested gecko and Geck Inspect starts tracking weights, sheds,
                                        photos, and lineage from day one. Not sure of the morph? Let the AI take a
                                        look at a photo first.
                                    </p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <Link to={createPageUrl('MyGeckos')}>
                                        <Button className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold">
                                            Add your first gecko
                                        </Button>
                                    </Link>
                                    <Link to={createPageUrl('MorphGuide')}>
                                        <Button variant="outline" className="border-slate-600 bg-slate-900/60 text-slate-100 hover:bg-slate-800">
                                            Browse the Morph Guide
                                        </Button>
                                    </Link>
                                    <Link to={createPageUrl('CareGuide')}>
                                        <Button variant="ghost" className="text-slate-300 hover:text-white">
                                            Read the care guide
                                        </Button>
                                    </Link>
                                </div>
                            </CardContent>
                        </Card>
                    )}

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

                    {dashPrefs.showWelcomeShelf && <WelcomeShelf currentUser={user} />}

                    <DailyPromptCard />

                    {/* MAIN CONTENT GRID, 3 columns on large screens */}
                    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
                        {/* Left column, Next Actions + Community Pulse */}
                        <div className="xl:col-span-4 space-y-6">
                            <NextActions currentUserEmail={user?.email} />
                            {/* Govee enclosure readings; renders nothing without a connection */}
                            {user && <EnclosureClimate user={user} />}
                            {dashPrefs.showCommunityPulse && <CommunityPulse />}
                            {dashPrefs.showLiveFeed && <LiveFeed currentUserEmail={user?.email} />}
                        </div>

                        {/* Middle column, Gecko of the Day hero */}
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

                        {/* Right column, Featured breeders + hatchery */}
                        <div className="xl:col-span-3 space-y-6">
                            {dashPrefs.showIdNeeds && <IdNeedsPanel currentUserEmail={user?.email} />}
                            {dashPrefs.showFeaturedBreeders && <FeaturedBreeders />}

                            {dashPrefs.showHatchery && <IncubatorTimeline email={email} />}

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
                                            <p className="text-slate-500 uppercase tracking-wider text-[10px]">
                                                Incubating
                                            </p>
                                            <p className="text-lg font-bold text-amber-300">
                                                {hatcheryStats.incubating}
                                            </p>
                                        </div>
                                        <div className="rounded-lg border border-slate-800 bg-slate-800/40 p-2">
                                            <p className="text-slate-500 uppercase tracking-wider text-[10px]">
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
