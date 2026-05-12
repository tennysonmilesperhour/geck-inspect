import { useEffect, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import StoreLayout from '@/components/store/StoreLayout';
import Seo from '@/components/seo/Seo';
import { supabase } from '@/lib/supabaseClient';
import { formatCents } from '@/lib/store/format';

export default function StoreOrderDetail() {
  const { orderNumber } = useParams();
  const [search] = useSearchParams();
  const token = search.get('token');
  const [order, setOrder] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        // Authenticated owners can fetch via RLS by order_number directly.
        // Guests pass ?token=<signed_token>; for Phase 1 we do a best-effort
        // direct fetch and surface a friendly message if it 401s ,  the
        // edge function for token-validated guest reads ships next.
        let q = supabase.from('store_orders').select('*').eq('order_number', orderNumber);
        if (token) q = q.eq('id', token);  // Phase 1 placeholder; real flow validates a signed token server-side
        const { data: o } = await q.maybeSingle();
        if (cancelled) return;
        if (!o) {
          setError('We couldn\'t find that order with the link you used.');
          setLoading(false);
          return;
        }
        setOrder(o);
        const { data: it } = await supabase
          .from('store_order_items')
          .select('id, product_name_snapshot, quantity, unit_price_cents, line_total_cents, fulfillment_status')
          .eq('order_id', o.id)
          .order('created_date', { ascending: true });
        if (!cancelled) setItems(it || []);
      } catch (e) {
        if (!cancelled) setError(e.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [orderNumber, token]);

  return (
    <StoreLayout breadcrumbs={[
      { label: 'Supplies', to: '/Store' },
      { label: 'Orders', to: '/Store/orders' },
      { label: orderNumber || 'Order' },
    ]}>
      <Seo title={`Order ${orderNumber} ,  Geck Inspect`} path={`/Store/orders/${orderNumber}`} description="" noIndex />
      {loading ? (
        <div className="h-40 flex items-center justify-center text-slate-500 text-sm">Loading…</div>
      ) : error ? (
        <div className="rounded-md border border-rose-700/50 bg-rose-950/40 px-4 py-3 text-sm text-rose-200">
          {error}
          <div className="mt-2">
            <Link to="/Store" className="text-emerald-300 hover:text-emerald-200">Back to Supplies →</Link>
          </div>
        </div>
      ) : !order ? (
        <div className="text-sm text-slate-400">Order not found.</div>
      ) : (
        <div className="space-y-6">
          <header>
            <h1 className="text-2xl font-bold text-slate-100">Order {order.order_number}</h1>
            <p className="text-sm text-slate-400 mt-1">
              {new Date(order.created_date).toLocaleString()} · {order.status}
            </p>
          </header>

          <div className="rounded-lg border border-slate-800 bg-slate-900/40 divide-y divide-slate-800">
            {items.map((it) => (
              <div key={it.id} className="px-4 py-3 flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-100">{it.product_name_snapshot}</div>
                  <div className="text-xs text-slate-500">
                    Qty {it.quantity} · {formatCents(it.unit_price_cents)} each · {it.fulfillment_status}
                  </div>
                </div>
                <div className="text-sm font-semibold text-emerald-200">
                  {formatCents(it.line_total_cents)}
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 text-sm space-y-1.5">
            <div className="flex justify-between text-slate-400">
              <span>Subtotal</span><span className="text-slate-200">{formatCents(order.subtotal_cents)}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Shipping</span><span className="text-slate-200">{formatCents(order.shipping_cents)}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Tax</span><span className="text-slate-200">{formatCents(order.tax_cents)}</span>
            </div>
            {order.discount_cents > 0 && (
              <div className="flex justify-between text-slate-400">
                <span>Discount</span><span className="text-slate-200">−{formatCents(order.discount_cents)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-bold pt-2 border-t border-slate-800 mt-2">
              <span className="text-slate-100">Total</span>
              <span className="text-emerald-200">{formatCents(order.total_cents)}</span>
            </div>
          </div>
        </div>
      )}
    </StoreLayout>
  );
}
