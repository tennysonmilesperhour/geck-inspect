import { useLocation, Link } from 'react-router-dom';
import { api } from '@/api/appClient';
import { useQuery } from '@tanstack/react-query';
import Seo from '@/components/seo/Seo';


export default function PageNotFound({}) {
    const location = useLocation();
    const pageName = location.pathname.substring(1);

    const { data: authData, isFetched } = useQuery({
        queryKey: ['user'],
        queryFn: async () => {
            try {
                const user = await api.auth.me();
                return { user, isAuthenticated: true };
            } catch {
                return { user: null, isAuthenticated: false };
            }
        }
    });

    return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-slate-950 text-slate-100">
            {/* Direct requests for an unknown path already return HTTP 404
                from middleware.js. Opening a missing route from inside the
                app does not make a new request, so this page still renders
                and asks crawlers that do run JavaScript not to index it. */}
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
                      <Link to="/" className="touch:min-h-11 inline-flex items-center rounded-full border border-slate-700 bg-slate-900 hover:border-emerald-500/40 hover:text-emerald-200 px-3 py-1.5 text-slate-300 transition-colors">Home</Link>
                      <Link to="/MorphGuide" className="touch:min-h-11 inline-flex items-center rounded-full border border-slate-700 bg-slate-900 hover:border-emerald-500/40 hover:text-emerald-200 px-3 py-1.5 text-slate-300 transition-colors">Morph Guide</Link>
                      <Link to="/CareGuide" className="touch:min-h-11 inline-flex items-center rounded-full border border-slate-700 bg-slate-900 hover:border-emerald-500/40 hover:text-emerald-200 px-3 py-1.5 text-slate-300 transition-colors">Care Guide</Link>
                      <Link to="/GeneticsGuide" className="touch:min-h-11 inline-flex items-center rounded-full border border-slate-700 bg-slate-900 hover:border-emerald-500/40 hover:text-emerald-200 px-3 py-1.5 text-slate-300 transition-colors">Genetics</Link>
                      <Link to="/Contact" className="touch:min-h-11 inline-flex items-center rounded-full border border-slate-700 bg-slate-900 hover:border-emerald-500/40 hover:text-emerald-200 px-3 py-1.5 text-slate-300 transition-colors">Contact</Link>
                    </nav>

                    {isFetched && authData.isAuthenticated && authData.user?.role === 'admin' && (
                        <div className="mt-8 p-4 bg-slate-900 rounded-xl border border-slate-700">
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