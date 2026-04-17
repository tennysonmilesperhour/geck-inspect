/**
 * Small helper components used by the GeneticsGuide sections data
 * and the GeneticsGuide page itself.
 */

export function Callout({ items }) {
  return (
    <div className="bg-emerald-900/40 border border-emerald-600 rounded-lg p-4 my-4 space-y-1">
      {items.map((item, i) => (
        <p key={i} className="text-emerald-400 text-sm font-medium">{'\u2192'} {item}</p>
      ))}
    </div>
  );
}

export function Subsection({ title, children }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/60">
      <div className="px-4 py-3 border-b border-slate-800">
        <h3 className="text-emerald-300 font-semibold text-base flex items-center gap-2">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400" />
          {title}
        </h3>
      </div>
      <div className="px-4 py-3 space-y-2">
        {children}
      </div>
    </div>
  );
}

export function BulletList({ items }) {
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2 text-slate-300 text-sm leading-relaxed">
          <span className="text-emerald-500 mt-1 flex-shrink-0">{'\u2022'}</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
