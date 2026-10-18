import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Seo from '@/components/seo/Seo';
import PublicPageShell from '@/components/public/PublicPageShell';
import WeeklyNotesSignup from '@/components/public/WeeklyNotesSignup';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/AuthContext';
import { getSupabase } from '@/lib/supabaseLazy';
import { CheckCircle2, Loader2, Mail, MailX } from 'lucide-react';

/**
 * Weekly Gecko Notes for visitors without an account
 * (docs/planning/weekly-notes-2026-10.md, section 9).
 *
 * /WeeklyNotes explains the notes and has the sign-up form. The
 * confirmation email links to /WeeklyNotes?t=<token>; the page then asks
 * the visitor to press one button, and only that press turns the notes on
 * (confirm_weekly_notes_signup). Mail security scanners open every link in
 * an email, scripts included, so a page that confirmed on opening would
 * sign up addresses whose owners never clicked.
 *
 * A signed-in member is pointed to the Weekly Gecko Notes switch in
 * Settings instead of the form.
 */
export default function WeeklyNotes() {
    const location = useLocation();
    const token = new URLSearchParams(location.search).get('t') || '';
    const { isAuthenticated } = useAuth();
    // confirm (nothing done yet), working, confirmed, already, member,
    // expired, invalid or error.
    const [state, setState] = useState(token ? 'confirm' : 'form');
    const live = useRef(true);

    useEffect(() => {
        live.current = true;
        return () => {
            live.current = false;
        };
    }, []);

    const confirm = useCallback(async () => {
        setState('working');
        try {
            const supabase = await getSupabase();
            const { data, error } = await supabase.rpc('confirm_weekly_notes_signup', { p_token: token });
            if (!live.current) return;
            const known = ['confirmed', 'already', 'member', 'expired', 'invalid'];
            setState(!error && known.includes(data) ? data : 'error');
        } catch {
            if (live.current) setState('error');
        }
    }, [token]);

    const showForm = state === 'form' || state === 'expired' || state === 'invalid';

    return (
        <PublicPageShell>
            <Seo
                title="Weekly Gecko Notes"
                description="One short crested gecko tip a week by email: heat, weights, feeding, het labels and pairings. Free."
                path="/WeeklyNotes"
                noIndex
            />
            <div className="max-w-xl mx-auto px-4 py-12">
                <Card>
                    {/* Announced when it changes, so a screen reader hears whether
                        the confirmation worked after the button goes away. */}
                    <CardContent className="p-8 space-y-4" aria-live="polite">
                        {state === 'form' && (
                            <>
                                <Mail className="w-10 h-10 text-emerald-400" aria-hidden="true" />
                                <h1 className="text-2xl font-bold text-slate-100">Weekly Gecko Notes</h1>
                                <p className="text-slate-300">
                                    One short email a week with one thing to know or do for your crested
                                    geckos: why heat is a bigger risk than cold, reading a weight trend,
                                    fresh CGD, shed rhythm, what 66% het means, when a female is ready to
                                    breed and how to pick an incubation temperature.
                                </p>
                                <p className="text-slate-400 text-sm">
                                    Written from a breeder's records and checked against the Care Guide and
                                    the Genetics Guide. Free, and every note has a link that stops them.
                                </p>
                            </>
                        )}
                        {state === 'confirm' && (
                            <div className="text-center space-y-4">
                                <Mail className="w-10 h-10 mx-auto text-emerald-400" aria-hidden="true" />
                                <h1 className="text-2xl font-bold text-slate-100">Confirm Weekly Gecko Notes</h1>
                                <p className="text-slate-400">
                                    Press the button to start one short crested gecko tip a week at the
                                    address you entered. Every note has a link that stops them.
                                </p>
                                <Button onClick={confirm}>Confirm my email</Button>
                            </div>
                        )}
                        {state === 'working' && (
                            <div className="text-center space-y-3">
                                <Loader2 className="w-8 h-8 mx-auto animate-spin text-emerald-400" aria-hidden="true" />
                                <p className="text-slate-300">Confirming...</p>
                            </div>
                        )}
                        {(state === 'confirmed' || state === 'already') && (
                            <div className="text-center space-y-4">
                                <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-400" aria-hidden="true" />
                                <h1 className="text-2xl font-bold text-slate-100">
                                    {state === 'confirmed' ? 'You are signed up' : 'You were already signed up'}
                                </h1>
                                <p className="text-slate-400">
                                    Weekly Gecko Notes come once a week. Every note has a link at the bottom
                                    that stops them.
                                </p>
                                <div className="flex flex-wrap justify-center gap-3 pt-2">
                                    <Link to="/CareGuide"><Button variant="outline">Open the Care Guide</Button></Link>
                                    <Link to="/MorphGuide"><Button variant="outline">Open the Morph Guide</Button></Link>
                                </div>
                            </div>
                        )}
                        {state === 'member' && (
                            <div className="text-center space-y-4">
                                <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-400" aria-hidden="true" />
                                <h1 className="text-2xl font-bold text-slate-100">You have a Geck Inspect account</h1>
                                <p className="text-slate-400">
                                    This address, or another spelling of it, belongs to an account. Members get
                                    Weekly Gecko Notes after their first two weeks. The switch for them is in
                                    Settings, under Email notifications.
                                </p>
                                <Link to="/Settings#email-notifications"><Button variant="outline">Open Settings</Button></Link>
                            </div>
                        )}
                        {(state === 'expired' || state === 'invalid' || state === 'error') && (
                            <div className="text-center space-y-3">
                                <MailX className="w-10 h-10 mx-auto text-amber-400" aria-hidden="true" />
                                <h1 className="text-2xl font-bold text-slate-100">
                                    {state === 'error'
                                        ? 'Something went wrong'
                                        : state === 'expired'
                                        ? 'This link has expired'
                                        : 'This link does not work'}
                                </h1>
                                <p className="text-slate-400">
                                    {state === 'error'
                                        ? 'We could not reach Geck Inspect. Check your connection and press the link in the email again.'
                                        : state === 'expired'
                                        ? 'Confirmation links work for 7 days. Enter your address below and we will send a new one.'
                                        : 'Only the newest link we sent works. Use the newest email, or enter your address below for a new one.'}
                                </p>
                            </div>
                        )}
                        {showForm && isAuthenticated && (
                            <p className="text-slate-300 text-sm">
                                You are signed in, so Weekly Gecko Notes come with your account. Turn them on
                                or off in <Link to="/Settings#email-notifications" className="underline">Settings</Link>.
                            </p>
                        )}
                        {showForm && !isAuthenticated && (
                            <WeeklyNotesSignup source="weekly_notes_page" page="/WeeklyNotes" framed={state !== 'form'} />
                        )}
                    </CardContent>
                </Card>
            </div>
        </PublicPageShell>
    );
}
