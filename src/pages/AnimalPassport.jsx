import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { format } from 'date-fns';
import {
  calculateAge, STATUS_BADGE_STYLES, PATTERN_GRADES, passportUrl
} from '@/lib/passportUtils';
import { parseLocalDate } from '@/lib/dateUtils';
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react';
import {
  Calendar, Scale, Droplets, Heart, Stethoscope, ChevronLeft, ChevronRight, QrCode, ArrowRightLeft,
  ShieldCheck, Check, X, User as UserIcon, Utensils, FileDown, Pencil, Zap,
} from 'lucide-react';
import { Helmet } from 'react-helmet-async';
import { Button } from '@/components/ui/button';
import ShareMenu from '@/components/shared/ShareMenu';
import QualityBadge from '@/components/shared/QualityBadge';
import WeightChart from '@/components/shared/WeightChart';
import FireStatePair from '@/components/shared/FireStatePair';
import { hasFireStatePhotos } from '@/lib/fireStatePhotos';
import OwnershipChain from '@/components/passport/OwnershipChain';
import { exportProvenanceCertificate } from '@/lib/certificateExport';
import { geckoSelect } from '@/lib/publicColumns';

// The passport is the page buyers see when they scan a tub label or open a
// shared link. It used its own palette tokens and two display fonts; since
// 29 Sep 2026 it uses the app's design system (the same classes, cards and
// buttons as every other screen). Owners also get a quick log at the top,
// so scanning their own tub label is the fastest way to log a feeding,
// a weight or a shed.

/** Date-only columns (YYYY-MM-DD) read as local days, not UTC. */
const fmtDay = (value, pattern = 'MMM d, yyyy') => {
  if (!value) return '-';
  const day = /^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? parseLocalDate(value) : new Date(value);
  return Number.isNaN(day?.getTime?.()) ? '-' : format(day, pattern);
};

const card = 'rounded-xl border border-slate-800 bg-slate-900 p-5 sm:p-6';

/* ─── Small pieces ──────────────────────────────────────────────── */

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
  const g = grade ? PATTERN_GRADES[grade] : null;
  if (!g) return null;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
        g.premium ? 'bg-amber-500/15 text-amber-300' : 'bg-emerald-500/10 text-emerald-200'
      }`}
      title={g.description}
    >
      {g.premium && <span className="mr-1">&#9733;</span>}
      {g.label}
    </span>
  );
}

function StatChip({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-1.5 rounded-xl bg-slate-900 border border-slate-700 px-3 py-2">
      <Icon size={14} className="text-emerald-400 shrink-0" />
      <span className="text-xs uppercase tracking-wider text-slate-500">{label}</span>
      <span className="text-sm font-medium ml-auto text-slate-200 truncate">{value || '-'}</span>
    </div>
  );
}

function MorphPill({ text, small }) {
  return (
    <span
      className={`inline-flex items-center rounded-full font-medium bg-emerald-500/10 text-emerald-200 border border-emerald-500/20 ${
        small ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm'
      }`}
    >
      {text}
    </span>
  );
}

function SectionHeading({ children }) {
  return <h2 className="text-lg font-semibold text-slate-100 mb-4">{children}</h2>;
}

function EmptyNote({ icon: Icon, children }) {
  return (
    <div className="text-center py-8 rounded-xl bg-slate-950/60">
      <Icon size={24} className="mx-auto mb-2 text-slate-600" />
      <p className="text-sm text-slate-500">{children}</p>
    </div>
  );
}

/* ─── Photo carousel ────────────────────────────────────────────── */

function PhotoCarousel({ images }) {
  const [idx, setIdx] = useState(0);
  if (!images || images.length === 0) {
    return (
      <div className="w-full h-72 sm:h-96 flex items-center justify-center rounded-xl bg-slate-900 border border-slate-700">
        <div className="text-center">
          <div className="text-6xl mb-2">🦎</div>
          <p className="text-sm text-slate-500">No photos yet</p>
        </div>
      </div>
    );
  }
  const prev = () => setIdx((i) => (i - 1 + images.length) % images.length);
  const next = () => setIdx((i) => (i + 1) % images.length);
  return (
    <div className="relative rounded-xl overflow-hidden h-72 sm:h-96 bg-slate-900">
      <img src={images[idx]} alt="Animal photo" className="w-full h-full object-cover" />
      {images.length > 1 && (
        <>
          <button
            type="button"
            onClick={prev}
            aria-label="Previous photo"
            className="absolute left-3 top-1/2 -translate-y-1/2 bg-slate-950/70 hover:bg-slate-950 rounded-full min-w-11 min-h-11 grid place-items-center"
          >
            <ChevronLeft size={20} className="text-slate-100" />
          </button>
          <button
            type="button"
            onClick={next}
            aria-label="Next photo"
            className="absolute right-3 top-1/2 -translate-y-1/2 bg-slate-950/70 hover:bg-slate-950 rounded-full min-w-11 min-h-11 grid place-items-center"
          >
            <ChevronRight size={20} className="text-slate-100" />
          </button>
          {/* The 8 px dots are too dense to tap, so on touch screens they
              only show the position; the arrows do the paging. */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 touch:pointer-events-none">
            {images.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Photo ${i + 1}`}
                onClick={() => setIdx(i)}
                className={`w-2 h-2 rounded-full ${i === idx ? 'bg-white' : 'bg-white/40'}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ─── Lineage tree (3-node) ─────────────────────────────────────── */

function ParentNode({ animal, manualName, label }) {
  const name = animal?.name || manualName || 'Unknown';
  return (
    <div className="rounded-xl p-4 text-center min-w-[140px] border border-slate-800 bg-slate-950/60">
      <p className="text-xs uppercase tracking-wider mb-1 text-slate-500">{label}</p>
      {animal?.passport_code ? (
        <Link to={`/passport/${animal.passport_code}`} className="text-sm font-semibold text-emerald-400 hover:underline">
          {name}
        </Link>
      ) : (
        <p className="text-sm font-semibold text-slate-200">{name}</p>
      )}
      {animal?.morphs_traits && <p className="text-xs mt-1 text-slate-500">{animal.morphs_traits}</p>}
      {!animal && manualName && <p className="text-xs mt-1 italic text-slate-500">Not in Geck Inspect</p>}
    </div>
  );
}

function LineageTree({ gecko, sire, dam }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex gap-4 justify-center flex-wrap">
        <ParentNode animal={sire} manualName={gecko?.sire_name} label="Sire" />
        <ParentNode animal={dam} manualName={gecko?.dam_name} label="Dam" />
      </div>
      <div className="w-px h-6 bg-emerald-500" />
      <div className="rounded-xl p-4 text-center border-2 border-emerald-500 bg-slate-950/60">
        <p className="text-sm font-bold text-slate-100">{gecko?.name || 'This gecko'}</p>
        {gecko?.morphs_traits && <p className="text-xs mt-1 text-slate-500">{gecko.morphs_traits}</p>}
      </div>
    </div>
  );
}

/* ─── Care history tabs ─────────────────────────────────────────── */

function CareHistoryTabs({ gecko, feedingRecords, weightRecords, shedRecords, vetRecords }) {
  const [tab, setTab] = useState('weight');
  const tabs = [
    { key: 'weight', label: 'Weight', icon: Scale, count: weightRecords.length },
    { key: 'feeding', label: 'Feeding', icon: Utensils, count: feedingRecords.length },
    { key: 'sheds', label: 'Sheds', icon: Droplets, count: shedRecords.length },
    { key: 'vet', label: 'Vet', icon: Stethoscope, count: vetRecords.length },
  ];
  const accepted = feedingRecords.filter((f) => f.accepted !== false).length;

  return (
    <div>
      <div className="flex gap-1 mb-4 flex-wrap" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-3 min-h-11 rounded-lg text-sm transition ${
              tab === t.key ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <t.icon size={14} />
            {t.label}
            <span className="text-xs opacity-70">({t.count})</span>
          </button>
        ))}
      </div>

      {tab === 'weight' && (weightRecords.length > 0
        ? <WeightChart records={weightRecords} gecko={gecko} height={240} />
        : <EmptyNote icon={Scale}>No weight records yet</EmptyNote>)}

      {tab === 'feeding' && (feedingRecords.length > 0 ? (
        <>
          <div className="mb-3 rounded-lg px-3 py-2 text-sm bg-emerald-500/10 text-emerald-200">
            Accepted {Math.round((accepted / feedingRecords.length) * 100)}% of the last {feedingRecords.length} feedings
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left py-2 px-2 text-xs uppercase tracking-wider text-slate-500">Date</th>
                  <th className="text-left py-2 px-2 text-xs uppercase tracking-wider text-slate-500">Food</th>
                  <th className="text-left py-2 px-2 text-xs uppercase tracking-wider text-slate-500">Accepted</th>
                </tr>
              </thead>
              <tbody>
                {feedingRecords.slice(0, 20).map((f, i) => (
                  <tr key={f.id} className={i % 2 === 1 ? 'bg-slate-950/40' : ''}>
                    <td className="py-1.5 px-2 text-slate-300">{fmtDay(f.date)}</td>
                    <td className="py-1.5 px-2 text-slate-300">{f.food_type || '-'}</td>
                    <td className="py-1.5 px-2">
                      {f.accepted !== false
                        ? <Check size={14} className="text-emerald-400" aria-label="Accepted" />
                        : <X size={14} className="text-rose-400" aria-label="Refused" />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : <EmptyNote icon={Utensils}>No feeding records yet</EmptyNote>)}

      {tab === 'sheds' && (shedRecords.length > 0 ? (
        <div className="space-y-2">
          {shedRecords.slice(0, 15).map((s) => {
            const issue = ['retained_toes', 'retained_eye_caps', 'partial'].includes(s.quality);
            return (
              <div key={s.id} className="flex items-center gap-3 rounded-lg px-3 py-2 bg-slate-950/60">
                <span className="text-sm text-slate-300">{fmtDay(s.date)}</span>
                <span className={`text-xs rounded-full px-2 py-0.5 ${issue ? 'bg-amber-500/15 text-amber-300' : 'bg-emerald-500/10 text-emerald-200'}`}>
                  {(s.quality || 'unknown').replace(/_/g, ' ')}
                </span>
                {s.notes && <span className="text-xs text-slate-500">{s.notes}</span>}
              </div>
            );
          })}
        </div>
      ) : <EmptyNote icon={Droplets}>No shed records yet</EmptyNote>)}

      {tab === 'vet' && (vetRecords.length > 0
        ? <div className="space-y-3">{vetRecords.map((v) => <VetRecordCard key={v.id} record={v} />)}</div>
        : <EmptyNote icon={Stethoscope}>No vet records</EmptyNote>)}
    </div>
  );
}

function VetRecordCard({ record }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <button
      type="button"
      className="touch:min-h-11 w-full text-left rounded-xl border border-slate-800 bg-slate-950/60 p-4 transition hover:border-slate-700"
      onClick={() => setExpanded(!expanded)}
      aria-expanded={expanded}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-200">{record.reason || 'Vet visit'}</p>
          <p className="text-xs text-slate-500">
            {fmtDay(record.date)}
            {record.vet_name && ` · ${record.vet_name}`}
          </p>
        </div>
        <ChevronRight size={16} className={`text-slate-500 transition-transform ${expanded ? 'rotate-90' : ''}`} />
      </div>
      {expanded && (
        <div className="mt-3 pt-3 space-y-2 border-t border-slate-800">
          {record.findings && (
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-500">Findings</p>
              <p className="text-sm text-slate-300">{record.findings}</p>
            </div>
          )}
          {record.treatment && (
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-500">Treatment</p>
              <p className="text-sm text-slate-300">{record.treatment}</p>
            </div>
          )}
          {record.follow_up && (
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-500">Follow-up</p>
              <p className="text-sm text-slate-300">{fmtDay(record.follow_up)}</p>
            </div>
          )}
        </div>
      )}
    </button>
  );
}

/* ─── Owner quick log ───────────────────────────────────────────── */

function OwnerQuickLog({ geckoId }) {
  const actions = [
    { log: 'fed', label: 'Fed', icon: Utensils },
    { log: 'weight', label: 'Weight', icon: Scale },
    { log: 'shed', label: 'Shed', icon: Droplets },
  ];
  return (
    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
      <p className="text-sm font-semibold text-emerald-200 flex items-center gap-1.5">
        <Zap size={14} /> Quick log
      </p>
      <p className="text-xs text-slate-400 mt-0.5">Your gecko. Fed and Shed save in one tap; Weight opens the scale entry.</p>
      <div className="grid grid-cols-3 gap-2 mt-3">
        {actions.map((a) => (
          <Button key={a.log} asChild className="bg-emerald-600 hover:bg-emerald-700 text-white min-h-11">
            <Link to={`/FieldMode?gecko=${encodeURIComponent(geckoId)}&log=${a.log}`}>
              <a.icon className="w-4 h-4" />
              {a.label}
            </Link>
          </Button>
        ))}
      </div>
    </div>
  );
}

/* ─── States ────────────────────────────────────────────────────── */

function CenteredState({ icon, title, children }) {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        {icon}
        <h1 className="text-2xl font-bold text-slate-100 mb-2">{title}</h1>
        {children}
      </div>
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

  useEffect(() => {
    if (!passportCode) return;
    const load = async () => {
      setIsLoading(true);
      try {
        // Signed-out visitors read the public columns only: created_by holds
        // the owner's email (see publicColumns.js).
        const columns = geckoSelect(Boolean(currentUser?.email));
        const { data: geckos, error: gErr } = await supabase
          .from('geckos')
          .select(columns)
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

        const [
          sireRes, damRes, ownerRes, feedRes, weightRes, shedRes, vetRes
        ] = await Promise.allSettled([
          g.sire_id ? supabase.from('geckos').select(columns).eq('id', g.sire_id).maybeSingle() : null,
          g.dam_id ? supabase.from('geckos').select(columns).eq('id', g.dam_id).maybeSingle() : null,
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="space-y-4 w-full max-w-2xl mx-auto px-4">
          {[384, 60, 200, 300].map((h, i) => (
            <div key={i} className="animate-pulse rounded-xl bg-slate-900" style={{ height: h }} />
          ))}
        </div>
      </div>
    );
  }

  if (error === 'not_found') {
    return (
      <CenteredState icon={<div className="text-6xl mb-4">🦎</div>} title="Passport not found">
        <p className="text-sm text-slate-400 mb-6">
          No animal with passport code <code className="font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-200">{passportCode}</code> was found.
        </p>
        <Button asChild className="bg-emerald-600 hover:bg-emerald-700 text-white">
          <Link to="/">Go to Geck Inspect</Link>
        </Button>
      </CenteredState>
    );
  }

  if (error === 'private') {
    return (
      <CenteredState icon={<ShieldCheck size={48} className="mx-auto mb-4 text-slate-500" />} title="Private passport">
        <p className="text-sm text-slate-400">This animal&apos;s passport is set to private by the owner.</p>
      </CenteredState>
    );
  }

  // A failed lookup (dropped connection, timeout) used to fall through to
  // the render below with no gecko and crash the page (found 29 Sep 2026).
  if (error === 'error' || !gecko) {
    return (
      <CenteredState icon={<div className="text-6xl mb-4">🦎</div>} title="Could not load this passport">
        <p className="text-sm text-slate-400 mb-6">Check your connection and try again.</p>
        <Button type="button" onClick={() => window.location.reload()} className="bg-emerald-600 hover:bg-emerald-700 text-white">
          Try again
        </Button>
      </CenteredState>
    );
  }

  const images = gecko.image_urls || [];
  // Trait tags live in morph_tags (a list); this read a morph_traits field
  // that does not exist, so the tag pills never showed.
  const morphTags = Array.isArray(gecko.morph_tags) ? gecko.morph_tags.filter(Boolean) : [];
  const baseMorph = gecko.morphs_traits || null;
  const status = (gecko.status || 'owned').toLowerCase().replace(/\s/g, '_');
  const isOwner = Boolean(currentUser?.email) && gecko.created_by === currentUser.email;
  const url = passportUrl(passportCode);
  const hasProvenance = ownershipRecords.length > 0
    || Boolean(gecko.sire_id || gecko.dam_id || gecko.sire_name || gecko.dam_name || gecko.breeder_name);
  // Messages opens a conversation from ?recipient= (this used ?recipientEmail=,
  // which it never read, so these buttons opened an empty inbox).
  const messageSeller = currentUser ? `/Messages?recipient=${encodeURIComponent(gecko.created_by)}` : '/AuthPortal';

  return (
    <>
      <Helmet>
        <title>{`${gecko.name} | Geck Inspect Passport`}</title>
        <meta name="description" content={`${gecko.name}, ${baseMorph || 'Crested Gecko'}. View full history, lineage, and care records on Geck Inspect.`} />
        <meta property="og:title" content={`${gecko.name} | Geck Inspect Passport`} />
        <meta property="og:description" content={`${baseMorph || 'Crested Gecko'}. View full history and care records.`} />
        {images[0] && <meta property="og:image" content={images[0]} />}
      </Helmet>

      <div className="min-h-screen bg-slate-950 text-slate-100">
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
          <PhotoCarousel images={images} />

          <div className="flex items-start justify-between flex-wrap gap-3">
            <div className="min-w-0">
              <h1 className="text-3xl sm:text-4xl font-bold leading-tight text-slate-100 break-words">{gecko.name}</h1>
              <code className="inline-block mt-1 text-xs font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
                {passportCode}
              </code>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <ShareMenu
                url={url}
                title={`${gecko.name} on Geck Inspect`}
                subtitle={[gecko.morphs_traits, gecko.sex].filter(Boolean).join(' · ')}
              />
              {hasProvenance && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => exportProvenanceCertificate(gecko, ownershipRecords, url)}
                  className="border-emerald-600 text-emerald-300 hover:bg-emerald-600/10 bg-transparent"
                  title="Download a printable provenance certificate. The QR code on it links back to this live passport."
                >
                  <FileDown className="w-4 h-4" />
                  Export certificate (PDF)
                </Button>
              )}
              <StatusBadge status={status} />
            </div>
          </div>

          {isOwner && <OwnerQuickLog geckoId={gecko.id} />}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <StatChip icon={Heart} label="Species" value={gecko.species || 'C. ciliatus'} />
            <StatChip icon={UserIcon} label="Sex" value={gecko.sex || 'Unknown'} />
            <StatChip icon={Calendar} label="Age" value={calculateAge(gecko.hatch_date, gecko.estimated_hatch_year)} />
            <StatChip icon={Scale} label="Weight" value={gecko.weight_grams ? `${gecko.weight_grams} g` : '-'} />
          </div>

          {(baseMorph || morphTags.length > 0 || gecko.pattern_grade || gecko.quality_score != null) && (
            <div className={card}>
              <SectionHeading>Morph and genetics</SectionHeading>
              <div className="flex flex-wrap items-center gap-2">
                {baseMorph && <MorphPill text={baseMorph} />}
                {gecko.quality_score != null
                  ? <QualityBadge score={gecko.quality_score} linkToScale />
                  : <PatternGradeBadge grade={gecko.pattern_grade} />}
              </div>
              {morphTags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {morphTags.map((t) => <MorphPill key={t} text={t} small />)}
                </div>
              )}
              {gecko.genetics_notes && <p className="text-sm mt-3 text-slate-400">{gecko.genetics_notes}</p>}
            </div>
          )}

          {hasFireStatePhotos(gecko) && (
            <div className={card}>
              <FireStatePair gecko={gecko} headingClassName="text-lg font-semibold text-slate-100" />
            </div>
          )}

          {(gecko.sire_id || gecko.dam_id || gecko.sire_name || gecko.dam_name) && (
            <div className={card}>
              <SectionHeading>Lineage</SectionHeading>
              <LineageTree gecko={gecko} sire={sire} dam={dam} />
              {gecko.breeder_name && (
                <p className="text-sm mt-4 text-center text-slate-500">
                  Bred by <span className="text-slate-200 font-medium">{gecko.breeder_name}</span>
                  {gecko.hatch_facility && ` · ${gecko.hatch_facility}`}
                </p>
              )}
            </div>
          )}

          <OwnershipChain records={ownershipRecords} />

          <div className={card}>
            <SectionHeading>Care history</SectionHeading>
            <CareHistoryTabs
              gecko={gecko}
              feedingRecords={feedingRecords}
              weightRecords={weightRecords}
              shedRecords={shedRecords}
              vetRecords={vetRecords}
            />
          </div>

          <div className={`${card} text-center`}>
            <div className="inline-block rounded-lg bg-white p-2 mb-3">
              <QRCodeSVG value={url} size={120} level="M" />
            </div>
            {/* Hidden canvas copy of the QR code, captured by the provenance certificate PDF export */}
            <div style={{ display: 'none' }} aria-hidden="true">
              <QRCodeCanvas value={url} size={512} level="M" data-passport-qr="true" />
            </div>
            <p className="text-sm font-medium text-slate-200">Scan to view this passport</p>
            <p className="text-xs mt-1 text-slate-500 break-all">{url}</p>
          </div>

          {!isOwner && (
            <div
              className="sticky bottom-0 pt-4 px-4 -mx-4 flex gap-3 justify-center flex-wrap bg-slate-950 border-t border-slate-800"
              style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
            >
              {status === 'for_sale' && (
                <Button asChild className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  <Link to={messageSeller}>
                    <Heart className="w-4 h-4" />
                    Inquire about this gecko
                  </Link>
                </Button>
              )}
              <Button asChild variant="outline" className="border-emerald-600 text-emerald-300 hover:bg-emerald-600/10 bg-transparent">
                <Link to={messageSeller}>
                  <ArrowRightLeft className="w-4 h-4" />
                  Ask the seller for a transfer invitation
                </Link>
              </Button>
            </div>
          )}

          {isOwner && (
            <div className="flex gap-3 justify-center flex-wrap pb-6">
              <Button asChild className="bg-emerald-600 hover:bg-emerald-700 text-white">
                <Link to={`/GeckoDetail?id=${gecko.id}`}>
                  <Pencil className="w-4 h-4" />
                  Edit in collection
                </Link>
              </Button>
              <Button asChild variant="outline" className="border-emerald-600 text-emerald-300 hover:bg-emerald-600/10 bg-transparent">
                <Link to={`/passport/${passportCode}/qr`}>
                  <QrCode className="w-4 h-4" />
                  QR code and print
                </Link>
              </Button>
            </div>
          )}

          <div className="text-center py-6">
            <p className="text-xs text-slate-500">
              Powered by <span className="font-semibold text-slate-300">Geck Inspect</span>, crested gecko records you can trust
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
