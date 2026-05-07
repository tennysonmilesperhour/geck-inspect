import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  ShoppingCart,
  Gift,
  Home as HomeIcon,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { fetchCart, cartItemCount } from '@/lib/store/cart';
import { useAuth } from '@/lib/AuthContext';

const APP_LOGO = 'https://i.imgur.com/gfaW2Yg.png';

/**
 * Shared chrome for every Store/* route. Renders a clean header with
 * brand, search, gifts CTA, cart, and account/login. The same chrome
 * is used by guest and authenticated users so the shopping experience
 * stays focused — we don't push the in-app sidebar over it.
 *
 * The "Back to app" link surfaces only for signed-in users so they can
 * return to /Dashboard without hunting for nav.
 */
export default function StoreLayout({ children, breadcrumbs }) {
  const { user, isAuthenticated } = useAuth();
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

          <nav className="hidden md:flex items-center gap-1 ml-4">
            <Link
              to="/Store"
              className="text-sm text-slate-300 hover:text-emerald-200 px-2 py-1 rounded"
            >
              Shop all
            </Link>
            <Link
              to="/Store/c/gifts"
              className="text-sm text-slate-300 hover:text-emerald-200 px-2 py-1 rounded inline-flex items-center gap-1"
            >
              <Gift className="w-3.5 h-3.5" /> Gifts
            </Link>
            <Link
              to="/Store/c/apparel"
              className="text-sm text-slate-300 hover:text-emerald-200 px-2 py-1 rounded"
            >
              Apparel
            </Link>
            <Link
              to="/Store/c/diet"
              className="text-sm text-slate-300 hover:text-emerald-200 px-2 py-1 rounded"
            >
              Diet
            </Link>
            <Link
              to="/Store/c/enclosures"
              className="text-sm text-slate-300 hover:text-emerald-200 px-2 py-1 rounded"
            >
              Enclosures
            </Link>
          </nav>

          <div className="flex-1" />

          <Link
            to="/Store/cart"
            className="relative inline-flex items-center gap-1.5 px-2 py-1 rounded text-slate-200 hover:bg-slate-800"
          >
            <ShoppingCart className="w-4 h-4" />
            <span className="text-sm hidden sm:inline">Cart</span>
            {count > 0 && (
              <span className="absolute -top-1 -right-1 bg-emerald-500 text-emerald-950 text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {count > 9 ? '9+' : count}
              </span>
            )}
          </Link>

          {isAuthenticated ? (
            <Link
              to="/Dashboard"
              className="text-xs text-slate-400 hover:text-slate-200 inline-flex items-center gap-1 px-2 py-1"
            >
              <HomeIcon className="w-3.5 h-3.5" /> Back to app
            </Link>
          ) : (
            <Link to="/AuthPortal">
              <Button size="sm" variant="outline" className="text-emerald-200 border-emerald-700/50 hover:bg-emerald-500/10">
                Sign in
              </Button>
            </Link>
          )}
        </div>
      </header>

      {breadcrumbs && breadcrumbs.length > 0 && (
        <div className="border-b border-slate-800/60 bg-slate-950">
          <div className="max-w-6xl mx-auto px-4 py-2 flex items-center gap-1.5 text-xs text-slate-400">
            {breadcrumbs.map((b, i) => (
              <span key={i} className="inline-flex items-center gap-1.5">
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
          <span>© Geck Inspect — Supplies for crested gecko keepers and breeders.</span>
          <Link to="/PrivacyPolicy" className="hover:text-slate-300">Privacy</Link>
          <Link to="/Terms" className="hover:text-slate-300">Terms</Link>
          <Link to="/Contact" className="hover:text-slate-300">Contact</Link>
          <span className="ml-auto">
            Some links are affiliate links — see disclosure on product pages.
          </span>
        </div>
      </footer>
    </div>
  );
}
