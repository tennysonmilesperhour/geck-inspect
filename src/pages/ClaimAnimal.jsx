import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { format } from 'date-fns';
import { ArrowRightLeft, ShieldCheck, Clock, AlertCircle, Check } from 'lucide-react';

const C = {
  forest: '#1A2E1A', moss: '#2D4A2D', sage: '#4E7C4E',
  paleSage: '#E8F0E8', warmWhite: '#F7F9F4', gold: '#C4860A',
  goldLight: '#FDF3E0', red: '#C0392B', muted: '#6B7B6B', slate: '#3D4A3D',
};

export default function ClaimAnimal() {
  const { token } = useParams();
  const auth = useAuth?.() || {};
  const currentUser = auth.user;

  const [transfer, setTransfer] = useState(null);
  const [gecko, setGecko] = useState(null);
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
        const { data: tr, error: trErr } = await supabase
          .from('transfer_requests')
          .select('*')
          .eq('token', token)
          .maybeSingle();

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

        // Load gecko info
        const { data: g } = await supabase
          .from('geckos')
          .select('id, name, morphs_traits, image_urls, passport_code, sex, weight_grams')
          .eq('id', tr.animal_id)
          .maybeSingle();
        setGecko(g);
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
      const now = new Date().toISOString();

      // Update transfer request
      await supabase
        .from('transfer_requests')
        .update({
          status: 'claimed',
          to_user_id: currentUser.id,
          claimed_at: now,
          updated_date: now,
        })
        .eq('id', transfer.id);

      // Update gecko ownership
      await supabase
        .from('geckos')
        .update({
          created_by: currentUser.email,
          status: 'Owned',
          updated_date: now,
        })
        .eq('id', transfer.animal_id);

      // Create ownership record
      await supabase
        .from('ownership_records')
        .insert({
          animal_id: transfer.animal_id,
          owner_user_id: currentUser.id,
          owner_name: currentUser.full_name || currentUser.email,
          acquired_date: now.split('T')[0],
          transfer_method: 'purchased',
          sale_price: transfer.sale_price,
          contributed_to_market_data: contributePrice && !!transfer.sale_price,
          created_by: currentUser.email,
          created_date: now,
          updated_date: now,
        });

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
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: C.warmWhite }}>
        <div className="space-y-4 w-full max-w-md mx-auto px-4">
          <div className="animate-pulse rounded-xl h-48" style={{ backgroundColor: C.paleSage }} />
          <div className="animate-pulse rounded-xl h-12" style={{ backgroundColor: C.paleSage }} />
        </div>
      </div>
    );
  }

  // Success state
  if (claimed) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: C.warmWhite }}>
        <div className="text-center max-w-md mx-auto px-4">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ backgroundColor: C.paleSage }}
          >
            <Check size={32} style={{ color: C.sage }} />
          </div>
          <h1 className="text-2xl mb-2" style={{ fontFamily: "'DM Serif Display', serif", color: C.forest }}>
            Welcome to your new gecko!
          </h1>
          <p className="text-sm mb-6" style={{ color: C.muted }}>
            <strong>{gecko?.name}</strong> has been added to your collection with full history intact.
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Link
              to="/MyGeckos"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium text-white"
              style={{ backgroundColor: C.sage }}
            >
              View My Collection
            </Link>
            {gecko?.passport_code && (
              <Link
                to={`/passport/${gecko.passport_code}`}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium border"
                style={{ borderColor: C.sage, color: C.sage }}
              >
                View Passport
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Error states
  if (error) {
    const messages = {
      not_found: { title: 'Transfer not found', msg: 'This transfer link is invalid or has been removed.' },
      already_claimed: { title: 'Already claimed', msg: 'This transfer has already been completed by another user.' },
      cancelled: { title: 'Transfer cancelled', msg: 'The seller cancelled this transfer before it was claimed.' },
      expired: { title: 'Transfer expired', msg: 'This transfer link has expired. Ask the seller to send a new one.' },
      claim_failed: { title: 'Claim failed', msg: 'Something went wrong. Please try again or contact the seller.' },
      error: { title: 'Something went wrong', msg: 'Please try again later.' },
    };
    const e = messages[error] || messages.error;
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: C.warmWhite }}>
        <div className="text-center max-w-md mx-auto px-4">
          <Clock size={48} style={{ color: C.muted }} className="mx-auto mb-4" />
          <h1 className="text-2xl mb-2" style={{ fontFamily: "'DM Serif Display', serif", color: C.forest }}>
            {e.title}
          </h1>
          <p className="text-sm mb-6" style={{ color: C.muted }}>{e.msg}</p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white"
            style={{ backgroundColor: C.sage }}
          >
            Go to Geck Inspect
          </Link>
        </div>
      </div>
    );
  }

  // Main claim page
  const profileImg = gecko?.image_urls?.[0];

  return (
    <div className="min-h-screen" style={{ backgroundColor: C.warmWhite, fontFamily: "'DM Sans', sans-serif" }}>
      <div className="max-w-md mx-auto px-4 py-12">
        <div className="text-center mb-6">
          <ArrowRightLeft size={32} style={{ color: C.sage }} className="mx-auto mb-3" />
          <h1 className="text-2xl" style={{ fontFamily: "'DM Serif Display', serif", color: C.forest }}>
            Ownership Transfer
          </h1>
          <p className="text-sm mt-1" style={{ color: C.muted }}>
            Someone is transferring an animal to you
          </p>
        </div>

        {/* Animal summary */}
        <div
          className="rounded-xl border p-6 mb-6"
          style={{ borderColor: 'rgba(78,124,78,0.15)', backgroundColor: 'white' }}
        >
          <div className="flex items-center gap-4">
            {profileImg ? (
              <img src={profileImg} alt={gecko?.name} className="w-20 h-20 rounded-xl object-cover" />
            ) : (
              <div className="w-20 h-20 rounded-xl flex items-center justify-center text-3xl" style={{ backgroundColor: C.paleSage }}>
                🦎
              </div>
            )}
            <div>
              <h2 className="text-lg font-semibold" style={{ color: C.forest, fontFamily: "'DM Serif Display', serif" }}>
                {gecko?.name || 'Unknown'}
              </h2>
              <p className="text-sm" style={{ color: C.muted }}>
                {gecko?.morphs_traits || 'Crested Gecko'}
              </p>
              {gecko?.passport_code && (
                <code className="text-xs font-mono px-1.5 py-0.5 rounded mt-1 inline-block" style={{ backgroundColor: C.paleSage, color: C.muted }}>
                  {gecko.passport_code}
                </code>
              )}
            </div>
          </div>

          {transfer.message && (
            <div className="mt-4 p-3 rounded-lg" style={{ backgroundColor: C.paleSage }}>
              <p className="text-xs uppercase tracking-wider mb-1" style={{ color: C.muted }}>Message from seller</p>
              <p className="text-sm" style={{ color: C.slate }}>{transfer.message}</p>
            </div>
          )}

          {transfer.sale_price && (
            <div className="mt-4 flex items-center gap-2">
              <span className="text-sm" style={{ color: C.muted }}>Sale price:</span>
              <span className="text-lg font-semibold" style={{ color: C.forest }}>
                ${Number(transfer.sale_price).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>
          )}
        </div>

        {/* Price contribution opt-in */}
        {transfer.sale_price && (
          <label
            className="flex items-start gap-3 rounded-xl border p-4 mb-6 cursor-pointer"
            style={{ borderColor: 'rgba(78,124,78,0.15)', backgroundColor: 'white' }}
          >
            <input
              type="checkbox"
              checked={contributePrice}
              onChange={e => setContributePrice(e.target.checked)}
              className="mt-1 rounded"
              style={{ accentColor: C.sage }}
            />
            <div>
              <p className="text-sm font-medium" style={{ color: C.slate }}>
                Contribute this sale price to market data
              </p>
              <p className="text-xs mt-0.5" style={{ color: C.muted }}>
                Anonymized — helps breeders understand morph pricing trends.
              </p>
            </div>
          </label>
        )}

        {/* Auth gate / claim button */}
        {!currentUser ? (
          <div className="space-y-3">
            <Link
              to={`/AuthPortal?redirect=/claim/${token}`}
              className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg text-sm font-medium text-white"
              style={{ backgroundColor: C.sage }}
            >
              Create your free account to claim
            </Link>
            <p className="text-xs text-center" style={{ color: C.muted }}>
              Already have an account? <Link to={`/AuthPortal?redirect=/claim/${token}`} className="underline" style={{ color: C.sage }}>Sign in</Link>
            </p>
          </div>
        ) : (
          <button
            onClick={handleClaim}
            disabled={claiming}
            className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: C.sage }}
          >
            {claiming ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <ShieldCheck size={18} />
            )}
            {claiming ? 'Claiming...' : 'Accept Ownership'}
          </button>
        )}

        <p className="text-xs text-center mt-6" style={{ color: C.muted }}>
          Transfer expires {transfer.expires_at ? format(new Date(transfer.expires_at), 'MMM d, yyyy') : 'in 72 hours'}
        </p>
      </div>
    </div>
  );
}
