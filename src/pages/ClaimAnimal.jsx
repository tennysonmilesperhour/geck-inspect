import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ArrowRightLeft, ShieldCheck, Clock, Check, Loader2 } from 'lucide-react';
import GeckoImage from '@/components/shared/GeckoImage';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { animalFromPreview, claimErrorKind } from '@/lib/transfers';
import { authContinuationPath, clearPostAuthRedirect, rememberPostAuthRedirect } from '@/lib/postAuthRedirect';
import { recordGeckoAdded } from '@/lib/activation';

const card = 'rounded-xl border border-slate-700 bg-slate-900 p-5 sm:p-6';
const messages = {
  not_found: ['Transfer not found', 'This link is invalid or has been removed. Ask the owner for a new link.'],
  already_claimed: ['Already claimed', 'This transfer has already been completed.'],
  cancelled: ['Transfer cancelled', 'The owner cancelled this link. Ask them for a new one.'],
  expired: ['Transfer expired', 'This link has expired. Ask the owner for a new one.'],
  wrong_account: ['Use the invited account', 'This link is for a different email address. Sign in with the email the owner invited.'],
  verify_email: ['Verify your email first', 'Open your confirmation email, then sign in again. Your transfer link will still be here.'],
  own_animal: ['You already own this animal', 'Share the QR code or link with the new owner.'],
  sign_in: ['Sign in to continue', 'Your session has ended. Sign in again to accept ownership.'],
  seller_changed: ['Transfer no longer valid', 'The sender no longer owns this animal. Ask the current owner for a new link.'],
  gecko_limit: ['Your plan is full', 'Archive a gecko you no longer keep or upgrade your plan, then try this link again.'],
  claim_failed: ['Could not complete the transfer', 'Your connection may have been interrupted. Try again to check whether the transfer completed.'],
  error: ['Could not load the transfer', 'Check your connection and try again.'],
};

export default function ClaimAnimal() {
  const { token } = useParams();
  const auth = useAuth();
  const navigate = useNavigate();
  const currentUser = auth.isAuthenticated && !auth.isGuest ? auth.user : null;
  const accountId = currentUser?.auth_user_id || currentUser?.id;
  const requestOwner = useRef();
  requestOwner.current = `${accountId || ''}:${token || ''}`;
  const claimPath = `/claim/${encodeURIComponent(token || '')}`;
  const signInPath = authContinuationPath(claimPath);
  const [transfer, setTransfer] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [contributePrice, setContributePrice] = useState(false);
  const [reload, setReload] = useState(0);
  const animal = animalFromPreview(transfer);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setError(null);
    setClaimed(false);
    setClaiming(false);
    setContributePrice(false);
    setTransfer(null);
    (async () => {
      try {
        // The server returns only status and expiry until the caller is
        // authorized. Never fetch a private animal row to fill this preview.
        const { data, error: rpcError } = await supabase.rpc('get_transfer_preview', { p_token: token });
        if (!active) return;
        if (rpcError) { setError('error'); return; }
        if (!data) { setError('not_found'); return; }
        setTransfer(data);
        if (data.claimed_by_you) {
          clearPostAuthRedirect();
          setClaimed(true);
        } else if (data.status === 'claimed') setError('already_claimed');
        else if (data.status === 'cancelled') setError('cancelled');
        else if (data.status === 'expired' || (data.expires_at && new Date(data.expires_at) <= new Date())) setError('expired');
      } catch {
        if (active) setError('error');
      } finally {
        if (active) setIsLoading(false);
      }
    })();
    return () => { active = false; };
  }, [token, accountId, reload]);

  const handleClaim = async () => {
    if (!currentUser || claiming) return;
    const owner = requestOwner.current;
    setClaiming(true);
    try {
      const { data, error: rpcError } = await supabase.rpc('claim_transfer', { p_token: token, p_contribute: contributePrice });
      if (requestOwner.current !== owner) return;
      if (rpcError) { setError(claimErrorKind(rpcError)); return; }
      if (!data?.ok) { setError('claim_failed'); return; }
      clearPostAuthRedirect();
      setTransfer((previous) => ({ ...previous, animal_type: data.animal_type }));
      setClaimed(true);
      if (!data.already_claimed) recordGeckoAdded('claim');
    } catch {
      if (requestOwner.current === owner) setError('claim_failed');
    } finally {
      if (requestOwner.current === owner) setClaiming(false);
    }
  };

  const switchAccount = async () => {
    setClaiming(true);
    rememberPostAuthRedirect(claimPath);
    try {
      await auth.logout(false);
      navigate(signInPath, { replace: true });
    } catch {
      setError('error');
    } finally {
      setClaiming(false);
    }
  };

  const terminal = ['not_found', 'already_claimed', 'cancelled', 'expired', 'seller_changed'].includes(error);
  const detailVisible = currentUser && transfer?.recipient_authorized && transfer?.animal_name;
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-4 py-12">
      <Helmet><title>Ownership transfer | Geck Inspect</title><meta name="robots" content="noindex, nofollow" /><meta name="referrer" content="no-referrer" /></Helmet>
      <div className="w-full max-w-md space-y-5">
        {isLoading ? (
          <div className="space-y-4" role="status" aria-label="Loading transfer"><div className="animate-pulse rounded-xl h-40 bg-slate-900" /><div className="animate-pulse rounded-xl h-12 bg-slate-900" /></div>
        ) : claimed ? (
          <div className={`${card} text-center space-y-4`} role="status">
            <Check size={36} className="mx-auto text-emerald-400" />
            <h1 className="text-2xl font-bold">Ownership accepted</h1>
            <p className="text-sm text-slate-300">Your {transfer?.animal_type === 'other_reptile' ? 'animal' : 'gecko'} is now in your collection. Its record and history have been kept.</p>
            <Button asChild><Link to={animal?.collectionPath || '/MyGeckos'}>View my collection</Link></Button>
          </div>
        ) : error ? (
          <div className={`${card} space-y-4`} role="alert">
            <Clock size={32} className="text-slate-400" />
            <h1 className="text-2xl font-bold">{(messages[error] || messages.error)[0]}</h1>
            <p className="text-sm text-slate-300">{(messages[error] || messages.error)[1]}</p>
            <div className="flex flex-wrap gap-2">
              {!terminal && <Button onClick={() => setReload((value) => value + 1)} disabled={claiming}>Try again</Button>}
              {['wrong_account', 'verify_email', 'sign_in'].includes(error) && (currentUser
                ? <Button variant="outline" onClick={switchAccount} disabled={claiming}>Sign in again</Button>
                : <Button asChild><Link to={signInPath}>Sign in</Link></Button>)}
              <Button asChild variant="outline"><Link to={currentUser ? '/MyGeckos' : '/'}>{currentUser ? 'My collection' : 'Geck Inspect'}</Link></Button>
            </div>
          </div>
        ) : (
          <>
            <header className="text-center space-y-2">
              <ArrowRightLeft size={32} className="mx-auto text-emerald-400" />
              <h1 className="text-2xl font-bold">Ownership transfer</h1>
              <p className="text-sm text-slate-300">Accept a gecko into your collection.</p>
            </header>
            <section className={`${card} space-y-4`} aria-label="Transfer details">
              {detailVisible ? (
                <>
                  <div className="flex items-center gap-4">
                    <GeckoImage src={animal?.image_urls?.[0]} alt={animal?.name} className="w-20 h-20 rounded-lg object-cover" />
                    <div className="min-w-0"><h2 className="font-semibold break-words">{animal?.name}</h2><p className="text-sm text-slate-400">{animal?.subtitle}</p></div>
                  </div>
                  {transfer.message && <p className="text-sm text-slate-300 whitespace-pre-wrap break-words">{transfer.message}</p>}
                  {transfer.sale_price != null && <p className="text-sm">Sale price: ${Number(transfer.sale_price).toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>}
                </>
              ) : <p className="text-sm text-slate-300">Animal and owner details stay private until you are authorized to view them. Confirm this link with the owner before accepting.</p>}
              <p className="text-sm text-slate-400">{transfer?.claim_mode === 'email' ? 'Use the verified email address the owner invited.' : 'The first verified account to accept this link becomes the owner.'}</p>
              {transfer?.expires_at && <p className="text-xs text-slate-400">Expires {new Date(transfer.expires_at).toLocaleString()}</p>}
            </section>
            {detailVisible && transfer.sale_price != null && (
              <label className={`${card} flex items-start gap-3 cursor-pointer`}>
                <input type="checkbox" checked={contributePrice} onChange={(event) => setContributePrice(event.target.checked)} className="mt-1 h-4 w-4 accent-emerald-500" />
                <span className="text-sm">Contribute this sale price to anonymous market data</span>
              </label>
            )}
            {!currentUser ? (
              <div className="space-y-3">
                <Button asChild className="w-full"><Link to={`${signInPath}&mode=signup`} onClick={() => rememberPostAuthRedirect(claimPath)}>Create account</Link></Button>
                <Button asChild variant="outline" className="w-full"><Link to={signInPath} onClick={() => rememberPostAuthRedirect(claimPath)}>Sign in</Link></Button>
                <p className="text-xs text-slate-400">After email verification, you will return here to accept. If you lose this page, scan the QR code or open the original link again.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-slate-400 break-all">Signed in as {currentUser.email}</p>
                <Button onClick={handleClaim} disabled={claiming} className="w-full">{claiming ? <Loader2 size={18} className="mr-2 animate-spin" /> : <ShieldCheck size={18} className="mr-2" />}{claiming ? 'Accepting...' : 'Accept ownership'}</Button>
                <Button variant="outline" onClick={switchAccount} disabled={claiming} className="w-full">Use another account</Button>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
