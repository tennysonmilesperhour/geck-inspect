import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { Gecko, MarketplaceCost, PendingSale } from '@/entities/all';
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
  DollarSign, TrendingUp, AlertCircle, Trash2, Plus, Save, Loader2,
  ChevronDown, ChevronUp, Tag, Calendar, Edit2, X, Check,
  Globe, Lock, ArrowRight, BarChart3,
  Clock, Weight, Thermometer, Package, CheckCircle2, Archive,
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
// Pending Sales — reserve price system
// ---------------------------------------------------------------------------

function PendingSaleCard({ sale, onUpdate, onComplete, onCancel, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(sale);
  const [savingPayment, setSavingPayment] = useState(null);

  const payments = Array.isArray(form.payment_schedule) ? form.payment_schedule : [];
  const totalScheduled = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
  const totalPaid = payments.filter(p => p.paid).reduce((s, p) => s + Number(p.amount || 0), 0);
  const remaining = Number(form.reserve_price || 0) - totalPaid;
  const allPaid = remaining <= 0 && Number(form.reserve_price) > 0;

  const handleSave = async () => {
    const updated = {
      ...form,
      amount_paid: totalPaid,
      payment_schedule: payments,
    };
    await onUpdate(sale.id, updated);
    setEditing(false);
  };

  const togglePayment = async (idx) => {
    setSavingPayment(idx);
    const updated = [...payments];
    updated[idx] = {
      ...updated[idx],
      paid: !updated[idx].paid,
      paid_date: !updated[idx].paid ? new Date().toISOString().split('T')[0] : null,
    };
    const newPaid = updated.filter(p => p.paid).reduce((s, p) => s + Number(p.amount || 0), 0);
    setForm(f => ({ ...f, payment_schedule: updated, amount_paid: newPaid }));
    await onUpdate(sale.id, { payment_schedule: updated, amount_paid: newPaid });
    setSavingPayment(null);
  };

  const addPayment = () => {
    const updated = [...payments, { amount: '', due_date: '', paid: false, paid_date: null, note: '' }];
    setForm(f => ({ ...f, payment_schedule: updated }));
  };

  const removePayment = (idx) => {
    const updated = payments.filter((_, i) => i !== idx);
    setForm(f => ({ ...f, payment_schedule: updated }));
  };

  const updatePayment = (idx, field, value) => {
    const updated = [...payments];
    updated[idx] = { ...updated[idx], [field]: value };
    setForm(f => ({ ...f, payment_schedule: updated }));
  };

  if (editing) {
    return (
      <div className="bg-slate-800/80 border border-amber-700/40 rounded-xl p-5 space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-bold text-slate-100">Edit Reserve — {form.gecko_name}</h3>
          <button onClick={() => { setForm(sale); setEditing(false); }} className="text-slate-400 hover:text-slate-200"><X className="w-4 h-4" /></button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-slate-400">Gecko Name</Label>
            <Input value={form.gecko_name} onChange={e => setForm(f => ({ ...f, gecko_name: e.target.value }))}
              className="bg-slate-700 border-slate-600 text-slate-100 h-9 text-sm mt-1" />
          </div>
          <div>
            <Label className="text-xs text-slate-400">Buyer Name</Label>
            <Input value={form.buyer_name || ''} onChange={e => setForm(f => ({ ...f, buyer_name: e.target.value }))}
              className="bg-slate-700 border-slate-600 text-slate-100 h-9 text-sm mt-1" />
          </div>
          <div>
            <Label className="text-xs text-slate-400">Reserve Price ($)</Label>
            <Input type="number" step="0.01" value={form.reserve_price} onChange={e => setForm(f => ({ ...f, reserve_price: e.target.value }))}
              className="bg-slate-700 border-slate-600 text-slate-100 h-9 text-sm mt-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
          </div>
          <div>
            <Label className="text-xs text-slate-400">Projected Ship Date</Label>
            <Input type="date" value={form.projected_ship_date || ''} onChange={e => setForm(f => ({ ...f, projected_ship_date: e.target.value }))}
              className="bg-slate-700 border-slate-600 text-slate-100 h-9 text-sm mt-1" />
          </div>
          <div>
            <Label className="text-xs text-slate-400">Target Weight (g)</Label>
            <Input type="number" step="0.1" value={form.target_weight_grams || ''} onChange={e => setForm(f => ({ ...f, target_weight_grams: e.target.value }))}
              placeholder="e.g. 35"
              className="bg-slate-700 border-slate-600 text-slate-100 h-9 text-sm mt-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
          </div>
          <div>
            <Label className="text-xs text-slate-400">Current Weight (g)</Label>
            <Input type="number" step="0.1" value={form.current_weight_grams || ''} onChange={e => setForm(f => ({ ...f, current_weight_grams: e.target.value }))}
              placeholder="e.g. 22"
              className="bg-slate-700 border-slate-600 text-slate-100 h-9 text-sm mt-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
          </div>
          <div>
            <Label className="text-xs text-slate-400">Temp Change From</Label>
            <Input value={form.temp_change_from || ''} onChange={e => setForm(f => ({ ...f, temp_change_from: e.target.value }))}
              placeholder="e.g. 72°F"
              className="bg-slate-700 border-slate-600 text-slate-100 h-9 text-sm mt-1" />
          </div>
          <div>
            <Label className="text-xs text-slate-400">Temp Change To</Label>
            <Input value={form.temp_change_to || ''} onChange={e => setForm(f => ({ ...f, temp_change_to: e.target.value }))}
              placeholder="e.g. 55°F"
              className="bg-slate-700 border-slate-600 text-slate-100 h-9 text-sm mt-1" />
          </div>
        </div>

        <div>
          <Label className="text-xs text-slate-400">Notes</Label>
          <Input value={form.notes || ''} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            className="bg-slate-700 border-slate-600 text-slate-100 h-9 text-sm mt-1" />
        </div>

        {/* Payment schedule editor */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-slate-300 font-semibold">Payment Schedule</Label>
            <Button size="sm" variant="ghost" onClick={addPayment} className="h-7 text-xs text-emerald-400 hover:text-emerald-300">
              <Plus className="w-3 h-3 mr-1" />Add Payment
            </Button>
          </div>
          {payments.map((p, idx) => (
            <div key={idx} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
              <div>
                <Input type="number" step="0.01" placeholder="Amount" value={p.amount}
                  onChange={e => updatePayment(idx, 'amount', e.target.value)}
                  className="bg-slate-700 border-slate-600 text-slate-100 h-8 text-xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
              </div>
              <div>
                <Input type="date" value={p.due_date || ''} onChange={e => updatePayment(idx, 'due_date', e.target.value)}
                  className="bg-slate-700 border-slate-600 text-slate-100 h-8 text-xs" />
              </div>
              <Button size="icon" variant="ghost" onClick={() => removePayment(idx)} className="h-8 w-8 text-red-400 hover:bg-red-900/20">
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          ))}
        </div>

        <div className="flex gap-2 justify-end pt-2">
          <Button variant="outline" onClick={() => { setForm(sale); setEditing(false); }} className="border-slate-600 text-slate-300 hover:bg-slate-800">Cancel</Button>
          <Button onClick={handleSave} className="bg-emerald-600 hover:bg-emerald-500 text-white"><Save className="w-3.5 h-3.5 mr-1.5" />Save</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-800/60 border border-amber-800/30 rounded-xl overflow-hidden">
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-slate-100 text-sm truncate">{sale.gecko_name}</h3>
              {allPaid && <Badge className="bg-emerald-900/50 text-emerald-300 border-emerald-700/40 text-[10px]">Fully Paid</Badge>}
            </div>
            {sale.buyer_name && <p className="text-xs text-slate-400 mt-0.5">Buyer: {sale.buyer_name}</p>}
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-lg font-bold text-amber-400">${Number(sale.reserve_price).toFixed(2)}</p>
            <p className="text-[10px] text-slate-500">reserve price</p>
          </div>
        </div>

        {/* Progress bar */}
        {Number(sale.reserve_price) > 0 && (
          <div className="mt-3">
            <div className="flex justify-between text-[10px] text-slate-400 mb-1">
              <span>${totalPaid.toFixed(2)} paid</span>
              <span>${remaining > 0 ? remaining.toFixed(2) : '0.00'} remaining</span>
            </div>
            <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${allPaid ? 'bg-emerald-500' : 'bg-amber-500'}`}
                style={{ width: `${Math.min(100, (totalPaid / Number(sale.reserve_price)) * 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Requirement chips */}
        <div className="flex flex-wrap gap-2 mt-3">
          {payments.length > 0 && (
            <div className="flex items-center gap-1 text-[10px] rounded-full px-2 py-0.5 bg-slate-700/50 border border-slate-600/50">
              <DollarSign className="w-3 h-3 text-amber-400" />
              <span className="text-slate-300">{payments.filter(p => p.paid).length}/{payments.length} payments</span>
            </div>
          )}
          {sale.target_weight_grams && (
            <div className="flex items-center gap-1 text-[10px] rounded-full px-2 py-0.5 bg-slate-700/50 border border-slate-600/50">
              <Weight className="w-3 h-3 text-blue-400" />
              <span className="text-slate-300">
                {sale.current_weight_grams ? `${sale.current_weight_grams}g / ` : ''}{sale.target_weight_grams}g
              </span>
            </div>
          )}
          {(sale.temp_change_from || sale.temp_change_to) && (
            <div className="flex items-center gap-1 text-[10px] rounded-full px-2 py-0.5 bg-slate-700/50 border border-slate-600/50">
              <Thermometer className="w-3 h-3 text-orange-400" />
              <span className="text-slate-300">{sale.temp_change_from || '?'} → {sale.temp_change_to || '?'}</span>
            </div>
          )}
          {sale.projected_ship_date && (
            <div className="flex items-center gap-1 text-[10px] rounded-full px-2 py-0.5 bg-slate-700/50 border border-slate-600/50">
              <Package className="w-3 h-3 text-purple-400" />
              <span className="text-slate-300">Ship: {format(new Date(sale.projected_ship_date), 'MMM d, yyyy')}</span>
            </div>
          )}
        </div>

        {/* Payment schedule detail */}
        {payments.length > 0 && (
          <div className="mt-3 space-y-1.5">
            {payments.map((p, idx) => (
              <div key={idx} className="flex items-center gap-2 text-xs">
                <button
                  onClick={() => togglePayment(idx)}
                  disabled={savingPayment === idx}
                  className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                    p.paid
                      ? 'bg-emerald-600 border-emerald-500 text-white'
                      : 'bg-slate-700 border-slate-600 text-transparent hover:border-emerald-500'
                  }`}
                >
                  {savingPayment === idx ? <Loader2 className="w-3 h-3 animate-spin text-slate-400" /> : <Check className="w-3 h-3" />}
                </button>
                <span className={`flex-1 ${p.paid ? 'text-slate-500 line-through' : 'text-slate-200'}`}>
                  ${Number(p.amount).toFixed(2)}
                  {p.due_date && <span className="text-slate-500 ml-1.5">due {format(new Date(p.due_date), 'MMM d')}</span>}
                </span>
                {p.paid && p.paid_date && <span className="text-emerald-500/70 text-[10px]">Paid {format(new Date(p.paid_date), 'MMM d')}</span>}
              </div>
            ))}
          </div>
        )}

        {sale.notes && <p className="text-xs text-slate-500 mt-2 italic">{sale.notes}</p>}
      </div>

      {/* Actions */}
      <div className="border-t border-slate-700/50 px-4 py-2.5 flex items-center gap-2 bg-slate-900/30">
        <Button size="sm" variant="ghost" onClick={() => setEditing(true)} className="h-7 text-xs text-slate-300 hover:text-white hover:bg-slate-700">
          <Edit2 className="w-3 h-3 mr-1" />Edit
        </Button>
        <Button size="sm" variant="ghost" onClick={() => onComplete(sale)}
          className="h-7 text-xs text-emerald-400 hover:text-emerald-300 hover:bg-emerald-900/30">
          <CheckCircle2 className="w-3 h-3 mr-1" />Complete Sale
        </Button>
        <Button size="sm" variant="ghost" onClick={() => onCancel(sale)}
          className="h-7 text-xs text-amber-400 hover:text-amber-300 hover:bg-amber-900/20">
          <X className="w-3 h-3 mr-1" />Cancel
        </Button>
        <div className="flex-1" />
        <Button size="icon" variant="ghost" onClick={() => onDelete(sale.id)}
          className="h-7 w-7 text-red-500 hover:bg-red-900/20">
          <Trash2 className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
}

function PendingSalesTab({ user, pendingSales, setPendingSales, onCompleteSale, allGeckos }) {
  const [creating, setCreating] = useState(false);
  const [geckoPickerOpen, setGeckoPickerOpen] = useState(false);
  const [newSale, setNewSale] = useState({
    gecko_name: '', buyer_name: '', reserve_price: '',
    projected_ship_date: '', target_weight_grams: '', current_weight_grams: '',
    temp_change_from: '', temp_change_to: '', notes: '',
    payment_schedule: [],
    // Toggle flags for which optional sections to show
    _usePayments: false, _useWeight: false, _useTemp: false, _useShipDate: false,
  });

  const resetForm = () => {
    setNewSale({
      gecko_name: '', buyer_name: '', reserve_price: '',
      projected_ship_date: '', target_weight_grams: '', current_weight_grams: '',
      temp_change_from: '', temp_change_to: '', notes: '',
      payment_schedule: [],
      _usePayments: false, _useWeight: false, _useTemp: false, _useShipDate: false,
    });
    setCreating(false);
  };

  const handleCreate = async () => {
    if (!newSale.gecko_name.trim() || !newSale.reserve_price) return;
    try {
      const record = {
        user_email: user.email,
        gecko_name: newSale.gecko_name.trim(),
        buyer_name: newSale.buyer_name.trim() || null,
        reserve_price: parseFloat(newSale.reserve_price) || 0,
        amount_paid: 0,
        payment_schedule: newSale._usePayments ? newSale.payment_schedule : [],
        target_weight_grams: newSale._useWeight && newSale.target_weight_grams ? parseFloat(newSale.target_weight_grams) : null,
        current_weight_grams: newSale._useWeight && newSale.current_weight_grams ? parseFloat(newSale.current_weight_grams) : null,
        temp_change_from: newSale._useTemp ? newSale.temp_change_from || null : null,
        temp_change_to: newSale._useTemp ? newSale.temp_change_to || null : null,
        projected_ship_date: newSale._useShipDate ? newSale.projected_ship_date || null : null,
        notes: newSale.notes || null,
        gecko_id: newSale.gecko_id || null,
        status: 'pending',
      };
      const created = await PendingSale.create(record);
      setPendingSales(prev => [created, ...prev]);
      toast({ title: 'Reserve created', description: `${record.gecko_name} — $${record.reserve_price.toFixed(2)}` });
      resetForm();
    } catch (err) {
      console.error('Failed to create pending sale:', err);
      toast({ title: 'Error', description: err.message || 'Could not create reserve.', variant: 'destructive' });
    }
  };

  const handleUpdate = async (id, data) => {
    try {
      const cleaned = { ...data };
      delete cleaned._usePayments; delete cleaned._useWeight; delete cleaned._useTemp; delete cleaned._useShipDate;
      delete cleaned.id; delete cleaned.created_by; delete cleaned.created_date;
      await PendingSale.update(id, cleaned);
      setPendingSales(prev => prev.map(s => s.id === id ? { ...s, ...cleaned } : s));
    } catch (err) {
      toast({ title: 'Update failed', description: err.message, variant: 'destructive' });
    }
  };

  const handleComplete = async (sale) => {
    if (!confirm(`Complete sale for "${sale.gecko_name}"? This will move it to revenue and archive the gecko.`)) return;
    try {
      await PendingSale.update(sale.id, { status: 'completed', completed_date: new Date().toISOString() });
      if (sale.gecko_id) {
        try {
          await Gecko.update(sale.gecko_id, {
            status: 'Sold', archived: true, archive_reason: 'sold',
            archived_date: new Date().toISOString().split('T')[0],
            asking_price: parseFloat(sale.reserve_price) || 0,
          });
        } catch (e) { console.warn('Could not archive gecko:', e); }
      }
      const created = await MarketplaceCost.create({
        user_email: user.email,
        description: sale.gecko_name,
        amount: parseFloat(sale.reserve_price) || 0,
        date: new Date().toISOString().split('T')[0],
        category: 'sale:produced_in_house',
      });
      setPendingSales(prev => prev.filter(s => s.id !== sale.id));
      if (onCompleteSale) onCompleteSale(sale, created);
      toast({ title: 'Sale completed', description: `${sale.gecko_name} added to revenue.` });
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleCancel = async (sale) => {
    if (!confirm(`Cancel reserve for "${sale.gecko_name}"? The gecko will remain in your collection.`)) return;
    try {
      await PendingSale.update(sale.id, { status: 'cancelled' });
      setPendingSales(prev => prev.filter(s => s.id !== sale.id));
      toast({ title: 'Reserve cancelled' });
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Permanently delete this pending sale record?')) return;
    try {
      await PendingSale.delete(id);
      setPendingSales(prev => prev.filter(s => s.id !== id));
      toast({ title: 'Deleted' });
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const selectGeckoForSale = (gecko) => {
    setNewSale(f => ({
      ...f,
      gecko_name: gecko.name,
      gecko_id: gecko.id,
      reserve_price: gecko.asking_price || '',
      current_weight_grams: gecko.weight || '',
    }));
    setGeckoPickerOpen(false);
  };

  const addPaymentToNew = () => {
    setNewSale(f => ({
      ...f,
      payment_schedule: [...f.payment_schedule, { amount: '', due_date: '', paid: false, paid_date: null, note: '' }],
    }));
  };

  const updateNewPayment = (idx, field, value) => {
    setNewSale(f => {
      const updated = [...f.payment_schedule];
      updated[idx] = { ...updated[idx], [field]: value };
      return { ...f, payment_schedule: updated };
    });
  };

  const removeNewPayment = (idx) => {
    setNewSale(f => ({ ...f, payment_schedule: f.payment_schedule.filter((_, i) => i !== idx) }));
  };

  const availableGeckos = (allGeckos || []).filter(g => !g.archived && g.status !== 'Sold');

  return (
    <div className="space-y-4">
      <Button onClick={() => setCreating(true)} className="bg-amber-600 hover:bg-amber-500 text-white h-9">
        <Plus className="w-4 h-4 mr-2" />New Reserve
      </Button>

      {creating && (
        <div className="bg-slate-800/50 border border-amber-700/40 rounded-xl p-5 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-slate-100">Create Reserve / Pending Sale</h3>
            <button onClick={resetForm} className="text-slate-400 hover:text-slate-200"><X className="w-4 h-4" /></button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-slate-400">Gecko Name</Label>
              <div className="flex gap-1.5 mt-1">
                <Input value={newSale.gecko_name} onChange={e => setNewSale(f => ({ ...f, gecko_name: e.target.value }))}
                  placeholder="Name or select from collection"
                  className="bg-slate-700 border-slate-600 text-slate-100 h-9 text-sm flex-1" />
                <Button size="sm" variant="outline" onClick={() => setGeckoPickerOpen(!geckoPickerOpen)}
                  className="h-9 border-slate-600 text-slate-300 hover:bg-slate-700 text-xs px-2 shrink-0">
                  Pick
                </Button>
              </div>
              {geckoPickerOpen && (
                <div className="mt-1.5 bg-slate-700 border border-slate-600 rounded-lg max-h-40 overflow-y-auto">
                  {availableGeckos.length === 0 ? (
                    <p className="text-xs text-slate-400 p-2">No geckos available</p>
                  ) : availableGeckos.map(g => (
                    <button key={g.id} onClick={() => selectGeckoForSale(g)}
                      className="w-full text-left px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-600 flex items-center gap-2">
                      {g.image_urls?.[0] && <img src={g.image_urls[0]} className="w-5 h-5 rounded object-cover" />}
                      <span className="truncate">{g.name}</span>
                      {g.asking_price && <span className="text-emerald-400 ml-auto">${g.asking_price}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <Label className="text-xs text-slate-400">Buyer Name</Label>
              <Input value={newSale.buyer_name} onChange={e => setNewSale(f => ({ ...f, buyer_name: e.target.value }))}
                placeholder="Optional" className="bg-slate-700 border-slate-600 text-slate-100 h-9 text-sm mt-1" />
            </div>
            <div>
              <Label className="text-xs text-slate-400">Reserve Price ($)</Label>
              <Input type="number" step="0.01" value={newSale.reserve_price} onChange={e => setNewSale(f => ({ ...f, reserve_price: e.target.value }))}
                placeholder="0.00"
                className="bg-slate-700 border-slate-600 text-slate-100 h-9 text-sm mt-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
            </div>
            <div>
              <Label className="text-xs text-slate-400">Notes</Label>
              <Input value={newSale.notes} onChange={e => setNewSale(f => ({ ...f, notes: e.target.value }))}
                placeholder="Optional" className="bg-slate-700 border-slate-600 text-slate-100 h-9 text-sm mt-1" />
            </div>
          </div>

          {/* Optional section toggles */}
          <div className="space-y-2">
            <Label className="text-xs text-slate-300 font-semibold">Include (toggle as relevant)</Label>
            <div className="flex flex-wrap gap-2">
              {[
                { key: '_usePayments', label: 'Payment Schedule', icon: DollarSign, active: 'bg-amber-900/40 border-amber-600/50 text-amber-300' },
                { key: '_useWeight', label: 'Weight Requirement', icon: Weight, active: 'bg-blue-900/40 border-blue-600/50 text-blue-300' },
                { key: '_useTemp', label: 'Temperature Change', icon: Thermometer, active: 'bg-orange-900/40 border-orange-600/50 text-orange-300' },
                { key: '_useShipDate', label: 'Projected Ship Date', icon: Package, active: 'bg-purple-900/40 border-purple-600/50 text-purple-300' },
              ].map(({ key, label, icon: Icon, active }) => (
                <button key={key} onClick={() => setNewSale(f => ({ ...f, [key]: !f[key] }))}
                  className={`flex items-center gap-1.5 text-xs rounded-full px-3 py-1.5 border transition-colors ${
                    newSale[key]
                      ? active
                      : 'bg-slate-800 border-slate-600 text-slate-400 hover:text-slate-200'
                  }`}>
                  <Icon className="w-3 h-3" />{label}
                </button>
              ))}
            </div>
          </div>

          {/* Conditional sections */}
          {newSale._usePayments && (
            <div className="space-y-2 bg-slate-900/50 rounded-lg p-3 border border-slate-700/50">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-amber-400 font-semibold flex items-center gap-1"><DollarSign className="w-3 h-3" />Payment Schedule</Label>
                <Button size="sm" variant="ghost" onClick={addPaymentToNew} className="h-6 text-[10px] text-emerald-400"><Plus className="w-3 h-3 mr-1" />Add</Button>
              </div>
              {newSale.payment_schedule.map((p, idx) => (
                <div key={idx} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                  <Input type="number" step="0.01" placeholder="Amount" value={p.amount}
                    onChange={e => updateNewPayment(idx, 'amount', e.target.value)}
                    className="bg-slate-700 border-slate-600 text-slate-100 h-8 text-xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                  <Input type="date" value={p.due_date || ''} onChange={e => updateNewPayment(idx, 'due_date', e.target.value)}
                    className="bg-slate-700 border-slate-600 text-slate-100 h-8 text-xs" />
                  <Button size="icon" variant="ghost" onClick={() => removeNewPayment(idx)} className="h-8 w-8 text-red-400 hover:bg-red-900/20">
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ))}
              {newSale.payment_schedule.length === 0 && <p className="text-[10px] text-slate-500">Click "Add" to schedule payments</p>}
            </div>
          )}

          {newSale._useWeight && (
            <div className="grid grid-cols-2 gap-3 bg-slate-900/50 rounded-lg p-3 border border-slate-700/50">
              <div>
                <Label className="text-xs text-blue-400 flex items-center gap-1"><Weight className="w-3 h-3" />Target Weight (g)</Label>
                <Input type="number" step="0.1" value={newSale.target_weight_grams} onChange={e => setNewSale(f => ({ ...f, target_weight_grams: e.target.value }))}
                  placeholder="e.g. 35"
                  className="bg-slate-700 border-slate-600 text-slate-100 h-8 text-xs mt-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
              </div>
              <div>
                <Label className="text-xs text-blue-400 flex items-center gap-1"><Weight className="w-3 h-3" />Current Weight (g)</Label>
                <Input type="number" step="0.1" value={newSale.current_weight_grams} onChange={e => setNewSale(f => ({ ...f, current_weight_grams: e.target.value }))}
                  placeholder="e.g. 22"
                  className="bg-slate-700 border-slate-600 text-slate-100 h-8 text-xs mt-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
              </div>
            </div>
          )}

          {newSale._useTemp && (
            <div className="grid grid-cols-2 gap-3 bg-slate-900/50 rounded-lg p-3 border border-slate-700/50">
              <div>
                <Label className="text-xs text-orange-400 flex items-center gap-1"><Thermometer className="w-3 h-3" />Temp From</Label>
                <Input value={newSale.temp_change_from} onChange={e => setNewSale(f => ({ ...f, temp_change_from: e.target.value }))}
                  placeholder="e.g. 72°F"
                  className="bg-slate-700 border-slate-600 text-slate-100 h-8 text-xs mt-1" />
              </div>
              <div>
                <Label className="text-xs text-orange-400 flex items-center gap-1"><Thermometer className="w-3 h-3" />Temp To</Label>
                <Input value={newSale.temp_change_to} onChange={e => setNewSale(f => ({ ...f, temp_change_to: e.target.value }))}
                  placeholder="e.g. 55°F"
                  className="bg-slate-700 border-slate-600 text-slate-100 h-8 text-xs mt-1" />
              </div>
            </div>
          )}

          {newSale._useShipDate && (
            <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50">
              <Label className="text-xs text-purple-400 flex items-center gap-1"><Package className="w-3 h-3" />Projected Ship Date</Label>
              <Input type="date" value={newSale.projected_ship_date} onChange={e => setNewSale(f => ({ ...f, projected_ship_date: e.target.value }))}
                className="bg-slate-700 border-slate-600 text-slate-100 h-8 text-xs mt-1 max-w-xs" />
            </div>
          )}

          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={resetForm} className="border-slate-600 text-slate-300 hover:bg-slate-800">Cancel</Button>
            <Button onClick={handleCreate} disabled={!newSale.gecko_name.trim() || !newSale.reserve_price}
              className="bg-amber-600 hover:bg-amber-500 text-white disabled:opacity-50">
              <Plus className="w-4 h-4 mr-1.5" />Create Reserve
            </Button>
          </div>
        </div>
      )}

      {/* Pending sales list */}
      {pendingSales.length === 0 && !creating ? (
        <div className="text-center py-10">
          <Clock className="w-8 h-8 text-slate-500 mx-auto mb-2" />
          <p className="text-slate-400">No pending sales.</p>
          <p className="text-xs text-slate-500 mt-1">Create a reserve when a buyer pays a deposit or commits to a purchase.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pendingSales.map(sale => (
            <PendingSaleCard
              key={sale.id}
              sale={sale}
              onUpdate={handleUpdate}
              onComplete={handleComplete}
              onCancel={handleCancel}
              onDelete={handleDelete}
            />
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

  const activeMorphStats = morphStats.find(m => m.name === selectedMorph) || morphStats[0];

  const handleMorphChange = (morph) => {
    setSelectedMorph(morph);
    setPriceHistory(generatePriceHistory(morph));
  };

  return (
    <div className="space-y-6">
      {/* Enterprise upsell banner — shown for non-enterprise users */}
      {!hasAccess && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/20 p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
            <Lock className="w-6 h-6 text-emerald-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-bold text-white">Enterprise Feature Preview</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              You're viewing Market Analytics with sample data. Upgrade to Enterprise for live market feeds updated in real time.
            </p>
          </div>
          <Link to={createPageUrl('Membership')}>
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shrink-0">
              View plans <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
            </Button>
          </Link>
        </div>
      )}

      {/* Demo data banner */}
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
  const [userGeckos, setUserGeckos] = useState([]);
  const [manualSales, setManualSales] = useState([]);
  const [priceOverrides, setPriceOverrides] = useState({});
  const [costs, setCosts] = useState([]);
  const [pendingSales, setPendingSales] = useState([]);
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
        setUserGeckos(allGeckos);
        // Only real sold geckos — exclude fake records created by old manual-sale flow
        setSoldGeckos(allGeckos.filter(g =>
          ((g.archived && g.archive_reason === 'sold') || g.status === 'Sold') &&
          !g.notes?.startsWith('[Manual sale]')
        ));

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

        // Separate manual sales (category prefixed with 'sale:') from expense costs
        setManualSales(dbCosts.filter(c => c.category?.startsWith('sale:')));
        setCosts(dbCosts.filter(c => !c.category?.startsWith('sale:')));

        // Load pending sales
        try {
          const ps = await PendingSale.filter({ user_email: currentUser.email, status: 'pending' }, '-created_date');
          setPendingSales(ps);
        } catch (e) { console.error('Failed to load pending sales:', e); }
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

  const manualSalesTotal = manualSales.reduce((sum, s) => sum + Number(s.amount), 0);
  const totalRevenue = soldGeckos.reduce((sum, g) => sum + getPrice(g), 0) + manualSalesTotal;
  const totalCosts = costs.reduce((sum, c) => sum + Number(c.amount), 0);
  const netProfit = totalRevenue - totalCosts;
  const currentYear = new Date().getFullYear();
  const ytdRevenue = soldGeckos.reduce((sum, g) => {
    const yr = g.archived_date ? new Date(g.archived_date).getFullYear() : new Date(g.updated_date).getFullYear();
    return yr === currentYear ? sum + getPrice(g) : sum;
  }, 0) + manualSales.reduce((sum, s) => {
    return s.date && new Date(s.date).getFullYear() === currentYear ? sum + Number(s.amount) : sum;
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

      // Refresh geckos lists
      const allGeckos = await Gecko.filter({ created_by: user.email });
      setUserGeckos(allGeckos);
      setSoldGeckos(allGeckos.filter(g => (g.archived && g.archive_reason === 'sold') || g.status === 'Sold'));
    } catch (error) {
      console.error('Failed to add geckos:', error);
    }
  };

  // Manual "Add Sale" — for sales of animals that were never added to
  // the collection (e.g. rehoming a gecko you helped a friend list, or
  // an "Other" category item). Stored as a MarketplaceCost record with
  // type='sale' so it doesn't pollute the gecko collection / archive.
  const [isAddingSale, setIsAddingSale] = useState(false);
  const handleAddManualRevenue = async () => {
    if (!newRevenue.name.trim() || !newRevenue.amount || isAddingSale) {
      return;
    }
    const price = parseFloat(newRevenue.amount) || 0;
    setIsAddingSale(true);
    try {
      const created = await MarketplaceCost.create({
        user_email: user.email,
        description: newRevenue.name.trim(),
        amount: price,
        date: newRevenue.date || new Date().toISOString().split('T')[0],
        category: 'sale:' + (newRevenue.category || 'produced_in_house'),
      });

      setManualSales((prev) => [created, ...prev]);
      toast({ title: "Sale Added", description: `${newRevenue.name.trim()} — $${price.toFixed(2)}` });
      setNewRevenue({
        name: '',
        amount: '',
        date: new Date().toISOString().split('T')[0],
        category: 'produced_in_house',
      });
      setSaleMode(null);
    } catch (error) {
      console.error('Failed to add manual sale:', error);
      const msg = error?.message || error?.details || JSON.stringify(error);
      toast({ title: "Error", description: `Could not add sale: ${msg}`, variant: "destructive" });
    } finally {
      setIsAddingSale(false);
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
    // Merge manual sales into the same quarter groups
    manualSales.forEach(sale => {
      const key = getQuarterKey(sale.date);
      if (!groups[key]) groups[key] = [];
      groups[key].push({
        id: sale.id,
        name: sale.description,
        archived_date: sale.date,
        asking_price: sale.amount,
        category: (sale.category || '').replace(/^sale:/, '') || 'General',
        amount: Number(sale.amount),
        isManualSale: true,
      });
    });
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }, [soldGeckos, geckoCategories, priceOverrides, manualSales]);

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
                  {[['revenue', 'Revenue'], ['pending', 'Pending'], ['costs', 'Costs']].map(([val, lbl]) => (
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

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            { label: 'Total Revenue', value: `${statsPrefs.currency}${totalRevenue.toFixed(2)}`, sub: `${soldGeckos.length} sold${manualSales.length ? ` + ${manualSales.length} manual` : ''}`, color: 'text-emerald-400', Icon: DollarSign },
            { label: 'Pending', value: `${statsPrefs.currency}${pendingSales.reduce((s, p) => s + Number(p.reserve_price || 0), 0).toFixed(2)}`, sub: `${pendingSales.length} reserve${pendingSales.length !== 1 ? 's' : ''}`, color: 'text-amber-400', Icon: Clock },
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
            <TabsList className="flex w-full max-w-xl mx-auto bg-slate-950 border border-slate-700 rounded-md p-1.5 gap-1 mb-6">
              <TabsTrigger value="revenue" className={tabTriggerClass}>Revenue</TabsTrigger>
              <TabsTrigger value="pending" className={tabTriggerClass}>
                <Clock className="w-3.5 h-3.5 mr-1" />
                Pending{pendingSales.length > 0 && ` (${pendingSales.length})`}
              </TabsTrigger>
              <TabsTrigger value="costs" className={tabTriggerClass}>Costs</TabsTrigger>
              <TabsTrigger value="analytics" className={tabTriggerClass}>
                <Globe className="w-3.5 h-3.5 mr-1" />
                Market Analytics
              </TabsTrigger>
            </TabsList>

            <TabsContent value="revenue" className="space-y-4">
              <Button onClick={() => setAddSaleModalOpen(true)} className="bg-emerald-600 hover:bg-emerald-500 text-white h-9">
                <Plus className="w-4 h-4 mr-2" />Add Sale
              </Button>

              {addSaleModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4"
                     onClick={(e) => { if (e.target === e.currentTarget) setAddSaleModalOpen(false); }}>
                  <div className="bg-slate-900 border border-slate-700 rounded-xl p-8 max-w-lg w-full"
                       onClick={(e) => e.stopPropagation()}>
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
                      disabled={!newRevenue.name.trim() || !newRevenue.amount || isAddingSale}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white h-9 disabled:opacity-50"
                    >
                      {isAddingSale ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                      {isAddingSale ? 'Adding...' : 'Add Sale'}
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-slate-100">Sold Geckos by Quarter</h3>
                {Object.keys(priceOverrides).length > 0 && (
                  <Button onClick={handleSaveAllPrices} disabled={isSaving} size="sm" className="gap-1.5 h-8 bg-emerald-600 hover:bg-emerald-500 text-white">
                    <Save className="w-3.5 h-3.5" />{isSaving ? 'Saving...' : 'Save Prices'}
                  </Button>
                )}
              </div>
              {soldGeckos.length === 0 && manualSales.length === 0 ? (
                <div className="text-center py-10">
                  <AlertCircle className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                  <p className="text-slate-400">No sold geckos found.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {revenueByQuarter.map(([key, geckos]) => (
                    <QuarterSection key={key} quarterKey={key} items={geckos}
                      renderItem={(item) => (
                        <div key={item.id} className="bg-slate-800/60 border border-slate-700/50 p-3 rounded-lg">
                          <div className="flex items-center gap-3">
                            {item.isManualSale ? (
                              <div className="w-9 h-9 rounded bg-emerald-900/40 border border-emerald-700/30 flex items-center justify-center flex-shrink-0">
                                <DollarSign className="w-4 h-4 text-emerald-400" />
                              </div>
                            ) : (
                              <img src={item.image_urls?.[0] || 'https://i.imgur.com/sw9gnDp.png'} alt={item.name}
                                className="w-9 h-9 rounded object-cover flex-shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-slate-100 text-sm truncate">{item.name}</p>
                              <p className="text-xs text-slate-500">
                                {item.archived_date ? format(new Date(item.archived_date), 'MMM d, yyyy') : '—'}
                                {item.isManualSale && <span className="ml-1 text-emerald-500/70">(manual)</span>}
                              </p>
                            </div>
                            {!item.isManualSale && (
                              <select value={geckoCategories[item.id] || 'other'}
                                onChange={e => handleGeckoCategoryChange(item.id, e.target.value)}
                                className="h-7 text-xs rounded bg-slate-700 border border-slate-600 text-slate-300 px-1.5">
                                {COST_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                              </select>
                            )}
                            {item.isManualSale ? (
                              <span className="text-xs text-slate-400 px-1.5">{_getRevenueCategory(item.category)}</span>
                            ) : (
                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                <span className="text-slate-400 text-xs">$</span>
                                <Input type="number" step="0.01"
                                  value={priceOverrides[item.id] !== undefined ? priceOverrides[item.id] : (item.asking_price || '')}
                                  onChange={e => setPriceOverrides(prev => ({ ...prev, [item.id]: e.target.value }))}
                                  placeholder="0.00"
                                  className="bg-slate-700 border-slate-600 text-slate-100 h-7 text-xs w-20 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                              </div>
                            )}
                            <p className="text-emerald-400 font-semibold text-sm w-16 text-right">${(item.amount || 0).toFixed(2)}</p>
                          </div>
                        </div>
                      )} />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="pending" className="space-y-4">
              <PendingSalesTab
                user={user}
                pendingSales={pendingSales}
                setPendingSales={setPendingSales}
                allGeckos={userGeckos}
                onCompleteSale={(sale, costRecord) => {
                  setManualSales(prev => [costRecord, ...prev]);
                  if (sale.gecko_id) {
                    setSoldGeckos(prev => [...prev, {
                      id: sale.gecko_id,
                      name: sale.gecko_name,
                      asking_price: sale.reserve_price,
                      archived: true,
                      archive_reason: 'sold',
                      archived_date: new Date().toISOString().split('T')[0],
                    }]);
                  }
                }}
              />
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
                  <Button onClick={handleAddCost} className="bg-emerald-600 hover:bg-emerald-500 text-white h-9">
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