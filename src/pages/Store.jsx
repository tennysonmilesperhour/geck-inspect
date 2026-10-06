import { Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
// The app's retrying loader, like every other route: after a deploy an old
// tab asks for chunk names that no longer exist, and React's plain lazy()
// sent that straight to the error screen.
import { lazy } from '@/lib/lazyWithRetry';
import StoreLayout from '@/components/store/StoreLayout';
import { STORE_CHECKOUT_ENABLED } from '@/lib/store/checkoutFlags';

const StoreLanding = lazy(() => import('@/components/store/StoreLanding'));
const StoreCategory = lazy(() => import('@/components/store/StoreCategory'));
const StoreProduct = lazy(() => import('@/components/store/StoreProduct'));
const StoreCart = lazy(() => import('@/components/store/StoreCart'));
const CustomStickerStudio = lazy(() => import('@/components/store/CustomStickerStudio'));
const CustomShirtStudio = lazy(() => import('@/components/store/CustomShirtStudio'));
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
 *   /Store/stickers                   → custom pet sticker builder
 *   /Store/tees                       → custom gecko tee builder
 *   /Store/cart                       → cart
 *   /Store/checkout/success           → post-Stripe-redirect confirmation
 *   /Store/orders                     → user order history (auth)
 *   /Store/orders/:orderNumber        → order detail (token query param for guests)
 *
 * While checkout is closed (STORE_CHECKOUT_ENABLED in
 * src/lib/store/checkoutFlags.js) the tee builder and the cart redirect to the landing page: each one ends in a payment
 * that cannot be made yet. The sticker builder remains available for
 * designing and downloading proofs; its purchase action is gated.
 * Checkout can be switched on
 * with that one flag.
 */
const toStoreHome = <Navigate to="/Store" replace />;

export default function Store() {
  return (
    <Suspense fallback={<StoreLayout><Spinner /></StoreLayout>}>
      <Routes>
        <Route index element={<StoreLanding />} />
        <Route path="c/*" element={<StoreCategory />} />
        <Route path="p/:slug" element={<StoreProduct />} />
        <Route path="stickers" element={<CustomStickerStudio />} />
        <Route path="tees" element={STORE_CHECKOUT_ENABLED ? <CustomShirtStudio /> : toStoreHome} />
        <Route path="cart" element={STORE_CHECKOUT_ENABLED ? <StoreCart /> : toStoreHome} />
        <Route path="checkout/success" element={<StoreCheckoutSuccess />} />
        <Route path="orders" element={<StoreOrders />} />
        <Route path="orders/:orderNumber" element={<StoreOrderDetail />} />
        <Route path="*" element={<StoreNotFound />} />
      </Routes>
    </Suspense>
  );
}
