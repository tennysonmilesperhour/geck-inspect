import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Gecko, ForumPost, GeckoImage, BreedingPlan } from '@/entities/all';
import { supabase } from '@/lib/supabaseClient';
import { publicDisplayName } from '@/lib/publicColumns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Activity as ActivityIcon,
    Camera,
    GitBranch,
    MessageSquare,
    Sparkles,
} from 'lucide-react';
import { formatDistanceToNowStrict } from 'date-fns';

/**
 * Community Pulse, a live-feeling activity ticker showing the most
 * recent public actions across the whole app: new geckos added, new
 * images uploaded, forum posts, and breeding plans kicked off.
 *
 * Pulls the last 20 of each in parallel, merges, sorts by timestamp,
 * and renders the top 8. Cheap enough to run every time the dashboard
 * loads, no polling; a manual refresh on the dashboard hits it again.
 */

const TYPE_META = {
    gecko: { icon: GitBranch, tint: 'text-emerald-400', verb: 'added a new gecko' },
    image: { icon: Camera, tint: 'text-purple-400', verb: 'uploaded a photo' },
    post: { icon: MessageSquare, tint: 'text-amber-400', verb: 'started a forum discussion' },
    plan: { icon: Sparkles, tint: 'text-rose-400', verb: 'started a breeding plan' },
};

export default function CommunityPulse() {
    const [isLoading, setIsLoading] = useState(true);
    const [items, setItems] = useState([]);
    const [profiles, setProfiles] = useState(new Map());

    useEffect(() => {
        (async () => {
            setIsLoading(true);
            try {
                const [geckos, images, posts, plans] = await Promise.all([
                    Gecko.list('-created_date', 20).catch(() => []),
                    GeckoImage.list('-created_date', 20).catch(() => []),
                    ForumPost.list('-created_date', 20).catch(() => []),
                    BreedingPlan.list('-created_date', 20).catch(() => []),
                ]);

                const merged = [
                    ...geckos.map((g) => ({
                        key: `gecko-${g.id}`,
                        type: 'gecko',
                        ts: g.created_date,
                        email: g.created_by,
                        ownerId: g.owner_profile_id || null,
                        detail: g.name || 'Unnamed gecko',
                        href: '/MarketplaceBuy',
                    })),
                    ...images.map((i) => ({
                        key: `image-${i.id}`,
                        type: 'image',
                        ts: i.created_date,
                        email: i.created_by,
                        ownerId: i.owner_profile_id || null,
                        detail: (i.primary_morph || 'gecko').replace(/_/g, ' '),
                        href: '/Gallery',
                    })),
                    ...posts.map((p) => ({
                        key: `post-${p.id}`,
                        type: 'post',
                        ts: p.created_date,
                        email: p.created_by,
                        ownerId: p.owner_profile_id || null,
                        detail: p.title || 'New post',
                        href: '/Forum',
                    })),
                    ...plans.map((pl) => ({
                        key: `plan-${pl.id}`,
                        type: 'plan',
                        ts: pl.created_date,
                        email: pl.created_by,
                        ownerId: pl.owner_profile_id || null,
                        detail: pl.breeding_id || 'New breeding plan',
                        href: '/Breeding',
                    })),
                ]
                    .filter((x) => x.ts)
                    .sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())
                    .slice(0, 8);

                setItems(merged);

                // Hydrate display names for the rows we actually show. Rows
                // carry owner_profile_id where the table has one; signed-out
                // visitors never get created_by (an email), so the email
                // lookup only runs for signed-in members' plan rows.
                const cols = 'id, email, full_name, business_name, profile_image_url';
                const ids = Array.from(new Set(merged.map((x) => x.ownerId).filter(Boolean)));
                const emails = Array.from(new Set(merged.filter((x) => !x.ownerId).map((x) => x.email).filter(Boolean)));
                const [byId, byEmail] = await Promise.all([
                    ids.length
                        ? supabase.rpc('read_profiles').select(cols).in('id', ids)
                        : Promise.resolve({ data: [] }),
                    emails.length
                        ? supabase.rpc('read_profiles', { p_emails: emails }).select(cols).in('email', emails)
                        : Promise.resolve({ data: [] }),
                ]);
                const map = new Map();
                for (const u of byId.data || []) map.set(`id:${u.id}`, u);
                for (const u of byEmail.data || []) if (u.email) map.set(`email:${u.email}`, u);
                setProfiles(map);
            } catch (err) {
                console.error('CommunityPulse load failed:', err);
            }
            setIsLoading(false);
        })();
    }, []);

    const pulse = useMemo(() => items, [items]);

    return (
        <Card className="gecko-card">
            <CardHeader>
                <CardTitle className="text-gecko-text text-glow flex items-center gap-2">
                    <ActivityIcon className="w-5 h-5 text-gecko-accent" />
                    Community Pulse
                </CardTitle>
                <p className="text-xs text-slate-400">
                    The latest from around Geck Inspect, refreshed every time you land here.
                </p>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="space-y-2">
                        {[...Array(4)].map((_, i) => (
                            <div
                                key={i}
                                className="h-10 rounded-lg bg-slate-800/40 border border-slate-800 animate-pulse"
                            />
                        ))}
                    </div>
                ) : pulse.length === 0 ? (
                    <p className="text-sm text-slate-500 text-center py-4">
                        No recent activity yet.
                    </p>
                ) : (
                    <ol className="space-y-2">
                        {pulse.map((item) => {
                            const meta = TYPE_META[item.type];
                            const Icon = meta.icon;
                            const user = item.ownerId
                                ? profiles.get(`id:${item.ownerId}`)
                                : profiles.get(`email:${item.email}`);
                            const name = publicDisplayName(user, 'A keeper');
                            return (
                                <li key={item.key}>
                                    <Link
                                        to={item.href}
                                        className="touch:min-h-11 flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-slate-800/60 transition-colors"
                                    >
                                        <span className={`shrink-0 ${meta.tint}`}>
                                            <Icon className="w-4 h-4" />
                                        </span>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm text-slate-200 truncate">
                                                <span className="font-semibold">{name}</span>{' '}
                                                <span className="text-slate-400">{meta.verb}</span>{' '}
                                                <span className="text-slate-300">· {item.detail}</span>
                                            </p>
                                        </div>
                                        <span className="text-[10px] text-slate-500 shrink-0">
                                            {formatDistanceToNowStrict(new Date(item.ts), { addSuffix: true })}
                                        </span>
                                    </Link>
                                </li>
                            );
                        })}
                    </ol>
                )}
            </CardContent>
        </Card>
    );
}
