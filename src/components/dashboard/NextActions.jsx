import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Gecko, Egg, BreedingPlan, WeightRecord, FutureBreedingPlan } from '@/entities/all';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Scale, EggIcon, Calendar, Target, ChevronRight, CheckCircle2, Sparkles } from 'lucide-react';
import { differenceInDays, format } from 'date-fns';
import { SEASON_LABELS, seasonStatus } from '@/lib/seasons';

/**
 * "Your Next Actions" widget — a personal todo-shaped list of things
 * the user should do soon, pulled from their actual data:
 *
 *   - Eggs due to hatch in the next 14 days (Incubating status + lay_date
 *     + 65–90 day incubation window)
 *   - Geckos that haven't been weighed in the last 30 days
 *   - Future breeding plans whose target season is "Ready now"
 *   - Active breeding plans with no recorded activity in 30+ days (stale)
 *
 * The whole thing is skippable — if there's nothing to do it renders
 * a celebration state instead of empty space. That's the spot where
 * the dashboard feels "alive" instead of static.
 */

const Scale2 = Scale; // kept for tree-shaking clarity

function buildActions({ geckos, eggs, plans, weights, futurePlans }) {
    const actions = [];
    const now = new Date();

    // 1. Eggs in the hatch window
    const incubating = (eggs || []).filter((e) => e.status === 'Incubating' && !e.archived && e.lay_date);
    for (const egg of incubating) {
        const laid = new Date(egg.lay_date);
        const daysIn = differenceInDays(now, laid);
        // crested gecko eggs hatch ~65–90 days after lay
        if (daysIn >= 60 && daysIn <= 100) {
            const daysUntilLikely = Math.max(0, 75 - daysIn);
            actions.push({
                id: `egg-${egg.id}`,
                icon: EggIcon,
                iconTint: 'text-amber-400',
                label: daysUntilLikely === 0
                    ? `An egg is due to hatch any day now`
                    : `Egg likely to hatch in ~${daysUntilLikely} day${daysUntilLikely === 1 ? '' : 's'}`,
                detail: `Laid ${format(laid, 'MMM d')} · ${daysIn} days in incubation`,
                href: '/Breeding',
                priority: daysUntilLikely <= 2 ? 0 : 1,
            });
        }
    }

    // 2. Geckos without a recent weight
    const weightByGecko = new Map();
    for (const w of weights || []) {
        if (!w.gecko_id || !w.record_date) continue;
        const existing = weightByGecko.get(w.gecko_id);
        const t = new Date(w.record_date).getTime();
        if (!existing || existing < t) weightByGecko.set(w.gecko_id, t);
    }
    const staleWeightGeckos = (geckos || [])
        .filter((g) => !g.archived && g.status !== 'Sold')
        .filter((g) => {
            const last = weightByGecko.get(g.id);
            if (!last) return true;
            return differenceInDays(now, new Date(last)) >= 30;
        });
    if (staleWeightGeckos.length > 0) {
        actions.push({
            id: 'weight-check',
            icon: Scale2,
            iconTint: 'text-blue-400',
            label:
                staleWeightGeckos.length === 1
                    ? `Weigh ${staleWeightGeckos[0].name}`
                    : `Weigh ${staleWeightGeckos.length} geckos overdue for a check`,
            detail: 'No weight recorded in 30+ days',
            href: '/MyGeckos',
            priority: 2,
        });
    }

    // 3. Future breeding plans whose target season is now
    for (const plan of futurePlans || []) {
        if (plan.notified) continue;
        const status = seasonStatus(plan.target_season, plan.target_year);
        if (status === 'active' || status === 'past') {
            actions.push({
                id: `future-${plan.id}`,
                icon: Target,
                iconTint: 'text-emerald-400',
                label: `Breeding plan ready: ${SEASON_LABELS[plan.target_season]} ${plan.target_year}`,
                detail: plan.goals || 'Open Season Planner to kick it off',
                href: '/ProjectManager',
                priority: 0,
            });
        }
    }

    // 4. Stale active breeding plans
    for (const plan of plans || []) {
        if (plan.archived || plan.status === 'Archived') continue;
        const lastTouch = new Date(plan.updated_date || plan.created_date || 0);
        if (differenceInDays(now, lastTouch) >= 30) {
            actions.push({
                id: `stale-plan-${plan.id}`,
                icon: Calendar,
                iconTint: 'text-rose-400',
                label: `Check in on breeding plan "${plan.breeding_id || 'untitled'}"`,
                detail: `No updates in ${differenceInDays(now, lastTouch)} days`,
                href: '/Breeding',
                priority: 3,
            });
        }
    }

    actions.sort((a, b) => a.priority - b.priority);
    return actions.slice(0, 6);
}

export default function NextActions({ currentUserEmail }) {
    const [isLoading, setIsLoading] = useState(true);
    const [data, setData] = useState(null);

    useEffect(() => {
        if (!currentUserEmail) {
            setIsLoading(false);
            return;
        }
        (async () => {
            setIsLoading(true);
            try {
                const [geckos, eggs, plans, weights, futurePlans] = await Promise.all([
                    Gecko.filter({ created_by: currentUserEmail }).catch(() => []),
                    Egg.filter({ created_by: currentUserEmail }).catch(() => []),
                    BreedingPlan.filter({ created_by: currentUserEmail }).catch(() => []),
                    WeightRecord.filter({ created_by: currentUserEmail }).catch(() => []),
                    FutureBreedingPlan.filter({ created_by: currentUserEmail }).catch(() => []),
                ]);
                setData({ geckos, eggs, plans, weights, futurePlans });
            } catch (err) {
                console.error('NextActions load failed:', err);
            }
            setIsLoading(false);
        })();
    }, [currentUserEmail]);

    const actions = useMemo(() => (data ? buildActions(data) : []), [data]);

    if (!currentUserEmail) return null;

    return (
        <Card className="gecko-card">
            <CardHeader>
                <CardTitle className="text-gecko-text text-glow flex items-center gap-2">
                    <Target className="w-5 h-5 text-gecko-accent" />
                    Your Next Actions
                </CardTitle>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="space-y-2">
                        {[...Array(3)].map((_, i) => (
                            <div
                                key={i}
                                className="h-12 rounded-lg bg-slate-800/40 border border-slate-800 animate-pulse"
                            />
                        ))}
                    </div>
                ) : actions.length === 0 ? (
                    <div className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-900/20 p-4">
                        <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
                        <div>
                            <p className="text-sm font-semibold text-emerald-200">All caught up!</p>
                            <p className="text-xs text-emerald-300/80">
                                No overdue check-ins or ready breedings. Nice work.
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {actions.map((a) => {
                            const Icon = a.icon;
                            return (
                                <Link
                                    key={a.id}
                                    to={a.href}
                                    className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-800/40 hover:bg-slate-800 hover:border-emerald-500/40 px-3 py-2.5 transition-colors group"
                                >
                                    <Icon className={`w-4 h-4 shrink-0 ${a.iconTint}`} />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-slate-100 truncate">
                                            {a.label}
                                        </p>
                                        <p className="text-[11px] text-slate-500 truncate">{a.detail}</p>
                                    </div>
                                    <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-emerald-400 shrink-0" />
                                </Link>
                            );
                        })}
                    </div>
                )}
                {actions.length > 0 && (
                    <p className="text-[10px] text-slate-500 mt-3 flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />
                        Calculated from your collection, eggs, weights, and breeding plans.
                    </p>
                )}
            </CardContent>
        </Card>
    );
}
