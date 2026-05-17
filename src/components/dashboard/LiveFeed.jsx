import { useEffect, useMemo, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { formatDistanceToNowStrict } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/lib/supabaseClient';
import { Camera, MessageSquare, GitBranch, UserPlus, Activity, Heart, Sparkles, Flame, Egg } from 'lucide-react';
import { createPageUrl } from '@/utils';

const POLL_MS = 30000;

const TYPE_META = {
    upload:         { icon: Camera,        tint: 'text-amber-400',   bg: 'bg-amber-500/10 border-amber-500/20' },
    forum_post:     { icon: MessageSquare, tint: 'text-violet-300',  bg: 'bg-violet-500/10 border-violet-500/20' },
    breeding_plan:  { icon: GitBranch,     tint: 'text-pink-300',    bg: 'bg-pink-500/10 border-pink-500/20' },
    hatched:        { icon: Egg,           tint: 'text-lime-300',    bg: 'bg-lime-500/10 border-lime-500/30' },
    join:           { icon: UserPlus,      tint: 'text-emerald-300', bg: 'bg-emerald-500/10 border-emerald-500/20' },
};

const REACTION_META = {
    heart:    { icon: Heart,    label: 'Heart',    color: 'text-rose-400' },
    congrats: { icon: Sparkles, label: 'Congrats', color: 'text-emerald-300' },
    fire:     { icon: Flame,    label: 'Fire',     color: 'text-amber-400' },
};

function EventReactions({ event, currentUserEmail, reactions, onToggle }) {
    return (
        <div className="flex items-center gap-1.5 mt-2">
            {Object.entries(REACTION_META).map(([key, meta]) => {
                const Icon = meta.icon;
                const count = reactions.filter((r) => r.reaction === key).length;
                const mine = currentUserEmail && reactions.some(
                    (r) => r.reaction === key && r.user_email === currentUserEmail
                );
                return (
                    <button
                        key={key}
                        type="button"
                        disabled={!currentUserEmail}
                        onClick={() => onToggle(event, key, mine)}
                        title={meta.label}
                        className={`group inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs border transition-colors ${
                            mine
                                ? 'border-slate-500 bg-slate-700/60 text-slate-100'
                                : 'border-slate-800 bg-slate-900/50 text-slate-400 hover:text-slate-200 hover:border-slate-600'
                        } ${!currentUserEmail ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                        <Icon className={`w-3 h-3 ${mine ? meta.color : 'text-slate-500 group-hover:text-slate-300'}`} />
                        {count > 0 && <span className="tabular-nums">{count}</span>}
                    </button>
                );
            })}
        </div>
    );
}

export default function LiveFeed({ currentUserEmail }) {
    const [events, setEvents] = useState(null);
    const [reactionsByKey, setReactionsByKey] = useState({});
    const [error, setError] = useState(null);

    const loadFeed = useCallback(async () => {
        try {
            const { data, error } = await supabase.rpc('community_feed', { p_limit: 25 });
            if (error) throw error;
            setEvents(Array.isArray(data) ? data : []);
            setError(null);
        } catch (e) {
            setError(e);
        }
    }, []);

    const loadReactions = useCallback(async (eventList) => {
        if (!eventList?.length) return;
        const types = [...new Set(eventList.map((e) => e.event_type))];
        const ids = [...new Set(eventList.map((e) => e.event_id))];
        const { data } = await supabase
            .from('community_event_reactions')
            .select('event_type, event_id, user_email, reaction')
            .in('event_type', types)
            .in('event_id', ids);
        const grouped = {};
        for (const r of data || []) {
            const key = `${r.event_type}:${r.event_id}`;
            (grouped[key] ||= []).push(r);
        }
        setReactionsByKey(grouped);
    }, []);

    useEffect(() => {
        let cancelled = false;
        const tick = async () => {
            await loadFeed();
        };
        tick();
        const id = setInterval(() => { if (!cancelled) tick(); }, POLL_MS);
        return () => { cancelled = true; clearInterval(id); };
    }, [loadFeed]);

    useEffect(() => {
        if (events?.length) loadReactions(events);
    }, [events, loadReactions]);

    const toggleReaction = async (event, reaction, currentlyMine) => {
        if (!currentUserEmail) return;
        const key = `${event.event_type}:${event.event_id}`;
        const prev = reactionsByKey[key] || [];
        // Optimistic update
        const next = currentlyMine
            ? prev.filter((r) => !(r.reaction === reaction && r.user_email === currentUserEmail))
            : [...prev, { event_type: event.event_type, event_id: event.event_id, user_email: currentUserEmail, reaction }];
        setReactionsByKey({ ...reactionsByKey, [key]: next });

        if (currentlyMine) {
            await supabase
                .from('community_event_reactions')
                .delete()
                .match({
                    event_type: event.event_type,
                    event_id: event.event_id,
                    user_email: currentUserEmail,
                    reaction,
                });
        } else {
            const { error } = await supabase
                .from('community_event_reactions')
                .insert({
                    event_type: event.event_type,
                    event_id: event.event_id,
                    user_email: currentUserEmail,
                    reaction,
                });
            if (error) {
                // Revert
                setReactionsByKey({ ...reactionsByKey, [key]: prev });
            }
        }
    };

    const items = useMemo(() => events || [], [events]);

    return (
        <Card className="gecko-card">
            <CardHeader>
                <CardTitle className="text-gecko-text flex items-center gap-2">
                    <Activity className="w-5 h-5 text-gecko-accent" />
                    Community Live
                </CardTitle>
                <p className="text-xs text-slate-500">Fresh activity from keepers in the community. Auto-refreshes every 30 seconds.</p>
            </CardHeader>
            <CardContent>
                {events === null && !error && (
                    <div className="space-y-2">
                        {[...Array(4)].map((_, i) => (
                            <div key={i} className="h-14 rounded-lg bg-slate-800/40 border border-slate-800 animate-pulse" />
                        ))}
                    </div>
                )}

                {error && (
                    <p className="text-sm text-slate-400">Couldn't load the live feed right now. We'll try again soon.</p>
                )}

                {events && events.length === 0 && (
                    <p className="text-sm text-slate-400">Quiet right now. Be the first to post something today.</p>
                )}

                <div className="space-y-3">
                    {items.map((ev) => {
                        const meta = TYPE_META[ev.event_type] || TYPE_META.upload;
                        const Icon = meta.icon;
                        const key = `${ev.event_type}:${ev.event_id}`;
                        const reactions = reactionsByKey[key] || [];
                        const actorHref = ev.actor_id ? `/PublicProfile?userId=${ev.actor_id}` : ev.href;
                        return (
                            <div
                                key={key}
                                className={`group rounded-xl border ${meta.bg} p-3 transition-colors hover:border-slate-600/50`}
                            >
                                <div className="flex items-start gap-3">
                                    <div className={`shrink-0 w-8 h-8 rounded-full bg-slate-900/60 border border-slate-800 flex items-center justify-center ${meta.tint}`}>
                                        <Icon className="w-4 h-4" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm text-slate-200 leading-snug">
                                            <Link
                                                to={createPageUrl(actorHref.replace(/^\//, ''))}
                                                className="font-semibold hover:text-emerald-300"
                                            >
                                                {ev.actor_name}
                                            </Link>{' '}
                                            <span className="text-slate-400">{ev.summary}</span>
                                        </p>
                                        <p className="text-[11px] text-slate-500 mt-0.5">
                                            {formatDistanceToNowStrict(new Date(ev.created_date), { addSuffix: true })}
                                            {ev.event_type !== 'join' && (
                                                <>
                                                    {' · '}
                                                    <Link to={createPageUrl(ev.href.replace(/^\//, ''))} className="hover:text-emerald-300">
                                                        Open
                                                    </Link>
                                                </>
                                            )}
                                        </p>
                                        <EventReactions
                                            event={ev}
                                            currentUserEmail={currentUserEmail}
                                            reactions={reactions}
                                            onToggle={toggleReaction}
                                        />
                                    </div>
                                    {ev.image_url && (
                                        <Link to={createPageUrl(ev.href.replace(/^\//, ''))} className="shrink-0">
                                            <img
                                                src={ev.image_url}
                                                alt=""
                                                className="w-14 h-14 rounded-lg object-cover border border-slate-800"
                                            />
                                        </Link>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
}
