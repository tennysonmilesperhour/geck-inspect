import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import StoreLayout from '@/components/store/StoreLayout';
import Seo from '@/components/seo/Seo';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { formatCents } from '@/lib/store/format';

export default function StoreOrders() {
  const { user, isAuthenticated } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!isAuthenticated) {
        setLoading(false);
        return;
      }
      try {
        const { data } = await supabase
          .from('store_orders')
          .select('id, order_number, status, total_cents, created_date, paid_at')
          .order('created_date', { ascending: false })
          .limit(50);
        if (!cancelled) setOrders(data || []);
      } catch (e) {
        console.warn('orders load failed', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [isAuthenticated, user?.email]);

  return (
    <StoreLayout breadcrumbs={[{ label: 'Supplies', to: '/Store' }, { label: 'Orders' }]}>
      <Seo title="Your orders — Geck Inspect" path="/Store/orders" description="" noIndex />
      <h1 className="text-2xl font-bold text-slate-100 mb-4">Your orders</h1>

      {!isAuthenticated ? (
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-6 text-sm text-slate-300">
          <p>Sign in to see your order history. If you checked out as a guest, look for the order
          link in your email receipt — it has a magic link to view your order without an account.</p>
          <Link to="/AuthPortal" className="inline-block mt-3 text-emerald-300 hover:text-emerald-200">Sign in →</Link>
        </div>
      ) : loading ? (
        <div className="h-40 flex items-center justify-center text-slate-500 text-sm">Loading…</div>
      ) : orders.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-700 bg-slate-900/20 p-8 text-center text-sm text-slate-400">
          No orders yet.
        </div>
      ) : (
        <div className="space-y-2">
          {orders.map((o) => (
            <Link
              key={o.id}
              to={`/Store/orders/${o.order_number}`}
              className="flex items-center justify-between rounded-md border border-slate-800 bg-slate-900/40 hover:bg-slate-900 px-4 py-3"
            >
              <div>
                <div className="text-sm font-semibold text-slate-100">{o.order_number}</div>
                <div className="text-xs text-slate-500">
                  {new Date(o.created_date).toLocaleDateString()} · {o.status}
                </div>
              </div>
              <div className="text-sm font-semibold text-emerald-200">{formatCents(o.total_cents)}</div>
            </Link>
          ))}
        </div>
      )}
    </StoreLayout>
  );
}
