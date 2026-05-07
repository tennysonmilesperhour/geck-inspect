import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Loader2,
  Save,
  Power,
  PowerOff,
  AlertTriangle,
  Package,
  ExternalLink,
  Filter,
  RefreshCw,
} from 'lucide-react';
import { formatCents } from '@/lib/store/format';

/**
 * Store admin — minimum-viable controls for the supplies tab.
 *
 * Controls:
 *   1. Master kill-switch (store_enabled) and a few key tunables
 *      pulled from app_settings.
 *   2. Product list with filter by status + fulfillment mode, plus
 *      one-click activate / archive / set-featured. Inline price + cost
 *      editing for the rows that need quick tweaks.
 *
 * Categories, vendors, and full product field edits are intentionally
 * deferred — admins can use the Supabase dashboard for those today and
 * we can add proper editors when the volume justifies them.
 */

const FULFILLMENT_LABELS = {
  direct_self: 'In-house',
  direct_pod: 'Print-on-demand',
  dropship_wholesale: 'Wholesale dropship',
  affiliate_redirect: 'Affiliate',
};

const STATUS_LABELS = { draft: 'Draft', active: 'Active', archived: 'Archived' };

function StatusBadge({ status }) {
  const tone =
    status === 'active'
      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-700/40'
      : status === 'draft'
      ? 'bg-amber-500/10 text-amber-300 border-amber-700/40'
      : 'bg-slate-700/40 text-slate-400 border-slate-700';
  return (
    <span className={`text-[10px] font-bold uppercase tracking-wider rounded border px-1.5 py-0.5 ${tone}`}>
      {STATUS_LABELS[status] || status}
    </span>
  );
}

function SettingsCard({ settings, onChange, onSave, saving }) {
  const knobs = [
    { key: 'store_enabled',                          label: 'Store enabled',                        type: 'bool',   help: 'Master kill-switch. When off, the Supplies tab and recommended-kit aside both hide.' },
    { key: 'store_free_shipping_threshold_cents',    label: 'Free shipping over (cents)',            type: 'cents',  help: 'Subtotal at which we waive the flat shipping fee. 5000 = $50.' },
    { key: 'store_signup_grant_min_order_cents',     label: 'Guest grant min order (cents)',        type: 'cents',  help: 'Minimum subtotal that earns a guest checkout the free Keeper trial.' },
    { key: 'store_signup_grant_duration_days',       label: 'Guest grant duration (days)',          type: 'int',    help: 'Length of the Keeper trial granted via the email-receipt link.' },
    { key: 'store_loyalty_cgd_min_cart_cents',       label: 'Loyalty perk min cart (cents)',        type: 'cents',  help: 'Cart subtotal that qualifies a paid subscriber for the free CGD sample.' },
    { key: 'store_loyalty_cgd_min_tenure_days',      label: 'Loyalty perk min tenure (days)',       type: 'int',    help: 'How long the user must have been a paid subscriber before the perk kicks in.' },
    { key: 'store_loyalty_samples_enabled',          label: 'Loyalty CGD samples enabled',          type: 'bool',   help: 'Off until wholesale Pangea inventory is in place; the cart still shows the perk preview when subscribers qualify.' },
    { key: 'store_affiliate_max_share_per_category_pct', label: 'Affiliate share cap per category (%)', type: 'int', help: 'Soft cap to keep the storefront from feeling like an affiliate farm.' },
  ];

  return (
    <Card className="bg-slate-900/50 border-slate-800">
      <CardHeader>
        <CardTitle className="text-white text-base flex items-center gap-2">
          <Power className="w-4 h-4 text-emerald-400" /> Store settings
        </CardTitle>
        <p className="text-sm text-slate-400 mt-1">
          Knobs persisted in app_settings. Changes apply on save.
        </p>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {knobs.map((k) => {
          const raw = settings[k.key];
          return (
            <div key={k.key} className="rounded-md border border-slate-800 bg-slate-950/40 p-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-slate-200">{k.label}</label>
                {k.type === 'bool' ? (
                  <Switch
                    checked={Boolean(raw)}
                    onCheckedChange={(v) => onChange(k.key, v)}
                  />
                ) : (
                  <Input
                    type="number"
                    value={raw ?? ''}
                    onChange={(e) =>
                      onChange(k.key, e.target.value === '' ? null : Number(e.target.value))
                    }
                    className="w-32 bg-slate-950 border-slate-700 text-slate-100 text-right"
                  />
                )}
              </div>
              <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">{k.help}</p>
              {k.type === 'cents' && raw != null && (
                <p className="text-[11px] text-emerald-300 mt-1">{formatCents(Number(raw))}</p>
              )}
            </div>
          );
        })}
        <div className="md:col-span-2 flex justify-end pt-2">
          <Button onClick={onSave} disabled={saving} className="bg-emerald-600 hover:bg-emerald-500 text-white">
            {saving ? (<><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Saving…</>) : (<><Save className="w-4 h-4 mr-1" /> Save settings</>)}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ProductRow({ p, onUpdate, busy }) {
  const [price, setPrice] = useState(p.our_price_cents ?? 0);
  const [cost, setCost] = useState(p.our_cost_cents ?? 0);
  const dirty = price !== (p.our_price_cents ?? 0) || cost !== (p.our_cost_cents ?? 0);
  const needsTag = p.fulfillment_mode === 'affiliate_redirect' && p.vendor_extra?.needs_partner_tag;
  const needsPrintful =
    p.fulfillment_mode === 'direct_pod' &&
    !p.vendor_extra?.printful_variant_id;

  return (
    <tr className="border-b border-slate-800 hover:bg-slate-900/40">
      <td className="px-3 py-2 align-top">
        <div className="text-sm font-semibold text-slate-100">{p.name}</div>
        <div className="text-[11px] text-slate-500 font-mono">{p.slug}</div>
        {(needsTag || needsPrintful) && (
          <div className="mt-1 inline-flex items-center gap-1 text-[10px] text-amber-300">
            <AlertTriangle className="w-3 h-3" />
            {needsTag ? 'Needs partner tag' : 'Needs Printful variant ID'}
          </div>
        )}
      </td>
      <td className="px-3 py-2 align-top">
        <StatusBadge status={p.status} />
      </td>
      <td className="px-3 py-2 align-top text-xs text-slate-400">
        {FULFILLMENT_LABELS[p.fulfillment_mode] || p.fulfillment_mode}
      </td>
      <td className="px-3 py-2 align-top">
        <Input
          type="number"
          value={price}
          onChange={(e) => setPrice(Number(e.target.value))}
          className="w-24 bg-slate-950 border-slate-700 text-slate-100 text-right"
        />
      </td>
      <td className="px-3 py-2 align-top">
        <Input
          type="number"
          value={cost}
          onChange={(e) => setCost(Number(e.target.value))}
          className="w-24 bg-slate-950 border-slate-700 text-slate-100 text-right"
        />
      </td>
      <td className="px-3 py-2 align-top">
        <div className="flex flex-wrap gap-1">
          {dirty && (
            <Button
              size="sm"
              disabled={busy}
              onClick={() => onUpdate(p.id, { our_price_cents: price, our_cost_cents: cost })}
              className="bg-emerald-600 hover:bg-emerald-500 text-white h-7 px-2 text-[11px]"
            >
              <Save className="w-3 h-3 mr-1" /> Save
            </Button>
          )}
          {p.status !== 'active' && (
            <Button
              size="sm"
              disabled={busy}
              variant="outline"
              onClick={() => onUpdate(p.id, { status: 'active' })}
              className="border-emerald-700/50 text-emerald-300 hover:bg-emerald-500/10 h-7 px-2 text-[11px]"
            >
              <Power className="w-3 h-3 mr-1" /> Activate
            </Button>
          )}
          {p.status === 'active' && (
            <Button
              size="sm"
              disabled={busy}
              variant="outline"
              onClick={() => onUpdate(p.id, { status: 'archived' })}
              className="border-slate-700 text-slate-300 hover:bg-slate-800 h-7 px-2 text-[11px]"
            >
              <PowerOff className="w-3 h-3 mr-1" /> Archive
            </Button>
          )}
          {p.status === 'archived' && (
            <Button
              size="sm"
              disabled={busy}
              variant="outline"
              onClick={() => onUpdate(p.id, { status: 'draft' })}
              className="border-slate-700 text-slate-300 hover:bg-slate-800 h-7 px-2 text-[11px]"
            >
              Reset to draft
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="text-slate-400 hover:bg-slate-800 h-7 px-2 text-[11px]"
            onClick={() => window.open(`/Store/p/${p.slug}`, '_blank', 'noopener,noreferrer')}
          >
            <ExternalLink className="w-3 h-3" />
          </Button>
        </div>
      </td>
    </tr>
  );
}

export default function StoreAdmin() {
  const [settings, setSettings] = useState({});
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rowBusy, setRowBusy] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [modeFilter, setModeFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [error, setError] = useState(null);

  async function loadSettings() {
    const { data } = await supabase
      .from('app_settings')
      .select('key, value')
      .like('key', 'store_%');
    const map = {};
    for (const r of data || []) map[r.key] = r.value;
    setSettings(map);
  }

  async function loadProducts() {
    const { data, error } = await supabase
      .from('store_products')
      .select(`
        id, slug, name, status, fulfillment_mode, vendor_id, category_id,
        our_price_cents, our_cost_cents, vendor_extra, is_featured, gift_friendly,
        updated_date
      `)
      .order('updated_date', { ascending: false })
      .limit(500);
    if (error) {
      setError(error.message);
      return;
    }
    setProducts(data || []);
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        await Promise.all([loadSettings(), loadProducts()]);
      } catch (e) {
        if (!cancelled) setError(e.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (modeFilter !== 'all' && p.fulfillment_mode !== modeFilter) return false;
      if (q && !p.name.toLowerCase().includes(q) && !p.slug.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [products, statusFilter, modeFilter, search]);

  async function saveSettings() {
    setSaving(true);
    setError(null);
    try {
      const rows = Object.entries(settings).map(([key, value]) => ({
        key, value, is_public: false,
      }));
      const { error: e } = await supabase.from('app_settings').upsert(rows, { onConflict: 'key' });
      if (e) throw e;
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setSaving(false);
    }
  }

  async function updateProduct(id, patch) {
    setRowBusy(true);
    try {
      const { error } = await supabase.from('store_products').update(patch).eq('id', id);
      if (error) throw error;
      await loadProducts();
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setRowBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="bg-slate-900/50 border-slate-800">
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle className="text-white flex items-center gap-2">
              <Package className="w-5 h-5 text-emerald-400" /> Store
            </CardTitle>
            <p className="text-sm text-slate-400 mt-1 max-w-2xl">
              Manage the Supplies tab catalog and the master kill-switch. Toggle
              <code className="text-emerald-300 font-mono mx-1">store_enabled</code>
              to turn the storefront on; activate individual products as they
              get real images, Printful variant IDs, or partner tags.
            </p>
          </div>
        </CardHeader>
      </Card>

      {error && (
        <div className="rounded-md border border-rose-700/50 bg-rose-950/40 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-slate-400 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </div>
      ) : (
        <>
          <SettingsCard
            settings={settings}
            onChange={(k, v) => setSettings((s) => ({ ...s, [k]: v }))}
            onSave={saveSettings}
            saving={saving}
          />

          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader className="flex flex-row items-start justify-between gap-3">
              <div>
                <CardTitle className="text-white text-base">
                  Products <span className="text-slate-500 text-sm font-normal ml-2">({filtered.length} shown)</span>
                </CardTitle>
                <p className="text-sm text-slate-400 mt-1">
                  Quick activate / archive / inline price + cost editing. For
                  full edits (images, descriptions, lifecycle tags, vendor
                  extras), use the Supabase dashboard — proper editor coming
                  next.
                </p>
              </div>
              <Button size="sm" variant="outline" className="border-slate-700 text-slate-300" onClick={loadProducts}>
                <RefreshCw className="w-3.5 h-3.5 mr-1" /> Refresh
              </Button>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-end gap-3 mb-3">
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-1">
                    <Filter className="w-3 h-3 inline" /> Status
                  </div>
                  <div className="flex gap-1">
                    {['all', 'draft', 'active', 'archived'].map((s) => (
                      <button
                        key={s}
                        onClick={() => setStatusFilter(s)}
                        className={`text-xs px-2.5 py-1 rounded border ${
                          statusFilter === s
                            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-700/40'
                            : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-slate-600'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-1">Mode</div>
                  <div className="flex gap-1 flex-wrap">
                    {['all', 'direct_self', 'direct_pod', 'dropship_wholesale', 'affiliate_redirect'].map((m) => (
                      <button
                        key={m}
                        onClick={() => setModeFilter(m)}
                        className={`text-xs px-2.5 py-1 rounded border ${
                          modeFilter === m
                            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-700/40'
                            : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-slate-600'
                        }`}
                      >
                        {m === 'all' ? 'All' : (FULFILLMENT_LABELS[m] || m)}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex-1 min-w-[200px]">
                  <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-1">Search</div>
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Name or slug"
                    className="bg-slate-950 border-slate-700 text-slate-100"
                  />
                </div>
              </div>

              <div className="overflow-x-auto rounded-md border border-slate-800">
                <table className="w-full text-sm">
                  <thead className="bg-slate-950 text-[11px] uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="text-left px-3 py-2 font-semibold">Product</th>
                      <th className="text-left px-3 py-2 font-semibold">Status</th>
                      <th className="text-left px-3 py-2 font-semibold">Mode</th>
                      <th className="text-left px-3 py-2 font-semibold">Price (¢)</th>
                      <th className="text-left px-3 py-2 font-semibold">Cost (¢)</th>
                      <th className="text-left px-3 py-2 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((p) => (
                      <ProductRow key={p.id} p={p} onUpdate={updateProduct} busy={rowBusy} />
                    ))}
                    {filtered.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-3 py-8 text-center text-slate-500 text-sm">
                          No products match those filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
