import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Seo from '@/components/seo/Seo';
import PublicPageShell from '@/components/public/PublicPageShell';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabaseClient';
import { CheckCircle2, Loader2, Mail, MailX } from 'lucide-react';

/**
 * The answer page for the one-time "Still keeping crested geckos?" email
 * (docs/marketing/email-brain.md, section 5). No sign-in needed: the link
 * carries the same signed token as the unsubscribe links.
 *
 * "Yes, keep them coming" records a yes (keep_weekly_notes_by_token), which
 * lets the member through the Weekly Gecko Notes relevance gate for a year.
 * "No, stop them" turns the notes off (unsubscribe_weekly_notes_by_token).
 *
 * Nothing changes until a button is pressed: mail security scanners open
 * every link in an email, so a page that acted on opening would answer
 * for members who never clicked.
 */
const RPC = {
    keep: 'keep_weekly_notes_by_token',
    stop: 'unsubscribe_weekly_notes_by_token',
};

export default function KeepNotes() {
    const location = useLocation();
    const token = new URLSearchParams(location.search).get('t') || '';
    // ask (nothing done yet), working, done, invalid, error or missing.
    const [state, setState] = useState(token ? 'ask' : 'missing');
    const [choice, setChoice] = useState('keep');
    const live = useRef(true);

    useEffect(() => {
        live.current = true;
        return () => {
            live.current = false;
        };
    }, []);

    const run = useCallback(async (which) => {
        setChoice(which);
        setState('working');
        try {
            const { data, error } = await supabase.rpc(RPC[which], { p_token: token });
            if (!live.current) return;
            setState(!error && data === true ? 'done' : 'invalid');
        } catch {
            if (live.current) setState('error');
        }
    }, [token]);

    return (
        <PublicPageShell>
            <Seo title="Weekly Gecko Notes" description="Keep or stop Weekly Gecko Notes." path="/KeepNotes" noIndex />
            <div className="max-w-xl mx-auto px-4 py-12">
                <Card>
                    <CardContent className="p-8 text-center space-y-4">
                        {state === 'ask' && (
                            <>
                                <Mail className="w-10 h-10 mx-auto text-emerald-400" />
                                <h1 className="text-2xl font-bold text-slate-100">Keep Weekly Gecko Notes?</h1>
                                <p className="text-slate-400">
                                    One short crested gecko tip a week: weights, humidity, genetics, eggs. Press
                                    the button to keep them coming.
                                </p>
                            </>
                        )}
                        {state === 'working' && (
                            <>
                                <Loader2 className="w-8 h-8 mx-auto animate-spin text-emerald-400" />
                                <p className="text-slate-300">Saving your answer...</p>
                            </>
                        )}
                        {state === 'done' && choice === 'keep' && (
                            <>
                                <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-400" />
                                <h1 className="text-2xl font-bold text-slate-100">Thanks, they will keep coming</h1>
                                <p className="text-slate-400">
                                    The next Weekly Gecko Note arrives within a week. Every note has a link to
                                    stop them if that changes.
                                </p>
                            </>
                        )}
                        {state === 'done' && choice === 'stop' && (
                            <>
                                <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-400" />
                                <h1 className="text-2xl font-bold text-slate-100">Weekly Gecko Notes are off</h1>
                                <p className="text-slate-400">
                                    Reminders and the other emails you chose still arrive. You can turn the notes
                                    back on in Settings.
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
                                        : 'The link is incomplete or has been changed. Use the button in the email, or change Weekly Gecko Notes in Settings.'}
                                </p>
                            </>
                        )}
                        <div className="pt-2 flex flex-wrap justify-center gap-3">
                            {state === 'ask' && (
                                <>
                                    <Button onClick={() => run('keep')}>Yes, keep them coming</Button>
                                    <Button variant="outline" onClick={() => run('stop')}>No, stop them</Button>
                                </>
                            )}
                            {state !== 'ask' && state !== 'working' && (
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
