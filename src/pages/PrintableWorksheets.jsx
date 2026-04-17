import { useState, useEffect, useCallback } from 'react';
import { User, Gecko, WeightRecord, FeedingRecord, ShedRecord } from '@/entities/all';
import { format, parseISO, startOfWeek, addDays as dateAddDays } from 'date-fns';
import {
  Printer, FileText, Stethoscope, Tag, GitBranch,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { QRCodeSVG } from 'qrcode.react';

/* ─── Design tokens ─────────────────────────────────────────────── */
const C = {
  forest:    '#e2e8f0',
  moss:      '#94a3b8',
  sage:      '#10b981',
  paleSage:  'rgba(16,185,129,0.1)',
  warmWhite: '#020617',
  gold:      '#f59e0b',
  goldLight: 'rgba(245,158,11,0.15)',
  red:       '#ef4444',
  slate:     '#cbd5e1',
  muted:     '#64748b',
  cardBg:    '#0f172a',
  border:    'rgba(51,65,85,0.5)',
};

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
    <div style={{ fontFamily: "'DM Sans', sans-serif", color: '#000', backgroundColor: '#fff', padding: 32 }}>
      <div style={{ borderBottom: '2px solid #000', paddingBottom: 12, marginBottom: 20 }}>
        <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 24, margin: 0 }}>
          Feeding Log
        </h1>
        <p style={{ fontSize: 14, margin: '4px 0 0', color: '#555' }}>
          {gecko.name || 'Unnamed Gecko'} {gecko.morph ? `— ${gecko.morph}` : ''}
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

  const age = gecko.date_of_birth
    ? `${Math.floor((new Date() - new Date(gecko.date_of_birth)) / (365.25 * 24 * 60 * 60 * 1000))}y ${Math.floor(((new Date() - new Date(gecko.date_of_birth)) % (365.25 * 24 * 60 * 60 * 1000)) / (30.44 * 24 * 60 * 60 * 1000))}m`
    : 'Unknown';

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", color: '#000', backgroundColor: '#fff', padding: 32, maxWidth: 700 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #000', paddingBottom: 12, marginBottom: 20 }}>
        <div>
          <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 24, margin: 0 }}>
            Veterinary Health Card
          </h1>
          <p style={{ fontSize: 11, color: '#888', margin: '4px 0 0' }}>
            Geck Inspect — Generated {format(new Date(), 'MMMM d, yyyy')}
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
          <p style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>{gecko.name || '—'}</p>
        </div>
        <div>
          <p style={{ fontSize: 11, color: '#888', margin: '0 0 2px' }}>Morph</p>
          <p style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>{gecko.morph || '—'}</p>
        </div>
        <div>
          <p style={{ fontSize: 11, color: '#888', margin: '0 0 2px' }}>Date of Birth</p>
          <p style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>
            {gecko.date_of_birth ? format(parseISO(gecko.date_of_birth), 'MMM d, yyyy') : '—'}
          </p>
        </div>
        <div>
          <p style={{ fontSize: 11, color: '#888', margin: '0 0 2px' }}>Age</p>
          <p style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>{age}</p>
        </div>
        <div>
          <p style={{ fontSize: 11, color: '#888', margin: '0 0 2px' }}>Sex</p>
          <p style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>{gecko.sex || '—'}</p>
        </div>
        <div>
          <p style={{ fontSize: 11, color: '#888', margin: '0 0 2px' }}>ID</p>
          <p style={{ fontSize: 12, fontWeight: 600, margin: 0, fontFamily: 'monospace' }}>{gecko.id}</p>
        </div>
      </div>

      {/* Weight history table */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 16, margin: '0 0 8px', borderBottom: '1px solid #ddd', paddingBottom: 4 }}>
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
                      {w.date ? format(parseISO(w.date), 'MMM d, yyyy') : '—'}
                    </td>
                    <td style={{ border: '1px solid #ccc', padding: '4px 8px', textAlign: 'right' }}>
                      {curr}g
                    </td>
                    <td style={{ border: '1px solid #ccc', padding: '4px 8px', textAlign: 'right', color: change != null ? (change >= 0 ? '#2D7A2D' : '#C0392B') : '#999' }}>
                      {change != null ? `${change >= 0 ? '+' : ''}${change.toFixed(1)}g` : '—'}
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
          <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 16, margin: '0 0 8px', borderBottom: '1px solid #ddd', paddingBottom: 4 }}>
            Recent Sheds
          </h2>
          {recentSheds.length > 0 ? (
            <ul style={{ margin: 0, padding: '0 0 0 16px', fontSize: 12 }}>
              {recentSheds.map((s, idx) => (
                <li key={s.id || idx} style={{ marginBottom: 2 }}>
                  {s.date ? format(parseISO(s.date), 'MMM d, yyyy') : '—'}
                  {s.completeness && ` — ${s.completeness}`}
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ fontSize: 12, color: '#999' }}>No shed records.</p>
          )}
        </div>

        <div>
          <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 16, margin: '0 0 8px', borderBottom: '1px solid #ddd', paddingBottom: 4 }}>
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
        <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 16, margin: '0 0 8px' }}>
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
  const passportUrl = `${window.location.origin}/AnimalPassport/${gecko.id}`;
  const photoUrl = gecko.image_urls?.[0] || null;

  return (
    <div style={{
      fontFamily: "'DM Sans', sans-serif",
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
      <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 20, margin: '0 0 4px' }}>
        {gecko.name || 'Crested Gecko'}
      </h2>
      <p style={{ fontSize: 13, color: '#555', margin: '0 0 8px' }}>
        {gecko.morph || 'Crested Gecko'}
      </p>

      {/* Details row */}
      <div style={{ display: 'flex', gap: 12, fontSize: 11, color: '#888', marginBottom: 12 }}>
        {gecko.sex && <span>{gecko.sex}</span>}
        {gecko.date_of_birth && <span>Born {format(parseISO(gecko.date_of_birth), 'MMM yyyy')}</span>}
        {gecko.weight && <span>{gecko.weight}g</span>}
      </div>

      {/* Price */}
      {gecko.price != null && (
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
          ${Number(gecko.price).toFixed(0)}
        </div>
      )}

      {/* QR code + info */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 10, color: '#888' }}>
          <p style={{ margin: '0 0 2px' }}>Scan for full passport</p>
          <p style={{ margin: 0, fontFamily: 'monospace', fontSize: 9 }}>Geck Inspect</p>
        </div>
        <QRCodeSVG value={passportUrl} size={64} level="M" />
      </div>
    </div>
  );
}

/* ─── Template: Lineage Card ────────────────────────────────────── */

function LineageCardTemplate({ gecko }) {
  const passportUrl = `${window.location.origin}/AnimalPassport/${gecko.id}`;
  const photoUrl = gecko.image_urls?.[0] || null;

  return (
    <div style={{
      fontFamily: "'DM Sans', sans-serif",
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
        <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 28, margin: 0 }}>
          {gecko.name || 'Crested Gecko'}
        </h1>
        <p style={{ fontSize: 14, color: '#555', margin: '4px 0 0' }}>
          {gecko.morph || 'Correlophus ciliatus'}
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
          <p style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>{gecko.sex || '—'}</p>
        </div>
        <div style={{ textAlign: 'center', padding: 8, border: '1px solid #ddd', borderRadius: 4 }}>
          <p style={{ fontSize: 10, color: '#888', margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: 1 }}>Date of Birth</p>
          <p style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>
            {gecko.date_of_birth ? format(parseISO(gecko.date_of_birth), 'MMM d, yyyy') : '—'}
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
              {gecko.sire_name || gecko.sire_id || '—'}
            </p>
            {gecko.sire_morph && (
              <p style={{ fontSize: 11, color: '#666', margin: '2px 0 0' }}>{gecko.sire_morph}</p>
            )}
          </div>
          <div>
            <p style={{ fontSize: 11, color: '#888', margin: '0 0 2px' }}>Dam (Mother)</p>
            <p style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>
              {gecko.dam_name || gecko.dam_id || '—'}
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
            {gecko.breeder || gecko.created_by || '—'}
          </p>
          <p style={{ fontSize: 10, color: '#888', margin: 0 }}>
            Issued {format(new Date(), 'MMMM d, yyyy')}
          </p>
        </div>
        <div style={{ textAlign: 'center' }}>
          <QRCodeSVG value={passportUrl} size={72} level="M" />
          <p style={{ fontSize: 8, color: '#aaa', margin: '4px 0 0' }}>Verify on Geck Inspect</p>
        </div>
      </div>
    </div>
  );
}

/* ─── Template button component ─────────────────────────────────── */

function TemplateButton({ icon: Icon, label, description, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex items-start gap-3 p-4 rounded-xl text-left transition-all"
      style={{
        border: `2px solid ${active ? C.sage : 'rgba(78,124,78,0.15)'}`,
        backgroundColor: active ? C.paleSage : '#fff',
      }}
    >
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: active ? C.sage : C.paleSage }}
      >
        <Icon size={20} style={{ color: active ? '#fff' : C.sage }} />
      </div>
      <div>
        <p className="text-sm font-semibold" style={{ color: C.forest }}>{label}</p>
        <p className="text-xs mt-0.5" style={{ color: C.muted }}>{description}</p>
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
      const currentUser = await User.me();
      if (!currentUser) {
        setIsLoading(false);
        return;
      }
      const userGeckos = await Gecko.filter({ created_by: currentUser.email });
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
          WeightRecord.filter({ animal_id: selectedGeckoId }, '-date'),
          FeedingRecord.filter({ animal_id: selectedGeckoId }, '-date'),
          ShedRecord.filter({ animal_id: selectedGeckoId }, '-date'),
        ]);
        if (!cancelled) {
          setWeights(wts);
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
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: C.warmWhite, fontFamily: "'DM Sans', sans-serif" }}
      >
        <Loader2 size={32} className="animate-spin" style={{ color: C.sage }} />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen pb-12"
      style={{ backgroundColor: C.warmWhite, fontFamily: "'DM Sans', sans-serif" }}
    >
      {/* Controls (hidden on print) */}
      <div className="no-print max-w-4xl mx-auto px-4 pt-8 pb-6">
        <div className="mb-6">
          <h1
            className="text-2xl mb-1"
            style={{ fontFamily: "'DM Serif Display', serif", color: C.forest }}
          >
            Printable Worksheets
          </h1>
          <p className="text-sm" style={{ color: C.muted }}>
            Generate print-ready documents for your geckos — feeding logs, vet cards, expo tags, and lineage certificates.
          </p>
        </div>

        {/* Gecko selector */}
        <div className="mb-6">
          <label className="text-sm font-medium mb-2 block" style={{ color: C.slate }}>
            Select Gecko
          </label>
          <Select value={selectedGeckoId} onValueChange={v => { setSelectedGeckoId(v); setSelectedTemplate(''); }}>
            <SelectTrigger className="max-w-md" style={{ backgroundColor: '#fff' }}>
              <SelectValue placeholder="Choose a gecko..." />
            </SelectTrigger>
            <SelectContent>
              {geckos.map(g => (
                <SelectItem key={g.id} value={g.id}>
                  {g.name || g.id} {g.morph ? `(${g.morph})` : ''} {g.sex ? `— ${g.sex}` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Template buttons */}
        {selectedGeckoId && (
          <div className="mb-6">
            <label className="text-sm font-medium mb-3 block" style={{ color: C.slate }}>
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
          <div className="flex items-center gap-3 mb-6">
            <Button
              onClick={handlePrint}
              disabled={loadingTemplate}
              style={{ backgroundColor: C.sage, color: '#fff' }}
            >
              {loadingTemplate ? (
                <Loader2 size={16} className="mr-2 animate-spin" />
              ) : (
                <Printer size={16} className="mr-2" />
              )}
              Print Document
            </Button>
            <span className="text-xs" style={{ color: C.muted }}>
              Opens your browser print dialog
            </span>
          </div>
        )}
      </div>

      {/* Printable area */}
      {selectedGecko && selectedTemplate && !loadingTemplate && (
        <div id="printable-area" className="max-w-4xl mx-auto px-4">
          <div
            className="no-print mb-3 pb-3"
            style={{ borderBottom: '1px solid rgba(78,124,78,0.15)' }}
          >
            <p className="text-xs font-medium" style={{ color: C.sage }}>
              PREVIEW — This is how your document will look when printed
            </p>
          </div>

          <div
            className="rounded-xl overflow-hidden"
            style={{ border: '1px solid rgba(78,124,78,0.15)', backgroundColor: '#fff' }}
          >
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
              <div style={{ padding: 24, display: 'flex', justifyContent: 'center' }}>
                <ExpoPriceTagTemplate gecko={selectedGecko} />
              </div>
            )}
            {selectedTemplate === 'lineage' && (
              <div style={{ padding: 24, display: 'flex', justifyContent: 'center' }}>
                <LineageCardTemplate gecko={selectedGecko} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
