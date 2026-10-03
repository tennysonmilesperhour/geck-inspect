import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { format } from 'date-fns';
import { ArrowRightLeft, ShieldCheck, Clock, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { animalFromPreview } from '@/lib/transfers';

// The page a buyer opens from a transfer link. It uses the app's own
// cards, colors and buttons (it had its own palette and fonts until
// 29 Sep 2026, P10).
const card = 'rounded-xl border border-slate-800 bg-slate-900 p-5 sm:p-6';

function CenteredState({ children }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100">
      <div className="text-center max-w-md mx-auto px-4">{children}</div>
    </div>
  );
}

export default function ClaimAnimal() {
  const { token } = useParams();
  const auth = useAuth?.() || {};
  const currentUser = auth.user;

  const [transfer, setTransfer] = useState(null);
  const [animal, setAnimal] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [contributePrice, setContributePrice] = useState(true);

  useEffect(() => {
    if (!token) return;
    (async () => {
      setIsLoading(true);
      try {
        // transfer_requests is no longer world-readable (only the sender
        // and the intended recipient can read rows), so the public claim
        // page reads a display-only preview through a SECURITY DEFINER
        // function keyed by the token. It returns status, expiry, the
        // animal pointer, message, price and a masked recipient email.
        const { data: tr, error: trErr } = await supabase
          .rpc('get_transfer_preview', { p_token: token });

        if (trErr || !tr) {
          setError('not_found');
          return;
        }
        if (tr.status === 'claimed') {
          setError('already_claimed');
          return;
        }
        if (tr.status === 'cancelled') {
          setError('cancelled');
          return;
        }
        if (tr.status === 'expired' || new Date(tr.expires_at) < new Date()) {
          setError('expired');
          return;
        }
        setTransfer(tr);

        // The preview carries the animal's name, first photo and morph, so
        // the page shows them even when the animal is private (the buyer
        // cannot read a private gecko's row before the claim).
        setAnimal(animalFromPreview(tr));
      } catch (err) {
        console.error(err);
        setError('error');
      } finally {
        setIsLoading(false);
      }
    })();
  }, [token]);

  const handleClaim = async () => {
    if (!currentUser) {
      window.location.href = `/AuthPortal?redirect=/claim/${token}`;
      return;
    }
    setClaiming(true);
    try {
      // The claim reassigns the animal across an RLS boundary (the claimer
      // isn't the owner yet), so it runs server-side in a SECURITY DEFINER
      // function that validates the token and moves ownership atomically.
      const { error: rpcError } = await supabase.rpc('claim_transfer', {
        p_token: token,
        p_contribute: contributePrice,
      });

      if (rpcError) {
        console.error('Claim failed:', rpcError);
        const msg = (rpcError.message || '').toLowerCase();
        if (msg.includes('already claimed')) setError('already_claimed');
        else if (msg.includes('cancelled')) setError('cancelled');
        else if (msg.includes('expired')) setError('expired');
        else if (msg.includes('not found')) setError('not_found');
        else if (msg.includes('intended recipient')) setError('wrong_account');
        else setError('claim_failed');
        return;
      }

      setClaimed(true);
    } catch (err) {
      console.error('Claim failed:', err);
      setError('claim_failed');
    } finally {
      setClaiming(false);
    }
  };

  // Loading
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="space-y-4 w-full max-w-md mx-auto px-4">
          <div className="animate-pulse rounded-xl h-48 bg-slate-900" />
          <div className="animate-pulse rounded-xl h-12 bg-slate-900" />
        </div>
      </div>
    );
  }

  // Success state
  if (claimed) {
    return (
      <CenteredState>
        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 bg-emerald-500/15">
          <Check size={32} className="text-emerald-400" />
        </div>
        <h1 className="text-2xl font-bold mb-2 text-slate-100">
          {animal?.successHeading || 'Welcome to your new animal!'}
        </h1>
        <p className="text-sm mb-6 text-slate-400">
          <strong className="text-slate-200">{animal?.name}</strong> has been added to your collection with full history intact.
        </p>
        <div className="flex gap-3 justify-center flex-wrap">
          <Button asChild className="bg-emerald-600 hover:bg-emerald-700 text-white min-h-11">
            <Link to={animal?.collectionPath || '/MyGeckos'}>View my collection</Link>
          </Button>
          {animal?.passport_code && (
            <Button asChild variant="outline" className="border-emerald-600 text-emerald-300 hover:bg-emerald-600/10 bg-transparent min-h-11">
              <Link to={`/passport/${animal.passport_code}`}>View passport</Link>
            </Button>
          )}
        </div>
      </CenteredState>
    );
  }

  // Error states
  if (error) {
    const messages = {
      not_found: { title: 'Transfer not found', msg: 'This transfer link is invalid or has been removed.' },
      already_claimed: { title: 'Already claimed', msg: 'This transfer has already been completed by another user.' },
      cancelled: { title: 'Transfer cancelled', msg: 'The seller cancelled this transfer before it was claimed.' },
      expired: { title: 'Transfer expired', msg: 'This transfer link has expired. Ask the seller to send a new one.' },
      wrong_account: {
        title: 'Wrong account',
        msg: transfer?.to_email_masked
          ? `This transfer was sent to ${transfer.to_email_masked}. Sign in with that email address to claim it.`
          : 'This transfer was sent to a different email address. Sign in with that address to claim it.',
      },
      claim_failed: { title: 'Claim failed', msg: 'Something went wrong. Please try again or contact the seller.' },
      error: { title: 'Something went wrong', msg: 'Please try again later.' },
    };
    const e = messages[error] || messages.error;
    return (
      <CenteredState>
        <Clock size={48} className="mx-auto mb-4 text-slate-500" />
        <h1 className="text-2xl font-bold mb-2 text-slate-100">{e.title}</h1>
        <p className="text-sm mb-6 text-slate-400">{e.msg}</p>
        <Button asChild className="bg-emerald-600 hover:bg-emerald-700 text-white min-h-11">
          <Link to="/">Go to Geck Inspect</Link>
        </Button>
      </CenteredState>
    );
  }

  // Main claim page
  const profileImg = animal?.image_urls?.[0];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-md mx-auto px-4 py-12">
        <div className="text-center mb-6">
          <ArrowRightLeft size={32} className="mx-auto mb-3 text-emerald-400" />
          <h1 className="text-2xl font-bold text-slate-100">Ownership transfer</h1>
          <p className="text-sm mt-1 text-slate-400">Someone is transferring an animal to you</p>
        </div>

        {/* Animal summary */}
        <div className={`${card} mb-6`}>
          <div className="flex items-center gap-4">
            {profileImg ? (
              <img src={profileImg} alt={animal?.name} className="w-20 h-20 rounded-xl object-cover" />
            ) : (
              <div className="w-20 h-20 rounded-xl flex items-center justify-center text-3xl bg-emerald-500/10">
                {animal?.emoji || '🦎'}
              </div>
            )}
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-slate-100 break-words">{animal?.name}</h2>
              <p className="text-sm text-slate-400">{animal?.subtitle || 'Animal'}</p>
              {animal?.passport_code && (
                <code className="text-xs font-mono px-2 py-0.5 rounded-full mt-1 inline-block bg-slate-800 text-slate-400">
                  {animal.passport_code}
                </code>
              )}
            </div>
          </div>

          {transfer.message && (
            <div className="mt-4 p-3 rounded-lg bg-slate-800/60 border border-slate-800">
              <p className="text-xs uppercase tracking-wider mb-1 text-slate-500">Message from seller</p>
              <p className="text-sm text-slate-300 whitespace-pre-wrap">{transfer.message}</p>
            </div>
          )}

          {transfer.sale_price && (
            <div className="mt-4 flex items-center gap-2">
              <span className="text-sm text-slate-400">Sale price:</span>
              <span className="text-lg font-semibold text-slate-100">
                ${Number(transfer.sale_price).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>
          )}
        </div>

        {/* Price contribution opt-in */}
        {transfer.sale_price && (
          <label className={`${card} flex items-start gap-3 mb-6 cursor-pointer !p-4`}>
            <input
              type="checkbox"
              checked={contributePrice}
              onChange={e => setContributePrice(e.target.checked)}
              className="mt-1 h-4 w-4 rounded accent-emerald-500"
            />
            <div>
              <p className="text-sm font-medium text-slate-200">Contribute this sale price to market data</p>
              <p className="text-xs mt-0.5 text-slate-400">Anonymized, helps breeders understand morph pricing trends.</p>
            </div>
          </label>
        )}

        {/* Auth gate / claim button */}
        {!currentUser ? (
          <div className="space-y-3">
            <Button asChild className="w-full bg-emerald-600 hover:bg-emerald-700 text-white min-h-12">
              <Link to={`/AuthPortal?mode=signup&redirect=/claim/${token}`}>Create your free account to claim</Link>
            </Button>
            <p className="text-xs text-center text-slate-400">
              Already have an account?{' '}
              <Link to={`/AuthPortal?redirect=/claim/${token}`} className="underline text-emerald-300">Sign in</Link>
            </p>
          </div>
        ) : (
          <Button
            onClick={handleClaim}
            disabled={claiming}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white min-h-12"
          >
            {claiming ? <Loader2 size={18} className="animate-spin" /> : <ShieldCheck size={18} />}
            {claiming ? 'Claiming...' : 'Accept ownership'}
          </Button>
        )}

        <p className="text-xs text-center mt-6 text-slate-500">
          Transfer expires {transfer.expires_at ? format(new Date(transfer.expires_at), 'MMM d, yyyy') : 'in 72 hours'}
        </p>
      </div>
    </div>
  );
}
