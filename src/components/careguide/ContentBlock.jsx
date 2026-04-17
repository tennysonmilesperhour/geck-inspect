import { AlertTriangle, Info, CheckCircle2, ShieldAlert } from 'lucide-react';

const CALLOUT_STYLES = {
  info: {
    wrap: 'border-sky-500/30 bg-sky-500/5',
    title: 'text-sky-300',
    Icon: Info,
    iconColor: 'text-sky-400',
  },
  warn: {
    wrap: 'border-amber-500/30 bg-amber-500/5',
    title: 'text-amber-300',
    Icon: AlertTriangle,
    iconColor: 'text-amber-400',
  },
  success: {
    wrap: 'border-emerald-500/30 bg-emerald-500/5',
    title: 'text-emerald-300',
    Icon: CheckCircle2,
    iconColor: 'text-emerald-400',
  },
  danger: {
    wrap: 'border-rose-500/30 bg-rose-500/5',
    title: 'text-rose-300',
    Icon: ShieldAlert,
    iconColor: 'text-rose-400',
  },
};

function Callout({ tone = 'info', title, items }) {
  const style = CALLOUT_STYLES[tone] || CALLOUT_STYLES.info;
  const Icon = style.Icon;
  return (
    <div className={`rounded-xl border p-4 md:p-5 ${style.wrap}`}>
      {title && (
        <div className={`flex items-center gap-2 text-sm font-semibold mb-2 ${style.title}`}>
          <Icon className={`w-4 h-4 ${style.iconColor}`} />
          {title}
        </div>
      )}
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-slate-200 leading-relaxed">
            {!title && <Icon className={`w-4 h-4 mt-1 flex-shrink-0 ${style.iconColor}`} />}
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DataTable({ headers, rows, caption }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden">
      {caption && (
        <div className="px-4 py-2 bg-slate-900 text-xs uppercase tracking-wider text-slate-400 border-b border-slate-800">
          {caption}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-900/80 border-b border-slate-800">
              {headers.map((h, i) => (
                <th
                  key={i}
                  className="text-left font-semibold text-slate-200 px-4 py-2.5 whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr
                key={ri}
                className="border-b border-slate-800/60 last:border-0 hover:bg-slate-800/30"
              >
                {row.map((cell, ci) => (
                  <td
                    key={ci}
                    className="px-4 py-2.5 text-slate-300 leading-relaxed align-top"
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DefinitionList({ items }) {
  return (
    <dl className="divide-y divide-slate-800 rounded-xl border border-slate-800 bg-slate-900/30 overflow-hidden">
      {items.map((item, i) => (
        <div key={i} className="px-4 py-3 md:grid md:grid-cols-[180px_1fr] md:gap-5">
          <dt className="font-semibold text-emerald-300 text-sm md:text-base mb-1 md:mb-0">
            {item.term}
          </dt>
          <dd className="text-slate-300 leading-relaxed">{item.def}</dd>
        </div>
      ))}
    </dl>
  );
}

function KeyValueList({ items }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {items.map((item, i) => (
        <div
          key={i}
          className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2"
        >
          <span className="text-xs text-slate-400">{item.label}</span>
          <span className="text-sm font-semibold text-slate-100 text-right">
            {item.value}
          </span>
          {item.note && (
            <span className="text-xs text-slate-500 italic">{item.note}</span>
          )}
        </div>
      ))}
    </div>
  );
}

export default function ContentBlock({ block }) {
  if (!block) return null;
  switch (block.type) {
    case 'p':
      return (
        <p className="text-slate-300 leading-relaxed text-[15px] md:text-base">
          {block.text}
        </p>
      );
    case 'ul':
      return (
        <ul className="space-y-2">
          {block.items.map((item, i) => (
            <li
              key={i}
              className="flex items-start gap-2.5 text-slate-300 leading-relaxed"
            >
              <span className="mt-2 w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      );
    case 'ol':
      return (
        <ol className="space-y-3">
          {block.items.map((item, i) => (
            <li
              key={i}
              className="flex items-start gap-3 text-slate-300 leading-relaxed"
            >
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-600/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center justify-center mt-0.5">
                {i + 1}
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ol>
      );
    case 'dl':
      return <DefinitionList items={block.items} />;
    case 'callout':
      return <Callout tone={block.tone} title={block.title} items={block.items} />;
    case 'table':
      return (
        <DataTable
          headers={block.headers}
          rows={block.rows}
          caption={block.caption}
        />
      );
    case 'kv':
      return <KeyValueList items={block.items} />;
    default:
      return null;
  }
}
