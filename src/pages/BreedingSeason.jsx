import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import Seo from '@/components/seo/Seo';
import { BreedingPlan, Egg } from '@/entities/all';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import {
    CalendarRange,
    Heart,
    Egg as EggIcon,
    Sparkles,
    ArrowRight,
} from 'lucide-react';
import { format, addDays, getDaysInMonth } from 'date-fns';
import { parseLocalDate } from '@/lib/dateUtils';
import LoadingSpinner from '@/components/shared/LoadingSpinner';

const LoginPortal = React.lazy(() => import('../components/auth/LoginPortal'));

// Season model (v1, intentionally simple): a "season" is a calendar year.
// Crested gecko breeding activity in most collections runs roughly
// November through October, so a Nov-anchored season would be slightly
// more biologically accurate. For v1 we group every event (copulation,
// lay, hatch) by the calendar year it happened in, which matches how
// people talk about "the 2026 season" and avoids edge-case confusion in
// the month grid. Revisit if users ask for a Nov-Oct window.

// Typical crested gecko incubation at room temperature runs 60 to 90
// days. When an egg has no hatch_date_expected we assume the midpoint.
const INCUBATION_FALLBACK_DAYS = 75;

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const FALLBACK_PHOTO = 'https://i.imgur.com/sw9gnDp.png';

// Vertical lanes inside each pair row so same-day markers don't overlap:
// copulations ride high, lays in the middle, hatches low.
const LANE_TOP = { copulation: '25%', lay: '50%', expected: '75%', hatch: '75%' };

const MARKER_STYLES = {
    copulation: 'bg-blue-400 border border-blue-200/60',
    lay: 'bg-amber-400 border border-amber-200/60',
    expected: 'bg-transparent border-2 border-slate-300/80',
    hatch: 'bg-emerald-400 border border-emerald-200/60',
};

// Fractional position of a date within its month, 0 = first day, ~1 = last.
function dayFraction(date) {
    return (date.getDate() - 1) / getDaysInMonth(date);
}

// Group a plan's eggs into clutches by shared lay_date.
function groupClutches(eggs) {
    const byDate = new Map();
    for (const egg of eggs) {
        if (!egg.lay_date) continue;
        if (!byDate.has(egg.lay_date)) byDate.set(egg.lay_date, []);
        byDate.get(egg.lay_date).push(egg);
    }
    return [...byDate.entries()].map(([layDate, clutchEggs]) => ({ layDate, eggs: clutchEggs }));
}

// The date a given egg's incubation visually ends on the timeline.
function eggEndDate(egg, layDate) {
    if (egg.hatch_date_actual) return parseLocalDate(egg.hatch_date_actual);
    if (egg.hatch_date_expected) return parseLocalDate(egg.hatch_date_expected);
    return addDays(layDate, INCUBATION_FALLBACK_DAYS);
}

// Builds a 12-slot array (one per month of `year`), each slot holding the
// incubation band segments and event markers that fall inside that month.
function buildPairTimeline(plan, eggs, year) {
    const months = Array.from({ length: 12 }, () => ({ bands: [], markers: [] }));
    const inYear = (d) => d && d.getFullYear() === year;

    const pushMarker = (date, marker) => {
        if (inYear(date)) {
            months[date.getMonth()].markers.push({ ...marker, frac: dayFraction(date) });
        }
    };

    for (const event of plan.copulation_events || []) {
        const d = parseLocalDate(event.date);
        if (d) pushMarker(d, { type: 'copulation', label: `Lock observed ${format(d, 'MMM d')}` });
    }

    for (const clutch of groupClutches(eggs)) {
        const lay = parseLocalDate(clutch.layDate);
        if (!lay) continue;

        let end = null;
        for (const egg of clutch.eggs) {
            const e = eggEndDate(egg, lay);
            if (e && (!end || e > end)) end = e;
        }

        const count = clutch.eggs.length;
        pushMarker(lay, {
            type: 'lay',
            label: `Clutch laid ${format(lay, 'MMM d')} (${count} egg${count !== 1 ? 's' : ''})`,
        });

        // Slate incubation band from lay to expected/actual hatch, clipped
        // to the selected year and split into per-month segments.
        if (end && end > lay) {
            const yearStart = new Date(year, 0, 1);
            const yearEnd = new Date(year, 11, 31);
            const bandStart = lay < yearStart ? yearStart : lay;
            const bandEnd = end > yearEnd ? yearEnd : end;
            if (bandStart <= bandEnd && inYear(bandStart) && inYear(bandEnd)) {
                for (let m = bandStart.getMonth(); m <= bandEnd.getMonth(); m++) {
                    const left = m === bandStart.getMonth() ? dayFraction(bandStart) : 0;
                    const right = m === bandEnd.getMonth() ? dayFraction(bandEnd) : 1;
                    months[m].bands.push({ left, width: Math.max(right - left, 0.04) });
                }
            }
        }

        if (end && clutch.eggs.some(e => e.status === 'Incubating')) {
            pushMarker(end, { type: 'expected', label: `Expected hatch around ${format(end, 'MMM d')}` });
        }

        for (const egg of clutch.eggs) {
            if (egg.status === 'Hatched' && egg.hatch_date_actual) {
                const hd = parseLocalDate(egg.hatch_date_actual);
                if (hd) pushMarker(hd, { type: 'hatch', label: `Hatched ${format(hd, 'MMM d')}` });
            }
        }
    }

    return months;
}

// Every calendar year this plan (or its eggs) has activity in.
function planActivityYears(plan, eggs) {
    const years = new Set();
    const add = (dateString) => {
        const d = parseLocalDate(dateString);
        if (d && !isNaN(d.getTime())) years.add(d.getFullYear());
    };
    add(plan.pairing_date);
    for (const event of plan.copulation_events || []) add(event.date);
    for (const egg of eggs) {
        add(egg.lay_date);
        add(egg.hatch_date_actual);
    }
    return years;
}

function LegendItem({ swatch, label }) {
    return (
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
            {swatch}
            <span>{label}</span>
        </div>
    );
}

function PairRowSkeleton() {
    return (
        <div className="flex items-center gap-4 py-3 border-b border-slate-800">
            <div className="w-44 sm:w-56 flex items-center gap-3 flex-shrink-0">
                <Skeleton className="w-9 h-9 rounded-full bg-slate-800" />
                <Skeleton className="w-9 h-9 rounded-full bg-slate-800 -ml-5" />
                <div className="space-y-1.5 flex-1">
                    <Skeleton className="h-3.5 w-28 bg-slate-800" />
                    <Skeleton className="h-3 w-20 bg-slate-800" />
                </div>
            </div>
            <Skeleton className="h-10 flex-1 bg-slate-800" />
        </div>
    );
}

function PairRow({ plan, sire, dam, seasonEggs, year, today }) {
    const months = useMemo(() => buildPairTimeline(plan, seasonEggs, year), [plan, seasonEggs, year]);

    const laid = seasonEggs.length;
    const hatched = seasonEggs.filter(e => e.status === 'Hatched').length;
    const incubating = seasonEggs.filter(e => e.status === 'Incubating').length;

    const todayInYear = today.getFullYear() === year;

    return (
        <div className="flex items-stretch gap-4 py-3 border-b border-slate-800 last:border-b-0">
            {/* Pair identity, links back to the Breeding page */}
            <Link
                to={createPageUrl('Breeding')}
                className="w-44 sm:w-56 flex-shrink-0 flex items-center gap-3 group"
                title="Open Breeding Management"
            >
                <div className="flex flex-shrink-0">
                    <img
                        src={sire?.image_urls?.[0] || FALLBACK_PHOTO}
                        alt={sire?.name || 'Sire'}
                        className="w-9 h-9 rounded-full object-cover border-2 border-slate-700"
                        loading="lazy"
                    />
                    <img
                        src={dam?.image_urls?.[0] || FALLBACK_PHOTO}
                        alt={dam?.name || 'Dam'}
                        className="w-9 h-9 rounded-full object-cover border-2 border-slate-700 -ml-3"
                        loading="lazy"
                    />
                </div>
                <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-200 truncate group-hover:text-emerald-400 transition-colors">
                        {sire?.name || 'Unknown sire'} x {dam?.name || 'Unknown dam'}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <Badge variant="outline" className="border-amber-700/60 text-amber-400 text-[10px] px-1.5 py-0">
                            {laid} laid
                        </Badge>
                        <Badge variant="outline" className="border-slate-600 text-slate-400 text-[10px] px-1.5 py-0">
                            {incubating} incubating
                        </Badge>
                        <Badge variant="outline" className="border-emerald-700/60 text-emerald-400 text-[10px] px-1.5 py-0">
                            {hatched} hatched
                        </Badge>
                    </div>
                </div>
            </Link>

            {/* Month grid timeline */}
            <div className="flex-1 grid grid-cols-12 rounded-md overflow-hidden bg-slate-900/60">
                {months.map((month, mi) => (
                    <div key={mi} className="relative h-14 border-l border-slate-800 first:border-l-0">
                        {month.bands.map((band, bi) => (
                            <div
                                key={bi}
                                className="absolute top-2 bottom-2 bg-slate-700/50 rounded-sm"
                                style={{ left: `${band.left * 100}%`, width: `${band.width * 100}%` }}
                            />
                        ))}
                        {todayInYear && today.getMonth() === mi && (
                            <div
                                className="absolute top-0 bottom-0 w-px bg-emerald-500/60"
                                style={{ left: `${dayFraction(today) * 100}%` }}
                            />
                        )}
                        {month.markers.map((marker, ki) => (
                            <div
                                key={ki}
                                title={marker.label}
                                className={`absolute w-2.5 h-2.5 rounded-full -translate-x-1/2 -translate-y-1/2 ${MARKER_STYLES[marker.type]}`}
                                style={{ left: `${marker.frac * 100}%`, top: LANE_TOP[marker.type] }}
                            />
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
}

export default function BreedingSeasonPage() {
    const { toast } = useToast();
    const [user, setUser] = useState(null);
    const [authChecked, setAuthChecked] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [plans, setPlans] = useState([]);
    const [eggs, setEggs] = useState([]);
    const [geckos, setGeckos] = useState([]);
    const today = useMemo(() => new Date(), []);
    const [selectedYear, setSelectedYear] = useState(today.getFullYear());

    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            try {
                const currentUser = await base44.auth.me();
                setUser(currentUser);
                setAuthChecked(true);
                if (!currentUser) {
                    setIsLoading(false);
                    return;
                }
                const { getVisibleGeckos } = await import('@/lib/geckoAccess');
                const [geckosData, plansData, eggsData] = await Promise.all([
                    getVisibleGeckos(currentUser),
                    BreedingPlan.filter({ created_by: currentUser.email }, '-created_date'),
                    Egg.filter({ created_by: currentUser.email }),
                ]);
                setGeckos(geckosData);
                setPlans(plansData);
                setEggs(eggsData);
            } catch (error) {
                console.error('Failed to load breeding season data:', error);
                setAuthChecked(true);
                toast({
                    title: 'Could not load your season',
                    description: 'Something went wrong fetching your breeding data. Please try again.',
                    variant: 'destructive',
                });
            }
            setIsLoading(false);
        };
        loadData();
    }, []);

    const eggsByPlan = useMemo(() => {
        const map = new Map();
        for (const egg of eggs) {
            if (!map.has(egg.breeding_plan_id)) map.set(egg.breeding_plan_id, []);
            map.get(egg.breeding_plan_id).push(egg);
        }
        return map;
    }, [eggs]);

    // Every year with recorded activity, newest first. The current year is
    // always offered so a fresh season starts selectable from day one.
    const availableYears = useMemo(() => {
        const years = new Set([today.getFullYear()]);
        for (const plan of plans) {
            for (const y of planActivityYears(plan, eggsByPlan.get(plan.id) || [])) {
                years.add(y);
            }
        }
        return [...years].sort((a, b) => b - a);
    }, [plans, eggsByPlan, today]);

    // Pairs shown for the selected season: any pair with activity that
    // year, plus all non-archived pairs when viewing the current year
    // (so a freshly created pairing shows up before its first lock).
    const seasonRows = useMemo(() => {
        const rows = [];
        for (const plan of plans) {
            const planEggs = eggsByPlan.get(plan.id) || [];
            const hasActivity = planActivityYears(plan, planEggs).has(selectedYear);
            const isCurrentSeasonActivePair = selectedYear === today.getFullYear() && !plan.archived;
            if (!hasActivity && !isCurrentSeasonActivePair) continue;

            const seasonEggs = planEggs.filter(e => {
                const d = parseLocalDate(e.lay_date);
                return d && d.getFullYear() === selectedYear;
            });
            rows.push({
                plan,
                sire: geckos.find(g => g.id === plan.sire_id),
                dam: geckos.find(g => g.id === plan.dam_id),
                seasonEggs,
            });
        }
        // Most productive pairs first, then alphabetical by sire name.
        rows.sort((a, b) =>
            (b.seasonEggs.length - a.seasonEggs.length) ||
            (a.sire?.name || '').localeCompare(b.sire?.name || '')
        );
        return rows;
    }, [plans, eggsByPlan, geckos, selectedYear, today]);

    const seasonTotals = useMemo(() => {
        let laid = 0; let hatched = 0; let incubating = 0;
        for (const row of seasonRows) {
            laid += row.seasonEggs.length;
            hatched += row.seasonEggs.filter(e => e.status === 'Hatched').length;
            incubating += row.seasonEggs.filter(e => e.status === 'Incubating').length;
        }
        return { laid, hatched, incubating };
    }, [seasonRows]);

    if (authChecked && !user) {
        return (
            <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center"><LoadingSpinner /></div>}>
                <LoginPortal requiredFeature="Breeding Season Timeline" />
            </Suspense>
        );
    }

    return (
        <div className="p-4 md:p-8 bg-slate-950 min-h-screen">
            <Seo
                title="Breeding Season"
                description="See your whole crested gecko breeding season on one timeline: locks, clutches, incubation, and hatches for every pair."
                path="/BreedingSeason"
                noIndex
                keywords={['breeding season', 'gecko breeding timeline', 'hatch tracker']}
            />
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                    <div>
                        <h1 className="text-2xl md:text-4xl font-bold text-slate-100 flex items-center gap-3">
                            <CalendarRange className="w-8 h-8 md:w-10 md:h-10 text-emerald-500" />
                            Breeding Season
                        </h1>
                        <p className="text-slate-400 mt-2 text-sm md:text-base">
                            Your whole season on one timeline: every lock, clutch, and hatch.
                        </p>
                    </div>
                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <Select
                            value={String(selectedYear)}
                            onValueChange={(v) => setSelectedYear(parseInt(v, 10))}
                        >
                            <SelectTrigger className="w-full md:w-44 bg-slate-900 border-slate-700 text-slate-200">
                                <SelectValue>{selectedYear} season</SelectValue>
                            </SelectTrigger>
                            <SelectContent className="bg-slate-800 border-slate-600 text-slate-200">
                                {availableYears.map(year => (
                                    <SelectItem key={year} value={String(year)}>{year} season</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {isLoading ? (
                    <Card className="bg-slate-900 border-slate-700">
                        <CardContent className="p-4 md:p-6">
                            <Skeleton className="h-5 w-64 bg-slate-800 mb-6" />
                            <PairRowSkeleton />
                            <PairRowSkeleton />
                            <PairRowSkeleton />
                        </CardContent>
                    </Card>
                ) : plans.length === 0 ? (
                    /* Empty state: no breeding plans at all */
                    <Card className="bg-slate-900 border-slate-700">
                        <CardContent className="p-8 md:p-12 text-center">
                            <Heart className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
                            <h2 className="text-xl font-bold text-slate-100 mb-2">Your season starts with a pairing</h2>
                            <p className="text-slate-400 max-w-md mx-auto mb-6">
                                Once you set up your first pair (maybe that Phantom x Lilly White
                                project you've been planning), every lock, clutch, and hatch will
                                show up here on one timeline.
                            </p>
                            <Link to={createPageUrl('Breeding')}>
                                <Button>
                                    Create your first pairing
                                    <ArrowRight className="w-4 h-4 ml-2" />
                                </Button>
                            </Link>
                        </CardContent>
                    </Card>
                ) : (
                    <Card className="bg-slate-900 border-slate-700">
                        <CardContent className="p-4 md:p-6">
                            {/* Season summary + legend */}
                            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-4">
                                <div className="flex items-center gap-2 text-sm text-slate-300 flex-wrap">
                                    <Badge className="bg-slate-800 text-slate-300 border border-slate-700">
                                        {seasonRows.length} pair{seasonRows.length !== 1 ? 's' : ''}
                                    </Badge>
                                    <Badge className="bg-amber-900/40 text-amber-300 border border-amber-800/60">
                                        <EggIcon className="w-3 h-3 mr-1" /> {seasonTotals.laid} laid
                                    </Badge>
                                    <Badge className="bg-slate-800 text-slate-300 border border-slate-700">
                                        {seasonTotals.incubating} incubating
                                    </Badge>
                                    <Badge className="bg-emerald-900/40 text-emerald-300 border border-emerald-800/60">
                                        <Sparkles className="w-3 h-3 mr-1" /> {seasonTotals.hatched} hatched
                                    </Badge>
                                </div>
                                <div className="flex items-center gap-4 flex-wrap">
                                    <LegendItem swatch={<span className="w-2.5 h-2.5 rounded-full bg-blue-400 inline-block" />} label="Lock" />
                                    <LegendItem swatch={<span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />} label="Clutch laid" />
                                    <LegendItem swatch={<span className="w-5 h-2.5 rounded-sm bg-slate-700 inline-block" />} label="Incubating" />
                                    <LegendItem swatch={<span className="w-2.5 h-2.5 rounded-full border-2 border-slate-300/80 inline-block" />} label="Expected hatch" />
                                    <LegendItem swatch={<span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" />} label="Hatched" />
                                </div>
                            </div>

                            {seasonRows.length === 0 ? (
                                <div className="text-center py-12">
                                    <CalendarRange className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                                    <p className="text-slate-400">
                                        No breeding activity recorded for the {selectedYear} season.
                                    </p>
                                    <p className="text-slate-500 text-sm mt-1">
                                        Pick another season above, or log a lock or clutch from the Breeding page.
                                    </p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <div className="min-w-[760px]">
                                        {/* Month header, aligned with the pair rows below */}
                                        <div className="flex items-center gap-4 pb-1 border-b border-slate-700">
                                            <div className="w-44 sm:w-56 flex-shrink-0" />
                                            <div className="flex-1 grid grid-cols-12">
                                                {MONTH_LABELS.map(label => (
                                                    <div key={label} className="text-[10px] uppercase tracking-wide text-slate-500 text-center">
                                                        {label}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                        {seasonRows.map(row => (
                                            <PairRow
                                                key={row.plan.id}
                                                plan={row.plan}
                                                sire={row.sire}
                                                dam={row.dam}
                                                seasonEggs={row.seasonEggs}
                                                year={selectedYear}
                                                today={today}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}
