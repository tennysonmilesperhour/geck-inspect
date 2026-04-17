import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { format } from 'date-fns';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Plus, ChevronLeft, AlertTriangle, TrendingUp, DollarSign, Percent, Target, Egg } from 'lucide-react';

const C = { forest: '#e2e8f0', sage: '#10b981', paleSage: 'rgba(16,185,129,0.1)', warmWhite: '#020617', gold: '#f59e0b', goldLight: 'rgba(245,158,11,0.15)', red: '#ef4444', slate: '#cbd5e1', muted: '#64748b', cardBg: '#0f172a', border: 'rgba(51,65,85,0.5)' };
const fmt = (v) => '$' + Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const COST_COLORS = ['#4E7C4E', '#2D4A2D', '#C4860A', '#6B7B6B', '#1A2E1A', '#8BA88B'];

export default function BreedingROI() {
  const auth = useAuth?.() || {};
  const [view, setView] = useState('list');
  const [projects, setProjects] = useState([]);
  const [selected, setSelected] = useState(null);
  const [outcomes, setOutcomes] = useState([]);
  const [clutches, setClutches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [wizard, setWizard] = useState({ step: 1, name: '', sire_name: '', sire_morph: '', dam_name: '', dam_morph: '', planned_start: '', planned_end: '', outcomes: [{ morph_combination: '', probability: 25, price_low: 0, price_mid: 0, price_high: 0 }], costs: { sire: 0, dam: 0, feeding: 30, housing: 15, incubation: 10, other: 0, months: 12 }, target_clutch_count: 3 });

  useEffect(() => { loadProjects(); }, []);

  const loadProjects = async () => {
    setLoading(true);
    const { data } = await supabase.from('breeding_projects').select('*').eq('created_by', auth.user?.email).order('created_date', { ascending: false });
    setProjects(data || []);
    setLoading(false);
  };

  const openProject = async (p) => {
    setSelected(p);
    setView('dashboard');
    const [oRes, cRes] = await Promise.all([
      supabase.from('genetic_outcome_predictions').select('*').eq('project_id', p.id).order('sort_order'),
      supabase.from('clutches').select('*').eq('project_id', p.id).order('clutch_number'),
    ]);
    setOutcomes(oRes.data || []);
    setClutches(cRes.data || []);
  };

  const probSum = wizard.outcomes.reduce((s, o) => s + Number(o.probability || 0), 0);

  const createProject = async () => {
    if (probSum !== 100 || !wizard.name) return;
    const c = wizard.costs;
    const totalEggs = wizard.target_clutch_count * 2;
    const { data: proj } = await supabase.from('breeding_projects').insert({
      name: wizard.name, sire_name: wizard.sire_name, sire_morph: wizard.sire_morph, dam_name: wizard.dam_name, dam_morph: wizard.dam_morph,
      planned_start: wizard.planned_start || null, planned_end: wizard.planned_end || null, target_clutch_count: wizard.target_clutch_count,
      acquisition_cost_sire: c.sire, acquisition_cost_dam: c.dam, feeding_cost_monthly: c.feeding, housing_cost_monthly: c.housing,
      incubation_cost: c.incubation, other_costs: c.other, project_duration_months: c.months, created_by: auth.user?.email,
    }).select().single();
    if (proj) {
      for (let i = 0; i < wizard.outcomes.length; i++) {
        const o = wizard.outcomes[i];
        await supabase.from('genetic_outcome_predictions').insert({
          project_id: proj.id, morph_combination: o.morph_combination, probability: o.probability / 100,
          price_low: o.price_low, price_mid: o.price_mid, price_high: o.price_high,
          expected_egg_count: totalEggs * (o.probability / 100), sort_order: i, created_by: auth.user?.email,
        });
      }
    }
    setView('list');
    loadProjects();
  };

  const calcProjectMetrics = (p) => {
    const totalCosts = Number(p.acquisition_cost_sire || 0) + Number(p.acquisition_cost_dam || 0) +
      (Number(p.feeding_cost_monthly || 0) + Number(p.housing_cost_monthly || 0)) * Number(p.project_duration_months || 12) +
      Number(p.incubation_cost || 0) * Number(p.target_clutch_count || 3) + Number(p.other_costs || 0);
    const projRevenue = outcomes.reduce((s, o) => s + Number(o.expected_egg_count || 0) * Number(o.price_mid || 0), 0);
    const profit = projRevenue - totalCosts;
    const roi = totalCosts > 0 ? (profit / totalCosts * 100) : 0;
    return { totalCosts, projRevenue, profit, roi };
  };

  // ─── WIZARD ───
  if (view === 'wizard') {
    return (
      <div className="min-h-screen p-6" style={{ backgroundColor: C.warmWhite, fontFamily: "'DM Sans', sans-serif" }}>
        <div className="max-w-2xl mx-auto">
          <button onClick={() => setView('list')} className="flex items-center gap-1 text-sm mb-4" style={{ color: C.sage }}><ChevronLeft size={16} /> Back</button>
          <h1 className="text-3xl mb-2" style={{ fontFamily: "'DM Serif Display', serif", color: C.forest }}>New Breeding Project</h1>

          {/* Progress */}
          <div className="flex gap-1 mb-6">
            {[1,2,3,4].map(s => <div key={s} className="flex-1 h-1.5 rounded-full" style={{ backgroundColor: wizard.step >= s ? C.sage : C.paleSage }} />)}
          </div>

          {wizard.step === 1 && (
            <div className="space-y-4">
              <h2 className="text-lg font-medium" style={{ color: C.forest }}>Pairing Details</h2>
              <input value={wizard.name} onChange={e => setWizard(p => ({ ...p, name: e.target.value }))} placeholder="Project name"
                className="w-full rounded-xl border px-4 py-3 text-sm" style={{ borderColor: C.border, color: C.slate }} />
              <div className="grid grid-cols-2 gap-3">
                <input value={wizard.sire_name} onChange={e => setWizard(p => ({ ...p, sire_name: e.target.value }))} placeholder="Sire name" className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: C.border, color: C.slate }} />
                <input value={wizard.sire_morph} onChange={e => setWizard(p => ({ ...p, sire_morph: e.target.value }))} placeholder="Sire morph" className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: C.border, color: C.slate }} />
                <input value={wizard.dam_name} onChange={e => setWizard(p => ({ ...p, dam_name: e.target.value }))} placeholder="Dam name" className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: C.border, color: C.slate }} />
                <input value={wizard.dam_morph} onChange={e => setWizard(p => ({ ...p, dam_morph: e.target.value }))} placeholder="Dam morph" className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: C.border, color: C.slate }} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs block mb-1" style={{ color: C.muted }}>Target clutches</label><input type="number" value={wizard.target_clutch_count} onChange={e => setWizard(p => ({ ...p, target_clutch_count: Number(e.target.value) }))} className="w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: C.border, color: C.slate }} /></div>
              </div>
              <button onClick={() => setWizard(p => ({ ...p, step: 2 }))} className="px-6 py-2.5 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: C.sage }}>Next: Genetic Outcomes</button>
            </div>
          )}

          {wizard.step === 2 && (
            <div className="space-y-4">
              <h2 className="text-lg font-medium" style={{ color: C.forest }}>Expected Genetic Outcomes</h2>
              <div className="h-2 rounded-full mb-2" style={{ backgroundColor: probSum === 100 ? C.sage : probSum > 100 ? C.red : C.gold }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(probSum, 100)}%`, backgroundColor: probSum === 100 ? C.sage : probSum > 100 ? C.red : C.gold }} />
              </div>
              <p className="text-xs" style={{ color: probSum === 100 ? C.sage : C.red }}>{probSum}% / 100%</p>
              {wizard.outcomes.map((o, i) => (
                <div key={i} className="grid grid-cols-5 gap-2 items-end">
                  <div className="col-span-2"><label className="text-xs block mb-1" style={{ color: C.muted }}>Morph</label><input value={o.morph_combination} onChange={e => { const n = [...wizard.outcomes]; n[i].morph_combination = e.target.value; setWizard(p => ({ ...p, outcomes: n })); }} className="w-full rounded-lg border px-2 py-1.5 text-sm" style={{ borderColor: C.border, color: C.slate }} /></div>
                  <div><label className="text-xs block mb-1" style={{ color: C.muted }}>Prob %</label><input type="number" value={o.probability} onChange={e => { const n = [...wizard.outcomes]; n[i].probability = Number(e.target.value); setWizard(p => ({ ...p, outcomes: n })); }} className="w-full rounded-lg border px-2 py-1.5 text-sm" style={{ borderColor: C.border, color: C.slate }} /></div>
                  <div><label className="text-xs block mb-1" style={{ color: C.muted }}>Mid $</label><input type="number" value={o.price_mid} onChange={e => { const n = [...wizard.outcomes]; n[i].price_mid = Number(e.target.value); setWizard(p => ({ ...p, outcomes: n })); }} className="w-full rounded-lg border px-2 py-1.5 text-sm" style={{ borderColor: C.border, color: C.slate }} /></div>
                  <button onClick={() => setWizard(p => ({ ...p, outcomes: p.outcomes.filter((_, j) => j !== i) }))} className="text-xs py-1.5 rounded" style={{ color: C.red }}>Remove</button>
                </div>
              ))}
              <button onClick={() => setWizard(p => ({ ...p, outcomes: [...p.outcomes, { morph_combination: '', probability: 0, price_low: 0, price_mid: 0, price_high: 0 }] }))} className="text-sm" style={{ color: C.sage }}>+ Add outcome</button>
              <div className="flex gap-3">
                <button onClick={() => setWizard(p => ({ ...p, step: 1 }))} className="px-4 py-2 rounded-lg text-sm border" style={{ borderColor: C.sage, color: C.sage }}>Back</button>
                <button onClick={() => setWizard(p => ({ ...p, step: 3 }))} className="px-6 py-2.5 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: C.sage }}>Next: Costs</button>
              </div>
            </div>
          )}

          {wizard.step === 3 && (
            <div className="space-y-4">
              <h2 className="text-lg font-medium" style={{ color: C.forest }}>Project Costs</h2>
              {[
                { key: 'sire', label: 'Sire acquisition' }, { key: 'dam', label: 'Dam acquisition' },
                { key: 'feeding', label: 'Feeding / month' }, { key: 'housing', label: 'Housing / month' },
                { key: 'incubation', label: 'Incubation / clutch' }, { key: 'other', label: 'Other costs' }, { key: 'months', label: 'Duration (months)' },
              ].map(f => (
                <div key={f.key}><label className="text-xs block mb-1" style={{ color: C.muted }}>{f.label}</label>
                <input type="number" value={wizard.costs[f.key]} onChange={e => setWizard(p => ({ ...p, costs: { ...p.costs, [f.key]: Number(e.target.value) } }))}
                  className="w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: C.border, color: C.slate }} /></div>
              ))}
              <div className="flex gap-3">
                <button onClick={() => setWizard(p => ({ ...p, step: 2 }))} className="px-4 py-2 rounded-lg text-sm border" style={{ borderColor: C.sage, color: C.sage }}>Back</button>
                <button onClick={() => setWizard(p => ({ ...p, step: 4 }))} className="px-6 py-2.5 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: C.sage }}>Preview P&L</button>
              </div>
            </div>
          )}

          {wizard.step === 4 && (() => {
            const c = wizard.costs;
            const totalCosts = Number(c.sire) + Number(c.dam) + (Number(c.feeding) + Number(c.housing)) * Number(c.months) + Number(c.incubation) * wizard.target_clutch_count + Number(c.other);
            const totalEggs = wizard.target_clutch_count * 2;
            const projRevenue = wizard.outcomes.reduce((s, o) => s + (totalEggs * (o.probability / 100)) * Number(o.price_mid), 0);
            const profit = projRevenue - totalCosts;
            return (
              <div className="space-y-4">
                <h2 className="text-lg font-medium" style={{ color: C.forest }}>Projected P&L</h2>
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-xl p-4 text-center" style={{ backgroundColor: C.paleSage }}><p className="text-xs uppercase" style={{ color: C.muted }}>Revenue</p><p className="text-xl font-semibold" style={{ color: C.forest }}>{fmt(projRevenue)}</p></div>
                  <div className="rounded-xl p-4 text-center" style={{ backgroundColor: C.paleSage }}><p className="text-xs uppercase" style={{ color: C.muted }}>Costs</p><p className="text-xl font-semibold" style={{ color: C.slate }}>{fmt(totalCosts)}</p></div>
                  <div className="rounded-xl p-4 text-center" style={{ backgroundColor: profit >= 0 ? C.paleSage : '#FCEBEB' }}><p className="text-xs uppercase" style={{ color: C.muted }}>Profit</p><p className="text-xl font-semibold" style={{ color: profit >= 0 ? C.sage : C.red }}>{fmt(profit)}</p></div>
                </div>
                {profit < 0 && <div className="rounded-lg p-3 flex items-center gap-2" style={{ backgroundColor: 'rgba(239,68,68,0.15)' }}><AlertTriangle size={16} style={{ color: C.red }} /><span className="text-sm" style={{ color: C.red }}>This project is projected to lose money at current prices.</span></div>}
                <div className="flex gap-3">
                  <button onClick={() => setWizard(p => ({ ...p, step: 3 }))} className="px-4 py-2 rounded-lg text-sm border" style={{ borderColor: C.sage, color: C.sage }}>Back</button>
                  <button onClick={createProject} disabled={probSum !== 100} className="px-6 py-2.5 rounded-lg text-sm font-medium text-white disabled:opacity-50" style={{ backgroundColor: C.sage }}>Create Project</button>
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    );
  }

  // ─── DASHBOARD ───
  if (view === 'dashboard' && selected) {
    const m = calcProjectMetrics(selected);
    const costData = [
      { name: 'Sire', value: Number(selected.acquisition_cost_sire || 0) },
      { name: 'Dam', value: Number(selected.acquisition_cost_dam || 0) },
      { name: 'Feeding', value: Number(selected.feeding_cost_monthly || 0) * Number(selected.project_duration_months || 12) },
      { name: 'Housing', value: Number(selected.housing_cost_monthly || 0) * Number(selected.project_duration_months || 12) },
      { name: 'Incubation', value: Number(selected.incubation_cost || 0) * Number(selected.target_clutch_count || 3) },
      { name: 'Other', value: Number(selected.other_costs || 0) },
    ].filter(d => d.value > 0);
    const breakEven = m.projRevenue > 0 && outcomes.length > 0 ? Math.ceil(m.totalCosts / (m.projRevenue / outcomes.reduce((s, o) => s + Number(o.expected_egg_count || 0), 0))) : null;

    return (
      <div className="min-h-screen p-6" style={{ backgroundColor: C.warmWhite, fontFamily: "'DM Sans', sans-serif" }}>
        <div className="max-w-6xl mx-auto">
          <button onClick={() => { setView('list'); setSelected(null); }} className="flex items-center gap-1 text-sm mb-4" style={{ color: C.sage }}><ChevronLeft size={16} /> Back</button>
          <h1 className="text-3xl mb-1" style={{ fontFamily: "'DM Serif Display', serif", color: C.forest }}>{selected.name}</h1>
          <p className="text-sm mb-6" style={{ color: C.muted }}>{selected.sire_name} x {selected.dam_name}</p>

          {m.profit < 0 && <div className="rounded-lg p-3 flex items-center gap-2 mb-4" style={{ backgroundColor: 'rgba(239,68,68,0.15)' }}><AlertTriangle size={16} style={{ color: C.red }} /><span className="text-sm" style={{ color: C.red }}>Projected to lose money at current market prices.</span></div>}

          {/* Stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Projected Revenue', value: fmt(m.projRevenue), icon: DollarSign, color: C.forest },
              { label: 'Projected Costs', value: fmt(m.totalCosts), icon: Target, color: C.slate },
              { label: 'Projected Profit', value: fmt(m.profit), icon: TrendingUp, color: m.profit >= 0 ? C.sage : C.red },
              { label: 'ROI', value: `${m.roi.toFixed(1)}%`, icon: Percent, color: m.roi >= 0 ? C.sage : C.red },
            ].map((s, i) => (
              <div key={i} className="rounded-xl border p-5" style={{ borderColor: C.border, backgroundColor: C.cardBg }}>
                <div className="flex items-center gap-2 mb-1"><s.icon size={14} style={{ color: C.sage }} /><span className="text-xs uppercase tracking-wider" style={{ color: C.muted }}>{s.label}</span></div>
                <p className="text-2xl font-semibold" style={{ color: s.color }}>{s.value}</p>
              </div>
            ))}
          </div>

          <div className="grid lg:grid-cols-5 gap-6 mb-6">
            {/* Outcomes table */}
            <div className="lg:col-span-3 rounded-xl border p-5" style={{ borderColor: C.border, backgroundColor: C.cardBg }}>
              <h2 className="text-lg mb-3" style={{ fontFamily: "'DM Serif Display', serif", color: C.forest }}>Morph Outcomes</h2>
              <table className="w-full text-sm">
                <thead><tr style={{ borderBottom: `1px solid ${C.paleSage}` }}>
                  {['Morph', 'Prob', 'Expected', 'Mid Price', 'Revenue'].map(h => <th key={h} className="text-left py-2 text-xs uppercase" style={{ color: C.muted }}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {outcomes.map((o, i) => (
                    <tr key={o.id} style={{ backgroundColor: i % 2 ? C.paleSage + '44' : 'transparent' }}>
                      <td className="py-2" style={{ color: C.forest }}>{o.morph_combination}</td>
                      <td style={{ color: C.slate }}>{(Number(o.probability) * 100).toFixed(0)}%</td>
                      <td style={{ color: C.slate }}>{Number(o.expected_egg_count || 0).toFixed(1)}</td>
                      <td style={{ color: C.slate }}>{fmt(o.price_mid)}</td>
                      <td className="font-medium" style={{ color: C.forest }}>{fmt(Number(o.expected_egg_count || 0) * Number(o.price_mid || 0))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Cost donut */}
            <div className="lg:col-span-2 rounded-xl border p-5" style={{ borderColor: C.border, backgroundColor: C.cardBg }}>
              <h2 className="text-lg mb-3" style={{ fontFamily: "'DM Serif Display', serif", color: C.forest }}>Cost Breakdown</h2>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart><Pie data={costData} innerRadius={50} outerRadius={75} dataKey="value" paddingAngle={2}>
                  {costData.map((_, i) => <Cell key={i} fill={COST_COLORS[i % COST_COLORS.length]} />)}
                </Pie><Tooltip formatter={v => fmt(v)} /></PieChart>
              </ResponsiveContainer>
              <div className="space-y-1 mt-2">{costData.map((d, i) => (
                <div key={d.name} className="flex justify-between text-xs"><span style={{ color: C.slate }}><span className="inline-block w-2 h-2 rounded-full mr-1" style={{ backgroundColor: COST_COLORS[i] }} />{d.name}</span><span style={{ color: C.muted }}>{fmt(d.value)}</span></div>
              ))}</div>
              {breakEven && <div className="mt-3 p-2 rounded-lg text-xs text-center" style={{ backgroundColor: C.goldLight, color: '#633806' }}>Break even: sell {breakEven} hatchlings at median price</div>}
            </div>
          </div>

          {/* Clutch log */}
          <div className="rounded-xl border p-5" style={{ borderColor: C.border, backgroundColor: C.cardBg }}>
            <h2 className="text-lg mb-3" style={{ fontFamily: "'DM Serif Display', serif", color: C.forest }}>Clutch Log</h2>
            {clutches.length > 0 ? (
              <div className="space-y-2">
                {clutches.map(c => (
                  <div key={c.id} className="flex items-center gap-4 rounded-lg p-3" style={{ backgroundColor: C.warmWhite }}>
                    <Egg size={16} style={{ color: C.sage }} />
                    <span className="text-sm font-medium" style={{ color: C.forest }}>Clutch #{c.clutch_number}</span>
                    <span className="text-xs" style={{ color: C.muted }}>{c.laid_date ? format(new Date(c.laid_date), 'MMM d, yyyy') : ''}</span>
                    <span className="text-xs" style={{ color: C.slate }}>{c.egg_count} eggs</span>
                    <span className="text-xs rounded-full px-2 py-0.5" style={{ backgroundColor: c.status === 'hatched' ? C.paleSage : C.goldLight, color: c.status === 'hatched' ? C.sage : '#633806' }}>{c.status}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-center py-6" style={{ color: C.muted }}>No clutches logged yet</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─── PROJECT LIST ───
  return (
    <div className="min-h-screen p-6" style={{ backgroundColor: C.warmWhite, fontFamily: "'DM Sans', sans-serif" }}>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl" style={{ fontFamily: "'DM Serif Display', serif", color: C.forest }}>Breeding ROI</h1>
          <button onClick={() => setView('wizard')} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: C.sage }}><Plus size={16} /> New Project</button>
        </div>
        {loading ? <div className="space-y-3">{[1,2].map(i => <div key={i} className="animate-pulse rounded-xl h-20" style={{ backgroundColor: C.paleSage }} />)}</div> : (
          <div className="rounded-xl border overflow-hidden" style={{ borderColor: C.border, backgroundColor: C.cardBg }}>
            <table className="w-full text-sm">
              <thead><tr style={{ backgroundColor: C.paleSage }}>
                {['Project', 'Pairing', 'Status', 'Clutches'].map(h => <th key={h} className="text-left py-3 px-4 text-xs uppercase tracking-wider" style={{ color: C.muted }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {projects.map((p, i) => (
                  <tr key={p.id} onClick={() => openProject(p)} className="cursor-pointer hover:bg-opacity-50 transition" style={{ backgroundColor: i % 2 ? C.paleSage + '44' : 'transparent' }}>
                    <td className="py-3 px-4 font-medium" style={{ color: C.forest }}>{p.name}</td>
                    <td className="py-3 px-4" style={{ color: C.slate }}>{p.sire_name} x {p.dam_name}</td>
                    <td className="py-3 px-4"><span className="text-xs rounded-full px-2 py-0.5" style={{ backgroundColor: p.status === 'active' ? C.paleSage : C.goldLight, color: p.status === 'active' ? C.sage : '#633806' }}>{p.status}</span></td>
                    <td className="py-3 px-4" style={{ color: C.muted }}>{p.target_clutch_count || 0} planned</td>
                  </tr>
                ))}
                {projects.length === 0 && <tr><td colSpan={4} className="text-center py-12 text-sm" style={{ color: C.muted }}>No breeding projects yet</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
