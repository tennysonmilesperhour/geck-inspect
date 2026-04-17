import { Link } from 'react-router-dom';
import { APP_LOGO_URL } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { createPageUrl } from '@/utils';

/**
 * Shared chrome for unauthenticated content pages (About, Contact, Terms,
 * and any future programmatic-SEO landing pages). Provides:
 *   - top nav with logo + Sign In CTA
 *   - a consistent footer with the site's indexable pages linked
 *     (internal linking density matters for topical authority)
 *
 * Pages that already ship their own hero header (CareGuide, GeneticsGuide,
 * MorphGuide) intentionally don't wrap themselves in this shell; they
 * layer their own hero on top of the slate background.
 */
export default function PublicPageShell({ children }) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <header className="max-w-6xl w-full mx-auto px-6 py-6 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
          <img src={APP_LOGO_URL} alt="Geck Inspect" className="h-10 w-10 rounded-xl" />
          <span className="text-xl font-bold tracking-tight">Geck Inspect</span>
        </Link>
        <nav className="hidden md:flex items-center gap-6 text-sm text-slate-300">
          <Link to="/MorphGuide" className="hover:text-white">Morph Guide</Link>
          <Link to="/CareGuide" className="hover:text-white">Care Guide</Link>
          <Link to="/GeneticsGuide" className="hover:text-white">Genetics</Link>
          <Link to="/GeneticCalculatorTool" className="hover:text-white">Calculator</Link>
        </nav>
        <Link to={createPageUrl('AuthPortal')}>
          <Button className="bg-emerald-700 hover:bg-emerald-800 text-white font-semibold">
            Sign In
          </Button>
        </Link>
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
          <Link to="/" className="flex items-center gap-3">
            <img src={APP_LOGO_URL} alt="Geck Inspect" className="h-8 w-8 rounded-lg" />
            <span className="font-bold text-slate-100">Geck Inspect</span>
          </Link>
          <p className="text-slate-500 mt-3 leading-relaxed max-w-md">
            The professional platform for crested gecko (<em>Correlophus ciliatus</em>) breeders and keepers. Collection management, breeding planning, AI morph ID, lineage, and community — in one place.
          </p>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Reference</div>
          <ul className="space-y-2 text-slate-400">
            <li><Link to="/MorphGuide" className="hover:text-white">Morph Guide</Link></li>
            <li><Link to="/CareGuide" className="hover:text-white">Care Guide</Link></li>
            <li><Link to="/GeneticsGuide" className="hover:text-white">Genetics Guide</Link></li>
            <li><Link to="/GeneticCalculatorTool" className="hover:text-white">Genetics Calculator</Link></li>
          </ul>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Company</div>
          <ul className="space-y-2 text-slate-400">
            <li><Link to="/About" className="hover:text-white">About</Link></li>
            <li><Link to="/Contact" className="hover:text-white">Contact</Link></li>
            <li><Link to="/MarketplaceVerification" className="hover:text-white">Marketplace Trust</Link></li>
            <li><Link to="/Terms" className="hover:text-white">Terms</Link></li>
            <li><Link to="/PrivacyPolicy" className="hover:text-white">Privacy</Link></li>
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
