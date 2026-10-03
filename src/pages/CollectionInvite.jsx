import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Users2, ArrowRight, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { createPageUrl } from '@/utils';
import { inviteStatusMessage } from '@/lib/collectionInvite';

/**
 * Invite landing for /collection-invite/:token.
 *
 * Flow:
 *   1. Read a preview of the invite by its token (collection name, role,
 *      who sent it). Nothing changes on page load; until 3 Oct 2026 this
 *      page accepted the invite the moment it opened.
 *   2. Accept: a signed-out visitor goes to AuthPortal and comes back here.
 *      Once signed in, accept_collection_invite checks the email match and
 *      freshness on the server.
 *   3. Decline: works with the link alone, signed in or not.
 */
export default function CollectionInvite() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, isLoadingAuth } = useAuth();
  const [preview, setPreview] = useState(null);
  const [state, setState] = useState({ stage: 'loading', error: null, row: null });

  useEffect(() => {
    let cancelled = false;
    setState({ stage: 'loading', error: null, row: null });
    supabase
      .rpc('get_collection_invite_preview', { p_token: token })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data) {
          setState({ stage: 'missing', error: null, row: null });
          return;
        }
        setPreview(data);
        setState({ stage: data.status === 'pending' ? 'ready' : 'closed', error: null, row: null });
      })
      .catch(() => {
        if (!cancelled) setState({ stage: 'missing', error: null, row: null });
      });
    return () => { cancelled = true; };
  }, [token]);

  const handleAccept = async () => {
    if (!isAuthenticated) {
      const next = encodeURIComponent(`/collection-invite/${token}`);
      navigate(`${createPageUrl('AuthPortal')}?next=${next}`);
      return;
    }
    setState({ stage: 'accepting', error: null, row: null });
    const { data, error } = await supabase.rpc('accept_collection_invite', { token });
    if (error) {
      setState({ stage: 'error', error: error.message, row: null });
      return;
    }
    setState({ stage: 'accepted', error: null, row: data });
  };

  const handleDecline = async () => {
    setState({ stage: 'declining', error: null, row: null });
    const { error } = await supabase.rpc('decline_collection_invite', { p_token: token });
    if (error) {
      setState({ stage: 'error', error: error.message, row: null });
      return;
    }
    setState({ stage: 'declined', error: null, row: null });
  };

  const busy = state.stage === 'accepting' || state.stage === 'declining';
  const collectionName = preview?.collection_name || 'a shared collection';
  const inviter = preview?.inviter_name || 'A Geck Inspect keeper';
  const role = preview?.role === 'editor' ? 'editor' : 'viewer';

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <Card className="max-w-lg w-full">
        <CardHeader>
          <CardTitle className="text-slate-100 flex items-center gap-2">
            <Users2 className="w-5 h-5" />
            Collection invitation
          </CardTitle>
          <CardDescription className="text-slate-400">
            {preview
              ? `${inviter} invited you to “${collectionName}” on Geck Inspect.`
              : 'An invitation to a shared crested gecko collection on Geck Inspect.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {state.stage === 'loading' && (
            <div className="flex items-center gap-2 text-slate-300 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading invitation...
            </div>
          )}

          {(state.stage === 'ready' || busy) && preview && (
            <>
              <div className="rounded-lg border border-slate-700 bg-slate-900 p-4 space-y-2 text-sm">
                <p className="text-slate-200">
                  You&rsquo;re invited as a <strong>{role}</strong>.{' '}
                  {role === 'editor'
                    ? 'Editors can add and update geckos in this collection alongside the owner.'
                    : 'Viewers can see the geckos in this collection but not change them.'}
                </p>
                {preview.member_email_masked && (
                  <p className="text-xs text-slate-400">
                    Sent to {preview.member_email_masked}. Accept while signed in with that address.
                  </p>
                )}
              </div>
              <div className="flex items-center justify-end gap-2 flex-wrap">
                <Button
                  variant="outline"
                  className="border-slate-600 text-slate-300"
                  onClick={handleDecline}
                  disabled={busy}
                >
                  {state.stage === 'declining' && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
                  Decline
                </Button>
                <Button
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={handleAccept}
                  disabled={busy || isLoadingAuth}
                >
                  {state.stage === 'accepting' && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
                  {isAuthenticated ? 'Accept invitation' : 'Sign in to accept'}
                </Button>
              </div>
            </>
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
                    You&rsquo;re now a {state.row?.role || role} on {collectionName}. Open My Geckos and
                    select this shared collection to see its animals and the actions available to your role.
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

          {state.stage === 'declined' && (
            <div className="flex items-start gap-3 rounded-lg border border-slate-700 bg-slate-900 p-4">
              <XCircle className="w-5 h-5 text-slate-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-slate-200">Invitation declined</p>
                <p className="text-xs text-slate-400 mt-1">
                  You won&rsquo;t be added to {collectionName}. If that was a mistake, ask {inviter} to invite you again.
                </p>
              </div>
            </div>
          )}

          {(state.stage === 'closed' || state.stage === 'missing') && (
            <>
              <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
                <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-amber-100">
                  {inviteStatusMessage(state.stage === 'missing' ? 'missing' : preview?.status)}
                </p>
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

          {state.stage === 'error' && (
            <>
              <div className="flex items-start gap-3 rounded-lg border border-red-500/30 bg-red-500/5 p-4">
                <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-red-200">
                    Something went wrong
                  </p>
                  <p className="text-xs text-red-200/80 mt-1">
                    {state.error || 'Please try again.'}
                  </p>
                  <p className="text-xs text-red-200/60 mt-2">
                    Common causes: the invitation expired, it was sent to a different email than the
                    one you&rsquo;re signed in with, or it was already used or withdrawn.
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
