import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import StoreLayout from '@/components/store/StoreLayout';

const StoreLanding = lazy(() => import('@/components/store/StoreLanding'));
const StoreCategory = lazy(() => import('@/components/store/StoreCategory'));
const StoreProduct = lazy(() => import('@/components/store/StoreProduct'));
const StoreCart = lazy(() => import('@/components/store/StoreCart'));
const StoreCheckoutSuccess = lazy(() => import('@/components/store/StoreCheckoutSuccess'));
const StoreOrders = lazy(() => import('@/components/store/StoreOrders'));
const StoreOrderDetail = lazy(() => import('@/components/store/StoreOrderDetail'));
const StoreNotFound = lazy(() => import('@/components/store/StoreNotFound'));

const Spinner = () => (
  <div className="flex items-center justify-center py-16">
    <div className="w-7 h-7 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
  </div>
);

/**
 * Top-level Store router. Mounted at /Store/* in App.jsx so all
 * sub-paths route through the shared StoreLayout chrome.
 *
 * Internal routes:
 *   /Store                            → landing
 *   /Store/c/:slug+                   → category (:slug+ supports gifts/under-25)
 *   /Store/p/:slug                    → product detail
 *   /Store/cart                       → cart
 *   /Store/checkout/success           → post-Stripe-redirect confirmation
 *   /Store/orders                     → user order history (auth)
 *   /Store/orders/:orderNumber        → order detail (token query param for guests)
 */
export default function Store() {
  return (
    <Suspense fallback={<StoreLayout><Spinner /></StoreLayout>}>
      <Routes>
        <Route index element={<StoreLanding />} />
        <Route path="c/*" element={<StoreCategory />} />
        <Route path="p/:slug" element={<StoreProduct />} />
        <Route path="cart" element={<StoreCart />} />
        <Route path="checkout/success" element={<StoreCheckoutSuccess />} />
        <Route path="orders" element={<StoreOrders />} />
        <Route path="orders/:orderNumber" element={<StoreOrderDetail />} />
        <Route path="*" element={<StoreNotFound />} />
      </Routes>
    </Suspense>
  );
}
