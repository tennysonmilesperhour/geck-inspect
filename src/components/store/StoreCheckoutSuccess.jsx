import { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import StoreLayout from '@/components/store/StoreLayout';
import Seo from '@/components/seo/Seo';
import { Button } from '@/components/ui/button';
import { clearGuestCart } from '@/lib/store/cart';
import { captureEvent } from '@/lib/posthog';

export default function StoreCheckoutSuccess() {
  const [search] = useSearchParams();
  const sessionId = search.get('session_id');
  const orderNumber = search.get('order');

  useEffect(() => {
    clearGuestCart();
    captureEvent('store_purchase_completed_view', {
      stripe_checkout_session_id: sessionId,
      order_number: orderNumber,
    });
  }, [sessionId, orderNumber]);

  return (
    <StoreLayout breadcrumbs={[{ label: 'Supplies', to: '/Store' }, { label: 'Order confirmed' }]}>
      <Seo title="Order confirmed — Geck Inspect" path="/Store/checkout/success" description="" noIndex />
      <div className="text-center py-16 max-w-lg mx-auto">
        <CheckCircle2 className="w-14 h-14 text-emerald-400 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-slate-100">Thanks — your order is in.</h1>
        <p className="text-sm text-slate-400 mt-2 leading-relaxed">
          A confirmation email is on its way with your order details and tracking
          info as soon as it ships. If you checked out as a guest, the email
          includes a link to create an account with bonus membership credit.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Link to="/Store">
            <Button className="bg-emerald-600 hover:bg-emerald-500 text-white">Keep shopping</Button>
          </Link>
          <Link to="/Store/orders">
            <Button variant="outline" className="border-slate-700 text-slate-200 hover:bg-slate-800">
              View orders
            </Button>
          </Link>
        </div>
      </div>
    </StoreLayout>
  );
}
