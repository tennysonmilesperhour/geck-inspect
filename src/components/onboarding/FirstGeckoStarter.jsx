import { Link } from 'react-router-dom';
import { Camera, FileSpreadsheet, GitBranch, Keyboard, Bell, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { flowEvent, markPhotoPath } from '@/lib/firstGeckoFlow';

const STEPS = [
  { icon: Camera, title: 'Add your gecko', body: 'By photo (Morph ID names the morph) or by typing a name.' },
  { icon: GitBranch, title: 'Add its parents', body: 'Names from the breeder are enough. Skip if you don’t know.' },
  { icon: Bell, title: 'See what it needs next', body: 'Its first weigh-in, feeding days and what it’s worth.' },
];

/**
 * The empty My Geckos page and the empty Dashboard both lead with this:
 * the three steps of the guided first gecko and two ways to start.
 *
 * Props:
 *   onStart / startHref: open the flow on its first step (a button on My
 *     Geckos, a link to /MyGeckos?add=1 from the Dashboard).
 *   onImport / importHref: the spreadsheet importer, for breeders.
 *   pendingName: a gecko kept from the demo and not saved yet; the main
 *     button saves it instead.
 *   surface: 'my_geckos' | 'dashboard', for analytics.
 */
export default function FirstGeckoStarter({ onStart, startHref, onImport, importHref, pendingName = null, onSavePending, surface }) {
  const startProps = onStart ? { onClick: () => { flowEvent('add', 'start', { surface }); onStart(); } } : null;
  const photoClick = () => { flowEvent('add', 'choose_photo', { surface }); markPhotoPath(true); };

  return (
    <section className="flex flex-col rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/40 via-slate-900 to-slate-900 p-5 md:p-6" aria-labelledby="first-gecko-title">
      <p className="text-[11px] uppercase tracking-wider font-semibold text-emerald-300">Getting started, about a minute</p>
      <h2 id="first-gecko-title" className="text-xl md:text-2xl font-bold text-slate-100 mt-1">
        {pendingName ? `Save ${pendingName} to your collection` : 'Add your first gecko'}
      </h2>
      <p className="text-sm text-slate-300 mt-1 max-w-2xl">
        {pendingName
          ? `You added ${pendingName} in the demo. One tap saves it here, then you can add its parents and see what it needs next.`
          : 'Three short steps, and you can skip any of them. At the end you see its family, its next weigh-in and feeding day, and what it is worth.'}
      </p>

      {/* On phones the buttons come first and the steps follow. */}
      <ol className="order-last md:order-none mt-4 grid gap-2 md:grid-cols-3">
        {STEPS.map((s, i) => (
          <li key={s.title} className="flex items-start gap-3 rounded-xl border border-slate-700 bg-slate-900/60 p-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-600/20 text-sm font-bold text-emerald-300">{i + 1}</span>
            <span className="min-w-0">
              <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-100"><s.icon className="w-3.5 h-3.5 text-emerald-400" />{s.title}</span>
              <span className="block text-xs text-slate-400 mt-0.5">{s.body}</span>
            </span>
          </li>
        ))}
      </ol>

      <div className="mt-4 flex flex-col sm:flex-row sm:flex-wrap gap-2">
        {pendingName && onSavePending ? (
          <Button className="min-h-11 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold" onClick={onSavePending}>
            <UserPlus className="w-4 h-4 mr-2" /> Save {pendingName}
          </Button>
        ) : (
          <>
            <Button asChild className="min-h-11 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold">
              <Link to="/Recognition?first_gecko=1" onClick={photoClick}>
                <Camera className="w-4 h-4 mr-2" /> Add by photo, first Morph ID free
              </Link>
            </Button>
            {startProps ? (
              <Button variant="outline" className="min-h-11 border-slate-600 bg-slate-900/60 text-slate-100 hover:bg-slate-800" {...startProps}>
                <Keyboard className="w-4 h-4 mr-2" /> Type a name and morph
              </Button>
            ) : (
              <Button asChild variant="outline" className="min-h-11 border-slate-600 bg-slate-900/60 text-slate-100 hover:bg-slate-800">
                <Link to={startHref} onClick={() => flowEvent('add', 'start', { surface })}>
                  <Keyboard className="w-4 h-4 mr-2" /> Type a name and morph
                </Link>
              </Button>
            )}
          </>
        )}
        {onImport ? (
          <Button variant="ghost" className="min-h-11 text-slate-200 hover:text-white" onClick={onImport}>
            <FileSpreadsheet className="w-4 h-4 mr-2" /> Import a spreadsheet
          </Button>
        ) : importHref ? (
          <Button asChild variant="ghost" className="min-h-11 text-slate-200 hover:text-white">
            <Link to={importHref}><FileSpreadsheet className="w-4 h-4 mr-2" /> Import a spreadsheet</Link>
          </Button>
        ) : null}
      </div>
      <p className="order-last md:order-none text-xs text-slate-500 mt-3">Free covers up to 10 geckos. Breeders with a spreadsheet can import it as CSV.</p>
    </section>
  );
}
