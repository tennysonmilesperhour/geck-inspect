import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Users2, ArrowRight, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { createPageUrl } from '@/utils';

/**
 * Accept-invite landing for /collection-invite/:token.
 *
 * Flow:
 *   1. Read the token from the URL.
 *   2. If the visitor isn't signed in, send them to AuthPortal with a
 *      next= param so they come back here after auth.
 *   3. Once authed, call the accept_collection_invite RPC. The function
 *      enforces email match and freshness server-side so we don't have
 *      to trust the client.
 *   4. On success, send them to /MyGeckos so they can see the shared
 *      collection (or to Settings → Collections to choose a role).
 */
export default function CollectionInvite() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, isLoadingAuth } = useAuth();
  const [state, setState] = useState({ stage: 'idle', error: null, row: null });

  useEffect(() => {
    if (isLoadingAuth) return;
    if (!isAuthenticated) {
      // Send to login with a return URL.
      const next = encodeURIComponent(`/collection-invite/${token}`);
      navigate(`${createPageUrl('AuthPortal')}?next=${next}`);
      return;
    }
    let cancelled = false;
    setState({ stage: 'accepting', error: null, row: null });
    supabase
      .rpc('accept_collection_invite', { token })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setState({ stage: 'error', error: error.message, row: null });
          return;
        }
        setState({ stage: 'accepted', error: null, row: data });
      })
      .catch((e) => {
        if (cancelled) return;
        setState({ stage: 'error', error: e.message, row: null });
      });
    return () => { cancelled = true; };
  }, [token, isAuthenticated, isLoadingAuth, navigate]);

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <Card className="bg-slate-900 border-slate-700 max-w-lg w-full">
        <CardHeader>
          <CardTitle className="text-slate-100 flex items-center gap-2">
            <Users2 className="w-5 h-5" />
            Collection invitation
          </CardTitle>
          <CardDescription className="text-slate-400">
            Accept the invitation to join a shared crested gecko collection on
            Geck Inspect.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {(state.stage === 'idle' || state.stage === 'accepting' || isLoadingAuth) && (
            <div className="flex items-center gap-2 text-slate-300 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              {state.stage === 'accepting' ? 'Accepting invitation…' : 'Loading…'}
            </div>
          )}

          {state.stage === 'accepted' && (
            <>
              <div className="flex items-start gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-emerald-200">
                    Invitation accepted
                  </p>
                  <p className="text-xs text-emerald-200/80 mt-1">
                    You&rsquo;re now a {state.row?.role || 'collaborator'} on this
                    collection. The shared geckos will appear in your dashboard
                    once the data-model integration is enabled (coming soon).
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2">
                <Link to={createPageUrl('Settings')}>
                  <Button variant="outline" className="border-slate-600 text-slate-300">
                    Settings
                  </Button>
                </Link>
                <Link to={createPageUrl('MyGeckos')}>
                  <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">
                    Go to my geckos
                    <ArrowRight className="w-4 h-4 ml-1.5" />
                  </Button>
                </Link>
              </div>
            </>
          )}

          {state.stage === 'error' && (
            <>
              <div className="flex items-start gap-3 rounded-lg border border-red-500/30 bg-red-500/5 p-4">
                <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-red-200">
                    Could not accept invitation
                  </p>
                  <p className="text-xs text-red-200/80 mt-1">
                    {state.error || 'Unknown error.'}
                  </p>
                  <p className="text-xs text-red-200/60 mt-2">
                    Common causes: invitation expired, the invite was issued to
                    a different email than the one you&rsquo;re signed in with,
                    or the invitation has already been used or revoked.
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2">
                <Link to="/">
                  <Button variant="outline" className="border-slate-600 text-slate-300">
                    Home
                  </Button>
                </Link>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
