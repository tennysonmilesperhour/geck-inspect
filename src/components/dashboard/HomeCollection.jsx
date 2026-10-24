import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getVisibleGeckos } from '@/lib/geckoAccess';
import GeckoImage from '@/components/shared/GeckoImage';

export default function HomeCollection({ user }) {
  const query = useQuery({
    queryKey: ['dashboard', 'recent-geckos', user.email],
    queryFn: () => getVisibleGeckos(user, { $or: [{ archived: null }, { archived: false }] }, '-updated_date', 3),
    staleTime: 60_000,
  });
  return <section aria-labelledby="home-geckos-title" className="space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 id="home-geckos-title" className="text-xl font-semibold text-slate-100">Your geckos</h2>
      <Link to="/MyGeckos" className="text-sm text-emerald-300 underline touch:min-h-11 inline-flex items-center">View collection</Link>
    </div>
    {query.isError ? <p className="text-sm text-slate-300">Recent animals could not be loaded. <button className="underline touch:min-h-11" onClick={() => query.refetch()}>Try again</button></p>
      : query.isPending ? <div className="h-32 rounded-xl bg-slate-900 animate-pulse" aria-label="Loading recent geckos" />
        : <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {query.data.map((gecko) => <Link key={gecko.id} to={`/MyGeckos?gecko=${encodeURIComponent(gecko.id)}`} className="rounded-xl border border-slate-700 bg-slate-900 overflow-hidden hover:border-emerald-400 focus-visible:ring-2 focus-visible:ring-emerald-400">
            <GeckoImage src={gecko.image_urls?.[0]} gecko={gecko} width={480} alt={!gecko.image_urls?.[0] || gecko.photo_is_illustrative ? "Illustrative gecko photo" : gecko.name || "Your gecko"} loading="lazy" className="w-full h-32 object-cover" />
            <div className="p-3"><h3 className="font-medium text-slate-100 truncate">{gecko.name || 'Unnamed gecko'}</h3><p className="text-xs text-slate-300 mt-1">Records, care, passport & transfer</p></div>
          </Link>)}
        </div>}
  </section>;
}
