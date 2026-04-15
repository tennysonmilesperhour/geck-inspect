import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { Gecko, MarketplaceCost } from '@/entities/all';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { toast } from '@/components/ui/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import PageSettingsPanel from '@/components/ui/PageSettingsPanel';
import usePageSettings from '@/hooks/usePageSettings';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  DollarSign, TrendingUp, AlertCircle, Trash2, Plus, Save,
  ChevronDown, ChevronUp, Tag, Calendar, Edit2, X, Check,
  Globe, Lock, ArrowRight, BarChart3,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { format, getQuarter, getYear } from 'date-fns';
import GeckoSelectionModal from '../components/marketplace/GeckoSelectionModal';

const QUARTER_LABELS = { 1: 'Q1 (Jan–Mar)', 2: 'Q2 (Apr–Jun)', 3: 'Q3 (Jul–Sep)', 4: 'Q4 (Oct–Dec)' };

const COST_CATEGORIES = [
  { value: 'food', label: 'Food' },
  { value: 'supplies', label: 'Supplies' },
  { value: 'vet_care', label: 'Vet Care' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'shipping', label: 'Shipping' },
  { value: 'expo_fees', label: 'Expo Fees' },
  { value: 'acquisition', label: 'Acquisition' },
  { value: 'utilities', label: 'Utilities' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'other', label: 'Other' },
];

const REVENUE_CATEGORIES = [
  { value: 'resale', label: 'Resale' },
  { value: 'produced_in_house', label: 'Produced In House' },
  { value: 'holdback_release', label: 'Holdback Release' },
  { value: 'retired_breeder', label: 'Retired Breeder' },
  { value: 'other', label: 'Other' },
];

const getCategoryLabel = (value) => COST_CATEGORIES.find(c => c.value === value)?.label || value || 'Other';
const _getRevenueCategory = (value) => REVENUE_CATEGORIES.find(c => c.value === value)?.label || value || 'Animal';

function getQuarterKey(dateStr) {
  const d = new Date(dateStr);
  return `${getYear(d)}-Q${getQuarter(d)}`;
}
function parseQuarterKey(key) {
  const [year, q] = key.split('-Q');
  return { year: parseInt(year), quarter: parseInt(q) };
}

function CostRow({ cost, onDelete, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    description: cost.description,
    amount: cost.amount,
    date: cost.date,
    category: cost.category || 'other'
  });

  const handleSave = async () => {
    await onUpdate(cost.id, { ...form, amount: parseFloat(form.amount) });
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="bg-emerald-950/40 border border-emerald-800/50 p-3 rounded-lg space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs text-slate-400">Description</Label>
            <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className="bg-slate-800 border-slate-600 text-slate-100 h-8 text-sm mt-1" />
          </div>
          <div>
            <Label className="text-xs text-slate-400">Amount ($)</Label>
            <Input type="number" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
              className="bg-slate-800 border-slate-600 text-slate-100 h-8 text-sm mt-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
          </div>
          <div>
            <Label className="text-xs text-slate-400">Date</Label>
            <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
              className="bg-slate-800 border-slate-600 text-slate-100 h-8 text-sm mt-1" />
          </div>
          <div>
            <Label className="text-xs text-slate-400">Category</Label>
            <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
              className="w-full h-8 mt-1 rounded-md bg-slate-800 border border-slate-600 text-slate-100 text-sm px-2">
              {COST_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)} className="h-7 text-slate-400"><X className="w-3 h-3" /></Button>
          <Button size="sm" onClick={handleSave} className="h-7 bg-slate-600 hover:bg-slate-500 text-white"><Check className="w-3 h-3 mr-1" />Save</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-800/60 border border-slate-700/50 p-3 rounded-lg flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <p className="font-medium text-slate-100 text-sm truncate">{cost.description}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-slate-500">{cost.date ? format(new Date(cost.date), 'MMM d, yyyy') : '—'}</span>
          <Badge className="text-[10px] px-1.5 py-0 bg-emerald-900/50 text-emerald-300 border-emerald-800/50">{getCategoryLabel(cost.category)}</Badge>
        </div>
      </div>
      <p className="text-orange-400 font-semibold text-sm flex-shrink-0">${Number(cost.amount).toFixed(2)}</p>
      <Button size="icon" variant="ghost" onClick={() => setEditing(true)} className="h-7 w-7 text-slate-400 hover:text-slate-200 hover:bg-slate-700 flex-shrink-0"><Edit2 className="w-3 h-3" /></Button>
      <Button size="icon" variant="ghost" onClick={() => onDelete(cost.id)} className="h-7 w-7 text-red-500 hover:bg-red-900/20 flex-shrink-0"><Trash2 className="w-3 h-3" /></Button>
    </div>
  );
}

function QuarterSection({ quarterKey, items, onDelete: _onDelete, onUpdate: _onUpdate, renderItem }) {
  const [open, setOpen] = useState(true);
  const { year, quarter } = parseQuarterKey(quarterKey);
  const total = items.reduce((s, i) => s + Number(i.amount || 0), 0);
  const grouped = items.reduce((acc, item) => {
    const cat = item.category || 'other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  return (
    <div className="bg-slate-800/60 border border-emerald-900/60 rounded-xl overflow-hidden">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-700/40 transition-colors">
        <div className="flex items-center gap-3">
          <Calendar className="w-4 h-4 text-emerald-500" />
          <span className="font-semibold text-slate-100">{year} — {QUARTER_LABELS[quarter]}</span>
          <Badge className="bg-emerald-900/50 text-emerald-300 border-emerald-800/40 text-xs">{items.length} entries</Badge>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-emerald-400 font-bold">${total.toFixed(2)}</span>
          {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </div>
      </button>

      {open && (
        <div className="px-4 pt-4 pb-4 border-t border-slate-700/50 space-y-4">
          {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([cat, catItems]) => (
            <div key={cat}>
              <div className="flex items-center gap-2 mb-2">
                <Tag className="w-3 h-3 text-emerald-600" />
                <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wide">{getCategoryLabel(cat)}</span>
                <span className="text-xs text-slate-500">— ${catItems.reduce((s, i) => s + Number(i.amount || 0), 0).toFixed(2)}</span>
              </div>
              <div className="space-y-2">
                {catItems.map(item => renderItem(item))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


// ---------------------------------------------------------------------------
// Market Analytics — enterprise-gated tab with comprehensive mock data
// ---------------------------------------------------------------------------
// All mock data tagged with __mock: true for clean removal when real
// data pipelines are connected.

const MORPHS_WITH_DATA = [
  'Lilly White', 'Axanthic', 'Cappuccino', 'Soft Scale', 'Harlequin',
  'Dalmatian', 'Pinstripe', 'Flame', 'Tiger', 'Patternless',
  'Empty Back', 'Moonglow', 'Bicolor', 'Brindle',
];

const WEIGHT_CLASSES = [
  { value: 'all', label: 'All weights' },
  { value: 'baby', label: 'Baby (< 5g)' },
  { value: 'juvenile', label: 'Juvenile (5-15g)' },
  { value: 'subadult', label: 'Sub-adult (15-30g)' },
  { value: 'adult', label: 'Adult (30g+)' },
];

const SEX_OPTIONS = [
  { value: 'all', label: 'All sexes' },
  { value: 'male', label: 'Male only' },
  { value: 'female', label: 'Female only' },
  { value: 'unsexed', label: 'Unsexed only' },
];

function generatePriceHistory(morphName, __mock = true) {
  const months = [];
  const basePrice = 100 + (morphName.length * 30) + Math.random() * 200;
  let price = basePrice;
  for (let i = 11; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const drift = (Math.random() - 0.45) * 40;
    price = Math.max(50, price + drift);
    months.push({
      month: d.toLocaleString('default', { month: 'short', year: '2-digit' }),
      avg: Math.round(price),
      median: Math.round(price * (0.85 + Math.random() * 0.3)),
      low: Math.round(price * 0.4),
      high: Math.round(price * (1.5 + Math.random() * 0.5)),
      volume: Math.round(5 + Math.random() * 50),
      __mock,
    });
  }
  return months;
}

function generateMorphStats(__mock = true) {
  return MORPHS_WITH_DATA.map(name => {
    const avg = Math.round(100 + Math.random() * 400);
    const median = Math.round(avg * (0.8 + Math.random() * 0.4));
    return {
      name,
      avgPrice: avg,
      medianPrice: median,
      lowPrice: Math.round(avg * 0.3),
      highPrice: Math.round(avg * (1.4 + Math.random() * 0.6)),
      avgDaysListed: Math.round(3 + Math.random() * 45),
      totalListings: Math.round(10 + Math.random() * 200),
      activeListings: Math.round(2 + Math.random() * 30),
      trend12m: +((-20 + Math.random() * 40).toFixed(1)),
      __mock,
    };
  }).sort((a, b) => b.totalListings - a.totalListings);
}

function MarketAnalyticsTab({ user }) {
  const [selectedMorph, setSelectedMorph] = useState(MORPHS_WITH_DATA[0]);
  const [weightClass, setWeightClass] = useState('all');
  const [sexFilter, setSexFilter] = useState('all');
  const [morphStats] = useState(() => generateMorphStats());
  const [priceHistory, setPriceHistory] = useState(() => generatePriceHistory(MORPHS_WITH_DATA[0]));

  const tier = user?.membership_tier || 'free';
  const isAdmin = user?.role === 'admin';
  const hasAccess = tier === 'enterprise' || isAdmin;

  if (!hasAccess) {
    return (
      <div className="py-16 text-center space-y-5">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
          <Lock className="w-8 h-8 text-emerald-400" />
        </div>
        <h3 className="text-xl font-bold text-white">Enterprise Feature</h3>
        <p className="text-slate-400 max-w-md mx-auto leading-relaxed">
          Market Analytics provides pricing trends, listing duration stats, and
          morph demand intelligence. Available on the Enterprise tier.
        </p>
        <Link to={createPageUrl('Membership')}>
          <Button className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-6">
            View plans <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </Link>
      </div>
    );
  }

  const activeMorphStats = morphStats.find(m => m.name === selectedMorph) || morphStats[0];

  const handleMorphChange = (morph) => {
    setSelectedMorph(morph);
    setPriceHistory(generatePriceHistory(morph));
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 flex items-start gap-2">
        <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <p className="text-xs text-slate-400 leading-relaxed">
          <span className="text-amber-300 font-semibold">Preview data.</span>{' '}
          All charts show simulated data. Live market feeds will replace this when integrated.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[180px]">
          <label className="text-xs text-slate-400 mb-1 block">Morph</label>
          <select
            value={selectedMorph}
            onChange={e => handleMorphChange(e.target.value)}
            className="w-full h-9 rounded-md bg-slate-900 border border-slate-700 text-slate-100 text-sm px-3"
          >
            {MORPHS_WITH_DATA.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Weight class</label>
          <select
            value={weightClass}
            onChange={e => setWeightClass(e.target.value)}
            className="h-9 rounded-md bg-slate-900 border border-slate-700 text-slate-100 text-sm px-3"
          >
            {WEIGHT_CLASSES.map(w => <option key={w.value} value={w.value}>{w.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Sex</label>
          <select
            value={sexFilter}
            onChange={e => setSexFilter(e.target.value)}
            className="h-9 rounded-md bg-slate-900 border border-slate-700 text-slate-100 text-sm px-3"
          >
            {SEX_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Avg Price', value: `$${activeMorphStats.avgPrice}`, color: 'text-emerald-400' },
          { label: 'Median', value: `$${activeMorphStats.medianPrice}`, color: 'text-blue-400' },
          { label: 'Range', value: `$${activeMorphStats.lowPrice}-$${activeMorphStats.highPrice}`, color: 'text-slate-300' },
          { label: 'Avg Days Listed', value: `${activeMorphStats.avgDaysListed}d`, color: 'text-amber-400' },
          { label: 'Active Listings', value: activeMorphStats.activeListings, color: 'text-purple-400' },
          { label: '12m Trend', value: `${activeMorphStats.trend12m > 0 ? '+' : ''}${activeMorphStats.trend12m}%`, color: activeMorphStats.trend12m >= 0 ? 'text-emerald-400' : 'text-red-400' },
        ].map(s => (
          <div key={s.label} className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">{s.label}</p>
            <p className={`text-lg font-bold mt-0.5 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Price History Chart */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
        <h4 className="text-sm font-semibold text-slate-200 mb-4">
          {selectedMorph} — 12-Month Price History
        </h4>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={priceHistory}>
              <defs>
                <linearGradient id="maAvgGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="maRangeGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a4034" />
              <XAxis dataKey="month" tick={{ fill: '#6b8f80', fontSize: 11 }} />
              <YAxis tick={{ fill: '#6b8f80', fontSize: 11 }} tickFormatter={v => `$${v}`} />
              <RechartsTooltip
                contentStyle={{ background: '#0c2a1f', border: '1px solid #1a4034', borderRadius: 8 }}
                labelStyle={{ color: '#d1fae5' }}
                itemStyle={{ color: '#a7f3d0' }}
                formatter={(v, name) => [`$${v}`, name]}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area type="monotone" dataKey="high" stroke="none" fill="url(#maRangeGrad)" name="High" />
              <Area type="monotone" dataKey="avg" stroke="#10b981" strokeWidth={2} fill="url(#maAvgGrad)" name="Average" />
              <Line type="monotone" dataKey="median" stroke="#8b5cf6" strokeWidth={1.5} strokeDasharray="4 2" dot={false} name="Median" />
              <Line type="monotone" dataKey="low" stroke="#ef4444" strokeWidth={1} strokeDasharray="2 2" dot={false} name="Low" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Volume Chart */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
        <h4 className="text-sm font-semibold text-slate-200 mb-4">Monthly Listing Volume</h4>
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={priceHistory}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a4034" />
              <XAxis dataKey="month" tick={{ fill: '#6b8f80', fontSize: 11 }} />
              <YAxis tick={{ fill: '#6b8f80', fontSize: 11 }} />
              <RechartsTooltip contentStyle={{ background: '#0c2a1f', border: '1px solid #1a4034', borderRadius: 8 }} labelStyle={{ color: '#d1fae5' }} />
              <Bar dataKey="volume" fill="#10b981" radius={[4, 4, 0, 0]} name="Listings" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* All Morphs Comparison Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800">
          <h4 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-emerald-400" />
            All Morphs Comparison
          </h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left px-4 py-2.5 text-slate-400 font-medium">Morph</th>
                <th className="text-right px-3 py-2.5 text-slate-400 font-medium">Avg</th>
                <th className="text-right px-3 py-2.5 text-slate-400 font-medium">Median</th>
                <th className="text-right px-3 py-2.5 text-slate-400 font-medium">Range</th>
                <th className="text-right px-3 py-2.5 text-slate-400 font-medium">Days Listed</th>
                <th className="text-right px-3 py-2.5 text-slate-400 font-medium">Active</th>
                <th className="text-right px-3 py-2.5 text-slate-400 font-medium">12m Trend</th>
              </tr>
            </thead>
            <tbody>
              {morphStats.map(m => (
                <tr
                  key={m.name}
                  onClick={() => handleMorphChange(m.name)}
                  className={`border-b border-slate-800/50 cursor-pointer transition-colors ${
                    m.name === selectedMorph ? 'bg-emerald-950/30' : 'hover:bg-slate-800/30'
                  }`}
                >
                  <td className="px-4 py-2.5 font-medium text-slate-200">{m.name}</td>
                  <td className="text-right px-3 py-2.5 text-emerald-400 font-semibold">${m.avgPrice}</td>
                  <td className="text-right px-3 py-2.5 text-slate-300">${m.medianPrice}</td>
                  <td className="text-right px-3 py-2.5 text-slate-400">${m.lowPrice}-${m.highPrice}</td>
                  <td className="text-right px-3 py-2.5 text-amber-400">{m.avgDaysListed}d</td>
                  <td className="text-right px-3 py-2.5 text-slate-300">{m.activeListings}</td>
                  <td className={`text-right px-3 py-2.5 font-semibold ${m.trend12m >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {m.trend12m > 0 ? '+' : ''}{m.trend12m}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
export default function MarketplaceSalesStats() {
  const [statsPrefs, setStatsPrefs] = usePageSettings('sales_stats_prefs', {
    defaultTab: 'revenue',
    expandQuarters: true,
    currency: '$',
  });
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [soldGeckos, setSoldGeckos] = useState([]);
  const [priceOverrides, setPriceOverrides] = useState({});
  const [costs, setCosts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [newCost, setNewCost] = useState({
    description: '', amount: '', date: new Date().toISOString().split('T')[0], category: 'other'
  });
  const [newRevenue, setNewRevenue] = useState({
    name: '', amount: '', date: new Date().toISOString().split('T')[0], category: 'produced_in_house'
  });
  const [geckoCategories, setGeckoCategories] = useState({});
  const [addSaleModalOpen, setAddSaleModalOpen] = useState(false);
  const [saleMode, setSaleMode] = useState(null);
  const [selectionModalOpen, setSelectionModalOpen] = useState(false);

  useEffect(() => {
    const savedGeckoCats = localStorage.getItem('marketplace_gecko_categories');
    if (savedGeckoCats) setGeckoCategories(JSON.parse(savedGeckoCats));
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const currentUser = await base44.auth.me();
        if (!currentUser) { navigate(createPageUrl('Home')); return; }
        setUser(currentUser);

        const allGeckos = await Gecko.filter({ created_by: currentUser.email });
        setSoldGeckos(allGeckos.filter(g => (g.archived && g.archive_reason === 'sold') || g.status === 'Sold'));

        let dbCosts = [];
        try {
          dbCosts = await MarketplaceCost.filter({ user_email: currentUser.email }, '-date');
        } catch (e) { console.error('Failed to load costs:', e); }

        if (dbCosts.length === 0) {
          try {
            const savedCosts = localStorage.getItem(`marketplace_costs_${currentUser.email}`);
            if (savedCosts) {
              const localCosts = JSON.parse(savedCosts);
              if (localCosts.length > 0) {
                const toCreate = localCosts.map(c => ({
                  user_email: currentUser.email,
                  description: c.description,
                  amount: c.amount,
                  date: c.date?.split('T')[0] || new Date().toISOString().split('T')[0],
                  category: 'General',
                }));
                await MarketplaceCost.bulkCreate(toCreate);
                dbCosts = await MarketplaceCost.filter({ user_email: currentUser.email }, '-date');
                localStorage.removeItem(`marketplace_costs_${currentUser.email}`);
              }
            }
          } catch (e) { console.warn('Migration failed:', e); }
        }

        setCosts(dbCosts);
      } catch (error) {
        console.error('Failed to load stats:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const getPrice = (gecko) => {
    if (priceOverrides[gecko.id] !== undefined) return parseFloat(priceOverrides[gecko.id]) || 0;
    return gecko.asking_price ? parseFloat(gecko.asking_price) : 0;
  };

  const totalRevenue = soldGeckos.reduce((sum, g) => sum + getPrice(g), 0);
  const totalCosts = costs.reduce((sum, c) => sum + Number(c.amount), 0);
  const netProfit = totalRevenue - totalCosts;
  const currentYear = new Date().getFullYear();
  const ytdRevenue = soldGeckos.reduce((sum, g) => {
    const yr = g.archived_date ? new Date(g.archived_date).getFullYear() : new Date(g.updated_date).getFullYear();
    return yr === currentYear ? sum + getPrice(g) : sum;
  }, 0);

  const handleSaveAllPrices = async () => {
    setIsSaving(true);
    for (const [geckoId, value] of Object.entries(priceOverrides)) {
      const parsed = parseFloat(value);
      if (!isNaN(parsed)) await Gecko.update(geckoId, { asking_price: parsed });
    }
    setIsSaving(false);
  };

  const handleAddCost = async () => {
    if (!newCost.description || !newCost.amount) return;
    try {
      const created = await MarketplaceCost.create({
        user_email: user.email,
        description: newCost.description,
        amount: parseFloat(newCost.amount),
        date: newCost.date,
        category: newCost.category || 'General',
      });
      setCosts(prev => [created, ...prev]);
      setNewCost({ description: '', amount: '', date: new Date().toISOString().split('T')[0], category: 'other' });
      toast({ title: "Cost Added", description: `${newCost.description} — $${parseFloat(newCost.amount).toFixed(2)}` });
    } catch (error) {
      console.error('Failed to add cost:', error);
      toast({ title: "Error", description: "Could not add cost. Please try again.", variant: "destructive" });
    }
  };

  const handleDeleteCost = async (id) => {
    await MarketplaceCost.delete(id);
    setCosts(prev => prev.filter(c => c.id !== id));
  };

  const handleUpdateCost = async (id, data) => {
    await MarketplaceCost.update(id, data);
    setCosts(prev => prev.map(c => c.id === id ? { ...c, ...data } : c));
  };

  const handleGeckoCategoryChange = (geckoId, cat) => {
    const updated = { ...geckoCategories, [geckoId]: cat };
    setGeckoCategories(updated);
    localStorage.setItem('marketplace_gecko_categories', JSON.stringify(updated));
  };

  const handleAddGeckosFromSelection = async (selectedGeckos) => {
    try {
      // Archive selected geckos as sold
      for (const gecko of selectedGeckos) {
        const price = parseFloat(gecko.asking_price) || 0;
        await Gecko.update(gecko.id, {
          archived: true,
          archive_reason: 'sold',
          archived_date: new Date().toISOString().split('T')[0],
          asking_price: price
        });
      }

      // Refresh sold geckos list
      const allGeckos = await Gecko.filter({ created_by: user.email });
      setSoldGeckos(allGeckos.filter(g => (g.archived && g.archive_reason === 'sold') || g.status === 'Sold'));
    } catch (error) {
      console.error('Failed to add geckos:', error);
    }
  };

  // Manual "Add Sale" — for sales of animals that were never added to
  // the collection (e.g. rehoming a gecko you helped a friend list, or
  // an "Other" category item). Creates a minimal archived Gecko record
  // so the sale flows through the same revenueByQuarter pipeline as
  // from-collection sales.
  const handleAddManualRevenue = async () => {
    if (!newRevenue.name.trim() || !newRevenue.amount) {
      return;
    }
    const price = parseFloat(newRevenue.amount) || 0;
    try {
      const created = await Gecko.create({
        name: newRevenue.name.trim(),
        sex: 'Unsexed',
        status: 'Sold',
        archived: true,
        archive_reason: 'sold',
        archived_date: newRevenue.date || new Date().toISOString().split('T')[0],
        asking_price: price,
        is_public: false,
        is_revenue_entry: true,
        notes: `Manual sale entry (${newRevenue.category})`,
      });

      // Track the category override so revenueByQuarter picks up the
      // right bucket instead of falling back to "General".
      setGeckoCategories((prev) => {
        const updated = { ...prev, [created.id]: newRevenue.category };
        try {
          localStorage.setItem('marketplace_gecko_categories', JSON.stringify(updated));
        } catch (e) {
          console.warn('localStorage write failed:', e);
        }
        return updated;
      });

      setSoldGeckos((prev) => [created, ...prev]);
      setNewRevenue({
        name: '',
        amount: '',
        date: new Date().toISOString().split('T')[0],
        category: 'produced_in_house',
      });
      setSaleMode(null);
    } catch (error) {
      console.error('Failed to add manual sale:', error);
    }
  };

  const costsByQuarter = useMemo(() => {
    const groups = {};
    costs.forEach(cost => {
      const key = getQuarterKey(cost.date || new Date().toISOString());
      if (!groups[key]) groups[key] = [];
      groups[key].push(cost);
    });
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }, [costs]);

  const revenueByQuarter = useMemo(() => {
    const groups = {};
    soldGeckos.forEach(gecko => {
      const dateStr = gecko.archived_date || gecko.updated_date;
      const key = getQuarterKey(dateStr);
      if (!groups[key]) groups[key] = [];
      groups[key].push({ ...gecko, category: geckoCategories[gecko.id] || 'General', amount: getPrice(gecko) });
    });
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }, [soldGeckos, geckoCategories, priceOverrides]);

  const tabTriggerClass = "flex-1 data-[state=active]:bg-emerald-900/70 data-[state=active]:text-emerald-200 data-[state=active]:border data-[state=active]:border-emerald-700/60 data-[state=active]:shadow-none text-slate-400 hover:text-slate-200 hover:bg-slate-800 text-xs md:text-sm px-2 rounded-sm transition-colors";

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-950 p-6 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-600 border-t-emerald-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Hero — matches GeneticsGuide visual pattern */}
      <div className="relative overflow-hidden border-b border-slate-800 bg-gradient-to-br from-slate-950 via-emerald-950/30 to-teal-950/20">
        <div className="absolute inset-0 gecko-scale-pattern opacity-[0.04] pointer-events-none" />
        <div className="relative max-w-5xl mx-auto px-4 md:px-8 py-8 md:py-10">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-b from-white to-emerald-200 bg-clip-text text-transparent tracking-tight">
                  Business Tools
                </h1>
                <p className="text-sm text-slate-400 mt-1">
                  Revenue tracking, cost management, and market intelligence for your breeding operation.
                </p>
              </div>
            </div>
            <PageSettingsPanel title="Sales Stats Settings">
              <div>
                <Label className="text-slate-300 text-sm mb-1 block">Default Tab</Label>
                <div className="flex gap-1">
                  {[['revenue', 'Revenue'], ['costs', 'Costs']].map(([val, lbl]) => (
                    <button
                      key={val}
                      onClick={() => setStatsPrefs({ defaultTab: val })}
                      className={`px-3 py-1 text-xs rounded ${statsPrefs.defaultTab === val ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-400'}`}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-slate-300 text-sm">Expand Quarters</Label>
                <Switch checked={statsPrefs.expandQuarters} onCheckedChange={v => setStatsPrefs({ expandQuarters: v })} />
              </div>
              <div>
                <Label className="text-slate-300 text-sm mb-1 block">Currency</Label>
                <div className="flex gap-1">
                  {['$', '\u20AC', '\u00A3', '\u00A5'].map(c => (
                    <button
                      key={c}
                      onClick={() => setStatsPrefs({ currency: c })}
                      className={`px-3 py-1 text-xs rounded ${statsPrefs.currency === c ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-400'}`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            </PageSettingsPanel>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 md:px-8 py-6 space-y-6">

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Total Revenue', value: `${statsPrefs.currency}${totalRevenue.toFixed(2)}`, sub: `${soldGeckos.length} geckos sold`, color: 'text-emerald-400', Icon: DollarSign },
            { label: 'YTD Revenue', value: `${statsPrefs.currency}${ytdRevenue.toFixed(2)}`, sub: 'Year to date', color: 'text-blue-400', Icon: TrendingUp },
            { label: 'Total Costs', value: `${statsPrefs.currency}${totalCosts.toFixed(2)}`, sub: `${costs.length} entries`, color: 'text-orange-400', Icon: DollarSign },
            { label: 'Net Profit', value: `${statsPrefs.currency}${netProfit.toFixed(2)}`, sub: 'All time', color: netProfit >= 0 ? 'text-emerald-400' : 'text-red-400', Icon: TrendingUp },
          ].map(({ label, value, sub, color, Icon }) => (
            <Card key={label} className="bg-emerald-950/40 border-emerald-900/50">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-xs text-slate-400 flex items-center gap-1.5">
                  <Icon className="w-3.5 h-3.5" />{label}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <p className={`text-xl font-bold ${color}`}>{value}</p>
                <p className="text-xs text-slate-500 mt-0.5">{sub}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="bg-emerald-950/30 border border-emerald-900/40 rounded-xl p-4 md:p-6">
          <Tabs defaultValue={statsPrefs.defaultTab}>
            <TabsList className="flex w-full max-w-md mx-auto bg-slate-950 border border-slate-700 rounded-md p-1.5 gap-1 mb-6">
              <TabsTrigger value="revenue" className={tabTriggerClass}>Revenue</TabsTrigger>
              <TabsTrigger value="costs" className={tabTriggerClass}>Costs</TabsTrigger>
              <TabsTrigger value="analytics" className={tabTriggerClass}>
                <Globe className="w-3.5 h-3.5 mr-1" />
                Market Analytics
              </TabsTrigger>
            </TabsList>

            <TabsContent value="revenue" className="space-y-4">
              <Button onClick={() => setAddSaleModalOpen(true)} className="bg-slate-600 hover:bg-slate-500 text-white h-9">
                <Plus className="w-4 h-4 mr-2" />Add Sale
              </Button>

              {addSaleModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                  <div className="bg-slate-900 border border-slate-700 rounded-xl p-8 max-w-lg w-full">
                    <h2 className="text-2xl font-bold text-slate-100 mb-2">Add Gecko Sale</h2>
                    <p className="text-slate-400 text-sm mb-6">Choose how you'd like to add a sale to your records</p>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <button onClick={() => { setSelectionModalOpen(true); setAddSaleModalOpen(false); setSaleMode('collection'); }}
                        className="bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg p-5 text-center transition-colors flex flex-col justify-center">
                        <p className="font-bold text-slate-100 text-base mb-2">From Collection</p>
                        <p className="text-xs text-slate-400">Select an existing gecko</p>
                      </button>
                      <button onClick={() => { setSelectionModalOpen(true); setAddSaleModalOpen(false); setSaleMode('listings'); }}
                        className="bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg p-5 text-center transition-colors flex flex-col justify-center">
                        <p className="font-bold text-slate-100 text-base mb-2">From Listings</p>
                        <p className="text-xs text-slate-400">Active marketplace listings</p>
                      </button>
                      <button onClick={() => { setSaleMode('manual'); setAddSaleModalOpen(false); }}
                        className="bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg p-5 text-center transition-colors flex flex-col justify-center">
                        <p className="font-bold text-slate-100 text-base mb-2">Manual Entry</p>
                        <p className="text-xs text-slate-400">Enter details directly</p>
                      </button>
                      <button onClick={() => setAddSaleModalOpen(false)}
                        className="bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg p-5 text-center transition-colors flex flex-col justify-center">
                        <p className="font-bold text-slate-100 text-base mb-2">Cancel</p>
                        <p className="text-xs text-slate-400">Close this menu</p>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {selectionModalOpen && saleMode && (
                <GeckoSelectionModal
                  mode={saleMode}
                  onClose={() => { setSelectionModalOpen(false); setSaleMode(null); }}
                  onAddGeckos={handleAddGeckosFromSelection}
                  userEmail={user.email}
                />
              )}

              {saleMode === 'manual' && (
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <h3 className="text-sm font-semibold text-slate-200">Add Gecko Sale</h3>
                    <button onClick={() => setSaleMode(null)} className="text-slate-400 hover:text-slate-200">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-slate-400">Gecko Name</Label>
                      <Input value={newRevenue.name} onChange={e => setNewRevenue(f => ({ ...f, name: e.target.value }))}
                        placeholder="e.g., Flame Morph #1" className="bg-slate-700 border-slate-600 text-slate-100 h-9 text-sm mt-1" />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-400">Sale Price ($)</Label>
                      <Input type="number" step="0.01" value={newRevenue.amount} onChange={e => setNewRevenue(f => ({ ...f, amount: e.target.value }))}
                        placeholder="0.00" className="bg-slate-700 border-slate-600 text-slate-100 h-9 text-sm mt-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-400">Sale Date</Label>
                      <Input type="date" value={newRevenue.date} onChange={e => setNewRevenue(f => ({ ...f, date: e.target.value }))}
                        className="bg-slate-700 border-slate-600 text-slate-100 h-9 text-sm mt-1" />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-400">Category</Label>
                      <select value={newRevenue.category} onChange={e => setNewRevenue(f => ({ ...f, category: e.target.value }))}
                        className="w-full h-9 mt-1 rounded-md bg-slate-700 border border-slate-600 text-slate-100 text-sm px-2">
                        {REVENUE_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="pt-2 flex gap-2">
                    <Button onClick={() => setSaleMode(null)} variant="outline" className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-800">
                      Cancel
                    </Button>
                    <Button
                      onClick={handleAddManualRevenue}
                      disabled={!newRevenue.name.trim() || !newRevenue.amount}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white h-9 disabled:opacity-50"
                    >
                      <Plus className="w-4 h-4 mr-2" />Add Sale
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-slate-100">Sold Geckos by Quarter</h3>
                {Object.keys(priceOverrides).length > 0 && (
                  <Button onClick={handleSaveAllPrices} disabled={isSaving} size="sm" className="gap-1.5 h-8 bg-slate-600 hover:bg-slate-500 text-white">
                    <Save className="w-3.5 h-3.5" />{isSaving ? 'Saving...' : 'Save Prices'}
                  </Button>
                )}
              </div>
              {soldGeckos.length === 0 ? (
                <div className="text-center py-10">
                  <AlertCircle className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                  <p className="text-slate-400">No sold geckos found.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {revenueByQuarter.map(([key, geckos]) => (
                    <QuarterSection key={key} quarterKey={key} items={geckos}
                      renderItem={(gecko) => (
                        <div key={gecko.id} className="bg-slate-800/60 border border-slate-700/50 p-3 rounded-lg">
                          <div className="flex items-center gap-3">
                            <img src={gecko.image_urls?.[0] || 'https://i.imgur.com/sw9gnDp.png'} alt={gecko.name}
                              className="w-9 h-9 rounded object-cover flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-slate-100 text-sm truncate">{gecko.name}</p>
                              <p className="text-xs text-slate-500">{gecko.archived_date ? format(new Date(gecko.archived_date), 'MMM d, yyyy') : '—'}</p>
                            </div>
                            <select value={geckoCategories[gecko.id] || 'other'}
                              onChange={e => handleGeckoCategoryChange(gecko.id, e.target.value)}
                              className="h-7 text-xs rounded bg-slate-700 border border-slate-600 text-slate-300 px-1.5">
                              {COST_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                            </select>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <span className="text-slate-400 text-xs">$</span>
                              <Input type="number" step="0.01"
                                value={priceOverrides[gecko.id] !== undefined ? priceOverrides[gecko.id] : (gecko.asking_price || '')}
                                onChange={e => setPriceOverrides(prev => ({ ...prev, [gecko.id]: e.target.value }))}
                                placeholder="0.00"
                                className="bg-slate-700 border-slate-600 text-slate-100 h-7 text-xs w-20 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                            </div>
                            <p className="text-emerald-400 font-semibold text-sm w-16 text-right">${getPrice(gecko).toFixed(2)}</p>
                          </div>
                        </div>
                      )} />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="costs" className="space-y-5">
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 space-y-3">
                <h3 className="text-sm font-semibold text-slate-200">Add New Cost</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-slate-400">Description</Label>
                    <Input value={newCost.description} onChange={e => setNewCost(f => ({ ...f, description: e.target.value }))}
                      placeholder="e.g., Food, Supplies, Vet Care"
                      className="bg-slate-700 border-slate-600 text-slate-100 h-9 text-sm mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs text-slate-400">Amount ($)</Label>
                    <Input type="number" step="0.01" value={newCost.amount} onChange={e => setNewCost(f => ({ ...f, amount: e.target.value }))}
                      placeholder="0.00"
                      className="bg-slate-700 border-slate-600 text-slate-100 h-9 text-sm mt-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                  </div>
                  <div>
                    <Label className="text-xs text-slate-400">Date</Label>
                    <Input type="date" value={newCost.date} onChange={e => setNewCost(f => ({ ...f, date: e.target.value }))}
                      className="bg-slate-700 border-slate-600 text-slate-100 h-9 text-sm mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs text-slate-400">Category</Label>
                    <select value={newCost.category} onChange={e => setNewCost(f => ({ ...f, category: e.target.value }))}
                      className="w-full h-9 mt-1 rounded-md bg-slate-700 border border-slate-600 text-slate-100 text-sm px-2">
                      {COST_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                  </div>
                </div>
                <div className="pt-2">
                  <Button onClick={handleAddCost} className="bg-slate-600 hover:bg-slate-500 text-white h-9">
                    <Plus className="w-4 h-4 mr-2" />Add Cost
                  </Button>
                </div>
              </div>

              {costs.length === 0 ? (
                <div className="text-center py-10">
                  <AlertCircle className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                  <p className="text-slate-400">No costs tracked yet.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {costsByQuarter.map(([key, quarterCosts]) => (
                    <QuarterSection key={key} quarterKey={key} items={quarterCosts}
                      onDelete={handleDeleteCost} onUpdate={handleUpdateCost}
                      renderItem={(cost) => (
                        <CostRow key={cost.id} cost={cost}
                          onDelete={handleDeleteCost} onUpdate={handleUpdateCost} />
                      )} />
                  ))}
                </div>
              )}

              {costs.length > 0 && (
                <div className="bg-emerald-950/40 border border-emerald-900/40 rounded-xl p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Total Revenue:</span>
                    <span className="text-emerald-400 font-semibold">${totalRevenue.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Total Costs:</span>
                    <span className="text-orange-400 font-semibold">${totalCosts.toFixed(2)}</span>
                  </div>
                  <div className="border-t border-emerald-900/50 pt-2 flex justify-between font-bold">
                    <span className="text-slate-200">Net Profit:</span>
                    <span className={netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}>${netProfit.toFixed(2)}</span>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* Market Analytics — Enterprise tier only */}
            <TabsContent value="analytics" className="space-y-6">
              <MarketAnalyticsTab user={user} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}