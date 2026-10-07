import { Link } from 'react-router-dom';
import { APP_LOGO_ICON_URL } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { createPageUrl } from '@/utils';
import { useInAppShell } from '@/lib/appShell';

/**
 * Shared chrome for unauthenticated content pages (About, Contact, Terms,
 * and any future programmatic-SEO landing pages). Inside the app shell it
 * renders the page alone. Otherwise it provides:
 *   - top nav with logo + Sign In CTA
 *   - a consistent footer with the site's indexable pages linked
 *     (internal linking density matters for topical authority)
 *
 * Pages that already ship their own hero header (CareGuide, GeneticsGuide,
 * MorphGuide) intentionally don't wrap themselves in this shell; they
 * layer their own hero on top of the slate background.
 */
export default function PublicPageShell({ children }) {
  // Opened from inside the app (Quality Scale is in the Discover menu),
  // the app already draws its own header and navigation, so skip the
  // public logo bar and footer instead of stacking a second header.
  const inAppShell = useInAppShell();
  if (inAppShell) {
    return <div className="min-h-screen bg-slate-950 text-slate-100 md:pt-4">{children}</div>;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <header className="max-w-6xl w-full mx-auto px-6 py-6 flex items-center justify-between">
        <Link to="/" className="touch:min-h-11 flex items-center gap-3 hover:opacity-90 transition-opacity">
          <img src={APP_LOGO_ICON_URL} alt="" width="40" height="40" className="h-10 w-10 rounded-xl" />
          <span className="text-xl font-bold tracking-tight">Geck Inspect</span>
        </Link>
        <nav className="hidden md:flex items-center gap-6 text-sm text-slate-300">
          <Link to="/MorphGuide" className="hover:text-white">Morph Guide</Link>
          <Link to="/CareGuide" className="hover:text-white">Care Guide</Link>
          <Link to="/GeneticsGuide" className="hover:text-white">Genetics</Link>
          <Link to="/calculator" className="hover:text-white">Calculator</Link>
        </nav>
        {/* Quiet sign-in link for returning members, one filled button
            for newcomers (matches the landing page header). */}
        <div className="flex items-center gap-1 sm:gap-3">
          <Link
            to={createPageUrl('AuthPortal')}
            className="inline-flex items-center min-h-11 px-3 text-sm font-semibold text-slate-200 hover:text-white rounded-md"
          >
            Sign in
          </Link>
          <Link to="/AuthPortal?mode=signup" className="hidden sm:inline-flex">
            <Button className="bg-emerald-700 hover:bg-emerald-800 text-white font-semibold">
              Start free
            </Button>
          </Link>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <PublicFooter />
    </div>
  );
}

export function PublicFooter() {
  return (
    <footer className="border-t border-slate-800/50 mt-16">
      <div className="max-w-6xl mx-auto px-6 py-10 grid grid-cols-2 md:grid-cols-4 gap-8 text-sm">
        <div className="col-span-2">
          <Link to="/" className="touch:min-h-11 flex items-center gap-3">
            <img src={APP_LOGO_ICON_URL} alt="" width="32" height="32" className="h-8 w-8 rounded-lg" />
            <span className="font-bold text-slate-100">Geck Inspect</span>
          </Link>
          <p className="text-slate-500 mt-3 leading-relaxed max-w-md">
            The crested gecko (<em>Correlophus ciliatus</em>) app for the business side of breeding: what each gecko is worth, what a pairing&rsquo;s eggs should bring, what each season made, and pedigrees buyers can verify.
          </p>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Reference</div>
          <ul className="space-y-2 touch:space-y-0 text-slate-400">
            <li><Link to="/MorphGuide" className="inline-flex items-center touch:min-h-11 touch:min-w-11 hover:text-white">Morph Guide</Link></li>
            <li><Link to="/CareGuide" className="inline-flex items-center touch:min-h-11 touch:min-w-11 hover:text-white">Care Guide</Link></li>
            <li><Link to="/GeneticsGuide" className="inline-flex items-center touch:min-h-11 touch:min-w-11 hover:text-white">Genetics Guide</Link></li>
            <li><Link to="/calculator" className="inline-flex items-center touch:min-h-11 touch:min-w-11 hover:text-white">Morph & Breeding Calculator</Link></li>
            <li><Link to="/pedigree-tracker" className="inline-flex items-center touch:min-h-11 touch:min-w-11 hover:text-white">Pedigree Tracker</Link></li>
            <li><Link to="/breeding-records" className="inline-flex items-center touch:min-h-11 touch:min-w-11 hover:text-white">Breeding Records</Link></li>
            <li><Link to="/crested-gecko-price" className="inline-flex items-center touch:min-h-11 touch:min-w-11 hover:text-white">Price Guide</Link></li>
            <li><Link to="/data" className="inline-flex items-center touch:min-h-11 touch:min-w-11 hover:text-white">Open Data</Link></li>
            <li><Link to="/Recognition" className="inline-flex items-center touch:min-h-11 touch:min-w-11 hover:text-white">Morph ID (first one free)</Link></li>
          </ul>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Company</div>
          <ul className="space-y-2 touch:space-y-0 text-slate-400">
            <li><Link to="/About" className="inline-flex items-center touch:min-h-11 touch:min-w-11 hover:text-white">About</Link></li>
            <li><Link to="/Contact" className="inline-flex items-center touch:min-h-11 touch:min-w-11 hover:text-white">Contact</Link></li>
            <li><Link to="/MarketplaceVerification" className="inline-flex items-center touch:min-h-11 touch:min-w-11 hover:text-white">Marketplace Trust</Link></li>
            <li><Link to="/Terms" className="inline-flex items-center touch:min-h-11 touch:min-w-11 hover:text-white">Terms</Link></li>
            <li><Link to="/PrivacyPolicy" className="inline-flex items-center touch:min-h-11 touch:min-w-11 hover:text-white">Privacy</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-slate-800/50">
        <div className="max-w-6xl mx-auto px-6 py-5 text-xs text-slate-500 flex flex-col md:flex-row items-center justify-between gap-2">
          <span>© {new Date().getFullYear()} Geck Inspect · geckOS</span>
          <span>Built for the crested gecko hobby.</span>
        </div>
      </div>
    </footer>
  );
}
