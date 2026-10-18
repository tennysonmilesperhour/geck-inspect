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
 * off for that member, Weekly Gecko Notes included. The signature is the
 * proof, so it works from any device, signed in or not. Push and in-app
 * notifications are unchanged.
 *
 * Weekly Gecko Notes link here with &scope=weekly. Then the main button
 * stops only those emails (unsubscribe_weekly_notes_by_token), and a
 * second button stops all notification emails.
 *
 * A visitor's Weekly Gecko Note (no account; they signed up on a guide
 * page) links here with &scope=visitor and a visitor token. The button
 * stops every email to that address (unsubscribe_weekly_notes_subscriber).
 * There is no Settings page for them, so the page offers none.
 *
 * Nothing changes until the member presses a button. Mail security
 * scanners (Microsoft Defender Safe Links, Proofpoint, Mimecast) open every
 * link in a delivered email, scripts included, so a page that acted on
 * opening would unsubscribe members who never clicked. RFC 8058 asks for
 * this confirmation step; the mail app's own one-click Unsubscribe button
 * is a POST to the email-unsubscribe function, which still needs no click
 * here. One page with one button is what US law (CAN-SPAM) allows.
 */
const RPC = {
    all: 'unsubscribe_email_by_token',
    weekly: 'unsubscribe_weekly_notes_by_token',
    visitor: 'unsubscribe_weekly_notes_subscriber',
};

export default function Unsubscribe() {
    const location = useLocation();
    const params = new URLSearchParams(location.search);
    const token = params.get('t') || '';
    const asked = params.get('scope');
    const initialScope = asked === 'weekly' || asked === 'visitor' ? asked : 'all';
    const visitor = initialScope === 'visitor';
    // Which emails the last request was about, and how it went.
    const [scope, setScope] = useState(initialScope);
    // confirm (nothing done yet), working, done, invalid, error or missing.
    const [state, setState] = useState(token ? 'confirm' : 'missing');
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
        return () => {
            live.current = false;
        };
    }, []);

    return (
        <PublicPageShell>
            <Seo title="Unsubscribe" description="Stop Geck Inspect notification emails." path="/Unsubscribe" noIndex />
            <div className="max-w-xl mx-auto px-4 py-12">
                <Card>
                    <CardContent className="p-8 text-center space-y-4">
                        {state === 'confirm' && scope === 'visitor' && (
                            <>
                                <MailX className="w-10 h-10 mx-auto text-emerald-400" />
                                <h1 className="text-2xl font-bold text-slate-100">Stop Weekly Gecko Notes?</h1>
                                <p className="text-slate-400">
                                    You asked for them on a Geck Inspect guide page. Nothing more will be sent
                                    to this address.
                                </p>
                            </>
                        )}
                        {state === 'confirm' && scope === 'weekly' && (
                            <>
                                <MailX className="w-10 h-10 mx-auto text-emerald-400" />
                                <h1 className="text-2xl font-bold text-slate-100">Stop Weekly Gecko Notes?</h1>
                                <p className="text-slate-400">
                                    This stops only the weekly email. Reminders, hatch alerts and the other
                                    emails you chose still arrive.
                                </p>
                            </>
                        )}
                        {state === 'confirm' && scope === 'all' && (
                            <>
                                <MailX className="w-10 h-10 mx-auto text-emerald-400" />
                                <h1 className="text-2xl font-bold text-slate-100">Unsubscribe from notification emails?</h1>
                                <p className="text-slate-400">
                                    Geck Inspect will stop sending you notification emails, Weekly Gecko Notes
                                    included. Hatch alerts, messages and replies still show in the app, and push
                                    notifications are unchanged.
                                </p>
                            </>
                        )}
                        {state === 'working' && (
                            <>
                                <Loader2 className="w-8 h-8 mx-auto animate-spin text-emerald-400" />
                                <p className="text-slate-300">
                                    {scope === 'all' ? 'Turning off notification emails...' : 'Turning off Weekly Gecko Notes...'}
                                </p>
                            </>
                        )}
                        {state === 'done' && scope === 'visitor' && (
                            <>
                                <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-400" />
                                <h1 className="text-2xl font-bold text-slate-100">Weekly Gecko Notes are off</h1>
                                <p className="text-slate-400">
                                    Nothing more will be sent to this address. You can sign up again any time
                                    on the Weekly Gecko Notes page.
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
                                    Geck Inspect will stop sending you notification emails, Weekly Gecko Notes
                                    included. Hatch alerts, messages and replies still show in the app, and push
                                    notifications are unchanged. You can turn emails back on in Settings at any
                                    time; Weekly Gecko Notes have their own switch there.
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
                                        : visitor
                                        ? 'The link is incomplete or has been changed. Use the link at the bottom of a recent note.'
                                        : 'The unsubscribe link is incomplete or has been changed. Use the link from a recent email, or turn emails off in Settings.'}
                                </p>
                            </>
                        )}
                        <div className="pt-2 flex flex-wrap justify-center gap-3">
                            {state === 'confirm' && scope === 'weekly' && (
                                <Button onClick={() => run('weekly')}>Stop Weekly Gecko Notes</Button>
                            )}
                            {state === 'confirm' && scope === 'visitor' && (
                                <Button onClick={() => run('visitor')}>Stop Weekly Gecko Notes</Button>
                            )}
                            {state === 'confirm' && scope === 'all' && (
                                <Button onClick={() => run('all')}>Unsubscribe</Button>
                            )}
                            {scope === 'weekly' && (state === 'confirm' || state === 'done') && (
                                <Button variant="outline" onClick={() => run('all')}>
                                    Stop all notification emails
                                </Button>
                            )}
                            {visitor ? (
                                state === 'done' && (
                                    <Link to="/WeeklyNotes">
                                        <Button variant="outline">Weekly Gecko Notes page</Button>
                                    </Link>
                                )
                            ) : (
                                <Link to="/Settings#email-notifications">
                                    <Button variant="outline">Email settings</Button>
                                </Link>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </PublicPageShell>
    );
}
