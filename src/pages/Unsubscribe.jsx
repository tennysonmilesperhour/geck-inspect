import { useEffect, useState } from 'react';
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
 */
export default function Unsubscribe() {
    const location = useLocation();
    const token = new URLSearchParams(location.search).get('t') || '';
    const [state, setState] = useState(token ? 'working' : 'missing');

    useEffect(() => {
        if (!token) return undefined;
        let cancelled = false;
        (async () => {
            try {
                const { data, error } = await supabase.rpc('unsubscribe_email_by_token', { p_token: token });
                if (cancelled) return;
                setState(!error && data === true ? 'done' : 'invalid');
            } catch {
                if (!cancelled) setState('error');
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [token]);

    return (
        <PublicPageShell>
            <Seo title="Unsubscribe" description="Stop Geck Inspect notification emails." path="/Unsubscribe" noIndex />
            <div className="max-w-xl mx-auto px-4 py-12">
                <Card>
                    <CardContent className="p-8 text-center space-y-4">
                        {state === 'working' && (
                            <>
                                <Loader2 className="w-8 h-8 mx-auto animate-spin text-emerald-400" />
                                <p className="text-slate-300">Turning off notification emails...</p>
                            </>
                        )}
                        {state === 'done' && (
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
                        <div className="pt-2">
                            <Link to="/Settings#email-notifications">
                                <Button variant="outline">Email settings</Button>
                            </Link>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </PublicPageShell>
    );
}
