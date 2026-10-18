import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Seo from '@/components/seo/Seo';
import PublicPageShell from '@/components/public/PublicPageShell';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabaseClient';
import { CheckCircle2, Loader2, MailX } from 'lucide-react';

/**
 * Unsubscribe from notification emails, no sign-in needed.
 *
 * Every notification email links here with a signed token
 * (/Unsubscribe?t=<profile id>.<signature>). The database checks the
 * signature (unsubscribe_email_by_token) and turns email notifications
 * off for that member. The signature is the proof, so it works from any
 * device, signed in or not. Push and in-app notifications are unchanged.
 *
 * Weekly Gecko Notes link here with &scope=weekly. Then only those emails
 * stop (unsubscribe_weekly_notes_by_token), and the page offers a second
 * button that stops all Geck Inspect email, which runs only when clicked.
 * An old cached copy of this page ignores the scope and stops all email,
 * which is the safe direction.
 */
const RPC = {
    all: 'unsubscribe_email_by_token',
    weekly: 'unsubscribe_weekly_notes_by_token',
};

export default function Unsubscribe() {
    const location = useLocation();
    const params = new URLSearchParams(location.search);
    const token = params.get('t') || '';
    const initialScope = params.get('scope') === 'weekly' ? 'weekly' : 'all';
    // Which emails the last request was about, and how it went.
    const [scope, setScope] = useState(initialScope);
    const [state, setState] = useState(token ? 'working' : 'missing');
    const live = useRef(true);

    const run = useCallback(async (which) => {
        setScope(which);
        setState('working');
        try {
            const { data, error } = await supabase.rpc(RPC[which], { p_token: token });
            if (!live.current) return;
            setState(!error && data === true ? 'done' : 'invalid');
        } catch {
            if (live.current) setState('error');
        }
    }, [token]);

    useEffect(() => {
        live.current = true;
        if (token) run(initialScope);
        return () => {
            live.current = false;
        };
    }, [token, initialScope, run]);

    return (
        <PublicPageShell>
            <Seo title="Unsubscribe" description="Stop Geck Inspect notification emails." path="/Unsubscribe" noIndex />
            <div className="max-w-xl mx-auto px-4 py-12">
                <Card>
                    <CardContent className="p-8 text-center space-y-4">
                        {state === 'working' && (
                            <>
                                <Loader2 className="w-8 h-8 mx-auto animate-spin text-emerald-400" />
                                <p className="text-slate-300">
                                    {scope === 'weekly' ? 'Turning off Weekly Gecko Notes...' : 'Turning off notification emails...'}
                                </p>
                            </>
                        )}
                        {state === 'done' && scope === 'weekly' && (
                            <>
                                <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-400" />
                                <h1 className="text-2xl font-bold text-slate-100">Weekly Gecko Notes are off</h1>
                                <p className="text-slate-400">
                                    You will not get the weekly email any more. Reminders, hatch alerts and the
                                    other emails you chose still arrive. You can turn Weekly Gecko Notes back on
                                    in Settings.
                                </p>
                            </>
                        )}
                        {state === 'done' && scope === 'all' && (
                            <>
                                <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-400" />
                                <h1 className="text-2xl font-bold text-slate-100">You are unsubscribed</h1>
                                <p className="text-slate-400">
                                    Geck Inspect will stop sending you notification emails. Hatch alerts,
                                    messages and replies still show in the app, and push notifications are
                                    unchanged. You can turn emails back on in Settings at any time.
                                </p>
                            </>
                        )}
                        {(state === 'invalid' || state === 'missing' || state === 'error') && (
                            <>
                                <MailX className="w-10 h-10 mx-auto text-amber-400" />
                                <h1 className="text-2xl font-bold text-slate-100">
                                    {state === 'error' ? 'Something went wrong' : 'This link does not work'}
                                </h1>
                                <p className="text-slate-400">
                                    {state === 'error'
                                        ? 'We could not reach Geck Inspect. Check your connection and open the link again.'
                                        : 'The unsubscribe link is incomplete or has been changed. Use the link from a recent email, or turn emails off in Settings.'}
                                </p>
                            </>
                        )}
                        <div className="pt-2 flex flex-wrap justify-center gap-3">
                            <Link to="/Settings#email-notifications">
                                <Button variant="outline">Email settings</Button>
                            </Link>
                            {state === 'done' && scope === 'weekly' && (
                                <Button variant="outline" onClick={() => run('all')}>
                                    Stop all Geck Inspect email
                                </Button>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </PublicPageShell>
    );
}
