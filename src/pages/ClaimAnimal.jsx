import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { format } from 'date-fns';
import { ArrowRightLeft, ShieldCheck, Clock, Check } from 'lucide-react';

const C = {
  forest: '#e2e8f0', moss: '#94a3b8', sage: '#10b981',
  paleSage: 'rgba(16,185,129,0.1)', warmWhite: '#020617', gold: '#f59e0b',
  goldLight: 'rgba(245,158,11,0.15)', red: '#ef4444', muted: '#64748b', slate: '#cbd5e1',
  cardBg: '#0f172a', border: 'rgba(51,65,85,0.5)',
};

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

        // Load the animal from whichever table the transfer points at, and
        // normalize into a shared shape the UI below can render either way.
        if (tr.animal_type === 'other_reptile') {
          const { data: r } = await supabase
            .from('other_reptiles')
            .select('id, name, species, morph, image_urls')
            .eq('id', tr.animal_id)
            .maybeSingle();
          setAnimal(r ? {
            isReptile: true,
            name: r.name,
            subtitle: [r.species, r.morph].filter(Boolean).join(' • ') || 'Reptile',
            image_urls: r.image_urls,
            passport_code: null,
            emoji: '🦎',
            collectionPath: '/OtherReptiles',
            successHeading: 'Welcome to your new reptile!',
          } : null);
        } else {
          const { data: g } = await supabase
            .from('geckos')
            .select('id, name, morphs_traits, image_urls, passport_code, sex, weight_grams')
            .eq('id', tr.animal_id)
            .maybeSingle();
          setAnimal(g ? {
            isReptile: false,
            name: g.name,
            subtitle: g.morphs_traits || 'Crested Gecko',
            image_urls: g.image_urls,
            passport_code: g.passport_code,
            emoji: '🦎',
            collectionPath: '/MyGeckos',
            successHeading: 'Welcome to your new gecko!',
          } : null);
        }
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
            {animal?.successHeading || 'Welcome to your new animal!'}
          </h1>
          <p className="text-sm mb-6" style={{ color: C.muted }}>
            <strong>{animal?.name}</strong> has been added to your collection with full history intact.
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Link
              to={animal?.collectionPath || '/MyGeckos'}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium text-white"
              style={{ backgroundColor: C.sage }}
            >
              View My Collection
            </Link>
            {animal?.passport_code && (
              <Link
                to={`/passport/${animal.passport_code}`}
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
  const profileImg = animal?.image_urls?.[0];

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
          style={{ borderColor: C.border, backgroundColor: C.cardBg }}
        >
          <div className="flex items-center gap-4">
            {profileImg ? (
              <img src={profileImg} alt={animal?.name} className="w-20 h-20 rounded-xl object-cover" />
            ) : (
              <div className="w-20 h-20 rounded-xl flex items-center justify-center text-3xl" style={{ backgroundColor: C.paleSage }}>
                {animal?.emoji || '🦎'}
              </div>
            )}
            <div>
              <h2 className="text-lg font-semibold" style={{ color: C.forest, fontFamily: "'DM Serif Display', serif" }}>
                {animal?.name || 'Unknown'}
              </h2>
              <p className="text-sm" style={{ color: C.muted }}>
                {animal?.subtitle || 'Animal'}
              </p>
              {animal?.passport_code && (
                <code className="text-xs font-mono px-1.5 py-0.5 rounded mt-1 inline-block" style={{ backgroundColor: C.paleSage, color: C.muted }}>
                  {animal.passport_code}
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
            style={{ borderColor: C.border, backgroundColor: C.cardBg }}
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
                Anonymized, helps breeders understand morph pricing trends.
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
