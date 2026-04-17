import { useLocation, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import Seo from '@/components/seo/Seo';


export default function PageNotFound({}) {
    const location = useLocation();
    const pageName = location.pathname.substring(1);

    const { data: authData, isFetched } = useQuery({
        queryKey: ['user'],
        queryFn: async () => {
            try {
                const user = await base44.auth.me();
                return { user, isAuthenticated: true };
            } catch {
                return { user: null, isAuthenticated: false };
            }
        }
    });

    return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-slate-950 text-slate-100">
            {/* Client-side noindex signal. Because the SPA returns HTTP 200
                on every path (Vercel rewrite → /index.html), the authoritative
                way to tell JS-executing crawlers this URL is a dead end is
                via <meta name="robots" content="noindex, nofollow">. Real
                404 status requires enumerating every known SPA path in
                vercel.json — tracked as a follow-up. */}
            <Seo
              title="Page not found"
              description="The page you requested could not be found on Geck Inspect."
              path={location.pathname}
              noIndex
            />
            <div className="max-w-md w-full">
                <div className="text-center space-y-6">
                    <div className="space-y-2">
                        <h1 className="text-7xl font-light text-slate-700">404</h1>
                        <div className="h-0.5 w-16 bg-slate-800 mx-auto"></div>
                    </div>

                    <div className="space-y-3">
                        <h2 className="text-2xl font-medium text-slate-100">
                            Page not found
                        </h2>
                        <p className="text-slate-400 leading-relaxed">
                            The page <span className="font-medium text-slate-300">"{pageName}"</span> does not exist on Geck Inspect. Try one of the links below to find what you're looking for.
                        </p>
                    </div>

                    <nav className="pt-2 flex flex-wrap gap-2 justify-center text-sm">
                      <Link to="/" className="rounded-full border border-slate-700 bg-slate-900 hover:border-emerald-500/40 hover:text-emerald-200 px-3 py-1.5 text-slate-300 transition-colors">Home</Link>
                      <Link to="/MorphGuide" className="rounded-full border border-slate-700 bg-slate-900 hover:border-emerald-500/40 hover:text-emerald-200 px-3 py-1.5 text-slate-300 transition-colors">Morph Guide</Link>
                      <Link to="/CareGuide" className="rounded-full border border-slate-700 bg-slate-900 hover:border-emerald-500/40 hover:text-emerald-200 px-3 py-1.5 text-slate-300 transition-colors">Care Guide</Link>
                      <Link to="/GeneticsGuide" className="rounded-full border border-slate-700 bg-slate-900 hover:border-emerald-500/40 hover:text-emerald-200 px-3 py-1.5 text-slate-300 transition-colors">Genetics</Link>
                      <Link to="/Contact" className="rounded-full border border-slate-700 bg-slate-900 hover:border-emerald-500/40 hover:text-emerald-200 px-3 py-1.5 text-slate-300 transition-colors">Contact</Link>
                    </nav>

                    {isFetched && authData.isAuthenticated && authData.user?.role === 'admin' && (
                        <div className="mt-8 p-4 bg-slate-900 rounded-lg border border-slate-800">
                            <p className="text-sm font-medium text-slate-300">Admin note</p>
                            <p className="text-sm text-slate-500 leading-relaxed mt-1">
                                This route isn't registered in App.jsx or pages.config.js. If it should exist, wire it up.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}