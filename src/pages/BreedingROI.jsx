import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { format } from 'date-fns';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Plus, ChevronLeft, AlertTriangle, TrendingUp, DollarSign, Percent, Target, Egg } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PageHeader from '@/components/shared/PageHeader';

const fmt = (v) => '$' + Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
// Readable on the dark card (the old forest greens nearly vanished).
const COST_COLORS = ['#10b981', '#38bdf8', '#f59e0b', '#a78bfa', '#f472b6', '#94a3b8'];
const TOOLTIP_STYLE = { backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: 8, fontSize: 12, color: '#e2e8f0' };
// Raw inputs follow the OS color scheme unless they are given colors.
const INPUT_CLS = 'border border-slate-700 bg-slate-900 text-slate-200 placeholder:text-slate-500';
const CARD_CLS = 'rounded-xl border border-slate-700 bg-slate-900 p-4 md:p-6';

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
      <div className="min-h-screen bg-slate-950 p-4 md:p-8">
        <div className="max-w-2xl mx-auto">
          <PageHeader
            icon={TrendingUp}
            title="New Breeding Project"
            eyebrow={<button onClick={() => setView('list')} className="flex items-center gap-1 text-sm text-emerald-400"><ChevronLeft size={16} /> Back</button>}
          />

          {/* Progress */}
          <div className="flex gap-1 mb-6">
            {[1,2,3,4].map(s => <div key={s} className={`flex-1 h-1.5 rounded-full ${wizard.step >= s ? 'bg-emerald-600' : 'bg-emerald-500/10'}`} />)}
          </div>

          {wizard.step === 1 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-slate-100">Pairing Details</h2>
              <input value={wizard.name} onChange={e => setWizard(p => ({ ...p, name: e.target.value }))} placeholder="Project name"
                className={`w-full rounded-xl px-4 py-3 text-sm ${INPUT_CLS}`} />
              <div className="grid grid-cols-2 gap-3">
                <input value={wizard.sire_name} onChange={e => setWizard(p => ({ ...p, sire_name: e.target.value }))} placeholder="Sire name" className={`rounded-lg px-3 py-2 text-sm ${INPUT_CLS}`} />
                <input value={wizard.sire_morph} onChange={e => setWizard(p => ({ ...p, sire_morph: e.target.value }))} placeholder="Sire morph" className={`rounded-lg px-3 py-2 text-sm ${INPUT_CLS}`} />
                <input value={wizard.dam_name} onChange={e => setWizard(p => ({ ...p, dam_name: e.target.value }))} placeholder="Dam name" className={`rounded-lg px-3 py-2 text-sm ${INPUT_CLS}`} />
                <input value={wizard.dam_morph} onChange={e => setWizard(p => ({ ...p, dam_morph: e.target.value }))} placeholder="Dam morph" className={`rounded-lg px-3 py-2 text-sm ${INPUT_CLS}`} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs block mb-1 text-slate-500">Target clutches</label><input type="number" value={wizard.target_clutch_count} onChange={e => setWizard(p => ({ ...p, target_clutch_count: Number(e.target.value) }))} className={`w-full rounded-lg px-3 py-2 text-sm ${INPUT_CLS}`} /></div>
              </div>
              <Button onClick={() => setWizard(p => ({ ...p, step: 2 }))}>Next: Genetic Outcomes</Button>
            </div>
          )}

          {wizard.step === 2 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-slate-100">Expected Genetic Outcomes</h2>
              <div className={`h-2 rounded-full mb-2 ${probSum === 100 ? 'bg-emerald-500/15' : probSum > 100 ? 'bg-red-500/15' : 'bg-amber-500/15'}`}>
                <div className={`h-full rounded-full transition-all ${probSum === 100 ? 'bg-emerald-600' : probSum > 100 ? 'bg-red-500' : 'bg-amber-500'}`} style={{ width: `${Math.min(probSum, 100)}%` }} />
              </div>
              <p className={`text-xs ${probSum === 100 ? 'text-emerald-400' : 'text-red-400'}`}>{probSum}% / 100%</p>
              {wizard.outcomes.map((o, i) => (
                <div key={i} className="grid grid-cols-2 sm:grid-cols-5 gap-2 items-end">
                  <div className="col-span-2"><label className="text-xs block mb-1 text-slate-500">Morph</label><input value={o.morph_combination} onChange={e => { const n = [...wizard.outcomes]; n[i].morph_combination = e.target.value; setWizard(p => ({ ...p, outcomes: n })); }} className={`w-full rounded-lg px-2 py-1.5 text-sm ${INPUT_CLS}`} /></div>
                  <div><label className="text-xs block mb-1 text-slate-500">Prob %</label><input type="number" value={o.probability} onChange={e => { const n = [...wizard.outcomes]; n[i].probability = Number(e.target.value); setWizard(p => ({ ...p, outcomes: n })); }} className={`w-full rounded-lg px-2 py-1.5 text-sm ${INPUT_CLS}`} /></div>
                  <div><label className="text-xs block mb-1 text-slate-500">Mid $</label><input type="number" value={o.price_mid} onChange={e => { const n = [...wizard.outcomes]; n[i].price_mid = Number(e.target.value); setWizard(p => ({ ...p, outcomes: n })); }} className={`w-full rounded-lg px-2 py-1.5 text-sm ${INPUT_CLS}`} /></div>
                  <button onClick={() => setWizard(p => ({ ...p, outcomes: p.outcomes.filter((_, j) => j !== i) }))} className="col-span-2 sm:col-span-1 justify-self-start sm:justify-self-auto text-xs py-1.5 rounded text-red-400">Remove</button>
                </div>
              ))}
              <button onClick={() => setWizard(p => ({ ...p, outcomes: [...p.outcomes, { morph_combination: '', probability: 0, price_low: 0, price_mid: 0, price_high: 0 }] }))} className="text-sm text-emerald-400">+ Add outcome</button>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => setWizard(p => ({ ...p, step: 1 }))}>Back</Button>
                <Button onClick={() => setWizard(p => ({ ...p, step: 3 }))}>Next: Costs</Button>
              </div>
            </div>
          )}

          {wizard.step === 3 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-slate-100">Project Costs</h2>
              {[
                { key: 'sire', label: 'Sire acquisition' }, { key: 'dam', label: 'Dam acquisition' },
                { key: 'feeding', label: 'Feeding / month' }, { key: 'housing', label: 'Housing / month' },
                { key: 'incubation', label: 'Incubation / clutch' }, { key: 'other', label: 'Other costs' }, { key: 'months', label: 'Duration (months)' },
              ].map(f => (
                <div key={f.key}><label className="text-xs block mb-1 text-slate-500">{f.label}</label>
                <input type="number" value={wizard.costs[f.key]} onChange={e => setWizard(p => ({ ...p, costs: { ...p.costs, [f.key]: Number(e.target.value) } }))}
                  className={`w-full rounded-lg px-3 py-2 text-sm ${INPUT_CLS}`} /></div>
              ))}
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => setWizard(p => ({ ...p, step: 2 }))}>Back</Button>
                <Button onClick={() => setWizard(p => ({ ...p, step: 4 }))}>Preview P&L</Button>
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
                <h2 className="text-lg font-semibold text-slate-100">Projected P&L</h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="rounded-xl p-4 text-center bg-emerald-500/10"><p className="text-xs uppercase text-slate-500">Revenue</p><p className="text-xl font-semibold text-slate-100">{fmt(projRevenue)}</p></div>
                  <div className="rounded-xl p-4 text-center bg-emerald-500/10"><p className="text-xs uppercase text-slate-500">Costs</p><p className="text-xl font-semibold text-slate-200">{fmt(totalCosts)}</p></div>
                  <div className={`rounded-xl p-4 text-center ${profit >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/15'}`}><p className="text-xs uppercase text-slate-500">Profit</p><p className={`text-xl font-semibold ${profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmt(profit)}</p></div>
                </div>
                {profit < 0 && <div className="rounded-lg p-3 flex items-center gap-2 bg-red-500/15"><AlertTriangle size={16} className="text-red-400" /><span className="text-sm text-red-400">This project is projected to lose money at current prices.</span></div>}
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => setWizard(p => ({ ...p, step: 3 }))}>Back</Button>
                  <Button onClick={createProject} disabled={probSum !== 100}>Create Project</Button>
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
      <div className="min-h-screen bg-slate-950 p-4 md:p-8">
        <div className="max-w-6xl mx-auto">
          <PageHeader
            icon={TrendingUp}
            title={selected.name}
            description={<>{selected.sire_name} x {selected.dam_name}</>}
            eyebrow={<button onClick={() => { setView('list'); setSelected(null); }} className="flex items-center gap-1 text-sm text-emerald-400"><ChevronLeft size={16} /> Back</button>}
          />

          {m.profit < 0 && <div className="rounded-lg p-3 flex items-center gap-2 mb-4 bg-red-500/15"><AlertTriangle size={16} className="text-red-400" /><span className="text-sm text-red-400">Projected to lose money at current market prices.</span></div>}

          {/* Stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Projected Revenue', value: fmt(m.projRevenue), icon: DollarSign, color: 'text-slate-100' },
              { label: 'Projected Costs', value: fmt(m.totalCosts), icon: Target, color: 'text-slate-200' },
              { label: 'Projected Profit', value: fmt(m.profit), icon: TrendingUp, color: m.profit >= 0 ? 'text-emerald-400' : 'text-red-400' },
              { label: 'ROI', value: `${m.roi.toFixed(1)}%`, icon: Percent, color: m.roi >= 0 ? 'text-emerald-400' : 'text-red-400' },
            ].map((s, i) => (
              <div key={i} className={CARD_CLS}>
                <div className="flex items-center gap-2 mb-1"><s.icon size={14} className="text-emerald-400" /><span className="text-xs uppercase tracking-wider text-slate-500">{s.label}</span></div>
                <p className={`text-2xl font-semibold ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-6">
            {/* Outcomes table */}
            <div className={`lg:col-span-3 min-w-0 ${CARD_CLS}`}>
              <h2 className="text-base font-semibold text-slate-100 mb-3">Morph Outcomes</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-emerald-500/10">
                    {['Morph', 'Prob', 'Expected', 'Mid Price', 'Revenue'].map(h => <th key={h} className="text-left py-2 pr-3 text-xs uppercase text-slate-500">{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {outcomes.map((o, i) => (
                      <tr key={o.id} className={i % 2 ? 'bg-emerald-500/5' : ''}>
                        <td className="py-2 pr-3 text-slate-100">{o.morph_combination}</td>
                        <td className="pr-3 text-slate-200">{(Number(o.probability) * 100).toFixed(0)}%</td>
                        <td className="pr-3 text-slate-200">{Number(o.expected_egg_count || 0).toFixed(1)}</td>
                        <td className="pr-3 text-slate-200">{fmt(o.price_mid)}</td>
                        <td className="pr-3 font-medium text-slate-100">{fmt(Number(o.expected_egg_count || 0) * Number(o.price_mid || 0))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Cost donut */}
            <div className={`lg:col-span-2 min-w-0 ${CARD_CLS}`}>
              <h2 className="text-base font-semibold text-slate-100 mb-3">Cost Breakdown</h2>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart><Pie data={costData} innerRadius={50} outerRadius={75} dataKey="value" paddingAngle={2}>
                  {costData.map((_, i) => <Cell key={i} fill={COST_COLORS[i % COST_COLORS.length]} />)}
                </Pie><Tooltip formatter={v => fmt(v)} contentStyle={TOOLTIP_STYLE} itemStyle={{ color: '#e2e8f0' }} /></PieChart>
              </ResponsiveContainer>
              <div className="space-y-1 mt-2">{costData.map((d, i) => (
                <div key={d.name} className="flex justify-between text-xs"><span className="text-slate-200"><span className="inline-block w-2 h-2 rounded-full mr-1" style={{ backgroundColor: COST_COLORS[i] }} />{d.name}</span><span className="text-slate-500">{fmt(d.value)}</span></div>
              ))}</div>
              {breakEven && <div className="mt-3 p-2 rounded-lg text-xs text-center bg-amber-500/15 text-amber-300">Break even: sell {breakEven} hatchlings at median price</div>}
            </div>
          </div>

          {/* Clutch log */}
          <div className={CARD_CLS}>
            <h2 className="text-base font-semibold text-slate-100 mb-3">Clutch Log</h2>
            {clutches.length > 0 ? (
              <div className="space-y-2">
                {clutches.map(c => (
                  <div key={c.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg p-3 bg-slate-950">
                    <Egg size={16} className="text-emerald-400" />
                    <span className="text-sm font-medium text-slate-100">Clutch #{c.clutch_number}</span>
                    <span className="text-xs text-slate-500">{c.laid_date ? format(new Date(c.laid_date), 'MMM d, yyyy') : ''}</span>
                    <span className="text-xs text-slate-200">{c.egg_count} eggs</span>
                    <span className={`text-xs rounded-full px-2 py-0.5 ${c.status === 'hatched' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/15 text-amber-300'}`}>{c.status}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-center py-6 text-slate-500">No clutches logged yet</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─── PROJECT LIST ───
  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <PageHeader icon={TrendingUp} title="Breeding ROI">
          <Button onClick={() => setView('wizard')}><Plus size={16} /> New Project</Button>
        </PageHeader>
        {/* Retired from the menus 28 Sep 2026; kept for old links. */}
        <div className="rounded-xl border border-slate-700 bg-emerald-500/10 p-4 mb-6 text-sm text-slate-100">
          This page has been replaced. Each plan in <Link to={createPageUrl('Breeding')} className="underline font-medium">Breeding</Link> now
          shows its pairing value from your geckos&apos; real odds and hatchling prices, and{' '}
          <Link to={createPageUrl('MarketplaceSalesStats')} className="underline font-medium">Business Tools</Link> shows
          profit per pairing from your actual sales and costs.
        </div>
        {loading ? <div className="space-y-3">{[1,2].map(i => <div key={i} className="animate-pulse rounded-xl h-20 bg-emerald-500/10" />)}</div> : (
          <div className="rounded-xl border border-slate-700 bg-slate-900 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="bg-emerald-500/10">
                  {['Project', 'Pairing', 'Status', 'Clutches'].map(h => <th key={h} className="text-left py-3 px-4 text-xs uppercase tracking-wider text-slate-500">{h}</th>)}
                </tr></thead>
                <tbody>
                  {projects.map((p, i) => (
                    <tr key={p.id} onClick={() => openProject(p)} className={`cursor-pointer hover:bg-slate-800/50 transition ${i % 2 ? 'bg-emerald-500/5' : ''}`}>
                      <td className="py-3 px-4 font-medium text-slate-100">{p.name}</td>
                      <td className="py-3 px-4 text-slate-200">{p.sire_name} x {p.dam_name}</td>
                      <td className="py-3 px-4"><span className={`text-xs rounded-full px-2 py-0.5 ${p.status === 'active' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/15 text-amber-300'}`}>{p.status}</span></td>
                      <td className="py-3 px-4 text-slate-500">{p.target_clutch_count || 0} planned</td>
                    </tr>
                  ))}
                  {projects.length === 0 && <tr><td colSpan={4} className="text-center py-12 text-sm text-slate-500">No breeding projects yet</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
