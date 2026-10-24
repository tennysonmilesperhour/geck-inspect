import { Suspense, useEffect, useState } from 'react';
import { lazy } from '@/lib/lazyWithRetry';
import { useAuth } from '@/lib/AuthContext';
import '@/styles/dashboard-home.css';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
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
    SlidersHorizontal,
    Plus,
} from 'lucide-react';
import StatsCard from '../components/dashboard/StatsCard';
import RecentActivity from '../components/dashboard/RecentActivity';
import FeaturedBreeders from '../components/dashboard/FeaturedBreeders';
import NextActions from '../components/dashboard/NextActions';
import EnclosureClimate from '../components/iot/EnclosureClimate';
import { IOT_SENSORS_ENABLED } from '@/lib/iotClient';
import CommunityPulse from '../components/dashboard/CommunityPulse';
import { default as GeckoOfTheDayComponent } from '../components/dashboard/GeckoOfTheDay';
import MyStoreButton from '../components/dashboard/MyStoreButton';
import LiveFeed from '../components/dashboard/LiveFeed';
import WelcomeShelf from '../components/dashboard/WelcomeShelf';
import IncubatorTimeline from '../components/dashboard/IncubatorTimeline';
import IdNeedsPanel from '../components/dashboard/IdNeedsPanel';
import ChangeLogModal from '../components/changelog/ChangeLogModal';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import HomeCollection from '@/components/dashboard/HomeCollection';
import { Card, CardContent } from '@/components/ui/card';
import ReferralLinkCard from '@/components/shared/ReferralLinkCard';
import FirstGeckoStarter from '@/components/onboarding/FirstGeckoStarter';
import SignOutButton from '@/components/auth/SignOutButton';
import { readPendingGecko } from '@/lib/firstGeckoFlow';
import { createPageUrl, getDisplayName } from '@/utils';
import { format } from 'date-fns';

const ImageDetailModal = lazy(() => import('../components/gallery/ImageDetailModal'));
const HomeValues = lazy(() => import('@/components/dashboard/HomeValues'));

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
        // with no owner, and those must not reach the community rail.
        // owner_profile_id is set exactly when a member uploaded the photo,
        // and unlike created_by a signed-out visitor may filter on it.
        GeckoImage.filter({ owner_profile_id: { $ne: null } }, '-created_date', 20).catch(() => []),
    ]);

    const stats = {
        users: Number(communityStats?.keepers ?? usersData.length) || 0,
        geckos: Number(communityStats?.geckos ?? 0) || 0,
        images: recentImagesData.length,
        verifiedImages: recentImagesData.filter((img) => img.verified).length,
        posts: posts.length,
    };

    // The uploader is found from the photo's owner_profile_id, never from an
    // email: signed-out visitors cannot read created_by or uploader_email.
    const uploaderOf = (image) => (image?.owner_profile_id
        ? User.get(image.owner_profile_id).catch(() => null)
        : Promise.resolve(null));

    let geckoOfTheDay = null;
    let fallbackGecko = null;
    if (gotd && gotd.length > 0) {
        const featuredGeckoImage = await GeckoImage.get(gotd[0].gecko_image_id).catch(() => null);
        const uploader = await uploaderOf(featuredGeckoImage);
        geckoOfTheDay = { ...gotd[0], image: featuredGeckoImage, uploader };
    } else if (recentImagesData.length > 0) {
        const randomImage = recentImagesData[Math.floor(Math.random() * recentImagesData.length)];
        fallbackGecko = { image: randomImage, uploader: await uploaderOf(randomImage) };
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

export default function Dashboard() {
    const navigate = useNavigate();
    // A gecko kept in the guest demo and not saved yet (My Geckos saves it).
    const [pendingGeckoName] = useState(() => readPendingGecko()?.name || null);
    const [dashPrefs, updateDashPrefs] = usePageSettings('dashboard_prefs', {
        showGeckoOfTheDay: true,
        showFeaturedBreeders: true,
        showCommunityPulse: true,
        showHatchery: true,
        compactStats: false,
        showLiveFeed: true,
        showIdNeeds: true,
        showWelcomeShelf: true,
        showValues: true,
    });
    const [showCustomize, setShowCustomize] = useState(false);
    const [selectedImageData, setSelectedImageData] = useState(null);
    const [showChangelog, setShowChangelog] = useState(false);
    const [changelogGlowing, setChangelogGlowing] = useState(false);

    // Data loading goes through react-query (launch review F47). Each
    // block is cached by the shared QueryClient, so leaving the dashboard
    // and coming back within staleTime renders from cache instead of
    // re-running the whole fan-out on every visit.
    const { user, isLoadingAuth } = useAuth();
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
        // Always recheck on arrival (the cached counts still render first),
        // so a gecko added anywhere replaces "Add your first gecko" at once.
        staleTime: 0,
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

    const isLoading = isLoadingAuth || communityQuery.isLoading;

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
    // Guests and accounts with no usable name get the greeting on its own.
    // getDisplayName falls back to "Geck Inspect User", which used to render
    // as "Good evening, Geck".
    const displayName = user && !isGuestMode() ? getDisplayName(user) : '';
    const firstName = displayName && displayName !== 'Geck Inspect User'
        ? displayName.split(' ')[0]
        : '';
    const hasGeckos = personalStats.geckos > 0;
    // A signed-in member whose collection is confirmed empty gets one next
    // step (the first-gecko card) instead of four hero buttons that lead to
    // empty pages. Waits for the count so the buttons never flicker.
    const isFirstRun = Boolean(user) && !isGuestMode() && personalQuery.isSuccess && personalStats.geckos === 0;
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
                <div className="max-w-7xl mx-auto space-y-6 dashboard-home">
                    {/* HERO STRIP, personal greeting + live mini stats */}
                    <div className="relative overflow-hidden rounded-3xl border border-emerald-500/20 bg-gradient-to-br from-emerald-950/60 via-slate-900/80 to-slate-950/80 backdrop-blur-sm dashboard-card-hover">
                        <div className="absolute inset-0 dashboard-aurora opacity-50 pointer-events-none" />
                        <div className="absolute -top-20 -right-20 w-80 h-80 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
                        <div className="absolute -bottom-16 -left-16 w-72 h-72 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

                        <div className="relative z-10 p-5 md:p-6">
                            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                                <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 text-xs font-semibold text-emerald-300">
                                    <Flame className="w-3.5 h-3.5" />
                                    {todayLabel}
                                </div>
                                <SignOutButton className="border-slate-600 bg-slate-900/60 text-slate-100 hover:bg-slate-800 backdrop-blur-sm" />
                            </div>
                            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5 md:gap-6">
                                <div className="space-y-2 md:space-y-3">
                                    <h1 className="text-3xl md:text-4xl font-bold tracking-tight leading-tight text-slate-100">
                                        {greeting}{firstName ? `, ${firstName}` : ''}
                                    </h1>
                                    <p className="text-slate-300 text-sm max-w-2xl leading-relaxed">
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
                                            'Welcome to Geck Inspect. Everything on this page fills in as your collection grows.'
                                        )}
                                    </p>
                                    <p className="text-emerald-200 text-xs">
                                        {seasonalKicker}
                                    </p>
                                </div>

                                <div className="flex flex-wrap gap-2.5 home-hero-actions">
                                    {user && !isFirstRun && <Button asChild><Link to="/BatchHusbandry"><Plus className="w-4 h-4 mr-2" />Log care</Link></Button>}
                                    {user && !isFirstRun && (
                                        <Link to={createPageUrl('MyGeckos')}>
                                            <Button className="bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white font-semibold shadow-lg shadow-emerald-500/20">
                                                <GitBranch className="w-4 h-4 mr-2" />
                                                My Collection
                                            </Button>
                                        </Link>
                                    )}
                                    {/* Store and profile previews have nothing to show
                                        before the first gecko, so a brand new account sees
                                        one clear next step instead of four buttons. */}
                                    {user && !isFirstRun && <MyStoreButton user={user} />}
                                    {user?.id && !isFirstRun && (
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

                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <nav aria-label="Homepage sections" className="flex flex-wrap gap-1 text-sm">
                            <a className="home-jump" href="#home-workspace">Your workspace</a>
                            <a className="home-jump" href="#home-community">Community</a>
                            <a className="home-jump" href="#home-breeding">Breeding & tools</a>
                        </nav>
                        <Button variant="outline" size="sm" onClick={() => setShowCustomize(true)}><SlidersHorizontal className="w-4 h-4 mr-2" />Customize home</Button>
                    </div>
                    <section id="home-workspace" aria-label="Your workspace" className="space-y-5 home-section">
                    {/* ACTIVATION: a signed-in keeper with no animals yet gets
                        the one thing that matters first, not community totals
                        and breeder tools. */}
                    {isFirstRun && (
                        // The guided first gecko: add it (by photo or typed),
                        // its parents, then what it needs next and its value.
                        <FirstGeckoStarter
                            surface="dashboard"
                            startHref={`${createPageUrl('MyGeckos')}?add=1&how=type`}
                            importHref={`${createPageUrl('MyGeckos')}?import=1`}
                            pendingName={pendingGeckoName}
                            onSavePending={() => navigate(createPageUrl('MyGeckos'))}
                        />
                    )}

                    {/* What needs doing today comes before any totals. Only
                        shown once there are geckos, otherwise its "All caught
                        up" state would sit next to the add-your-first card. */}
                    <div className={`grid gap-5 ${hasGeckos && dashPrefs.showCommunityPulse ? 'lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]' : ''}`}>
                        {hasGeckos && <NextActions currentUserEmail={user?.email} />}
                        {dashPrefs.showCommunityPulse && <CommunityPulse />}
                    </div>
                    {IOT_SENSORS_ENABLED && user && <EnclosureClimate user={user} />}

                    {/* STATS STRIP */}
                    {isLoading ? (
                        <div className={`home-stats grid grid-cols-2 md:grid-cols-4 gap-3 ${dashPrefs.compactStats ? 'max-w-3xl' : ''}`}>
                            {[...Array(4)].map((_, i) => (
                                <div
                                    key={i}
                                    className={`${dashPrefs.compactStats ? 'h-16' : 'h-28'} rounded-2xl border border-slate-800 bg-slate-900/50 animate-pulse`}
                                />
                            ))}
                        </div>
                    ) : user ? (
                        // Signed-in keepers see only their own numbers. The two
                        // community cards were dropped (VIP audit P4.3): with a
                        // small community they advertised an empty room, and
                        // "Forum Threads" was a sample capped at 10, not a count.
                        <div className={`home-stats grid grid-cols-2 md:grid-cols-4 gap-3 ${dashPrefs.compactStats ? 'max-w-3xl' : ''}`}>
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
                                title="Eggs Incubating"
                                value={hatcheryStats.incubating.toLocaleString()}
                                icon={Egg}
                                gradient="from-amber-500 to-orange-600"
                                description={dashPrefs.compactStats ? '' : 'In your incubator'}
                            />
                            <StatsCard
                                title="Hatched"
                                value={hatcheryStats.hatched.toLocaleString()}
                                icon={GitBranch}
                                gradient="from-cyan-500 to-blue-600"
                                description={dashPrefs.compactStats ? '' : 'Eggs you have hatched'}
                            />
                        </div>
                    ) : (
                        // Signed-out / guest view: pure community stats.
                        <div className={`home-stats grid grid-cols-2 md:grid-cols-4 gap-3 ${dashPrefs.compactStats ? 'max-w-3xl' : ''}`}>
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

                    {hasGeckos && user && !isGuestMode() && dashPrefs.showValues && <Suspense fallback={<div className="h-28 rounded-xl bg-slate-900 animate-pulse" aria-label="Loading value summaries" />}><HomeValues user={user} /></Suspense>}
                    {hasGeckos && user && <HomeCollection user={user} />}
                    </section>

                    <section id="home-community" aria-labelledby="home-community-title" className="space-y-5 home-section">
                        <div className="flex flex-wrap justify-between gap-3 items-center">
                            <div><h2 id="home-community-title" className="text-2xl font-semibold text-slate-100">Community</h2><p className="text-sm text-slate-300 mt-1">Keepers, photos, and conversations.</p></div>
                            <Link to="/Forum" className="text-sm text-emerald-300 underline touch:min-h-11 inline-flex items-center">Open Forum</Link>
                        </div>
                        {dashPrefs.showWelcomeShelf && <WelcomeShelf currentUser={user} />}
                    {/* MAIN CONTENT GRID, 3 columns on large screens */}
                    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
                        {/* Community activity */}
                        <div className="xl:col-span-4 space-y-6">
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

                        {/* Identification requests and breeders */}
                        <div className="xl:col-span-3 space-y-6">
                            {dashPrefs.showIdNeeds && <IdNeedsPanel currentUserEmail={user?.email} />}
                            {dashPrefs.showFeaturedBreeders && <FeaturedBreeders />}
                        </div>
                    </div>
                    </section>
                    <section id="home-breeding" aria-labelledby="home-breeding-title" className="space-y-5 home-section">
                        <h2 id="home-breeding-title" className="text-2xl font-semibold text-slate-100">Breeding & tools</h2>
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
                            {dashPrefs.showHatchery && <IncubatorTimeline email={email} />}

                            {dashPrefs.showHatchery && <Card className="gecko-card">
                                <CardContent className="p-5 space-y-4">
                                    <div className="flex items-center gap-2 text-gecko-text">
                                        <Egg className="w-5 h-5 text-amber-400" />
                                        <h3 className="font-semibold">Your Hatchery</h3>
                                    </div>
                                    <div>
                                        <p className="text-4xl font-bold text-white">
                                            {hatcheryStats.hatched.toLocaleString()}
                                        </p>
                                        <p className="text-xs text-slate-400 uppercase tracking-wider mt-1">
                                            Recorded hatches
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
                                                    className="touch:min-h-11 inline-flex items-center text-xs text-slate-300 hover:text-emerald-300 rounded-md px-2 py-1.5 hover:bg-slate-800/60 transition-colors"
                                                >
                                                    → {l.label}
                                                </Link>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                    </section>
                    <ReferralLinkCard />

                </div>
            </div>

            <Dialog open={showCustomize} onOpenChange={setShowCustomize}>
                <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
                    <DialogHeader><DialogTitle>Customize home</DialogTitle><DialogDescription>Choose what appears on your homepage. Preferences are saved on this device.</DialogDescription></DialogHeader>
                    <div className="space-y-1">
                        {[
                            ['showCommunityPulse', 'Community Pulse'], ['showLiveFeed', 'Community Live'],
                            ['showWelcomeShelf', 'New keepers'], ['showGeckoOfTheDay', 'Gecko of the Day'],
                            ['showIdNeeds', 'Help identify geckos'], ['showFeaturedBreeders', 'Featured breeders'],
                            ['showHatchery', 'Hatchery and incubator timeline'], ['showValues', 'Collection and season values'],
                            ['compactStats', 'Compact collection statistics'],
                        ].map(([key, label]) => <label key={key} className="flex items-center justify-between gap-4 py-3 text-sm text-slate-200">
                            {label}<Checkbox checked={Boolean(dashPrefs[key])} onCheckedChange={(checked) => updateDashPrefs({ [key]: checked === true })} />
                        </label>)}
                    </div>
                    <Button onClick={() => setShowCustomize(false)}>Done</Button>
                </DialogContent>
            </Dialog>
            {selectedImageData && (
                <Suspense fallback={<p role="status" className="text-center p-4">Opening photo…</p>}><ImageDetailModal
                    data={selectedImageData}
                    onClose={() => setSelectedImageData(null)}
                /></Suspense>
            )}
            <ChangeLogModal isOpen={showChangelog} onClose={() => setShowChangelog(false)} />
        </div>
    );
}
