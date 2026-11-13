import GeckoImage from '@/components/shared/GeckoImage';
import { DEFAULT_GECKO_IMAGE } from '@/lib/constants';
import { useState, useLayoutEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import BreedingTabRedirect from '@/components/breeding/BreedingTabRedirect';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    CalendarRange,
    CalendarDays,
    Heart,
    Egg as EggIcon,
    Sparkles,
    ArrowRight,
} from 'lucide-react';
import { format, addDays, getDayOfYear, getDaysInYear, differenceInCalendarDays } from 'date-fns';
import { parseLocalDate } from '@/lib/dateUtils';

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

const FALLBACK_PHOTO = DEFAULT_GECKO_IMAGE;

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

const FAILED_STATUSES = new Set(['Infertile', 'Slug', 'Failed', 'Stillbirth']);

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
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mt-1" style={{ fontVariantNumeric: 'tabular-nums' }}>
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

function PairRow({ plan, sire, dam, seasonEggs, year, today, onOpenPlan }) {
    const bars = useMemo(() => buildClutchBars(seasonEggs, year, today), [seasonEggs, year, today]);
    const locks = useMemo(() => lockTicks(plan, year), [plan, year]);

    const laid = seasonEggs.length;
    const hatched = seasonEggs.filter(e => e.status === 'Hatched').length;
    const incubating = seasonEggs.filter(e => e.status === 'Incubating').length;

    const todayInYear = today.getFullYear() === year;
    const lanes = Math.max(bars.length, 1);
    const height = ROW_PADDING * 2 + LOCK_RAIL_HEIGHT + lanes * CLUTCH_LANE_HEIGHT;

    return (
        <div className="flex flex-col md:flex-row md:items-stretch gap-2 md:gap-4 py-3 border-b border-slate-800 last:border-b-0">
            {/* Pair identity, opens the pair's plan card. On phones it
                sits above its timeline and stays pinned to the left edge
                while the timeline scrolls sideways. */}
            <button
                type="button"
                onClick={() => onOpenPlan?.(plan)}
                className="touch:min-h-11 sticky left-0 self-start max-w-[calc(100vw-4.5rem)] md:static md:self-auto md:w-56 flex-shrink-0 flex items-start gap-3 group pt-1 text-left"
                title="Open this pair's plan"
            >
                <div className="flex flex-shrink-0">
                    <GeckoImage
                        src={sire?.image_urls?.[0] || FALLBACK_PHOTO}
                        alt={sire?.name || 'Sire'}
                        className="w-9 h-9 rounded-full object-cover border-2 border-slate-700"
                        loading="lazy"
                        width={96}
                    />
                    <GeckoImage
                        src={dam?.image_urls?.[0] || FALLBACK_PHOTO}
                        alt={dam?.name || 'Dam'}
                        className="w-9 h-9 rounded-full object-cover border-2 border-slate-700 -ml-3"
                        loading="lazy"
                        width={96}
                    />
                </div>
                <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-200 truncate group-hover:text-emerald-400 transition-colors">
                        {sire?.name || 'Unknown sire'} x {dam?.name || 'Unknown dam'}
                    </div>
                    <CountStrip laid={laid} hatched={hatched} incubating={incubating} />
                </div>
            </button>

            {/* Year timeline: month bands, lock rail, one labelled bar per clutch */}
            <div className="md:flex-1 relative rounded-md overflow-hidden bg-slate-900/60" style={{ height }}>
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

/**
 * /BreedingSeason was a page of its own until November 2026, headed
 * "Breeding Season". It is now the "Season" tab of the Breeding page
 * (experience review, finding H5), so the old address only forwards
 * there. The timeline itself is SeasonTimeline below, which the Breeding
 * page loads when the tab opens.
 */
export default function BreedingSeasonRedirect() {
    return <BreedingTabRedirect tab="season" />;
}

/**
 * The "Season" tab of Breeding: every lock, clutch and hatch of a year on
 * one timeline, one row per pair.
 *
 * The Breeding page hands in the plans, eggs and geckos it has already
 * loaded, so the tab opens at once and always agrees with the Plans tab:
 *   onNewPlan   open the new-plan form (the empty state's button)
 *   onOpenPlan  (plan): show that pair's plan card on its tab
 */
export function SeasonTimeline({ plans = [], eggs = [], geckos = [], onNewPlan, onOpenPlan }) {
    const today = useMemo(() => new Date(), []);
    const [selectedYear, setSelectedYear] = useState(today.getFullYear());

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
                // An egg archived while still Incubating was deleted; it no
                // longer belongs on the timeline or in the "due" totals.
                if (e.archived && e.status === 'Incubating') return false;
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

    // On a phone the year timeline is wider than the screen and opened at
    // January, so late-season clutches sat out of view until you swiped.
    // Scroll it so today is centred when the current season is showing.
    const timelineScrollRef = useRef(null);
    const monthAxisRef = useRef(null);
    useLayoutEffect(() => {
        const scroller = timelineScrollRef.current;
        const axis = monthAxisRef.current;
        if (!scroller || !axis) return;
        if (scroller.scrollWidth <= scroller.clientWidth) return;
        if (selectedYear !== today.getFullYear()) {
            scroller.scrollLeft = 0;
            return;
        }
        const scrollerBox = scroller.getBoundingClientRect();
        const axisBox = axis.getBoundingClientRect();
        const axisStart = axisBox.left - scrollerBox.left + scroller.scrollLeft;
        const todayX = axisStart + yearFraction(today, selectedYear) * axisBox.width;
        scroller.scrollLeft = Math.max(0, todayX - scroller.clientWidth / 2);
    }, [selectedYear, today, seasonRows.length]);

    const seasonTotals = useMemo(() => {
        let laid = 0; let hatched = 0; let incubating = 0;
        for (const row of seasonRows) {
            laid += row.seasonEggs.length;
            hatched += row.seasonEggs.filter(e => e.status === 'Hatched').length;
            incubating += row.seasonEggs.filter(e => e.status === 'Incubating').length;
        }
        return { laid, hatched, incubating };
    }, [seasonRows]);

    return (
        <div>
                {/* The year picker, and the one way into the Season Planner.
                    The planner keeps its own page: it has five tabs of its
                    own, and a second tab bar inside this one would be a maze. */}
                <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                        <Select
                            value={String(selectedYear)}
                            onValueChange={(v) => setSelectedYear(parseInt(v, 10))}
                        >
                            <SelectTrigger aria-label="Season" className="w-full sm:w-44 bg-slate-900 border-slate-700 text-slate-200">
                                <SelectValue>{selectedYear} season</SelectValue>
                            </SelectTrigger>
                            <SelectContent className="bg-slate-800 border-slate-600 text-slate-200">
                                {availableYears.map(year => (
                                    <SelectItem key={year} value={String(year)}>{year} season</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <p className="text-sm text-slate-400">Every lock, clutch and hatch on one timeline.</p>
                    </div>
                    <Button asChild variant="outline" className="h-auto min-h-9 whitespace-normal py-2 text-left justify-start border-slate-600 hover:bg-slate-800">
                        <Link to={createPageUrl('ProjectManager')}>
                            <CalendarDays className="w-4 h-4" aria-hidden="true" />
                            <span>Open the Season Planner: tasks, feeding groups and notes</span>
                            <ArrowRight className="w-4 h-4 ml-auto md:ml-0" aria-hidden="true" />
                        </Link>
                    </Button>
                </div>

                {plans.length === 0 ? (
                    /* Empty state: no breeding plans at all */
                    <Card>
                        <CardContent className="p-8 md:p-12 text-center">
                            <Heart className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
                            <h2 className="text-xl font-bold text-slate-100 mb-2">Your season starts with a pairing</h2>
                            <p className="text-slate-400 max-w-md mx-auto">
                                Once you set up your first pair (maybe that Phantom x Lilly White
                                project you've been planning), every lock, clutch, and hatch will
                                show up here on one timeline.
                            </p>
                            <Button type="button" className="mt-4" onClick={() => onNewPlan?.()}>
                                Create your first pairing
                                <ArrowRight className="w-4 h-4 ml-2" />
                            </Button>
                        </CardContent>
                    </Card>
                ) : (
                    <Card>
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
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
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
                                        Pick another season above, or log a lock or clutch on the Plans tab.
                                    </p>
                                </div>
                            ) : (
                                <div ref={timelineScrollRef} className="overflow-x-auto">
                                    <div className="min-w-[640px] md:min-w-[760px]">
                                        {/* Month header, aligned with the pair rows below */}
                                        <div className="flex items-center gap-4 pb-1 border-b border-slate-700">
                                            <div className="hidden md:block w-56 flex-shrink-0" />
                                            <div ref={monthAxisRef} className="flex-1 grid grid-cols-12">
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
                                                onOpenPlan={onOpenPlan}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}
        </div>
    );
}
