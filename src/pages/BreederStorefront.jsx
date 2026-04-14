import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { format } from 'date-fns';
import { MapPin, Calendar, ShieldCheck, Instagram, Globe, Facebook, Star, MessageSquare, Edit, Save, ExternalLink } from 'lucide-react';

const C = { forest: '#e2e8f0', sage: '#10b981', paleSage: 'rgba(16,185,129,0.1)', warmWhite: '#020617', gold: '#f59e0b', goldLight: 'rgba(245,158,11,0.15)', slate: '#cbd5e1', muted: '#64748b', cardBg: '#0f172a', border: 'rgba(51,65,85,0.5)' };

function StarRating({ rating }) {
  return <div className="flex gap-0.5">{[1,2,3,4,5].map(i => <Star key={i} size={14} fill={i <= rating ? C.gold : 'transparent'} style={{ color: i <= rating ? C.gold : C.muted }} />)}</div>;
}

export default function BreederStorefront() {
  const auth = useAuth?.() || {};
  const [profile, setProfile] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [forSale, setForSale] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const slug = new URLSearchParams(window.location.search).get('slug');
  const isSetup = !slug && !loading && !profile;
  const [setupForm, setSetupForm] = useState({ display_name: '', custom_slug: '', bio: '', location: '', years_breeding: '', specialty_morphs: '' });

  useEffect(() => {
    (async () => {
      setLoading(true);
      let p = null;
      if (slug) {
        const { data } = await supabase.from('breeder_profiles').select('*').eq('custom_slug', slug).maybeSingle();
        p = data;
      } else if (auth.user?.email) {
        const { data } = await supabase.from('breeder_profiles').select('*').eq('created_by', auth.user.email).maybeSingle();
        p = data;
      }
      setProfile(p);

      if (p) {
        const { data: revs } = await supabase.from('breeder_reviews').select('*').eq('reviewed_user_id', p.user_id).order('created_date', { ascending: false });
        setReviews(revs || []);
        const ownerEmail = p.created_by;
        if (ownerEmail) {
          const { data: geckos } = await supabase.from('geckos').select('id, name, morphs_traits, image_urls, asking_price, passport_code, sex, status')
            .eq('created_by', ownerEmail).or('status.ilike.%sale%,status.eq.For Sale');
          setForSale(geckos || []);
        }
        setEditForm({ display_name: p.display_name || '', bio: p.bio || '', location: p.location || '', years_breeding: p.years_breeding || '', specialty_morphs: (p.specialty_morphs || []).join(', ') });
      }
      setLoading(false);
    })();
  }, [slug, auth.user?.email]);

  const avgRating = reviews.length > 0 ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : null;
  const isOwner = auth.user?.email && profile?.created_by === auth.user.email;

  const saveProfile = async () => {
    const updates = { ...editForm, specialty_morphs: editForm.specialty_morphs.split(',').map(s => s.trim()).filter(Boolean), updated_date: new Date().toISOString() };
    await supabase.from('breeder_profiles').update(updates).eq('id', profile.id);
    setProfile(p => ({ ...p, ...updates }));
    setEditing(false);
  };

  const createStorefront = async () => {
    if (!setupForm.display_name || !setupForm.custom_slug) return;
    const { data } = await supabase.from('breeder_profiles').insert({
      ...setupForm, specialty_morphs: setupForm.specialty_morphs.split(',').map(s => s.trim()).filter(Boolean),
      user_id: auth.user?.id, created_by: auth.user?.email,
    }).select().single();
    if (data) { setProfile(data); setEditForm({ display_name: data.display_name, bio: data.bio || '', location: data.location || '', years_breeding: data.years_breeding || '', specialty_morphs: (data.specialty_morphs || []).join(', ') }); }
  };

  if (loading) {
    return <div className="min-h-screen p-6" style={{ backgroundColor: C.warmWhite }}><div className="max-w-3xl mx-auto space-y-4">{[200, 100, 300].map((h, i) => <div key={i} className="animate-pulse rounded-xl" style={{ height: h, backgroundColor: C.paleSage }} />)}</div></div>;
  }

  // ─── SETUP FORM (no profile yet) ───
  if (isSetup) {
    return (
      <div className="min-h-screen p-6" style={{ backgroundColor: C.warmWhite, fontFamily: "'DM Sans', sans-serif" }}>
        <div className="max-w-lg mx-auto">
          <h1 className="text-3xl mb-2" style={{ fontFamily: "'DM Serif Display', serif", color: C.forest }}>Set Up Your Storefront</h1>
          <p className="text-sm mb-6" style={{ color: C.muted }}>Create your public breeder page to share with buyers.</p>
          <div className="space-y-4">
            <div><label className="text-xs uppercase block mb-1" style={{ color: C.muted }}>Display Name *</label><input value={setupForm.display_name} onChange={e => setSetupForm(p => ({ ...p, display_name: e.target.value }))} className="w-full rounded-xl border px-4 py-3 text-sm" style={{ borderColor: 'rgba(51,65,85,0.5)', color: C.slate }} placeholder="Tennys Crested Geckos" /></div>
            <div><label className="text-xs uppercase block mb-1" style={{ color: C.muted }}>URL Slug * (geckinspect.com/BreederStorefront?slug=your-slug)</label><input value={setupForm.custom_slug} onChange={e => setSetupForm(p => ({ ...p, custom_slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))} className="w-full rounded-xl border px-4 py-3 text-sm font-mono" style={{ borderColor: 'rgba(51,65,85,0.5)', color: C.slate }} placeholder="tennys-crested-geckos" /></div>
            <div><label className="text-xs uppercase block mb-1" style={{ color: C.muted }}>Bio</label><textarea value={setupForm.bio} onChange={e => setSetupForm(p => ({ ...p, bio: e.target.value }))} rows={3} className="w-full rounded-xl border px-4 py-3 text-sm" style={{ borderColor: 'rgba(51,65,85,0.5)', color: C.slate }} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs uppercase block mb-1" style={{ color: C.muted }}>Location</label><input value={setupForm.location} onChange={e => setSetupForm(p => ({ ...p, location: e.target.value }))} className="w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'rgba(51,65,85,0.5)', color: C.slate }} placeholder="Utah, USA" /></div>
              <div><label className="text-xs uppercase block mb-1" style={{ color: C.muted }}>Years Breeding</label><input type="number" value={setupForm.years_breeding} onChange={e => setSetupForm(p => ({ ...p, years_breeding: Number(e.target.value) }))} className="w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'rgba(51,65,85,0.5)', color: C.slate }} /></div>
            </div>
            <div><label className="text-xs uppercase block mb-1" style={{ color: C.muted }}>Specialty Morphs (comma-separated)</label><input value={setupForm.specialty_morphs} onChange={e => setSetupForm(p => ({ ...p, specialty_morphs: e.target.value }))} className="w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'rgba(51,65,85,0.5)', color: C.slate }} placeholder="Lilly White, Extreme Harlequin, Tricolor" /></div>
            <button onClick={createStorefront} className="px-6 py-2.5 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: C.sage }}>Create Storefront</button>
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: C.warmWhite }}><div className="text-center"><p className="text-lg" style={{ color: C.muted }}>Breeder not found</p></div></div>;
  }

  // ─── STOREFRONT ───
  return (
    <div className="min-h-screen" style={{ backgroundColor: C.warmWhite, fontFamily: "'DM Sans', sans-serif" }}>
      {/* Banner */}
      <div className="h-48 relative" style={{ background: profile.banner_photo ? `url(${profile.banner_photo}) center/cover` : `linear-gradient(135deg, ${C.forest}, ${C.sage})` }}>
        <div className="absolute -bottom-12 left-6">
          <div className="w-24 h-24 rounded-full border-4 border-white flex items-center justify-center text-3xl font-bold shadow-lg"
            style={{ backgroundColor: profile.profile_photo ? 'transparent' : C.paleSage, color: C.forest, backgroundImage: profile.profile_photo ? `url(${profile.profile_photo})` : 'none', backgroundSize: 'cover' }}>
            {!profile.profile_photo && (profile.display_name || '?')[0].toUpperCase()}
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 pt-16 pb-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2">
              {editing ? <input value={editForm.display_name} onChange={e => setEditForm(p => ({ ...p, display_name: e.target.value }))} className="text-2xl font-bold border-b-2 bg-transparent" style={{ fontFamily: "'DM Serif Display', serif", color: C.forest, borderColor: C.sage }} />
                : <h1 className="text-2xl" style={{ fontFamily: "'DM Serif Display', serif", color: C.forest }}>{profile.display_name}</h1>}
              {profile.is_verified && <ShieldCheck size={18} style={{ color: C.sage }} />}
            </div>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              {(editing ? editForm.location : profile.location) && <span className="flex items-center gap-1 text-sm" style={{ color: C.muted }}><MapPin size={13} />{editing ? <input value={editForm.location} onChange={e => setEditForm(p => ({ ...p, location: e.target.value }))} className="bg-transparent border-b text-sm" style={{ color: C.muted }} /> : profile.location}</span>}
              {profile.years_breeding && <span className="text-sm" style={{ color: C.muted }}>{profile.years_breeding} years breeding</span>}
            </div>
          </div>
          {isOwner && (
            editing ? <button onClick={saveProfile} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm text-white" style={{ backgroundColor: C.sage }}><Save size={14} /> Save</button>
              : <button onClick={() => setEditing(true)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm border" style={{ borderColor: C.sage, color: C.sage }}><Edit size={14} /> Edit</button>
          )}
        </div>

        {/* Bio */}
        {editing ? <textarea value={editForm.bio} onChange={e => setEditForm(p => ({ ...p, bio: e.target.value }))} rows={3} className="w-full rounded-lg border px-3 py-2 text-sm mb-4" style={{ borderColor: 'rgba(51,65,85,0.5)', color: C.slate }} />
          : profile.bio && <p className="text-sm mb-4" style={{ color: C.slate }}>{profile.bio}</p>}

        {/* Specialty morphs */}
        {(profile.specialty_morphs || []).length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {profile.specialty_morphs.map(m => <span key={m} className="text-xs rounded-full px-2.5 py-1" style={{ backgroundColor: C.paleSage, color: C.sage }}>{m}</span>)}
          </div>
        )}

        {/* Stats row */}
        <div className="flex gap-4 flex-wrap py-3 mb-6 border-y" style={{ borderColor: C.paleSage }}>
          <span className="text-sm" style={{ color: C.slate }}><strong>{forSale.length}</strong> <span style={{ color: C.muted }}>for sale</span></span>
          <span className="text-sm" style={{ color: C.slate }}><strong>{reviews.length}</strong> <span style={{ color: C.muted }}>reviews</span></span>
          {avgRating && <span className="flex items-center gap-1 text-sm" style={{ color: C.slate }}><Star size={13} fill={C.gold} style={{ color: C.gold }} /> {avgRating}</span>}
          {profile.ships_to?.length > 0 && <span className="text-sm" style={{ color: C.muted }}>Ships to: {profile.ships_to.join(', ')}</span>}
        </div>

        {/* For Sale */}
        <h2 className="text-xl mb-4" style={{ fontFamily: "'DM Serif Display', serif", color: C.forest }}>Available Geckos</h2>
        {forSale.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
            {forSale.map(g => (
              <a key={g.id} href={g.passport_code ? `/passport/${g.passport_code}` : `/GeckoDetail?id=${g.id}`}
                className="rounded-xl border overflow-hidden transition hover:shadow-md" style={{ borderColor: 'rgba(51,65,85,0.5)', backgroundColor: C.cardBg }}>
                {g.image_urls?.[0] ? <img src={g.image_urls[0]} alt={g.name} className="w-full h-32 object-cover" /> : <div className="w-full h-32 flex items-center justify-center text-3xl" style={{ backgroundColor: C.paleSage }}>🦎</div>}
                <div className="p-3">
                  <h3 className="text-sm font-semibold truncate" style={{ color: C.forest }}>{g.name}</h3>
                  <p className="text-xs" style={{ color: C.muted }}>{g.morphs_traits || 'Crested Gecko'}</p>
                  {g.asking_price && <p className="text-sm font-bold mt-1" style={{ color: C.forest }}>${g.asking_price}</p>}
                </div>
              </a>
            ))}
          </div>
        ) : (
          <p className="text-sm text-center py-8 mb-8" style={{ color: C.muted }}>No geckos currently for sale</p>
        )}

        {/* Reviews */}
        <h2 className="text-xl mb-4" style={{ fontFamily: "'DM Serif Display', serif", color: C.forest }}>Reviews</h2>
        {reviews.length > 0 ? (
          <div className="space-y-3 mb-8">
            {reviews.map(r => (
              <div key={r.id} className="rounded-xl border p-4" style={{ borderColor: 'rgba(51,65,85,0.5)', backgroundColor: C.cardBg }}>
                <div className="flex items-center gap-2 mb-2">
                  <StarRating rating={r.rating} />
                  {r.is_verified && <span className="text-xs rounded-full px-2 py-0.5" style={{ backgroundColor: C.paleSage, color: C.sage }}>Verified purchase</span>}
                </div>
                {r.title && <p className="text-sm font-semibold" style={{ color: C.forest }}>{r.title}</p>}
                {r.body && <p className="text-sm mt-1" style={{ color: C.slate }}>{r.body}</p>}
                <p className="text-xs mt-2" style={{ color: C.muted }}>{r.created_date ? format(new Date(r.created_date), 'MMM d, yyyy') : ''}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-center py-8" style={{ color: C.muted }}>No reviews yet</p>
        )}

        {/* Footer */}
        <div className="text-center py-4"><p className="text-xs" style={{ color: C.muted }}>Powered by <span className="font-semibold" style={{ color: C.forest }}>Geck Inspect</span></p></div>
      </div>
    </div>
  );
}
