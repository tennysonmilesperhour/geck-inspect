import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  ShoppingCart,
  Gift,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { fetchCart, cartItemCount } from '@/lib/store/cart';
import { useAuth } from '@/lib/AuthContext';

const APP_LOGO = 'https://i.imgur.com/gfaW2Yg.png';

/**
 * Shared chrome for every Store/* route.
 *
 * Two render modes:
 *   - Embedded: when the user is authenticated (or in guest mode), the
 *     parent app Layout already renders the brand header + sidebar.
 *     We skip the standalone brand bar and only render a slim store
 *     sub-nav (categories + cart) so the in-app sidebar stays visible
 *     and the brand chrome doesn't double up.
 *   - Standalone: anonymous web visitors landing from a Google search
 *     for "crested gecko gifts" get the full chrome with logo, brand
 *     name, gifts/apparel/diet/enclosures nav, cart, and a Sign in CTA.
 */
export default function StoreLayout({ children, breadcrumbs }) {
  const { isAuthenticated, isGuest } = useAuth();
  const embedded = isAuthenticated || isGuest;
  const [count, setCount] = useState(0);
  const location = useLocation();

  useEffect(() => {
    let cancelled = false;
    async function refresh() {
      try {
        const { items } = await fetchCart();
        if (!cancelled) setCount(cartItemCount(items));
      } catch {
        if (!cancelled) setCount(0);
      }
    }
    refresh();
    return () => { cancelled = true; };
  }, [location.pathname]);

  const subNav = (
    <nav className="flex items-center gap-1 overflow-x-auto">
      <Link
        to="/Store"
        className="text-sm text-slate-300 hover:text-emerald-200 px-2 py-1 rounded whitespace-nowrap"
      >
        Shop all
      </Link>
      <Link
        to="/Store/c/gifts"
        className="text-sm text-slate-300 hover:text-emerald-200 px-2 py-1 rounded inline-flex items-center gap-1 whitespace-nowrap"
      >
        <Gift className="w-3.5 h-3.5" /> Gifts
      </Link>
      <Link to="/Store/c/apparel" className="text-sm text-slate-300 hover:text-emerald-200 px-2 py-1 rounded whitespace-nowrap">
        Apparel
      </Link>
      <Link to="/Store/c/diet" className="text-sm text-slate-300 hover:text-emerald-200 px-2 py-1 rounded whitespace-nowrap">
        Diet
      </Link>
      <Link to="/Store/c/enclosures" className="text-sm text-slate-300 hover:text-emerald-200 px-2 py-1 rounded whitespace-nowrap">
        Enclosures
      </Link>
    </nav>
  );

  const cartChip = (
    <Link
      to="/Store/cart"
      className="relative inline-flex items-center gap-1.5 px-2 py-1 rounded text-slate-200 hover:bg-slate-800 shrink-0"
    >
      <ShoppingCart className="w-4 h-4" />
      <span className="text-sm hidden sm:inline">Cart</span>
      {count > 0 && (
        <span className="absolute -top-1 -right-1 bg-emerald-500 text-emerald-950 text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
          {count > 9 ? '9+' : count}
        </span>
      )}
    </Link>
  );

  // ---------------------------------------------------------------------
  // Embedded mode ,  slim sub-nav only. The parent Layout owns the brand,
  // sidebar, and account menu.
  // ---------------------------------------------------------------------
  if (embedded) {
    return (
      <div className="min-h-full text-slate-100">
        <div className="sticky top-0 z-20 border-b border-slate-800 bg-slate-950/95 backdrop-blur-sm">
          <div className="max-w-6xl mx-auto px-4 py-2 flex items-center gap-3">
            <div className="flex-1 min-w-0">{subNav}</div>
            {cartChip}
          </div>
        </div>

        {breadcrumbs && breadcrumbs.length > 0 && (
          <div className="border-b border-slate-800/60 bg-slate-950">
            <div className="max-w-6xl mx-auto px-4 py-2 flex items-center gap-1.5 text-xs text-slate-400 overflow-x-auto">
              {breadcrumbs.map((b, i) => (
                <span key={i} className="inline-flex items-center gap-1.5 whitespace-nowrap">
                  {i > 0 && <ChevronRight className="w-3 h-3 text-slate-600" />}
                  {b.to ? (
                    <Link to={b.to} className="hover:text-emerald-300">{b.label}</Link>
                  ) : (
                    <span className="text-slate-300">{b.label}</span>
                  )}
                </span>
              ))}
            </div>
          </div>
        )}

        <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>

        <div className="border-t border-slate-800/60 mt-12">
          <div className="max-w-6xl mx-auto px-4 py-4 text-[11px] text-slate-500 flex flex-col md:flex-row items-start md:items-center gap-2 md:gap-4">
            <span>Supplies ,  sold by Geck Inspect, with select partner items.</span>
            <span className="md:ml-auto">
              Some links are affiliate links ,  see disclosure on product pages.
            </span>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------
  // Standalone mode ,  anonymous visitors. Full chrome with logo, brand,
  // and Sign in CTA.
  // ---------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950/95 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link to="/Store" className="flex items-center gap-2 shrink-0 group">
            <img
              src={APP_LOGO}
              alt="Geck Inspect"
              className="h-7 w-7 rounded-md object-contain"
              loading="lazy"
              decoding="async"
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.style.display = 'none';
              }}
            />
            <div className="leading-tight hidden sm:block">
              <div
                className="text-sm font-bold text-emerald-100"
                style={{ fontFamily: "'Righteous', cursive", letterSpacing: '0.03em' }}
              >
                Geck Inspect
              </div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500">
                Supplies
              </div>
            </div>
          </Link>

          <div className="hidden md:flex items-center gap-1 ml-4 flex-1">{subNav}</div>

          <div className="flex-1 md:hidden" />

          {cartChip}

          <Link to="/AuthPortal">
            <Button size="sm" variant="outline" className="text-emerald-200 border-emerald-700/50 hover:bg-emerald-500/10">
              Sign in
            </Button>
          </Link>
        </div>

        <div className="md:hidden border-t border-slate-800/60">
          <div className="max-w-6xl mx-auto px-4 py-2 overflow-x-auto">{subNav}</div>
        </div>
      </header>

      {breadcrumbs && breadcrumbs.length > 0 && (
        <div className="border-b border-slate-800/60 bg-slate-950">
          <div className="max-w-6xl mx-auto px-4 py-2 flex items-center gap-1.5 text-xs text-slate-400 overflow-x-auto">
            {breadcrumbs.map((b, i) => (
              <span key={i} className="inline-flex items-center gap-1.5 whitespace-nowrap">
                {i > 0 && <ChevronRight className="w-3 h-3 text-slate-600" />}
                {b.to ? (
                  <Link to={b.to} className="hover:text-emerald-300">{b.label}</Link>
                ) : (
                  <span className="text-slate-300">{b.label}</span>
                )}
              </span>
            ))}
          </div>
        </div>
      )}

      <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>

      <footer className="border-t border-slate-800 mt-12">
        <div className="max-w-6xl mx-auto px-4 py-6 text-xs text-slate-500 flex flex-col md:flex-row items-start md:items-center gap-3 md:gap-6">
          <span>© Geck Inspect ,  Supplies for crested gecko keepers and breeders.</span>
          <Link to="/PrivacyPolicy" className="hover:text-slate-300">Privacy</Link>
          <Link to="/Terms" className="hover:text-slate-300">Terms</Link>
          <Link to="/Contact" className="hover:text-slate-300">Contact</Link>
          <span className="ml-auto">
            Some links are affiliate links ,  see disclosure on product pages.
          </span>
        </div>
      </footer>
    </div>
  );
}
