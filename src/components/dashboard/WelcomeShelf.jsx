import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabaseClient';
import { Sparkles, MessageCircle } from 'lucide-react';
import { createPageUrl } from '@/utils';

/**
 * "New this week" rail. Shows up to 6 keepers who joined in the last
 * seven days (public profiles only), with a one-tap "Say hi" that
 * deep-links to the DM compose for that keeper.
 *
 * Returns null when nobody has joined recently so it doesn't render
 * an empty card.
 */
export default function WelcomeShelf({ currentUserEmail }) {
    const [keepers, setKeepers] = useState(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const { data } = await supabase.rpc('welcome_shelf', { p_limit: 6 });
            if (!cancelled) setKeepers(Array.isArray(data) ? data : []);
        })();
        return () => { cancelled = true; };
    }, []);

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
                        Say hi and they'll remember it
                    </span>
                </div>
                <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1">
                    {keepers.map((k) => {
                        const isMe = currentUserEmail && k.email === currentUserEmail;
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
                                    <Button
                                        asChild
                                        size="sm"
                                        variant="outline"
                                        className="w-full mt-2 border-emerald-500/30 bg-emerald-950/40 text-emerald-200 hover:bg-emerald-900/40 h-7 text-xs"
                                    >
                                        <Link to={createPageUrl(`Messages?to=${encodeURIComponent(k.email)}`)}>
                                            <MessageCircle className="w-3 h-3 mr-1" /> Say hi
                                        </Link>
                                    </Button>
                                )}
                            </div>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
}
