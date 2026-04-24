import { Fragment } from 'react';
import { AlertTriangle, Info, CheckCircle2, ShieldAlert, X, Check } from 'lucide-react';

const TONE_STYLES = {
  neutral: {
    card: 'border-slate-800 bg-slate-900/50',
    heading: 'text-slate-100',
    meta: 'text-slate-500',
  },
  fern: {
    card: 'border-emerald-600/30 bg-emerald-950/30',
    heading: 'text-emerald-200',
    meta: 'text-emerald-300/70',
  },
  moss: {
    card: 'border-emerald-500/25 bg-emerald-900/20',
    heading: 'text-emerald-100',
    meta: 'text-emerald-300/70',
  },
  amber: {
    card: 'border-amber-500/30 bg-amber-950/20',
    heading: 'text-amber-200',
    meta: 'text-amber-300/70',
  },
  coral: {
    card: 'border-orange-500/30 bg-orange-950/20',
    heading: 'text-orange-200',
    meta: 'text-orange-300/70',
  },
  ruby: {
    card: 'border-rose-600/30 bg-rose-950/30',
    heading: 'text-rose-200',
    meta: 'text-rose-300/70',
  },
  cream: {
    card: 'border-stone-300/20 bg-stone-100/5',
    heading: 'text-stone-100',
    meta: 'text-stone-400',
  },
};

const CALLOUT_ICONS = {
  info: { Icon: Info, color: 'text-sky-300', wrap: 'border-sky-500/30 bg-sky-500/5' },
  warn: { Icon: AlertTriangle, color: 'text-amber-300', wrap: 'border-amber-500/30 bg-amber-500/5' },
  success: { Icon: CheckCircle2, color: 'text-emerald-300', wrap: 'border-emerald-500/30 bg-emerald-500/5' },
  danger: { Icon: ShieldAlert, color: 'text-rose-300', wrap: 'border-rose-500/30 bg-rose-500/5' },
};

function Kicker({ children }) {
  if (!children) return null;
  return (
    <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-400/80 mb-2">
      {children}
    </div>
  );
}

function SlideTitle({ children }) {
  return (
    <h3 className="font-serif text-2xl md:text-4xl font-bold leading-tight text-slate-50 mb-3">
      {children}
    </h3>
  );
}

function Lead({ children }) {
  if (!children) return null;
  return (
    <p className="text-base md:text-lg text-slate-300 leading-relaxed mb-6 max-w-3xl">
      {children}
    </p>
  );
}

function Prose({ text }) {
  return (
    <p className="text-slate-300 leading-relaxed text-[15px] md:text-base">{text}</p>
  );
}

function Cards({ cols = 3, items, tone }) {
  const gridCols = cols === 2 ? 'md:grid-cols-2' : cols === 4 ? 'md:grid-cols-2 lg:grid-cols-4' : 'md:grid-cols-3';
  return (
    <div className={`grid grid-cols-1 ${gridCols} gap-3 md:gap-4`}>
      {items.map((item, i) => {
        const t = TONE_STYLES[item.tone || tone || 'neutral'];
        return (
          <div key={i} className={`rounded-xl border p-4 md:p-5 ${t.card}`}>
            {item.meta && (
              <div className={`text-[10px] font-bold uppercase tracking-widest mb-2 ${t.meta}`}>
                {item.meta}
              </div>
            )}
            {item.title && (
              <div className={`font-serif text-lg font-semibold mb-2 ${t.heading}`}>
                {item.title}
              </div>
            )}
            {item.text && (
              <p className="text-sm text-slate-300 leading-relaxed">{item.text}</p>
            )}
            {item.items && (
              <ul className="mt-2 space-y-1.5">
                {item.items.map((li, j) => (
                  <li key={j} className="flex items-start gap-2 text-sm text-slate-300 leading-relaxed">
                    <span className="mt-1.5 w-1 h-1 rounded-full bg-emerald-400 flex-shrink-0" />
                    <span>{li}</span>
                  </li>
                ))}
              </ul>
            )}
            {item.footer && (
              <div className={`mt-3 pt-3 border-t border-slate-800/60 text-xs ${t.meta}`}>
                {item.footer}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Steps({ items }) {
  return (
    <ol className="space-y-3">
      {items.map((step, i) => (
        <li key={i} className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 flex gap-4">
          <span className="flex-shrink-0 w-9 h-9 rounded-full bg-emerald-600/20 border border-emerald-500/40 text-emerald-300 text-sm font-bold flex items-center justify-center">
            {step.number || String(i + 1).padStart(2, '0')}
          </span>
          <div className="min-w-0 flex-1">
            {step.title && (
              <div className="font-semibold text-slate-100 mb-1">{step.title}</div>
            )}
            {step.text && (
              <div className="text-sm text-slate-300 leading-relaxed">{step.text}</div>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

const LADDER_TONE_BARS = {
  fern: 'border-l-emerald-500',
  moss: 'border-l-emerald-400',
  amber: 'border-l-amber-500',
  coral: 'border-l-orange-500',
  ruby: 'border-l-rose-600',
  neutral: 'border-l-slate-600',
};

function Ladder({ items }) {
  return (
    <div className="space-y-2">
      {items.map((rung, i) => {
        const bar = LADDER_TONE_BARS[rung.tone || 'neutral'];
        return (
          <div
            key={i}
            className={`rounded-lg border border-slate-800 bg-slate-900/40 border-l-4 ${bar} p-4 md:grid md:grid-cols-[140px_1fr] md:gap-5`}
          >
            {rung.badge && (
              <div className="text-lg md:text-xl font-bold font-serif text-slate-100 mb-1 md:mb-0">
                {rung.badge}
              </div>
            )}
            <div>
              {rung.title && (
                <div className="font-semibold text-slate-100 mb-0.5">{rung.title}</div>
              )}
              {rung.text && (
                <div className="text-sm text-slate-300 leading-relaxed">{rung.text}</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Checklist({ items, variant = 'check' }) {
  return (
    <ul className="space-y-2">
      {items.map((item, i) => {
        const xMode = variant === 'x' || item.variant === 'x';
        const Icon = xMode ? X : Check;
        const color = xMode ? 'text-rose-400 border-rose-500/40 bg-rose-500/10' : 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10';
        const text = typeof item === 'string' ? item : item.text;
        return (
          <li key={i} className="flex items-start gap-3 text-slate-300 leading-relaxed">
            <span className={`mt-0.5 flex-shrink-0 w-6 h-6 rounded-md border flex items-center justify-center ${color}`}>
              <Icon className="w-3.5 h-3.5" />
            </span>
            <span>{text}</span>
          </li>
        );
      })}
    </ul>
  );
}

function Compare({ columns }) {
  return (
    <div className={`grid grid-cols-1 ${columns.length === 3 ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-4`}>
      {columns.map((col, i) => {
        const t = TONE_STYLES[col.tone || 'neutral'];
        return (
          <div key={i} className={`rounded-xl border p-4 md:p-5 ${t.card}`}>
            {col.heading && (
              <div className={`font-serif text-lg font-bold mb-3 ${t.heading}`}>
                {col.heading}
              </div>
            )}
            {col.items && (
              <ul className="space-y-2">
                {col.items.map((item, j) => (
                  <li key={j} className="flex items-start gap-2 text-sm text-slate-300 leading-relaxed">
                    <span className={`mt-1 w-1.5 h-1.5 rounded-full ${col.tone === 'ruby' || col.tone === 'coral' || col.tone === 'amber' ? 'bg-rose-400' : 'bg-emerald-400'} flex-shrink-0`} />
                    <span>{typeof item === 'string' ? item : (<><span className="font-semibold text-slate-200">{item.title}</span>{item.text ? ` – ${item.text}` : ''}</>)}</span>
                  </li>
                ))}
              </ul>
            )}
            {col.text && (
              <p className="text-sm text-slate-300 leading-relaxed">{col.text}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function StatRow({ items }) {
  return (
    <div className={`grid grid-cols-2 ${items.length >= 3 ? 'md:grid-cols-3' : ''} ${items.length >= 4 ? 'lg:grid-cols-4' : ''} gap-3`}>
      {items.map((stat, i) => (
        <div key={i} className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
          <div className="font-serif text-2xl md:text-3xl font-bold text-emerald-300">{stat.value}</div>
          <div className="text-xs uppercase tracking-wider text-slate-400 mt-1">{stat.label}</div>
          {stat.note && <div className="text-xs text-slate-500 mt-1">{stat.note}</div>}
        </div>
      ))}
    </div>
  );
}

function Timeline({ items }) {
  return (
    <ol className="space-y-2">
      {items.map((stage, i) => (
        <li key={i} className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 md:grid md:grid-cols-[140px_180px_1fr] md:gap-4 md:items-baseline">
          <div className="text-sm font-bold text-emerald-300 font-serif mb-1 md:mb-0">{stage.when}</div>
          {stage.label && (
            <div className="text-sm font-semibold text-slate-100 mb-1 md:mb-0">{stage.label}</div>
          )}
          <div className="text-sm text-slate-300 leading-relaxed">{stage.text}</div>
        </li>
      ))}
    </ol>
  );
}

function KVTable({ rows }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden">
      {rows.map((row, i) => (
        <div key={i} className="grid grid-cols-[1fr_auto] gap-4 px-4 py-3 border-b border-slate-800/60 last:border-0">
          <div className="text-sm text-slate-300">{row.label}</div>
          <div className="text-sm font-semibold text-emerald-300">{row.value}</div>
        </div>
      ))}
    </div>
  );
}

function DataTable({ headers, rows }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-x-auto">
      <table className="w-full text-sm">
        {headers && (
          <thead>
            <tr className="bg-slate-900/80 border-b border-slate-800">
              {headers.map((h, i) => (
                <th key={i} className="text-left font-semibold text-slate-200 px-4 py-2.5 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className="border-b border-slate-800/60 last:border-0">
              {row.map((cell, ci) => (
                <td key={ci} className="px-4 py-2.5 text-slate-300 leading-relaxed align-top">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Callout({ tone = 'info', title, text, items }) {
  const style = CALLOUT_ICONS[tone] || CALLOUT_ICONS.info;
  const { Icon } = style;
  return (
    <div className={`rounded-xl border p-4 md:p-5 ${style.wrap}`}>
      <div className={`flex items-start gap-2 ${style.color}`}>
        <Icon className={`w-4 h-4 mt-1 flex-shrink-0`} />
        <div className="flex-1">
          {title && <div className="font-bold text-sm mb-1">{title}</div>}
          {text && <p className="text-slate-200 leading-relaxed text-sm">{text}</p>}
          {items && (
            <ul className="space-y-1 mt-1">
              {items.map((it, i) => (
                <li key={i} className="text-sm text-slate-200 leading-relaxed">• {it}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function Punnett({ title, parents, cells, outcome }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 md:p-5">
      {title && <div className="font-serif text-base font-bold text-slate-100 mb-3">{title}</div>}
      <div className="inline-grid grid-cols-[auto_auto_auto] gap-0.5 bg-slate-800 p-0.5 rounded-lg">
        <div />
        {parents[1].map((p, i) => (
          <div key={`h-${i}`} className="w-14 h-10 flex items-center justify-center font-mono font-bold text-emerald-300 bg-slate-900">{p}</div>
        ))}
        {parents[0].map((p, i) => (
          <Fragment key={`row-${i}`}>
            <div className="w-14 h-14 flex items-center justify-center font-mono font-bold text-emerald-300 bg-slate-900">{p}</div>
            {cells[i].map((cell, j) => {
              const toneMap = {
                normal: 'bg-slate-800 text-slate-300',
                het: 'bg-amber-900/40 text-amber-200',
                visual: 'bg-emerald-800/50 text-emerald-200',
                super: 'bg-rose-900/50 text-rose-200',
                lw: 'bg-sky-900/40 text-sky-200',
              };
              return (
                <div key={`c-${i}-${j}`} className={`w-14 h-14 flex flex-col items-center justify-center font-mono font-bold rounded ${toneMap[cell.kind] || 'bg-slate-800 text-slate-300'}`}>
                  <span>{cell.text}</span>
                  {cell.sub && <span className="text-[9px] font-sans font-bold uppercase tracking-widest">{cell.sub}</span>}
                </div>
              );
            })}
          </Fragment>
        ))}
      </div>
      {outcome && (
        <div className="mt-3 text-sm text-slate-300">
          <div className="text-xs uppercase tracking-wider text-slate-500 mb-1">Expected outcome</div>
          {outcome}
        </div>
      )}
    </div>
  );
}

function Tree({ root, branches }) {
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/30 p-4 text-center font-serif text-lg text-emerald-100 font-semibold">
        {root}
      </div>
      <div className="space-y-2 pl-4 md:pl-8 border-l-2 border-slate-800">
        {branches.map((branch, i) => {
          const toneMap = {
            success: 'border-emerald-500/40 bg-emerald-950/30 text-emerald-200',
            waiting: 'border-amber-500/40 bg-amber-950/30 text-amber-200',
            action: 'border-orange-500/40 bg-orange-950/30 text-orange-200',
            emergency: 'border-rose-500/40 bg-rose-950/40 text-rose-200',
            neutral: 'border-slate-700 bg-slate-900/40 text-slate-200',
          };
          return (
            <div key={i} className={`rounded-lg border p-3 ${toneMap[branch.tone || 'neutral']}`}>
              {branch.condition && (
                <div className="text-xs uppercase tracking-wider opacity-80 mb-1">{branch.condition}</div>
              )}
              <div className="font-semibold text-sm">{branch.text}</div>
              {branch.detail && <div className="text-xs opacity-80 mt-1">{branch.detail}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Principle({ text }) {
  return (
    <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/40 to-slate-900/60 p-8 md:p-12 text-center">
      <p className="font-serif text-2xl md:text-4xl font-bold leading-tight text-transparent bg-clip-text bg-gradient-to-b from-white to-emerald-200 max-w-3xl mx-auto">
        {text}
      </p>
    </div>
  );
}

function Divider() {
  return <div className="h-px bg-slate-800/60" />;
}

function Block({ block }) {
  switch (block.type) {
    case 'p':
    case 'prose':
      return <Prose text={block.text} />;
    case 'cards':
      return <Cards cols={block.cols} items={block.items} tone={block.tone} />;
    case 'steps':
      return <Steps items={block.items} />;
    case 'ladder':
      return <Ladder items={block.items} />;
    case 'checklist':
      return <Checklist items={block.items} variant={block.variant} />;
    case 'compare':
      return <Compare columns={block.columns} />;
    case 'stats':
      return <StatRow items={block.items} />;
    case 'timeline':
      return <Timeline items={block.items} />;
    case 'kv':
      return <KVTable rows={block.rows} />;
    case 'table':
      return <DataTable headers={block.headers} rows={block.rows} />;
    case 'callout':
      return <Callout tone={block.tone} title={block.title} text={block.text} items={block.items} />;
    case 'punnett':
      return <Punnett title={block.title} parents={block.parents} cells={block.cells} outcome={block.outcome} />;
    case 'tree':
      return <Tree root={block.root} branches={block.branches} />;
    case 'principle':
      return <Principle text={block.text} />;
    case 'divider':
      return <Divider />;
    case 'heading':
      return <div className="font-serif text-xl md:text-2xl font-bold text-slate-100 pt-2">{block.text}</div>;
    default:
      return null;
  }
}

export default function GuideSlide({ slide, number, total }) {
  if (!slide) return null;

  if (slide.layout === 'hero') {
    return (
      <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-950/50 via-slate-900 to-slate-950 p-8 md:p-14">
        <div className="text-[11px] font-bold uppercase tracking-[0.3em] text-emerald-400/80 mb-6">
          {slide.kicker}
        </div>
        <h3 className="font-serif text-4xl md:text-6xl font-bold tracking-tight leading-[1.05] mb-6 bg-gradient-to-b from-white to-emerald-200 bg-clip-text text-transparent">
          {slide.title}
        </h3>
        {slide.lead && (
          <p className="text-lg md:text-xl text-slate-300 leading-relaxed max-w-3xl mb-8">
            {slide.lead}
          </p>
        )}
        {slide.tags && slide.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {slide.tags.map((tag, i) => (
              <span
                key={i}
                className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-emerald-300"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (slide.layout === 'closing') {
    return (
      <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-950/50 via-slate-900 to-slate-950 p-8 md:p-14 text-center">
        {slide.kicker && <Kicker>{slide.kicker}</Kicker>}
        <h3 className="font-serif text-3xl md:text-5xl font-bold tracking-tight leading-tight mb-6 bg-gradient-to-b from-white to-emerald-200 bg-clip-text text-transparent max-w-3xl mx-auto">
          {slide.title}
        </h3>
        {slide.lead && (
          <p className="text-base md:text-lg text-slate-300 leading-relaxed max-w-2xl mx-auto">
            {slide.lead}
          </p>
        )}
        {slide.blocks && (
          <div className="mt-8 space-y-4 text-left max-w-2xl mx-auto">
            {slide.blocks.map((block, i) => (
              <Block key={i} block={block} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 md:p-8">
      {(number != null && total != null) && (
        <div className="flex items-center justify-between mb-4 text-[10px] uppercase tracking-[0.2em] text-slate-500">
          <span>Slide {number} of {total}</span>
        </div>
      )}
      <Kicker>{slide.kicker}</Kicker>
      <SlideTitle>{slide.title}</SlideTitle>
      {slide.lead && <Lead>{slide.lead}</Lead>}
      {slide.blocks && (
        <div className="space-y-5">
          {slide.blocks.map((block, i) => (
            <Block key={i} block={block} />
          ))}
        </div>
      )}
      {slide.footer && (
        <div className="mt-6 pt-4 border-t border-slate-800/60 text-sm text-emerald-300 font-semibold">
          {slide.footer}
        </div>
      )}
    </div>
  );
}
