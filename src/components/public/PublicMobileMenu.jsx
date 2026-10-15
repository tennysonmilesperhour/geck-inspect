import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { APP_LOGO_ICON_URL } from '@/lib/constants';
import { createPageUrl } from '@/utils';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

/**
 * Phone menu for the signed-out site (landing page and PublicPageShell).
 * The desktop header shows its links inline from md up; below md they
 * were hidden with nothing in their place, so the guides and tools were
 * only reachable from the footer. This is the hamburger that replaces
 * them on phones. Desktop never renders it.
 */
const SECTIONS = [
  {
    label: 'Guides',
    links: [
      { to: '/MorphGuide', label: 'Morph Guide' },
      { to: '/CareGuide', label: 'Care Guide' },
      { to: '/GeneticsGuide', label: 'Genetics Guide' },
    ],
  },
  {
    label: 'Tools',
    links: [
      { to: '/calculator', label: 'Morph & Breeding Calculator' },
      { to: '/Recognition', label: 'Morph ID (one free a month)' },
      { to: '/crested-gecko-price', label: 'Price Guide' },
    ],
  },
  {
    label: 'Geck Inspect',
    links: [
      { to: '/Membership', label: 'Pricing' },
      { to: '/About', label: 'About' },
      { to: '/Contact', label: 'Contact' },
    ],
  },
];

export default function PublicMobileMenu({ signedIn = false, onNavigate }) {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const isActive = (to) => pathname.toLowerCase() === to.toLowerCase();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label="Open menu"
          className="md:hidden inline-flex items-center justify-center h-11 w-11 rounded-lg text-slate-200 hover:text-white hover:bg-white/10 transition-colors"
        >
          <Menu className="h-6 w-6" />
        </button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="w-[min(20rem,85vw)] border-slate-800 bg-slate-950 text-slate-100 p-0 flex flex-col"
      >
        <div className="flex items-center gap-3 px-5 pt-[calc(1.25rem+env(safe-area-inset-top))] pb-4 border-b border-slate-800">
          <img src={APP_LOGO_ICON_URL} alt="" width="32" height="32" className="h-8 w-8 rounded-lg" />
          <SheetTitle className="text-lg font-bold text-slate-100">Geck Inspect</SheetTitle>
          <SheetDescription className="sr-only">Site pages</SheetDescription>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-5" aria-label="Site">
          {SECTIONS.map((section) => (
            <div key={section.label}>
              <div className="px-3 mb-1 text-xs font-semibold uppercase tracking-wider text-emerald-400/80">
                {section.label}
              </div>
              <ul>
                {section.links.map((link) => (
                  <li key={link.to}>
                    <SheetClose asChild>
                      <Link
                        to={link.to}
                        onClick={() => onNavigate?.(link.to)}
                        aria-current={isActive(link.to) ? 'page' : undefined}
                        className={`flex items-center min-h-11 px-3 rounded-lg text-base transition-colors ${
                          isActive(link.to)
                            ? 'bg-emerald-500/15 text-emerald-200 font-semibold'
                            : 'text-slate-200 hover:bg-white/5 hover:text-white'
                        }`}
                      >
                        {link.label}
                      </Link>
                    </SheetClose>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="px-5 pt-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] border-t border-slate-800 space-y-2">
          {signedIn ? (
            <SheetClose asChild>
              <Link
                to={createPageUrl('Dashboard')}
                className="flex items-center justify-center min-h-11 rounded-lg bg-emerald-700 hover:bg-emerald-600 font-semibold text-white"
              >
                Dashboard
              </Link>
            </SheetClose>
          ) : (
            <>
              <SheetClose asChild>
                <Link
                  to="/AuthPortal?mode=signup"
                  onClick={() => onNavigate?.('signup')}
                  className="flex items-center justify-center min-h-11 rounded-lg bg-emerald-700 hover:bg-emerald-600 font-semibold text-white"
                >
                  Start free
                </Link>
              </SheetClose>
              <SheetClose asChild>
                <Link
                  to={createPageUrl('AuthPortal')}
                  onClick={() => onNavigate?.('signin')}
                  className="flex items-center justify-center min-h-11 rounded-lg border border-slate-700 hover:bg-white/5 font-semibold text-slate-200"
                >
                  Sign in
                </Link>
              </SheetClose>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
