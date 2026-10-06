import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { MORPHS, MORPH_CATEGORIES, INHERITANCE, RARITY } from '@/data/morph-guide';

/**
 * Every morph in one real <table>: name (linked), category, inheritance,
 * rarity and typical price. Plain table markup on purpose, because search
 * engines and AI answer engines lift rows straight out of tables.
 * Column headers sort the rows; the table scrolls sideways inside its own
 * box on a phone so the page itself never does.
 */

const CATEGORY_LABEL = Object.fromEntries(MORPH_CATEGORIES.map((c) => [c.id, c.label]));

// Lowest dollar figure in a range like "$1,200 to $3,500", for sorting.
function priceFloor(range) {
  const m = String(range || '').match(/\$\s?([\d,]+)/);
  return m ? Number(m[1].replace(/,/g, '')) : null;
}

// "$500 to $1,500 for line-bred near-white animals" reads badly in a
// cell, so keep only the dollar range itself.
function shortPrice(range) {
  const m = String(range || '').match(/\$[\d,]+(?:\s*to\s*\$[\d,]+\+?)?/);
  return m ? m[0] : null;
}

const COLUMNS = [
  { id: 'name', label: 'Morph', value: (m) => m.name },
  { id: 'category', label: 'Category', value: (m) => CATEGORY_LABEL[m.category] || '' },
  { id: 'inheritance', label: 'Inheritance', value: (m) => INHERITANCE[m.inheritance]?.label || '' },
  { id: 'rarity', label: 'Rarity', value: (m) => RARITY[m.rarity]?.order ?? 0 },
  { id: 'price', label: 'Typical price', value: (m) => priceFloor(m.priceRange) },
];

export default function MorphIndexCompareTable({ morphs = MORPHS }) {
  const [sort, setSort] = useState({ id: 'name', dir: 'asc' });

  const rows = useMemo(() => {
    const col = COLUMNS.find((c) => c.id === sort.id) || COLUMNS[0];
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...morphs].sort((a, b) => {
      const av = col.value(a);
      const bv = col.value(b);
      // Morphs with no price yet always sink to the bottom.
      if (av == null && bv == null) return a.name.localeCompare(b.name);
      if (av == null) return 1;
      if (bv == null) return -1;
      const diff = typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv));
      return diff * dir || a.name.localeCompare(b.name);
    });
  }, [morphs, sort]);

  const toggle = (id) =>
    setSort((s) => (s.id === id ? { id, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { id, dir: id === 'rarity' || id === 'price' ? 'desc' : 'asc' }));

  return (
    <section aria-labelledby="morph-table-heading" className="space-y-3">
      <div>
        <h2 id="morph-table-heading" className="text-xl md:text-2xl font-bold text-white">
          All crested gecko morphs compared
        </h2>
        <p className="mt-1 text-sm text-slate-400">
          {morphs.length} morphs side by side. Tap a column to sort. Prices are typical
          asking prices for healthy adults in USD.
        </p>
      </div>
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm text-left">
          <caption className="sr-only">
            Crested gecko morphs with category, inheritance, rarity and typical price
          </caption>
          <thead className="bg-slate-900 text-xs uppercase tracking-wider text-slate-400">
            <tr>
              {COLUMNS.map((c) => {
                const active = sort.id === c.id;
                const Icon = active ? (sort.dir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;
                return (
                  <th
                    key={c.id}
                    scope="col"
                    aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    className="px-3 py-2 font-semibold whitespace-nowrap"
                  >
                    <button
                      type="button"
                      onClick={() => toggle(c.id)}
                      className={`inline-flex items-center gap-1 min-h-9 hover:text-white ${active ? 'text-emerald-300' : ''}`}
                    >
                      {c.label}
                      <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {rows.map((m) => {
              const rarity = RARITY[m.rarity];
              const inh = INHERITANCE[m.inheritance];
              const price = shortPrice(m.priceRange);
              return (
                <tr key={m.slug} className="hover:bg-slate-800/40">
                  <th scope="row" className="px-3 py-2 font-semibold whitespace-nowrap">
                    <Link to={`/MorphGuide/${m.slug}`} className="text-emerald-300 hover:text-emerald-200 hover:underline">
                      {m.name}
                    </Link>
                  </th>
                  <td className="px-3 py-2 text-slate-300 whitespace-nowrap">{CATEGORY_LABEL[m.category] || 'Other'}</td>
                  <td className="px-3 py-2 text-slate-300 whitespace-nowrap">{inh?.label || 'Unknown'}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {rarity ? (
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${rarity.color}`}>
                        {rarity.label}
                      </span>
                    ) : (
                      <span className="text-slate-500">Unknown</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-slate-300 whitespace-nowrap">
                    {price || <span className="text-slate-500">No market price yet</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
