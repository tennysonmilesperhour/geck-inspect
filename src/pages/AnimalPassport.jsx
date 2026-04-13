import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Gecko, WeightRecord, OwnershipRecord, FeedingRecord, ShedRecord, VetRecord } from '@/entities/all';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { format } from 'date-fns';
import {
  calculateAge, STATUS_BADGE_STYLES, PATTERN_GRADES, TRANSFER_METHOD_LABELS, passportUrl
} from '@/lib/passportUtils';
import { QRCodeSVG } from 'qrcode.react';
import {
  Calendar, Scale, Droplets, Heart, Stethoscope, ChevronLeft, ChevronRight,
  ExternalLink, Copy, QrCode, ArrowRightLeft, ShieldCheck, Clock, Check, X,
  GitBranch, User as UserIcon, Utensils
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts';
import { Helmet } from 'react-helmet-async';

/* ─── Design tokens ─────────────────────────────────────────────── */
const C = {
  forest:    '#1A2E1A',
  moss:      '#2D4A2D',
  sage:      '#4E7C4E',
  paleSage:  '#E8F0E8',
  warmWhite: '#F7F9F4',
  gold:      '#C4860A',
  goldLight: '#FDF3E0',
  red:       '#C0392B',
  slate:     '#3D4A3D',
  muted:     '#6B7B6B',
};

/* ─── Tiny sub-components ───────────────────────────────────────── */

function StatusBadge({ status }) {
  const s = STATUS_BADGE_STYLES[status] || STATUS_BADGE_STYLES.owned;
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={{ backgroundColor: s.bg, color: s.text }}
    >
      {s.label}
    </span>
  );
}

function PatternGradeBadge({ grade }) {
  if (!grade) return null;
  const g = PATTERN_GRADES[grade];
  if (!g) return null;
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold"
      style={{
        backgroundColor: g.premium ? C.goldLight : C.paleSage,
        color: g.premium ? '#633806' : C.forest,
      }}
      title={g.description}
    >
      {g.premium && <span className="mr-1">&#9733;</span>}
      {g.label}
    </span>
  );
}

function StatChip({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-1.5 rounded-lg px-3 py-2" style={{ backgroundColor: C.paleSage }}>
      <Icon size={14} style={{ color: C.sage }} />
      <span className="text-xs uppercase tracking-wider" style={{ color: C.muted }}>{label}</span>
      <span className="text-sm font-medium ml-auto" style={{ color: C.slate }}>{value || '—'}</span>
    </div>
  );
}

function MorphPill({ text, small }) {
  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${small ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm'}`}
      style={{ backgroundColor: C.paleSage, color: C.forest }}
    >
      {text}
    </span>
  );
}

function SectionHeading({ children }) {
  return (
    <h2
      className="text-xl mb-4"
      style={{ fontFamily: "'DM Serif Display', serif", color: C.forest }}
    >
      {children}
    </h2>
  );
}

/* ─── Photo carousel ────────────────────────────────────────────── */

function PhotoCarousel({ images }) {
  const [idx, setIdx] = useState(0);
  if (!images || images.length === 0) {
    return (
      <div
        className="w-full flex items-center justify-center rounded-xl"
        style={{ height: 400, backgroundColor: C.paleSage }}
      >
        <div className="text-center">
          <div className="text-6xl mb-2" style={{ color: C.muted }}>🦎</div>
          <p className="text-sm" style={{ color: C.muted }}>No photos yet</p>
        </div>
      </div>
    );
  }
  const prev = () => setIdx(i => (i - 1 + images.length) % images.length);
  const next = () => setIdx(i => (i + 1) % images.length);
  return (
    <div className="relative rounded-xl overflow-hidden" style={{ height: 400 }}>
      <img
        src={images[idx]}
        alt="Animal photo"
        className="w-full h-full object-cover transition-opacity duration-200"
      />
      {images.length > 1 && (
        <>
          <button onClick={prev} className="absolute left-3 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full p-2 shadow-lg transition">
            <ChevronLeft size={20} style={{ color: C.forest }} />
          </button>
          <button onClick={next} className="absolute right-3 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full p-2 shadow-lg transition">
            <ChevronRight size={20} style={{ color: C.forest }} />
          </button>
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={() => setIdx(i)}
                className="w-2 h-2 rounded-full transition"
                style={{ backgroundColor: i === idx ? 'white' : 'rgba(255,255,255,0.4)' }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ─── Lineage tree (3-node) ─────────────────────────────────────── */

function LineageTree({ gecko, sire, dam }) {
  const ParentNode = ({ animal, manualName, label }) => {
    const name = animal?.name || manualName || 'Unknown';
    const hasPassport = animal?.passport_code;
    return (
      <div
        className="rounded-xl p-4 text-center min-w-[140px] border"
        style={{ backgroundColor: C.warmWhite, borderColor: 'rgba(78,124,78,0.15)' }}
      >
        <p className="text-xs uppercase tracking-wider mb-1" style={{ color: C.muted }}>{label}</p>
        {hasPassport ? (
          <Link
            to={`/passport/${animal.passport_code}`}
            className="text-sm font-semibold hover:underline"
            style={{ color: C.sage }}
          >
            {name}
          </Link>
        ) : (
          <p className="text-sm font-semibold" style={{ color: C.slate }}>{name}</p>
        )}
        {animal?.morphs_traits && (
          <p className="text-xs mt-1" style={{ color: C.muted }}>{animal.morphs_traits}</p>
        )}
        {!animal && manualName && (
          <p className="text-xs mt-1 italic" style={{ color: C.muted }}>Not in Geck Inspect</p>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex gap-4 justify-center flex-wrap">
        <ParentNode animal={sire} manualName={gecko?.sire_name} label="Sire" />
        <ParentNode animal={dam} manualName={gecko?.dam_name} label="Dam" />
      </div>
      <div className="w-px h-6" style={{ backgroundColor: C.sage }} />
      <div
        className="rounded-xl p-4 text-center border-2"
        style={{ borderColor: C.sage, backgroundColor: C.warmWhite }}
      >
        <p className="text-sm font-bold" style={{ color: C.forest, fontFamily: "'DM Serif Display', serif" }}>
          {gecko?.name || 'This gecko'}
        </p>
        {gecko?.morphs_traits && (
          <p className="text-xs mt-1" style={{ color: C.muted }}>{gecko.morphs_traits}</p>
        )}
      </div>
    </div>
  );
}

/* ─── Ownership timeline ────────────────────────────────────────── */

function OwnershipTimeline({ records }) {
  if (!records || records.length === 0) {
    return (
      <div className="text-center py-6">
        <ShieldCheck size={24} style={{ color: C.muted }} className="mx-auto mb-2" />
        <p className="text-sm" style={{ color: C.muted }}>Original owner — no transfers recorded</p>
      </div>
    );
  }
  return (
    <div className="space-y-0">
      {records.map((r, i) => (
        <div key={r.id} className="flex gap-4 items-start">
          <div className="flex flex-col items-center">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold shrink-0"
              style={{ backgroundColor: C.paleSage, color: C.forest }}
            >
              {(r.owner_name || '?')[0].toUpperCase()}
            </div>
            {i < records.length - 1 && (
              <div className="w-px flex-1 my-1" style={{ backgroundColor: 'rgba(78,124,78,0.2)' }} />
            )}
          </div>
          <div className="pb-6">
            <p className="text-sm font-semibold" style={{ color: C.slate }}>{r.owner_name}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs" style={{ color: C.muted }}>
                {r.acquired_date ? format(new Date(r.acquired_date), 'MMM d, yyyy') : 'Unknown date'}
              </span>
              {r.transfer_method && (
                <span
                  className="text-xs rounded-full px-2 py-0.5"
                  style={{ backgroundColor: C.paleSage, color: C.forest }}
                >
                  {TRANSFER_METHOD_LABELS[r.transfer_method] || r.transfer_method}
                </span>
              )}
            </div>
            {r.notes && <p className="text-xs mt-1" style={{ color: C.muted }}>{r.notes}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Care history tabs ─────────────────────────────────────────── */

function CareHistoryTabs({ feedingRecords, weightRecords, shedRecords, vetRecords }) {
  const [tab, setTab] = useState('weight');
  const tabs = [
    { key: 'weight', label: 'Weight', icon: Scale, count: weightRecords.length },
    { key: 'feeding', label: 'Feeding', icon: Utensils, count: feedingRecords.length },
    { key: 'sheds', label: 'Sheds', icon: Droplets, count: shedRecords.length },
    { key: 'vet', label: 'Vet', icon: Stethoscope, count: vetRecords.length },
  ];

  const shedQualityBadge = (quality) => {
    const retained = ['retained_toes', 'retained_eye_caps', 'partial'];
    const isIssue = retained.includes(quality);
    return (
      <span
        className="text-xs rounded-full px-2 py-0.5"
        style={{
          backgroundColor: isIssue ? '#FEF3CD' : C.paleSage,
          color: isIssue ? '#856404' : C.forest,
        }}
      >
        {(quality || 'unknown').replace(/_/g, ' ')}
      </span>
    );
  };

  return (
    <div>
      <div className="flex gap-1 mb-4 flex-wrap">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition"
            style={{
              backgroundColor: tab === t.key ? C.sage : 'transparent',
              color: tab === t.key ? 'white' : C.muted,
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            <t.icon size={14} />
            {t.label}
            <span className="text-xs opacity-70">({t.count})</span>
          </button>
        ))}
      </div>

      {tab === 'weight' && (
        <div>
          {weightRecords.length >= 3 ? (
            <div className="rounded-xl p-4" style={{ backgroundColor: C.warmWhite }}>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={weightRecords.map(w => ({
                  date: format(new Date(w.record_date || w.date || w.created_date), 'MMM d'),
                  weight: w.weight_grams,
                  raw_date: new Date(w.record_date || w.date || w.created_date),
                })).sort((a, b) => a.raw_date - b.raw_date)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(78,124,78,0.1)" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: C.muted }} />
                  <YAxis tick={{ fontSize: 11, fill: C.muted }} unit="g" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: C.warmWhite,
                      border: `1px solid ${C.paleSage}`,
                      borderRadius: 8,
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: 12,
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="weight"
                    stroke={C.sage}
                    strokeWidth={2}
                    dot={{ fill: C.sage, r: 3 }}
                    activeDot={{ r: 5, fill: C.forest }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="text-center py-8 rounded-xl" style={{ backgroundColor: C.warmWhite }}>
              <Scale size={24} className="mx-auto mb-2" style={{ color: C.muted }} />
              <p className="text-sm" style={{ color: C.muted }}>
                {weightRecords.length === 0
                  ? 'No weight records yet'
                  : 'Add more weight logs to see trends'}
              </p>
            </div>
          )}
        </div>
      )}

      {tab === 'feeding' && (
        <div>
          {feedingRecords.length > 0 ? (
            <>
              <div className="mb-3 rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: C.paleSage, color: C.forest }}>
                Acceptance rate: {Math.round((feedingRecords.filter(f => f.accepted !== false).length / feedingRecords.length) * 100)}%
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${C.paleSage}` }}>
                      <th className="text-left py-2 px-2 text-xs uppercase tracking-wider" style={{ color: C.muted }}>Date</th>
                      <th className="text-left py-2 px-2 text-xs uppercase tracking-wider" style={{ color: C.muted }}>Food</th>
                      <th className="text-left py-2 px-2 text-xs uppercase tracking-wider" style={{ color: C.muted }}>Accepted</th>
                    </tr>
                  </thead>
                  <tbody>
                    {feedingRecords.slice(0, 20).map((f, i) => (
                      <tr key={f.id} style={{ backgroundColor: i % 2 === 0 ? 'transparent' : C.paleSage + '33' }}>
                        <td className="py-1.5 px-2" style={{ color: C.slate }}>
                          {f.date ? format(new Date(f.date), 'MMM d, yyyy') : '—'}
                        </td>
                        <td className="py-1.5 px-2" style={{ color: C.slate }}>{f.food_type || '—'}</td>
                        <td className="py-1.5 px-2">
                          {f.accepted !== false
                            ? <Check size={14} style={{ color: C.sage }} />
                            : <X size={14} style={{ color: C.red }} />}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="text-center py-8 rounded-xl" style={{ backgroundColor: C.warmWhite }}>
              <Utensils size={24} className="mx-auto mb-2" style={{ color: C.muted }} />
              <p className="text-sm" style={{ color: C.muted }}>No feeding records yet</p>
            </div>
          )}
        </div>
      )}

      {tab === 'sheds' && (
        <div>
          {shedRecords.length > 0 ? (
            <div className="space-y-2">
              {shedRecords.slice(0, 15).map(s => (
                <div
                  key={s.id}
                  className="flex items-center gap-3 rounded-lg px-3 py-2"
                  style={{ backgroundColor: C.warmWhite }}
                >
                  <span className="text-sm" style={{ color: C.slate }}>
                    {s.date ? format(new Date(s.date), 'MMM d, yyyy') : '—'}
                  </span>
                  {shedQualityBadge(s.quality)}
                  {s.notes && <span className="text-xs" style={{ color: C.muted }}>{s.notes}</span>}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 rounded-xl" style={{ backgroundColor: C.warmWhite }}>
              <Droplets size={24} className="mx-auto mb-2" style={{ color: C.muted }} />
              <p className="text-sm" style={{ color: C.muted }}>No shed records yet</p>
            </div>
          )}
        </div>
      )}

      {tab === 'vet' && (
        <div>
          {vetRecords.length > 0 ? (
            <div className="space-y-3">
              {vetRecords.map(v => (
                <VetRecordCard key={v.id} record={v} />
              ))}
            </div>
          ) : (
            <div className="text-center py-8 rounded-xl" style={{ backgroundColor: C.warmWhite }}>
              <Stethoscope size={24} className="mx-auto mb-2" style={{ color: C.muted }} />
              <p className="text-sm" style={{ color: C.muted }}>No vet records</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function VetRecordCard({ record }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div
      className="rounded-xl border p-4 cursor-pointer transition hover:shadow-sm"
      style={{ borderColor: 'rgba(78,124,78,0.15)', backgroundColor: C.warmWhite }}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold" style={{ color: C.slate }}>{record.reason || 'Vet visit'}</p>
          <p className="text-xs" style={{ color: C.muted }}>
            {record.date ? format(new Date(record.date), 'MMM d, yyyy') : '—'}
            {record.vet_name && ` · ${record.vet_name}`}
          </p>
        </div>
        <ChevronRight
          size={16}
          style={{ color: C.muted, transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 200ms' }}
        />
      </div>
      {expanded && (
        <div className="mt-3 pt-3 space-y-2" style={{ borderTop: `1px solid ${C.paleSage}` }}>
          {record.findings && (
            <div>
              <p className="text-xs uppercase tracking-wider" style={{ color: C.muted }}>Findings</p>
              <p className="text-sm" style={{ color: C.slate }}>{record.findings}</p>
            </div>
          )}
          {record.treatment && (
            <div>
              <p className="text-xs uppercase tracking-wider" style={{ color: C.muted }}>Treatment</p>
              <p className="text-sm" style={{ color: C.slate }}>{record.treatment}</p>
            </div>
          )}
          {record.follow_up && (
            <div>
              <p className="text-xs uppercase tracking-wider" style={{ color: C.muted }}>Follow-up</p>
              <p className="text-sm" style={{ color: C.slate }}>{format(new Date(record.follow_up), 'MMM d, yyyy')}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN PASSPORT PAGE
   ═══════════════════════════════════════════════════════════════════ */

export default function AnimalPassport() {
  const { passportCode } = useParams();
  const auth = useAuth?.() || {};
  const currentUser = auth.user;

  const [gecko, setGecko] = useState(null);
  const [sire, setSire] = useState(null);
  const [dam, setDam] = useState(null);
  const [ownershipRecords, setOwnershipRecords] = useState([]);
  const [feedingRecords, setFeedingRecords] = useState([]);
  const [weightRecords, setWeightRecords] = useState([]);
  const [shedRecords, setShedRecords] = useState([]);
  const [vetRecords, setVetRecords] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!passportCode) return;
    const load = async () => {
      setIsLoading(true);
      try {
        // Find gecko by passport_code
        const { data: geckos, error: gErr } = await supabase
          .from('geckos')
          .select('*')
          .eq('passport_code', passportCode)
          .limit(1);
        if (gErr) throw gErr;
        if (!geckos || geckos.length === 0) {
          setError('not_found');
          setIsLoading(false);
          return;
        }
        const g = geckos[0];
        if (!g.is_public && g.created_by !== currentUser?.email) {
          setError('private');
          setIsLoading(false);
          return;
        }
        setGecko(g);

        // Load related data in parallel
        const [
          sireRes, damRes, ownerRes, feedRes, weightRes, shedRes, vetRes
        ] = await Promise.allSettled([
          g.sire_id ? supabase.from('geckos').select('*').eq('id', g.sire_id).maybeSingle() : null,
          g.dam_id ? supabase.from('geckos').select('*').eq('id', g.dam_id).maybeSingle() : null,
          supabase.from('ownership_records').select('*').eq('animal_id', g.id).order('acquired_date', { ascending: true }),
          supabase.from('feeding_records').select('*').eq('animal_id', g.id).order('date', { ascending: false }).limit(30),
          supabase.from('weight_records').select('*').eq('gecko_id', g.id).order('record_date', { ascending: true }),
          supabase.from('shed_records').select('*').eq('animal_id', g.id).order('date', { ascending: false }).limit(20),
          supabase.from('vet_records').select('*').eq('animal_id', g.id).order('date', { ascending: false }),
        ]);

        if (sireRes?.value?.data) setSire(sireRes.value.data);
        if (damRes?.value?.data) setDam(damRes.value.data);
        if (ownerRes?.value?.data) setOwnershipRecords(ownerRes.value.data);
        if (feedRes?.value?.data) setFeedingRecords(feedRes.value.data);
        if (weightRes?.value?.data) setWeightRecords(weightRes.value.data);
        if (shedRes?.value?.data) setShedRecords(shedRes.value.data);
        if (vetRes?.value?.data) setVetRecords(vetRes.value.data);
      } catch (err) {
        console.error('Passport load error:', err);
        setError('error');
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [passportCode, currentUser?.email]);

  const copyLink = () => {
    navigator.clipboard.writeText(passportUrl(passportCode));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // — Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: C.warmWhite }}>
        <div className="space-y-4 w-full max-w-2xl mx-auto px-4">
          {[400, 60, 200, 300].map((h, i) => (
            <div key={i} className="animate-pulse rounded-xl" style={{ height: h, backgroundColor: C.paleSage }} />
          ))}
        </div>
      </div>
    );
  }

  // — Error states
  if (error === 'not_found') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: C.warmWhite }}>
        <div className="text-center max-w-md mx-auto px-4">
          <div className="text-6xl mb-4">🦎</div>
          <h1 className="text-2xl mb-2" style={{ fontFamily: "'DM Serif Display', serif", color: C.forest }}>
            Passport not found
          </h1>
          <p className="text-sm mb-6" style={{ color: C.muted }}>
            No animal with passport code <code className="font-mono px-1.5 py-0.5 rounded" style={{ backgroundColor: C.paleSage, color: C.forest }}>{passportCode}</code> was found.
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition hover:opacity-90"
            style={{ backgroundColor: C.sage }}
          >
            Go to Geck Inspect
          </Link>
        </div>
      </div>
    );
  }

  if (error === 'private') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: C.warmWhite }}>
        <div className="text-center max-w-md mx-auto px-4">
          <ShieldCheck size={48} style={{ color: C.muted }} className="mx-auto mb-4" />
          <h1 className="text-2xl mb-2" style={{ fontFamily: "'DM Serif Display', serif", color: C.forest }}>
            Private passport
          </h1>
          <p className="text-sm" style={{ color: C.muted }}>This animal's passport is set to private by the owner.</p>
        </div>
      </div>
    );
  }

  // — Parse morph data
  const images = gecko.image_urls || [];
  const morphTraits = gecko.morph_traits
    ? (Array.isArray(gecko.morph_traits) ? gecko.morph_traits : gecko.morph_traits.split(',').map(t => t.trim()))
    : [];
  const baseMorph = gecko.morphs_traits || gecko.base_morph || null;
  const status = (gecko.status || 'owned').toLowerCase().replace(/\s/g, '_');
  const isOwner = currentUser?.email && gecko.created_by === currentUser.email;
  const url = passportUrl(passportCode);

  return (
    <>
      <Helmet>
        <title>{gecko.name} — Geck Inspect Passport</title>
        <meta name="description" content={`${gecko.name} — ${baseMorph || 'Crested Gecko'}. View full history, lineage, and care records on Geck Inspect.`} />
        <meta property="og:title" content={`${gecko.name} — Geck Inspect Passport`} />
        <meta property="og:description" content={`${baseMorph || 'Crested Gecko'} — View full history and care records.`} />
        {images[0] && <meta property="og:image" content={images[0]} />}
      </Helmet>

      <div className="min-h-screen" style={{ backgroundColor: C.warmWhite, fontFamily: "'DM Sans', sans-serif" }}>
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">

          {/* ─── Hero ──────────────────────────────── */}
          <PhotoCarousel images={images} />

          {/* ─── Header ────────────────────────────── */}
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <h1
                className="text-4xl leading-tight"
                style={{ fontFamily: "'DM Serif Display', serif", color: C.forest }}
              >
                {gecko.name}
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <code
                  className="text-xs font-mono px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: C.paleSage, color: C.muted }}
                >
                  {passportCode}
                </code>
                <button
                  onClick={copyLink}
                  className="text-xs flex items-center gap-1 px-2 py-0.5 rounded-full transition hover:opacity-70"
                  style={{ backgroundColor: C.paleSage, color: C.sage }}
                  title="Copy passport link"
                >
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                  {copied ? 'Copied!' : 'Copy link'}
                </button>
              </div>
            </div>
            <StatusBadge status={status} />
          </div>

          {/* ─── Identity row ──────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <StatChip icon={Heart} label="Species" value={gecko.species || 'C. ciliatus'} />
            <StatChip icon={UserIcon} label="Sex" value={gecko.sex || 'Unknown'} />
            <StatChip icon={Calendar} label="Age" value={calculateAge(gecko.hatch_date || gecko.date_of_birth, gecko.estimated_hatch_year)} />
            <StatChip icon={Scale} label="Weight" value={gecko.weight_grams ? `${gecko.weight_grams}g` : '—'} />
          </div>

          {/* ─── Morph card ────────────────────────── */}
          {(baseMorph || morphTraits.length > 0 || gecko.pattern_grade) && (
            <div
              className="rounded-xl border p-6"
              style={{ borderColor: 'rgba(78,124,78,0.15)', backgroundColor: 'white' }}
            >
              <SectionHeading>Morph &amp; Genetics</SectionHeading>
              <div className="flex flex-wrap items-center gap-2">
                {baseMorph && <MorphPill text={baseMorph} />}
                <PatternGradeBadge grade={gecko.pattern_grade} />
              </div>
              {morphTraits.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {morphTraits.map(t => <MorphPill key={t} text={t} small />)}
                </div>
              )}
              {gecko.genetics_notes && (
                <p className="text-sm mt-3" style={{ color: C.muted }}>{gecko.genetics_notes}</p>
              )}
            </div>
          )}

          {/* ─── Lineage ───────────────────────────── */}
          {(gecko.sire_id || gecko.dam_id || gecko.sire_name || gecko.dam_name) && (
            <div
              className="rounded-xl border p-6"
              style={{ borderColor: 'rgba(78,124,78,0.15)', backgroundColor: 'white' }}
            >
              <SectionHeading>Lineage</SectionHeading>
              <LineageTree gecko={gecko} sire={sire} dam={dam} />
              {gecko.breeder_name && (
                <p className="text-sm mt-4 text-center" style={{ color: C.muted }}>
                  Bred by <span style={{ color: C.slate, fontWeight: 500 }}>{gecko.breeder_name}</span>
                  {gecko.hatch_facility && ` · ${gecko.hatch_facility}`}
                </p>
              )}
            </div>
          )}

          {/* ─── Ownership timeline ────────────────── */}
          <div
            className="rounded-xl border p-6"
            style={{ borderColor: 'rgba(78,124,78,0.15)', backgroundColor: 'white' }}
          >
            <SectionHeading>Ownership History</SectionHeading>
            <OwnershipTimeline records={ownershipRecords} />
          </div>

          {/* ─── Care history ──────────────────────── */}
          <div
            className="rounded-xl border p-6"
            style={{ borderColor: 'rgba(78,124,78,0.15)', backgroundColor: 'white' }}
          >
            <SectionHeading>Care History</SectionHeading>
            <CareHistoryTabs
              feedingRecords={feedingRecords}
              weightRecords={weightRecords}
              shedRecords={shedRecords}
              vetRecords={vetRecords}
            />
          </div>

          {/* ─── QR Code section ───────────────────── */}
          <div
            className="rounded-xl border p-6 text-center"
            style={{ borderColor: 'rgba(78,124,78,0.15)', backgroundColor: 'white' }}
          >
            <QRCodeSVG value={url} size={120} level="M" className="mx-auto mb-3" />
            <p className="text-sm font-medium" style={{ color: C.forest }}>Scan to view this passport</p>
            <p className="text-xs mt-1" style={{ color: C.muted }}>{url}</p>
          </div>

          {/* ─── Sticky footer action bar ──────────── */}
          {!isOwner && (
            <div
              className="sticky bottom-0 py-4 px-4 -mx-4 flex gap-3 justify-center flex-wrap"
              style={{ backgroundColor: C.warmWhite, borderTop: `1px solid ${C.paleSage}` }}
            >
              {status === 'for_sale' && (
                <Link
                  to={currentUser ? `/Messages?recipientEmail=${gecko.created_by}` : '/AuthPortal'}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium text-white transition hover:opacity-90"
                  style={{ backgroundColor: C.sage }}
                >
                  <Heart size={16} />
                  Inquire about this gecko
                </Link>
              )}
              <button
                onClick={() => {
                  if (!currentUser) {
                    window.location.href = '/AuthPortal';
                    return;
                  }
                  // In full implementation, this would open the claim flow
                  alert('Claim flow coming soon — contact the seller to initiate a transfer.');
                }}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition hover:opacity-90 border"
                style={{ borderColor: C.sage, color: C.sage, backgroundColor: 'transparent' }}
              >
                <ArrowRightLeft size={16} />
                I purchased this gecko — claim ownership
              </button>
            </div>
          )}

          {/* ─── Owner actions bar ─────────────────── */}
          {isOwner && (
            <div className="flex gap-3 justify-center flex-wrap pb-6">
              <Link
                to={`/GeckoDetail?id=${gecko.id}`}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition hover:opacity-90"
                style={{ backgroundColor: C.sage }}
              >
                Edit in Collection
              </Link>
              <Link
                to={`/passport/${passportCode}/qr`}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition hover:opacity-90 border"
                style={{ borderColor: C.sage, color: C.sage }}
              >
                <QrCode size={16} />
                QR Code &amp; Print
              </Link>
            </div>
          )}

          {/* ─── Footer branding ───────────────────── */}
          <div className="text-center py-6">
            <p className="text-xs" style={{ color: C.muted }}>
              Powered by <span style={{ fontWeight: 600, color: C.forest }}>Geck Inspect</span> — Professional Gecko Management
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
