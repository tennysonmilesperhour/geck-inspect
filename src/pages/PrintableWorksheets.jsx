import { useState, useEffect, useCallback } from 'react';
import { User, WeightRecord, FeedingRecord, ShedRecord } from '@/entities/all';
import { format, parseISO, startOfWeek, addDays as dateAddDays } from 'date-fns';
import {
  Printer, FileText, Stethoscope, Tag, GitBranch,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { QRCodeSVG } from 'qrcode.react';
import { GUEST_USER, isGuestMode } from '@/lib/guestMode';
import PageHeader from '@/components/shared/PageHeader';

/* ─── Print CSS (injected once) ─────────────────────────────────── */

const PRINT_STYLE_ID = 'printable-worksheets-style';

function ensurePrintStyles() {
  if (document.getElementById(PRINT_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = PRINT_STYLE_ID;
  style.textContent = `
    @media print {
      body * { visibility: hidden !important; }
      #printable-area, #printable-area * { visibility: visible !important; }
      #printable-area {
        position: absolute !important;
        left: 0 !important;
        top: 0 !important;
        width: 100% !important;
        padding: 0 !important;
        margin: 0 !important;
      }
      .no-print { display: none !important; }
      @page { margin: 0.5in; }
    }
  `;
  document.head.appendChild(style);
}

/* ─── Template: Feeding Log ─────────────────────────────────────── */

function FeedingLogTemplate({ gecko }) {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const weeks = 4;

  return (
    <div style={{ color: '#000', backgroundColor: '#fff', padding: 32 }}>
      <div style={{ borderBottom: '2px solid #000', paddingBottom: 12, marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>
          Feeding Log
        </h1>
        <p style={{ fontSize: 14, margin: '4px 0 0', color: '#555' }}>
          {gecko.name || 'Unnamed Gecko'}{gecko.morphs_traits ? `, ${gecko.morphs_traits}` : ''}
        </p>
        <p style={{ fontSize: 12, color: '#888', margin: '2px 0 0' }}>
          Generated {format(new Date(), 'MMMM d, yyyy')}
        </p>
      </div>

      {Array.from({ length: weeks }).map((_, weekIdx) => {
        const weekStart = startOfWeek(dateAddDays(new Date(), weekIdx * 7), { weekStartsOn: 1 });
        return (
          <div key={weekIdx} style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, color: '#333' }}>
              Week of {format(weekStart, 'MMM d, yyyy')}
            </p>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  {days.map(d => (
                    <th
                      key={d}
                      style={{
                        border: '1px solid #ccc',
                        padding: '6px 8px',
                        backgroundColor: '#f5f5f5',
                        fontWeight: 600,
                        textAlign: 'center',
                        width: `${100 / 7}%`,
                      }}
                    >
                      {d}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  {days.map(d => (
                    <td
                      key={d}
                      style={{
                        border: '1px solid #ccc',
                        padding: 8,
                        height: 48,
                        verticalAlign: 'top',
                        fontSize: 11,
                        color: '#999',
                      }}
                    >
                      Food:
                      <br />
                      Ate: Y / N
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        );
      })}

      <div style={{ marginTop: 20, fontSize: 11, color: '#888' }}>
        <p>Notes: _______________________________________________</p>
      </div>
    </div>
  );
}

/* ─── Template: Vet Health Card ─────────────────────────────────── */

function VetHealthCardTemplate({ gecko, weights, sheds, feedingRecords }) {
  const last10Weights = weights
    .sort((a, b) => new Date(b.date || b.created_date) - new Date(a.date || a.created_date))
    .slice(0, 10)
    .reverse();

  const totalFeedings = feedingRecords.length;
  const acceptedFeedings = feedingRecords.filter(f => f.accepted !== false).length;
  const feedRate = totalFeedings > 0 ? Math.round((acceptedFeedings / totalFeedings) * 100) : 0;

  const recentSheds = sheds
    .sort((a, b) => new Date(b.date || b.created_date) - new Date(a.date || a.created_date))
    .slice(0, 5);

  const age = gecko.hatch_date
    ? `${Math.floor((new Date() - new Date(gecko.hatch_date)) / (365.25 * 24 * 60 * 60 * 1000))}y ${Math.floor(((new Date() - new Date(gecko.hatch_date)) % (365.25 * 24 * 60 * 60 * 1000)) / (30.44 * 24 * 60 * 60 * 1000))}m`
    : 'Unknown';

  return (
    <div style={{ color: '#000', backgroundColor: '#fff', padding: 32, maxWidth: 700 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #000', paddingBottom: 12, marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>
            Veterinary Health Card
          </h1>
          <p style={{ fontSize: 11, color: '#888', margin: '4px 0 0' }}>
            Geck Inspect · Generated {format(new Date(), 'MMMM d, yyyy')}
          </p>
        </div>
        <div style={{ textAlign: 'right', fontSize: 12 }}>
          <p style={{ fontWeight: 700, margin: 0 }}>Crested Gecko</p>
          <p style={{ margin: 0, color: '#555' }}>Correlophus ciliatus</p>
        </div>
      </div>

      {/* Animal info */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
        <div>
          <p style={{ fontSize: 11, color: '#888', margin: '0 0 2px' }}>Name</p>
          <p style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>{gecko.name || '-'}</p>
        </div>
        <div>
          <p style={{ fontSize: 11, color: '#888', margin: '0 0 2px' }}>Morph</p>
          <p style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>{gecko.morphs_traits || '-'}</p>
        </div>
        <div>
          <p style={{ fontSize: 11, color: '#888', margin: '0 0 2px' }}>Date of Birth</p>
          <p style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>
            {gecko.hatch_date ? format(parseISO(gecko.hatch_date), 'MMM d, yyyy') : '-'}
          </p>
        </div>
        <div>
          <p style={{ fontSize: 11, color: '#888', margin: '0 0 2px' }}>Age</p>
          <p style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>{age}</p>
        </div>
        <div>
          <p style={{ fontSize: 11, color: '#888', margin: '0 0 2px' }}>Sex</p>
          <p style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>{gecko.sex || '-'}</p>
        </div>
        <div>
          <p style={{ fontSize: 11, color: '#888', margin: '0 0 2px' }}>ID</p>
          <p className="font-mono" style={{ fontSize: 12, fontWeight: 600, margin: 0 }}>{gecko.id}</p>
        </div>
      </div>

      {/* Weight history table */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 8px', borderBottom: '1px solid #ddd', paddingBottom: 4 }}>
          Weight History (Last 10)
        </h2>
        {last10Weights.length > 0 ? (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                <th style={{ border: '1px solid #ccc', padding: '4px 8px', backgroundColor: '#f5f5f5', textAlign: 'left' }}>Date</th>
                <th style={{ border: '1px solid #ccc', padding: '4px 8px', backgroundColor: '#f5f5f5', textAlign: 'right' }}>Weight (g)</th>
                <th style={{ border: '1px solid #ccc', padding: '4px 8px', backgroundColor: '#f5f5f5', textAlign: 'right' }}>Change</th>
              </tr>
            </thead>
            <tbody>
              {last10Weights.map((w, idx) => {
                const prev = idx > 0 ? parseFloat(last10Weights[idx - 1].weight) : null;
                const curr = parseFloat(w.weight);
                const change = prev != null ? curr - prev : null;
                return (
                  <tr key={w.id || idx}>
                    <td style={{ border: '1px solid #ccc', padding: '4px 8px' }}>
                      {w.date ? format(parseISO(w.date), 'MMM d, yyyy') : '-'}
                    </td>
                    <td style={{ border: '1px solid #ccc', padding: '4px 8px', textAlign: 'right' }}>
                      {curr}g
                    </td>
                    <td style={{ border: '1px solid #ccc', padding: '4px 8px', textAlign: 'right', color: change != null ? (change >= 0 ? '#2D7A2D' : '#C0392B') : '#999' }}>
                      {change != null ? `${change >= 0 ? '+' : ''}${change.toFixed(1)}g` : '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p style={{ fontSize: 12, color: '#999' }}>No weight records available.</p>
        )}
      </div>

      {/* Shed summary + Feeding rate */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 8px', borderBottom: '1px solid #ddd', paddingBottom: 4 }}>
            Recent Sheds
          </h2>
          {recentSheds.length > 0 ? (
            <ul style={{ margin: 0, padding: '0 0 0 16px', fontSize: 12 }}>
              {recentSheds.map((s, idx) => (
                <li key={s.id || idx} style={{ marginBottom: 2 }}>
                  {s.date ? format(parseISO(s.date), 'MMM d, yyyy') : '-'}
                  {s.completeness && `, ${s.completeness}`}
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ fontSize: 12, color: '#999' }}>No shed records.</p>
          )}
        </div>

        <div>
          <h2 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 8px', borderBottom: '1px solid #ddd', paddingBottom: 4 }}>
            Feeding Rate
          </h2>
          <p style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>{feedRate}%</p>
          <p style={{ fontSize: 11, color: '#888', margin: '2px 0 0' }}>
            {acceptedFeedings} accepted of {totalFeedings} offered
          </p>
        </div>
      </div>

      {/* Vet notes */}
      <div style={{ borderTop: '1px solid #ddd', paddingTop: 12, marginTop: 12 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 8px' }}>
          Veterinary Notes
        </h2>
        <div style={{ border: '1px solid #ccc', borderRadius: 4, padding: 12, minHeight: 80, fontSize: 12, color: '#999' }}>
          (Use this space for vet observations)
        </div>
      </div>
    </div>
  );
}

/* ─── Template: Expo Price Tag ──────────────────────────────────── */

function ExpoPriceTagTemplate({ gecko }) {
  // Public passports live at /passport/<code>. The old /AnimalPassport/<id>
  // route never existed, so every printed code opened a dead page. No code
  // is printed for a gecko without a passport.
  const passportUrl = gecko.passport_code ? `${window.location.origin}/passport/${gecko.passport_code}` : null;
  const photoUrl = gecko.image_urls?.[0] || null;

  return (
    <div style={{
      color: '#000',
      backgroundColor: '#fff',
      padding: 20,
      width: 320,
      border: '2px solid #000',
      borderRadius: 8,
    }}>
      {/* Photo */}
      {photoUrl && (
        <div style={{ width: '100%', height: 180, borderRadius: 6, overflow: 'hidden', marginBottom: 12, backgroundColor: '#f0f0f0' }}>
          <img
            src={photoUrl}
            alt={gecko.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </div>
      )}

      {/* Name & morph */}
      <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 4px' }}>
        {gecko.name || 'Crested Gecko'}
      </h2>
      <p style={{ fontSize: 13, color: '#555', margin: '0 0 8px' }}>
        {gecko.morphs_traits || 'Crested Gecko'}
      </p>

      {/* Details row */}
      <div style={{ display: 'flex', gap: 12, fontSize: 11, color: '#888', marginBottom: 12 }}>
        {gecko.sex && <span>{gecko.sex}</span>}
        {gecko.hatch_date && <span>Born {format(parseISO(gecko.hatch_date), 'MMM yyyy')}</span>}
        {gecko.weight_grams && <span>{gecko.weight_grams}g</span>}
      </div>

      {/* Price */}
      {gecko.asking_price != null && (
        <div style={{
          backgroundColor: '#000',
          color: '#fff',
          padding: '8px 16px',
          borderRadius: 6,
          textAlign: 'center',
          fontSize: 24,
          fontWeight: 700,
          marginBottom: 12,
        }}>
          ${Number(gecko.asking_price).toFixed(0)}
        </div>
      )}

      {/* QR code + info */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 10, color: '#888' }}>
          <p style={{ margin: '0 0 2px' }}>Scan for full passport</p>
          <p className="font-mono" style={{ margin: 0, fontSize: 9 }}>Geck Inspect</p>
        </div>
        {passportUrl && <QRCodeSVG value={passportUrl} size={64} level="M" />}
      </div>
    </div>
  );
}

/* ─── Template: Lineage Card ────────────────────────────────────── */

function LineageCardTemplate({ gecko }) {
  // Public passports live at /passport/<code>. The old /AnimalPassport/<id>
  // route never existed, so every printed code opened a dead page. No code
  // is printed for a gecko without a passport.
  const passportUrl = gecko.passport_code ? `${window.location.origin}/passport/${gecko.passport_code}` : null;
  const photoUrl = gecko.image_urls?.[0] || null;

  return (
    <div style={{
      color: '#000',
      backgroundColor: '#fff',
      padding: 32,
      maxWidth: 600,
      border: '3px double #000',
      borderRadius: 4,
    }}>
      {/* Certificate header */}
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <p style={{ fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', color: '#888', margin: '0 0 4px' }}>
          Certificate of Lineage
        </p>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>
          {gecko.name || 'Crested Gecko'}
        </h1>
        <p style={{ fontSize: 14, color: '#555', margin: '4px 0 0' }}>
          {gecko.morphs_traits || 'Correlophus ciliatus'}
        </p>
      </div>

      {/* Photo */}
      {photoUrl && (
        <div style={{
          width: 200,
          height: 200,
          borderRadius: '50%',
          overflow: 'hidden',
          margin: '0 auto 20px',
          border: '3px solid #000',
          backgroundColor: '#f0f0f0',
        }}>
          <img
            src={photoUrl}
            alt={gecko.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </div>
      )}

      {/* Details grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
        <div style={{ textAlign: 'center', padding: 8, border: '1px solid #ddd', borderRadius: 4 }}>
          <p style={{ fontSize: 10, color: '#888', margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: 1 }}>Sex</p>
          <p style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>{gecko.sex || '-'}</p>
        </div>
        <div style={{ textAlign: 'center', padding: 8, border: '1px solid #ddd', borderRadius: 4 }}>
          <p style={{ fontSize: 10, color: '#888', margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: 1 }}>Date of Birth</p>
          <p style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>
            {gecko.hatch_date ? format(parseISO(gecko.hatch_date), 'MMM d, yyyy') : '-'}
          </p>
        </div>
      </div>

      {/* Parents */}
      <div style={{ borderTop: '1px solid #ddd', borderBottom: '1px solid #ddd', padding: '16px 0', marginBottom: 20 }}>
        <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, color: '#888', margin: '0 0 8px' }}>
          Lineage
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <p style={{ fontSize: 11, color: '#888', margin: '0 0 2px' }}>Sire (Father)</p>
            <p style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>
              {gecko.sire_name || gecko.sire_id || '-'}
            </p>
            {gecko.sire_morph && (
              <p style={{ fontSize: 11, color: '#666', margin: '2px 0 0' }}>{gecko.sire_morph}</p>
            )}
          </div>
          <div>
            <p style={{ fontSize: 11, color: '#888', margin: '0 0 2px' }}>Dam (Mother)</p>
            <p style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>
              {gecko.dam_name || gecko.dam_id || '-'}
            </p>
            {gecko.dam_morph && (
              <p style={{ fontSize: 11, color: '#666', margin: '2px 0 0' }}>{gecko.dam_morph}</p>
            )}
          </div>
        </div>
      </div>

      {/* Breeder + QR */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, color: '#888', margin: '0 0 4px' }}>
            Breeder
          </p>
          <p style={{ fontSize: 14, fontWeight: 600, margin: '0 0 2px' }}>
            {/* breeder_name, never created_by: that is the owner's email. */}
            {gecko.breeder_name || '-'}
          </p>
          <p style={{ fontSize: 10, color: '#888', margin: 0 }}>
            Issued {format(new Date(), 'MMMM d, yyyy')}
          </p>
        </div>
        <div style={{ textAlign: 'center' }}>
          {passportUrl && (
            <>
              <QRCodeSVG value={passportUrl} size={72} level="M" />
              <p style={{ fontSize: 8, color: '#aaa', margin: '4px 0 0' }}>Verify on Geck Inspect</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Template button component ─────────────────────────────────── */

function TemplateButton({ icon: Icon, label, description, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`touch:min-h-11 flex items-start gap-3 p-4 rounded-xl text-left transition-all border-2 ${
        active ? 'border-emerald-500 bg-emerald-500/10' : 'border-slate-700 bg-slate-900'
      }`}
    >
      <div
        className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
          active ? 'bg-emerald-600' : 'bg-emerald-500/10'
        }`}
      >
        <Icon size={20} className={active ? 'text-white' : 'text-emerald-400'} />
      </div>
      <div>
        <p className="text-sm font-semibold text-slate-100">{label}</p>
        <p className="text-xs mt-0.5 text-slate-500">{description}</p>
      </div>
    </button>
  );
}

/* ─── Main page ─────────────────────────────────────────────────── */

export default function PrintableWorksheets() {
  const [geckos, setGeckos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const [selectedGeckoId, setSelectedGeckoId] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('');

  // Loaded data for selected gecko
  const [weights, setWeights] = useState([]);
  const [feedings, setFeedings] = useState([]);
  const [sheds, setSheds] = useState([]);
  const [loadingTemplate, setLoadingTemplate] = useState(false);

  useEffect(() => {
    ensurePrintStyles();
  }, []);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Demo mode has no signed-in user; use the demo keeper so the sample
      // geckos can be printed.
      const currentUser = isGuestMode() ? GUEST_USER : await User.me();
      if (!currentUser) {
        setIsLoading(false);
        return;
      }
      const { getVisibleGeckos } = await import('@/lib/geckoAccess');
      const userGeckos = await getVisibleGeckos(currentUser);
      setGeckos(userGeckos.filter(g => !g.archived));
    } catch (err) {
      console.error('Failed to load geckos:', err);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Load records when gecko or template changes
  useEffect(() => {
    if (!selectedGeckoId || !selectedTemplate) return;
    if (selectedTemplate === 'feeding-log' || selectedTemplate === 'expo-tag' || selectedTemplate === 'lineage') {
      // These templates don't need extra data beyond the gecko itself
      setLoadingTemplate(false);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoadingTemplate(true);
      try {
        const [wts, fds, shs] = await Promise.all([
          // Weigh-ins live in weight_records as gecko_id / record_date /
          // weight_grams. This asked for animal_id and date, the query
          // failed, and the vet card printed with no weights, feedings or
          // sheds (fixed 29 Sep 2026).
          WeightRecord.filter({ gecko_id: selectedGeckoId }, '-record_date'),
          FeedingRecord.filter({ animal_id: selectedGeckoId }, '-date'),
          ShedRecord.filter({ animal_id: selectedGeckoId }, '-date'),
        ]);
        if (!cancelled) {
          setWeights(wts.map((w) => ({ ...w, date: w.record_date, weight: w.weight_grams })));
          setFeedings(fds);
          setSheds(shs);
        }
      } catch (err) {
        console.error('Failed to load records:', err);
      }
      if (!cancelled) setLoadingTemplate(false);
    })();

    return () => { cancelled = true; };
  }, [selectedGeckoId, selectedTemplate]);

  const selectedGecko = geckos.find(g => g.id === selectedGeckoId);

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 p-4 md:p-8">
        <div className="max-w-4xl mx-auto flex justify-center py-20">
          <Loader2 size={32} className="animate-spin text-emerald-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-8">
      {/* Controls (hidden on print) */}
      <div className="no-print max-w-4xl mx-auto">
        <PageHeader
          icon={Printer}
          title="Printable Worksheets"
          description="Generate print-ready documents for your geckos, feeding logs, vet cards, expo tags, and lineage certificates."
        />

        {/* Gecko selector */}
        <div className="mb-6">
          <label className="text-sm font-medium mb-2 block text-slate-200">
            Select Gecko
          </label>
          <Select value={selectedGeckoId} onValueChange={v => { setSelectedGeckoId(v); setSelectedTemplate(''); }}>
            <SelectTrigger className="max-w-md">
              <SelectValue placeholder="Choose a gecko..." />
            </SelectTrigger>
            <SelectContent>
              {geckos.map(g => (
                <SelectItem key={g.id} value={g.id}>
                  {[g.name || g.id, g.morphs_traits, g.sex].filter(Boolean).join(', ')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Template buttons */}
        {selectedGeckoId && (
          <div className="mb-6">
            <label className="text-sm font-medium mb-3 block text-slate-200">
              Choose Template
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <TemplateButton
                icon={FileText}
                label="Feeding Log"
                description="Weekly table with Mon-Sun columns"
                active={selectedTemplate === 'feeding-log'}
                onClick={() => setSelectedTemplate('feeding-log')}
              />
              <TemplateButton
                icon={Stethoscope}
                label="Vet Health Card"
                description="Professional one-pager with full history"
                active={selectedTemplate === 'vet-card'}
                onClick={() => setSelectedTemplate('vet-card')}
              />
              <TemplateButton
                icon={Tag}
                label="Expo Price Tag"
                description="Small format with photo and QR code"
                active={selectedTemplate === 'expo-tag'}
                onClick={() => setSelectedTemplate('expo-tag')}
              />
              <TemplateButton
                icon={GitBranch}
                label="Lineage Card"
                description="Certificate-style with parent info"
                active={selectedTemplate === 'lineage'}
                onClick={() => setSelectedTemplate('lineage')}
              />
            </div>
          </div>
        )}

        {/* Print button */}
        {selectedGeckoId && selectedTemplate && (
          <div className="flex flex-wrap items-center gap-3 mb-6">
            <Button
              onClick={handlePrint}
              disabled={loadingTemplate}
            >
              {loadingTemplate ? (
                <Loader2 size={16} className="mr-2 animate-spin" />
              ) : (
                <Printer size={16} className="mr-2" />
              )}
              Print Document
            </Button>
            <span className="text-xs text-slate-500">
              Opens your browser print dialog
            </span>
          </div>
        )}
      </div>

      {/* Printable area */}
      {selectedGecko && selectedTemplate && !loadingTemplate && (
        <div id="printable-area" className="max-w-4xl mx-auto">
          <div className="no-print mb-3 pb-3 border-b border-slate-800">
            <p className="text-xs font-medium text-emerald-400">
              PREVIEW: this is how your document will look when printed
            </p>
          </div>

          {/* The preview is white on purpose: it shows the printed page. */}
          <div className="rounded-xl overflow-hidden border border-slate-700 bg-white print:rounded-none print:border-0">
            {selectedTemplate === 'feeding-log' && (
              <FeedingLogTemplate gecko={selectedGecko} />
            )}
            {selectedTemplate === 'vet-card' && (
              <VetHealthCardTemplate
                gecko={selectedGecko}
                weights={weights}
                sheds={sheds}
                feedingRecords={feedings}
              />
            )}
            {selectedTemplate === 'expo-tag' && (
              <div className="p-4 sm:p-6 flex justify-center">
                <ExpoPriceTagTemplate gecko={selectedGecko} />
              </div>
            )}
            {selectedTemplate === 'lineage' && (
              <div className="p-4 sm:p-6 flex justify-center">
                <LineageCardTemplate gecko={selectedGecko} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
