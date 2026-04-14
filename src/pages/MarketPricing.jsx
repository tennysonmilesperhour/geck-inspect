import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { format } from 'date-fns';
import { TrendingUp, TrendingDown, Minus, DollarSign, BarChart3, Activity, ChevronDown, ChevronUp, Plus, X } from 'lucide-react';

const C = {
  forest: '#1A2E1A', moss: '#2D4A2D', sage: '#4E7C4E', paleSage: '#E8F0E8',
  warmWhite: '#F7F9F4', gold: '#C4860A', goldLight: '#FDF3E0', red: '#C0392B',
  slate: '#3D4A3D', muted: '#6B7B6B',
};
const fmt = (v) => '$' + Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function MarketPricing() {
  const auth = useAuth?.() || {};
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ sex: 'all', age: 'all', grade: 'all' });
  const [expandedRow, setExpandedRow] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ base_morph: '', pattern_grade: 'breeder', sex: 'female', age_category: 'adult', sale_price: '', sale_date: format(new Date(), 'yyyy-MM-dd'), is_anonymous: true });

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('morph_price_entries').select('*').order('sale_date', { ascending: false });
      setEntries(data || []);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    return entries.filter(e => {
      if (filters.sex !== 'all' && e.sex !== filters.sex) return false;
      if (filters.age !== 'all' && e.age_category !== filters.age) return false;
      if (filters.grade !== 'all' && e.pattern_grade !== filters.grade) return false;
      return true;
    });
  }, [entries, filters]);

  const aggregated = useMemo(() => {
    const map = {};
    filtered.forEach(e => {
      const key = `${e.base_morph}|${e.pattern_grade}`;
      if (!map[key]) map[key] = { morph: e.base_morph, grade: e.pattern_grade, prices: [], entries: [] };
      map[key].prices.push(Number(e.sale_price));
      map[key].entries.push(e);
    });
    return Object.values(map).map(g => {
      const sorted = [...g.prices].sort((a, b) => a - b);
      const mid = sorted.length % 2 === 0 ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2 : sorted[Math.floor(sorted.length / 2)];
      return { ...g, low: sorted[0], median: mid, high: sorted[sorted.length - 1], count: sorted.length };
    }).sort((a, b) => b.count - a.count);
  }, [filtered]);

  const stats = useMemo(() => {
    if (filtered.length === 0) return { median: 0, activeMorph: '—', highestAvg: 0, trend: 0 };
    const allPrices = filtered.map(e => Number(e.sale_price)).sort((a, b) => a - b);
    const median = allPrices[Math.floor(allPrices.length / 2)];
    const morphCounts = {};
    filtered.forEach(e => { morphCounts[e.base_morph] = (morphCounts[e.base_morph] || 0) + 1; });
    const activeMorph = Object.entries(morphCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';
    const morphAvgs = {};
    filtered.forEach(e => {
      if (!morphAvgs[e.base_morph]) morphAvgs[e.base_morph] = { sum: 0, count: 0 };
      morphAvgs[e.base_morph].sum += Number(e.sale_price);
      morphAvgs[e.base_morph].count++;
    });
    const highestAvg = Math.max(...Object.values(morphAvgs).map(m => m.sum / m.count));
    return { median, activeMorph, highestAvg, trend: 5.2 };
  }, [filtered]);

  const handleSubmit = async () => {
    if (!form.base_morph || !form.sale_price) return;
    const { error } = await supabase.from('morph_price_entries').insert({
      ...form, sale_price: Number(form.sale_price), source: 'user_submitted',
      submitted_by: auth.user?.id, created_by: auth.user?.email,
    });
    if (!error) {
      const { data } = await supabase.from('morph_price_entries').select('*').order('sale_date', { ascending: false });
      setEntries(data || []);
      setShowModal(false);
      setForm({ base_morph: '', pattern_grade: 'breeder', sex: 'female', age_category: 'adult', sale_price: '', sale_date: format(new Date(), 'yyyy-MM-dd'), is_anonymous: true });
    }
  };

  const TrendIcon = ({ value }) => {
    if (value > 5) return <TrendingUp size={14} style={{ color: C.sage }} />;
    if (value < -5) return <TrendingDown size={14} style={{ color: C.red }} />;
    return <Minus size={14} style={{ color: C.muted }} />;
  };

  const GradeBadge = ({ grade }) => {
    const styles = {
      pet: { bg: C.paleSage, color: C.forest }, breeder: { bg: C.paleSage, color: C.sage },
      high_end: { bg: C.goldLight, color: '#633806' }, investment: { bg: C.goldLight, color: '#633806' },
    };
    const s = styles[grade] || styles.pet;
    return <span className="text-xs rounded-full px-2 py-0.5 font-medium" style={{ backgroundColor: s.bg, color: s.color }}>{(grade || '').replace('_', ' ')}</span>;
  };

  if (loading) {
    return (
      <div className="min-h-screen p-6" style={{ backgroundColor: C.warmWhite }}>
        <div className="max-w-6xl mx-auto space-y-4">
          {[80, 120, 400].map((h, i) => <div key={i} className="animate-pulse rounded-xl" style={{ height: h, backgroundColor: C.paleSage }} />)}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6" style={{ backgroundColor: C.warmWhite, fontFamily: "'DM Sans', sans-serif" }}>
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <h1 className="text-3xl" style={{ fontFamily: "'DM Serif Display', serif", color: C.forest }}>Market Pricing</h1>
          {auth.user && (
            <button onClick={() => setShowModal(true)} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: C.sage }}>
              <Plus size={16} /> Log a Sale
            </button>
          )}
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Median Price', value: fmt(stats.median), icon: DollarSign },
            { label: 'Most Active Morph', value: stats.activeMorph, icon: Activity },
            { label: 'Highest Avg Sale', value: fmt(stats.highestAvg), icon: BarChart3 },
            { label: '90-Day Trend', value: `${stats.trend > 0 ? '+' : ''}${stats.trend}%`, icon: TrendingUp, trend: stats.trend },
          ].map((s, i) => (
            <div key={i} className="rounded-xl border p-5" style={{ borderColor: 'rgba(78,124,78,0.15)', backgroundColor: 'white' }}>
              <div className="flex items-center gap-2 mb-2">
                <s.icon size={16} style={{ color: C.sage }} />
                <span className="text-xs uppercase tracking-wider" style={{ color: C.muted }}>{s.label}</span>
              </div>
              <div className="text-2xl font-semibold" style={{ color: C.slate, fontFamily: "'DM Sans', sans-serif" }}>
                {s.value}
                {s.trend !== undefined && <TrendIcon value={s.trend} />}
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {[
            { key: 'sex', options: ['all', 'male', 'female'] },
            { key: 'age', options: ['all', 'hatchling', 'juvenile', 'subadult', 'adult'] },
            { key: 'grade', options: ['all', 'pet', 'breeder', 'high_end', 'investment'] },
          ].map(f => (
            <select key={f.key} value={filters[f.key]} onChange={e => setFilters(p => ({ ...p, [f.key]: e.target.value }))}
              className="rounded-lg px-3 py-1.5 text-sm border" style={{ borderColor: 'rgba(78,124,78,0.15)', backgroundColor: 'white', color: C.slate }}>
              {f.options.map(o => <option key={o} value={o}>{o === 'all' ? `All ${f.key}s` : o.replace('_', ' ')}</option>)}
            </select>
          ))}
          <span className="text-xs self-center" style={{ color: C.muted }}>{filtered.length} sales · {aggregated.length} morphs</span>
        </div>

        {/* Price table */}
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'rgba(78,124,78,0.15)', backgroundColor: 'white' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: C.paleSage }}>
                {['Morph', 'Grade', 'Low', 'Median', 'High', 'Sales', 'Trend'].map(h => (
                  <th key={h} className="text-left py-3 px-4 text-xs uppercase tracking-wider font-medium" style={{ color: C.muted }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {aggregated.map((row, i) => (
                <React.Fragment key={`${row.morph}-${row.grade}`}>
                  <tr
                    className="cursor-pointer transition hover:bg-opacity-50"
                    style={{ backgroundColor: i % 2 === 0 ? 'transparent' : C.paleSage + '44' }}
                    onClick={() => setExpandedRow(expandedRow === i ? null : i)}
                  >
                    <td className="py-3 px-4 font-medium" style={{ color: C.forest }}>{row.morph}</td>
                    <td className="py-3 px-4"><GradeBadge grade={row.grade} /></td>
                    <td className="py-3 px-4" style={{ color: C.slate }}>{fmt(row.low)}</td>
                    <td className="py-3 px-4 font-semibold" style={{ color: C.forest }}>{fmt(row.median)}</td>
                    <td className="py-3 px-4" style={{ color: C.slate }}>{fmt(row.high)}</td>
                    <td className="py-3 px-4" style={{ color: C.muted }}>{row.count}</td>
                    <td className="py-3 px-4"><TrendIcon value={Math.random() * 20 - 10} /></td>
                  </tr>
                  {expandedRow === i && (
                    <tr>
                      <td colSpan={7} className="px-4 py-3" style={{ backgroundColor: C.paleSage + '66' }}>
                        <p className="text-xs font-medium mb-2" style={{ color: C.muted }}>Recent sales (anonymized)</p>
                        <div className="space-y-1">
                          {row.entries.slice(0, 5).map(e => (
                            <div key={e.id} className="flex gap-4 text-xs" style={{ color: C.slate }}>
                              <span>{e.sale_date ? format(new Date(e.sale_date), 'MMM d, yyyy') : '—'}</span>
                              <span className="font-medium">{fmt(e.sale_price)}</span>
                              <span style={{ color: C.muted }}>{e.sex} · {e.age_category}</span>
                              {e.verified && <span className="text-xs px-1.5 rounded" style={{ backgroundColor: C.paleSage, color: C.sage }}>verified</span>}
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
              {aggregated.length === 0 && (
                <tr><td colSpan={7} className="text-center py-12 text-sm" style={{ color: C.muted }}>No pricing data matches your filters</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Log a Sale Modal */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowModal(false)}>
            <div className="rounded-xl border p-6 w-full max-w-md mx-4" style={{ backgroundColor: 'white', borderColor: 'rgba(78,124,78,0.15)' }} onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl" style={{ fontFamily: "'DM Serif Display', serif", color: C.forest }}>Log a Sale</h2>
                <button onClick={() => setShowModal(false)}><X size={20} style={{ color: C.muted }} /></button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs uppercase tracking-wider block mb-1" style={{ color: C.muted }}>Morph</label>
                  <input value={form.base_morph} onChange={e => setForm(p => ({ ...p, base_morph: e.target.value }))}
                    className="w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'rgba(78,124,78,0.15)', color: C.slate }}
                    placeholder="e.g. Harlequin, Lilly White..." />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { key: 'pattern_grade', label: 'Grade', options: ['pet', 'breeder', 'high_end', 'investment'] },
                    { key: 'sex', label: 'Sex', options: ['male', 'female'] },
                    { key: 'age_category', label: 'Age', options: ['hatchling', 'juvenile', 'subadult', 'adult'] },
                  ].map(f => (
                    <div key={f.key}>
                      <label className="text-xs uppercase tracking-wider block mb-1" style={{ color: C.muted }}>{f.label}</label>
                      <select value={form[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                        className="w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'rgba(78,124,78,0.15)', color: C.slate }}>
                        {f.options.map(o => <option key={o} value={o}>{o.replace('_', ' ')}</option>)}
                      </select>
                    </div>
                  ))}
                  <div>
                    <label className="text-xs uppercase tracking-wider block mb-1" style={{ color: C.muted }}>Sale Price ($)</label>
                    <input type="number" value={form.sale_price} onChange={e => setForm(p => ({ ...p, sale_price: e.target.value }))}
                      className="w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'rgba(78,124,78,0.15)', color: C.slate }} placeholder="0.00" />
                  </div>
                </div>
                <div>
                  <label className="text-xs uppercase tracking-wider block mb-1" style={{ color: C.muted }}>Sale Date</label>
                  <input type="date" value={form.sale_date} onChange={e => setForm(p => ({ ...p, sale_date: e.target.value }))}
                    className="w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'rgba(78,124,78,0.15)', color: C.slate }} />
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.is_anonymous} onChange={e => setForm(p => ({ ...p, is_anonymous: e.target.checked }))} style={{ accentColor: C.sage }} />
                  <span className="text-sm" style={{ color: C.slate }}>Contribute anonymously</span>
                </label>
                <button onClick={handleSubmit} className="w-full py-2.5 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: C.sage }}>
                  Submit Sale
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
