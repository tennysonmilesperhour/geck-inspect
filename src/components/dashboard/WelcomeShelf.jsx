import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabaseClient';
import { Sparkles, UserPlus, UserCheck, Eye } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { UserFollow } from '@/entities/all';
import { notifyNewFollower } from '@/components/notifications/NotificationService';
import { useToast } from '@/components/ui/use-toast';

/**
 * "New this week" rail. Shows up to 6 keepers who joined in the last
 * seven days (public profiles only). Each card offers a Follow toggle
 * and a View profile link so the keeper can decide how much engagement
 * they want, no DM pressure.
 *
 * Returns null when nobody has joined recently so it doesn't render
 * an empty card.
 */
export default function WelcomeShelf({ currentUser }) {
    const [keepers, setKeepers] = useState(null);
    const [followByEmail, setFollowByEmail] = useState({});
    const [emailById, setEmailById] = useState({});
    const [busyEmail, setBusyEmail] = useState({});
    const { toast } = useToast();

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const { data } = await supabase.rpc('welcome_shelf', { p_limit: 6 });
            if (!cancelled) setKeepers(Array.isArray(data) ? data : []);
        })();
        return () => { cancelled = true; };
    }, []);

    // welcome_shelf() never returns email addresses. Follows are still
    // stored by email, so a signed-in member's browser looks up the
    // address of each keeper on the shelf by profile id.
    useEffect(() => {
        if (!currentUser?.email || !keepers || keepers.length === 0) return;
        let cancelled = false;
        (async () => {
            const ids = keepers.map((k) => k.id).filter(Boolean);
            const [myFollows, { data: rows }] = await Promise.all([
                UserFollow.filter({ follower_email: currentUser.email }).catch(() => []),
                supabase.rpc('read_profiles').select('id, email').in('id', ids)
                    .then((r) => r, () => ({ data: [] })),
            ]);
            if (cancelled) return;
            const emails = {};
            for (const r of rows || []) if (r.email) emails[r.id] = r.email;
            setEmailById(emails);
            const idx = {};
            for (const f of myFollows || []) idx[f.following_email] = f;
            setFollowByEmail(idx);
        })();
        return () => { cancelled = true; };
    }, [currentUser?.email, keepers]);

    const handleFollowToggle = async (keeper) => {
        if (!currentUser?.email) {
            toast({
                title: 'Sign in to follow',
                description: 'Follows show up in your activity feed.',
            });
            return;
        }
        const keeperEmail = emailById[keeper.id];
        if (!keeperEmail || busyEmail[keeperEmail]) return;
        setBusyEmail((b) => ({ ...b, [keeperEmail]: true }));
        try {
            const existing = followByEmail[keeperEmail];
            if (existing) {
                await UserFollow.delete(existing.id);
                setFollowByEmail((f) => {
                    const next = { ...f };
                    delete next[keeperEmail];
                    return next;
                });
            } else {
                const newFollow = await UserFollow.create({
                    follower_email: currentUser.email,
                    following_email: keeperEmail,
                });
                setFollowByEmail((f) => ({ ...f, [keeperEmail]: newFollow }));
                try {
                    await notifyNewFollower(
                        keeperEmail,
                        currentUser.email,
                        currentUser.full_name,
                    );
                } catch (notifyErr) {
                    console.error('Follower notification failed:', notifyErr);
                }
            }
        } catch (err) {
            console.error('Follow toggle failed:', err);
            toast({
                title: 'Could not update follow',
                description: 'Try again in a minute.',
                variant: 'destructive',
            });
        } finally {
            setBusyEmail((b) => ({ ...b, [keeperEmail]: false }));
        }
    };

    if (!keepers || keepers.length === 0) return null;

    return (
        <Card className="bg-gradient-to-br from-emerald-950/30 via-slate-900/60 to-cyan-950/30 border-emerald-500/20 backdrop-blur-sm">
            <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="w-4 h-4 text-emerald-300" />
                    <h3 className="text-sm font-semibold text-emerald-200 uppercase tracking-wider">
                        New keepers this week
                    </h3>
                    <span className="text-xs text-slate-500 ml-auto">
                        Joined in the last seven days
                    </span>
                </div>
                <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1">
                    {keepers.map((k) => {
                        const kEmail = emailById[k.id];
                        const isMe = (Boolean(currentUser?.id) && k.id === String(currentUser.id))
                            || (Boolean(kEmail) && kEmail === currentUser?.email);
                        const isFollowing = Boolean(kEmail && followByEmail[kEmail]);
                        const isBusy = Boolean(kEmail && busyEmail[kEmail]);
                        return (
                            <div
                                key={k.id}
                                className="shrink-0 w-40 rounded-xl border border-slate-800 bg-slate-900/60 p-3 hover:border-emerald-500/40 transition-colors"
                            >
                                <Link
                                    to={createPageUrl(`PublicProfile?userId=${k.id}`)}
                                    className="block"
                                >
                                    {k.profile_image_url ? (
                                        <img
                                            src={k.profile_image_url}
                                            alt={k.display_name}
                                            className="w-14 h-14 rounded-full mx-auto object-cover border border-slate-700"
                                        />
                                    ) : (
                                        <div className="w-14 h-14 rounded-full mx-auto bg-emerald-900/40 border border-emerald-700/40 flex items-center justify-center text-emerald-200 font-bold text-lg">
                                            {k.display_name?.[0]?.toUpperCase() || '?'}
                                        </div>
                                    )}
                                    <p className="text-center text-sm font-medium text-slate-100 mt-2 truncate">
                                        {k.display_name}
                                    </p>
                                </Link>
                                {isMe ? (
                                    <p className="text-center text-[10px] text-slate-500 mt-2 italic">
                                        That's you
                                    </p>
                                ) : (
                                    <div className="mt-2 space-y-1.5 touch:space-y-2">
                                        <Button
                                            size="sm"
                                            onClick={() => handleFollowToggle(k)}
                                            disabled={isBusy}
                                            className={`w-full h-7 text-xs border ${
                                                isFollowing
                                                    ? 'bg-slate-800/60 text-slate-200 border-slate-600 hover:bg-slate-800'
                                                    : 'bg-emerald-600 text-white border-emerald-500 hover:bg-emerald-500'
                                            }`}
                                        >
                                            {isFollowing ? (
                                                <>
                                                    <UserCheck className="w-3 h-3 mr-1" />
                                                    Following
                                                </>
                                            ) : (
                                                <>
                                                    <UserPlus className="w-3 h-3 mr-1" />
                                                    Follow
                                                </>
                                            )}
                                        </Button>
                                        <Button
                                            asChild
                                            size="sm"
                                            variant="outline"
                                            className="w-full h-7 text-xs border-slate-700 bg-slate-900/40 text-slate-200 hover:bg-slate-800"
                                        >
                                            <Link to={createPageUrl(`PublicProfile?userId=${k.id}`)}>
                                                <Eye className="w-3 h-3 mr-1" />
                                                View profile
                                            </Link>
                                        </Button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
}
