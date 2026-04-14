import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { format } from 'date-fns';
import { Printer, FileText, Heart, Tag, GitBranch } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

const C = { forest: '#1A2E1A', sage: '#4E7C4E', paleSage: '#E8F0E8', warmWhite: '#F7F9F4', gold: '#C4860A', slate: '#3D4A3D', muted: '#6B7B6B' };

export default function PrintableWorksheets() {
  const auth = useAuth?.() || {};
  const [geckos, setGeckos] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [gecko, setGecko] = useState(null);
  const [weights, setWeights] = useState([]);
  const [template, setTemplate] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('geckos').select('id, name, morphs_traits, sex, hatch_date, weight_grams, image_urls, passport_code, sire_name, dam_name, breeder_name, status, asking_price, created_by')
        .eq('created_by', auth.user?.email).order('name');
      setGeckos(data || []);
      setLoading(false);
    })();
  }, [auth.user?.email]);

  useEffect(() => {
    if (!selectedId) return;
    (async () => {
      const g = geckos.find(g => g.id === selectedId);
      setGecko(g);
      const { data } = await supabase.from('weight_records').select('*').eq('gecko_id', selectedId).order('record_date', { ascending: false }).limit(10);
      setWeights(data || []);
    })();
  }, [selectedId, geckos]);

  const passportUrl = gecko?.passport_code ? `${window.location.origin}/passport/${gecko.passport_code}` : '';
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const templates = [
    { id: 'feeding', label: 'Feeding Log', icon: FileText, desc: 'Weekly feeding tracker' },
    { id: 'vet', label: 'Vet Health Card', icon: Heart, desc: 'One-page health summary for vet visits' },
    { id: 'expo', label: 'Expo Price Tag', icon: Tag, desc: 'Price tag with QR code for shows' },
    { id: 'lineage', label: 'Lineage Card', icon: GitBranch, desc: 'Certificate-style lineage document' },
  ];

  if (template && gecko) {
    return (
      <div>
        {/* Print controls — hidden during print */}
        <div className="print:hidden p-4 flex items-center gap-3" style={{ backgroundColor: C.warmWhite }}>
          <button onClick={() => setTemplate(null)} className="text-sm px-3 py-1.5 rounded-lg border" style={{ borderColor: C.sage, color: C.sage }}>Back</button>
          <button onClick={() => window.print()} className="text-sm px-4 py-1.5 rounded-lg text-white flex items-center gap-2" style={{ backgroundColor: C.sage }}>
            <Printer size={14} /> Print
          </button>
          <span className="text-xs" style={{ color: C.muted }}>{gecko.name} — {templates.find(t => t.id === template)?.label}</span>
        </div>

        {/* ─── FEEDING LOG ─── */}
        {template === 'feeding' && (
          <div className="max-w-[800px] mx-auto p-8 bg-white text-black print:p-4" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            <div className="flex justify-between items-start mb-6 border-b pb-4" style={{ borderColor: '#ddd' }}>
              <div>
                <h1 className="text-xl font-bold" style={{ fontFamily: "'DM Serif Display', serif" }}>{gecko.name}</h1>
                <p className="text-sm text-gray-500">{gecko.morphs_traits || 'Crested Gecko'} · {gecko.sex || 'Unknown sex'}</p>
              </div>
              <div className="text-right text-xs text-gray-400">
                <p>Weekly Feeding Log</p>
                <p>Week of: ____________</p>
              </div>
            </div>
            <table className="w-full border-collapse text-sm">
              <thead><tr>{days.map(d => <th key={d} className="border p-2 text-center bg-gray-50 font-medium" style={{ borderColor: '#ddd' }}>{d}</th>)}</tr></thead>
              <tbody>
                <tr>{days.map(d => <td key={d} className="border p-3 align-top h-24" style={{ borderColor: '#ddd' }}><p className="text-xs text-gray-400 mb-1">Food:</p><p className="text-xs text-gray-400">Accepted: ☐ Y ☐ N</p></td>)}</tr>
                <tr>{days.map(d => <td key={d} className="border p-3 align-top h-24" style={{ borderColor: '#ddd' }}><p className="text-xs text-gray-400 mb-1">Food:</p><p className="text-xs text-gray-400">Accepted: ☐ Y ☐ N</p></td>)}</tr>
              </tbody>
            </table>
            <div className="mt-4 text-xs text-gray-400 flex justify-between"><span>Geck Inspect</span><span>Generated {format(new Date(), 'MMM d, yyyy')}</span></div>
          </div>
        )}

        {/* ─── VET HEALTH CARD ─── */}
        {template === 'vet' && (
          <div className="max-w-[800px] mx-auto p-8 bg-white text-black print:p-4" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            <div className="flex justify-between items-start mb-4 border-b-2 pb-4" style={{ borderColor: C.forest }}>
              <div>
                <h1 className="text-2xl font-bold" style={{ fontFamily: "'DM Serif Display', serif", color: C.forest }}>Veterinary Health Card</h1>
                <p className="text-sm mt-1" style={{ color: C.muted }}>Geck Inspect — Animal Health Record</p>
              </div>
              {passportUrl && <QRCodeSVG value={passportUrl} size={60} />}
            </div>
            <div className="grid grid-cols-2 gap-x-8 gap-y-2 mb-6 text-sm">
              <div><span className="font-medium">Name:</span> {gecko.name}</div>
              <div><span className="font-medium">Species:</span> Correlophus ciliatus</div>
              <div><span className="font-medium">Sex:</span> {gecko.sex || 'Unknown'}</div>
              <div><span className="font-medium">DOB:</span> {gecko.hatch_date ? format(new Date(gecko.hatch_date), 'MMM d, yyyy') : 'Unknown'}</div>
              <div><span className="font-medium">Current Weight:</span> {gecko.weight_grams ? `${gecko.weight_grams}g` : 'Unknown'}</div>
              <div><span className="font-medium">Morph:</span> {gecko.morphs_traits || 'Unknown'}</div>
            </div>
            <h3 className="font-medium text-sm mb-2 border-b pb-1" style={{ borderColor: '#ddd' }}>Weight History</h3>
            <table className="w-full text-sm mb-4 border-collapse">
              <thead><tr className="bg-gray-50"><th className="border p-1.5 text-left text-xs">Date</th><th className="border p-1.5 text-left text-xs">Weight (g)</th><th className="border p-1.5 text-left text-xs">Change</th></tr></thead>
              <tbody>{weights.length > 0 ? weights.map((w, i) => (
                <tr key={w.id}><td className="border p-1.5 text-xs">{w.record_date ? format(new Date(w.record_date), 'MMM d, yyyy') : ''}</td>
                <td className="border p-1.5 text-xs">{w.weight_grams}g</td>
                <td className="border p-1.5 text-xs">{i < weights.length - 1 ? `${(w.weight_grams - weights[i + 1].weight_grams).toFixed(1)}g` : '—'}</td></tr>
              )) : <tr><td colSpan={3} className="border p-2 text-xs text-gray-400 text-center">No weight records</td></tr>}</tbody>
            </table>
            <div className="mt-4 text-xs text-gray-400 flex justify-between"><span>Geck Inspect — Veterinary Health Card</span><span>{format(new Date(), 'MMM d, yyyy')}</span></div>
          </div>
        )}

        {/* ─── EXPO PRICE TAG ─── */}
        {template === 'expo' && (
          <div className="flex flex-wrap gap-4 p-8 justify-center bg-white print:p-2">
            {[1, 2].map(n => (
              <div key={n} className="w-[3in] h-[4in] border-2 rounded-lg p-4 flex flex-col items-center justify-between text-center" style={{ borderColor: C.forest, fontFamily: "'DM Sans', sans-serif" }}>
                {gecko.image_urls?.[0] ? <img src={gecko.image_urls[0]} alt={gecko.name} className="w-24 h-24 rounded-lg object-cover" /> : <div className="w-24 h-24 rounded-lg bg-gray-100 flex items-center justify-center text-3xl">🦎</div>}
                <div>
                  <h2 className="text-lg font-bold" style={{ fontFamily: "'DM Serif Display', serif", color: C.forest }}>{gecko.name}</h2>
                  <p className="text-xs" style={{ color: C.muted }}>{gecko.morphs_traits || 'Crested Gecko'}</p>
                </div>
                <p className="text-3xl font-bold" style={{ color: C.forest }}>${gecko.asking_price || '—'}</p>
                {passportUrl && <QRCodeSVG value={passportUrl} size={64} />}
                <p className="text-xs" style={{ color: C.muted }}>Scan for full history · Geck Inspect</p>
              </div>
            ))}
          </div>
        )}

        {/* ─── LINEAGE CARD ─── */}
        {template === 'lineage' && (
          <div className="max-w-[800px] mx-auto p-8 bg-white text-black print:p-4" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            <div className="text-center border-b-2 pb-6 mb-6" style={{ borderColor: C.forest }}>
              <h1 className="text-2xl font-bold mb-1" style={{ fontFamily: "'DM Serif Display', serif", color: C.forest }}>Certificate of Lineage</h1>
              <p className="text-sm" style={{ color: C.muted }}>Geck Inspect Verified Record</p>
            </div>
            <div className="text-center mb-6">
              {gecko.image_urls?.[0] && <img src={gecko.image_urls[0]} alt={gecko.name} className="w-32 h-32 rounded-xl object-cover mx-auto mb-3" />}
              <h2 className="text-xl font-bold" style={{ fontFamily: "'DM Serif Display', serif", color: C.forest }}>{gecko.name}</h2>
              <p className="text-sm" style={{ color: C.muted }}>{gecko.morphs_traits || 'Crested Gecko'} · {gecko.sex || 'Unknown sex'}</p>
              {gecko.passport_code && <p className="text-xs font-mono mt-1" style={{ color: C.muted }}>{gecko.passport_code}</p>}
            </div>
            <div className="grid grid-cols-2 gap-8 mb-8">
              <div className="text-center p-4 rounded-lg" style={{ backgroundColor: '#f9f9f9' }}>
                <p className="text-xs uppercase tracking-wider mb-1 font-medium" style={{ color: C.muted }}>Sire</p>
                <p className="text-sm font-semibold" style={{ color: C.forest }}>{gecko.sire_name || 'Unknown'}</p>
              </div>
              <div className="text-center p-4 rounded-lg" style={{ backgroundColor: '#f9f9f9' }}>
                <p className="text-xs uppercase tracking-wider mb-1 font-medium" style={{ color: C.muted }}>Dam</p>
                <p className="text-sm font-semibold" style={{ color: C.forest }}>{gecko.dam_name || 'Unknown'}</p>
              </div>
            </div>
            {gecko.breeder_name && <p className="text-center text-sm mb-4" style={{ color: C.slate }}>Bred by <strong>{gecko.breeder_name}</strong></p>}
            <div className="text-center">{passportUrl && <QRCodeSVG value={passportUrl} size={80} className="mx-auto" />}<p className="text-xs mt-2" style={{ color: C.muted }}>Scan for live digital passport</p></div>
            <div className="mt-8 text-xs text-gray-400 flex justify-between border-t pt-3"><span>Geck Inspect — Certificate of Lineage</span><span>{format(new Date(), 'MMM d, yyyy')}</span></div>
          </div>
        )}
      </div>
    );
  }

  // ─── TEMPLATE SELECTOR ───
  return (
    <div className="min-h-screen p-6" style={{ backgroundColor: C.warmWhite, fontFamily: "'DM Sans', sans-serif" }}>
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl mb-2" style={{ fontFamily: "'DM Serif Display', serif", color: C.forest }}>Printable Worksheets</h1>
        <p className="text-sm mb-6" style={{ color: C.muted }}>Generate print-ready documents from your gecko records.</p>

        <div className="mb-6">
          <label className="text-xs uppercase tracking-wider block mb-2" style={{ color: C.muted }}>Select a gecko</label>
          <select value={selectedId} onChange={e => setSelectedId(e.target.value)}
            className="w-full rounded-xl border px-4 py-3 text-sm" style={{ borderColor: 'rgba(78,124,78,0.15)', color: C.slate }}>
            <option value="">Choose a gecko...</option>
            {geckos.map(g => <option key={g.id} value={g.id}>{g.name} — {g.morphs_traits || 'Unknown morph'}</option>)}
          </select>
        </div>

        {selectedId && (
          <div className="grid grid-cols-2 gap-4">
            {templates.map(t => (
              <button key={t.id} onClick={() => setTemplate(t.id)}
                className="rounded-xl border p-5 text-left transition hover:shadow-sm"
                style={{ borderColor: 'rgba(78,124,78,0.15)', backgroundColor: 'white' }}>
                <t.icon size={24} style={{ color: C.sage }} className="mb-2" />
                <h3 className="text-sm font-semibold" style={{ color: C.forest }}>{t.label}</h3>
                <p className="text-xs mt-1" style={{ color: C.muted }}>{t.desc}</p>
              </button>
            ))}
          </div>
        )}

        {!selectedId && !loading && (
          <div className="text-center py-12">
            <Printer size={32} className="mx-auto mb-2" style={{ color: C.muted }} />
            <p className="text-sm" style={{ color: C.muted }}>Select a gecko above to generate printable documents</p>
          </div>
        )}
      </div>
    </div>
  );
}
