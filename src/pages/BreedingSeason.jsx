import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import Seo from '@/components/seo/Seo';
import { BreedingPlan, Egg } from '@/entities/all';
import { api } from '@/api/appClient';
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
import { format, addDays, getDayOfYear, getDaysInYear, differenceInCalendarDays } from 'date-fns';
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

// Layout of one pair row. The timeline reads like a project roadmap (the
// style GitHub Projects and Linear use for their roadmap views): every
// clutch is a labelled bar that runs from the lay date to the hatch date,
// locks are thin ticks along the top rail, and today is a vertical rule.
// Bars are positioned as a fraction of the whole year, so a clutch laid on
// 28 March and hatched on 4 June is one continuous bar across three months.
const LOCK_RAIL_HEIGHT = 18;
const CLUTCH_LANE_HEIGHT = 30;
const ROW_PADDING = 8;

// Colour says outcome. A clutch is "hatched" when every egg hatched,
// "incubating" while any egg is still in the incubator, "failed" when
// every egg was infertile or a slug, and "mixed" for anything else.
const CLUTCH_STYLES = {
    hatched: 'bg-emerald-500/25 border-emerald-400/70 text-emerald-50',
    incubating: 'bg-amber-500/20 border-amber-400/70 text-amber-50',
    failed: 'bg-rose-500/15 border-rose-400/50 text-rose-100',
    mixed: 'bg-slate-600/40 border-slate-400/60 text-slate-100',
};

const FAILED_STATUSES = new Set(['Infertile', 'Slug', 'Failed']);

// Position of a date across the selected year, 0 = 1 January, 1 = 31 December.
// Dates outside the year clamp to the edge so a clutch laid in December and
// hatched in February still draws to the year boundary.
function yearFraction(date, year) {
    if (!date) return 0;
    if (date.getFullYear() < year) return 0;
    if (date.getFullYear() > year) return 1;
    const days = getDaysInYear(new Date(year, 0, 1));
    return (getDayOfYear(date) - 1) / days;
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

// One bar per clutch, oldest first, with the outcome that decides its colour
// and the label text drawn inside it.
function buildClutchBars(eggs, year, today) {
    return groupClutches(eggs)
        .map(({ layDate, eggs: clutchEggs }) => {
            const lay = parseLocalDate(layDate);
            if (!lay) return null;
            let end = null;
            for (const egg of clutchEggs) {
                const e = eggEndDate(egg, lay);
                if (e && (!end || e > end)) end = e;
            }
            if (!end || end < lay) end = addDays(lay, INCUBATION_FALLBACK_DAYS);

            const count = clutchEggs.length;
            const hatched = clutchEggs.filter(e => e.status === 'Hatched').length;
            const incubating = clutchEggs.filter(e => e.status === 'Incubating').length;
            const failed = clutchEggs.filter(e => FAILED_STATUSES.has(e.status)).length;
            const outcome = hatched === count ? 'hatched'
                : incubating > 0 ? 'incubating'
                : failed === count ? 'failed'
                : 'mixed';

            const daysLeft = outcome === 'incubating' ? differenceInCalendarDays(end, today) : null;
            const endLabel = outcome === 'hatched' ? `hatched ${format(end, 'MMM d')}`
                : outcome === 'incubating'
                    ? (daysLeft > 0 ? `due ${format(end, 'MMM d')}, ${daysLeft}d` : `due ${format(end, 'MMM d')}`)
                : outcome === 'failed' ? (failed === 1 ? 'infertile' : `${failed} infertile`)
                : `${hatched} of ${count} hatched`;

            return {
                key: layDate,
                lay,
                end,
                count,
                hatched,
                incubating,
                failed,
                outcome,
                left: yearFraction(lay, year),
                right: yearFraction(end, year),
                label: `${count} ${count === 1 ? 'egg' : 'eggs'}`,
                layLabel: `laid ${format(lay, 'MMM d')}`,
                endLabel,
                title: `Clutch laid ${format(lay, 'MMM d, yyyy')}: ${count} ${count === 1 ? 'egg' : 'eggs'}, ${hatched} hatched, ${incubating} incubating${failed ? `, ${failed} infertile or slug` : ''}. ${outcome === 'hatched' ? 'Last hatch' : 'Expected hatch'} ${format(end, 'MMM d')}.`,
            };
        })
        .filter(Boolean)
        .sort((a, b) => a.lay - b.lay);
}

function lockTicks(plan, year) {
    return (plan.copulation_events || [])
        .map((event) => parseLocalDate(event.date))
        .filter((d) => d && d.getFullYear() === year)
        .map((d) => ({ key: d.toISOString(), frac: yearFraction(d, year), label: `Lock observed ${format(d, 'MMM d')}` }));
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

// The three numbers that matter for a pair this season, set as figures with
// small labels instead of three coloured badges fighting for attention.
function CountStrip({ laid, hatched, incubating }) {
    const rate = laid > 0 ? Math.round((hatched / laid) * 100) : null;
    const items = [
        { value: laid, label: 'laid', tone: 'text-slate-100' },
        { value: hatched, label: 'hatched', tone: 'text-emerald-300' },
        { value: incubating, label: 'incubating', tone: 'text-amber-300' },
    ];
    return (
        <div className="flex items-baseline gap-3 mt-1" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {items.map((it) => (
                <div key={it.label} className="leading-none">
                    <span className={`text-sm font-semibold ${it.tone}`}>{it.value}</span>
                    <span className="ml-1 text-[10px] uppercase tracking-wide text-slate-500">{it.label}</span>
                </div>
            ))}
            {rate !== null && laid > 0 && hatched > 0 && (
                <span className="text-[10px] text-slate-500 leading-none">{rate}% hatch rate</span>
            )}
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
            <Skeleton className="h-14 flex-1 bg-slate-800" />
        </div>
    );
}

function PairRow({ plan, sire, dam, seasonEggs, year, today }) {
    const bars = useMemo(() => buildClutchBars(seasonEggs, year, today), [seasonEggs, year, today]);
    const locks = useMemo(() => lockTicks(plan, year), [plan, year]);

    const laid = seasonEggs.length;
    const hatched = seasonEggs.filter(e => e.status === 'Hatched').length;
    const incubating = seasonEggs.filter(e => e.status === 'Incubating').length;

    const todayInYear = today.getFullYear() === year;
    const lanes = Math.max(bars.length, 1);
    const height = ROW_PADDING * 2 + LOCK_RAIL_HEIGHT + lanes * CLUTCH_LANE_HEIGHT;

    return (
        <div className="flex items-stretch gap-4 py-3 border-b border-slate-800 last:border-b-0">
            {/* Pair identity, links back to the Breeding page */}
            <Link
                to={createPageUrl('Breeding')}
                className="w-44 sm:w-56 flex-shrink-0 flex items-start gap-3 group pt-1"
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
                    <CountStrip laid={laid} hatched={hatched} incubating={incubating} />
                </div>
            </Link>

            {/* Year timeline: month bands, lock rail, one labelled bar per clutch */}
            <div className="flex-1 relative rounded-md overflow-hidden bg-slate-900/60" style={{ height }}>
                {MONTH_LABELS.map((label, mi) => (
                    <div
                        key={label}
                        className={`absolute top-0 bottom-0 border-l border-slate-800 first:border-l-0 ${mi % 2 ? 'bg-slate-800/20' : ''}`}
                        style={{ left: `${(mi / 12) * 100}%`, width: `${100 / 12}%` }}
                    />
                ))}

                {/* Lock rail */}
                {locks.map((lock) => (
                    <div
                        key={lock.key}
                        title={lock.label}
                        className="absolute w-0.5 rounded-full bg-sky-400"
                        style={{ left: `${lock.frac * 100}%`, top: ROW_PADDING, height: LOCK_RAIL_HEIGHT - 6 }}
                    />
                ))}

                {bars.length === 0 && (
                    <div
                        className="absolute inset-x-3 flex items-center text-[11px] text-slate-500"
                        style={{ top: ROW_PADDING + LOCK_RAIL_HEIGHT, height: CLUTCH_LANE_HEIGHT }}
                    >
                        {locks.length > 0 ? 'Locks recorded, no clutch yet' : `No clutches recorded in ${year}`}
                    </div>
                )}

                {bars.map((bar, i) => {
                    const widthPct = Math.max((bar.right - bar.left) * 100, 1.5);
                    const wide = widthPct >= 14;
                    const roomRight = bar.right < 0.8;
                    return (
                        <div
                            key={bar.key}
                            className="absolute flex items-center"
                            style={{
                                top: ROW_PADDING + LOCK_RAIL_HEIGHT + i * CLUTCH_LANE_HEIGHT,
                                height: CLUTCH_LANE_HEIGHT,
                                left: `${bar.left * 100}%`,
                                width: `${widthPct}%`,
                            }}
                        >
                            <div
                                title={bar.title}
                                className={`h-[22px] w-full rounded-md border px-2 flex items-center gap-1.5 text-[11px] whitespace-nowrap overflow-hidden ${CLUTCH_STYLES[bar.outcome]}`}
                            >
                                <EggIcon className="w-3 h-3 shrink-0 opacity-90" />
                                <span className="font-semibold">{bar.label}</span>
                                {wide && <span className="opacity-80">{bar.layLabel}</span>}
                                {wide && <span className="ml-auto opacity-90">{bar.endLabel}</span>}
                            </div>
                            {!wide && roomRight && (
                                <span className="absolute left-full ml-1.5 text-[11px] text-slate-400 whitespace-nowrap">
                                    {bar.layLabel}, {bar.endLabel}
                                </span>
                            )}
                        </div>
                    );
                })}

                {todayInYear && (
                    <div
                        className="absolute top-0 bottom-0 w-px bg-emerald-400/80"
                        style={{ left: `${yearFraction(today, year) * 100}%` }}
                        title={`Today, ${format(today, 'MMM d')}`}
                    />
                )}
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
                const currentUser = await api.auth.me();
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
                                    <LegendItem swatch={<span className="w-0.5 h-3 rounded-full bg-sky-400 inline-block" />} label="Lock" />
                                    <LegendItem swatch={<span className="w-5 h-2.5 rounded-sm bg-amber-500/30 border border-amber-400/70 inline-block" />} label="Incubating" />
                                    <LegendItem swatch={<span className="w-5 h-2.5 rounded-sm bg-emerald-500/30 border border-emerald-400/70 inline-block" />} label="Hatched" />
                                    <LegendItem swatch={<span className="w-5 h-2.5 rounded-sm bg-rose-500/20 border border-rose-400/50 inline-block" />} label="Infertile or slug" />
                                    <LegendItem swatch={<span className="w-px h-3 bg-emerald-400/80 inline-block" />} label="Today" />
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
