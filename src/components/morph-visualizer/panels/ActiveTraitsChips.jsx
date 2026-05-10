/**
 * Visible summary of what is "on" in the current selection ,  tag chips that
 * describe the phenotype at a glance.
 */

import { BASE_COLORS_BY_ID } from '../data/traits';
import { zygosityLabel } from '../data/genetics';

const CATEGORY_COLORS = {
  mendelian: 'bg-emerald-700 text-emerald-50 border-emerald-500',
  pattern:   'bg-blue-700 text-blue-50 border-blue-500',
  accent:    'bg-purple-700 text-purple-50 border-purple-500',
};

export default function ActiveTraitsChips({ phenotype, selections }) {
  const base = BASE_COLORS_BY_ID[phenotype.baseColorId];
  const chips = [];

  if (base) {
    chips.push({
      key: `base-${base.id}`,
      text: `${base.name} base`,
      className: 'bg-slate-700 text-slate-100 border-slate-500',
    });
  }

  phenotype.activeMorphs.forEach((m) => {
    let label = m.label;
    if (m.category === 'mendelian' && m.zygosity) {
      label = zygosityLabel(m.id, m.zygosity);
    } else if (m.category === 'pattern' && m.intensity) {
      const tier = ['Trace', 'Partial', 'Strong', 'Extreme'][m.intensity - 1];
      label = `${tier} ${m.label}`;
    }
    chips.push({
      key: `${m.category}-${m.id}`,
      text: label,
      className: CATEGORY_COLORS[m.category] || 'bg-slate-700 text-slate-100 border-slate-500',
    });
  });

  // Structural chips (only non-default)
  const s = phenotype.structural || {};
  if (s.crowned) chips.push({ key: 'crowned', text: 'Crowned', className: 'bg-amber-700 text-amber-50 border-amber-500' });
  if (s.furred)  chips.push({ key: 'furred', text: 'Furred', className: 'bg-amber-700 text-amber-50 border-amber-500' });
  if (s.tail === 'absent') chips.push({ key: 'tailless', text: 'Tailless', className: 'bg-slate-800 text-slate-400 border-slate-600' });

  // Environmental chips
  const env = selections.environmental || {};
  if (env.fire_state === 'fired_up')   chips.push({ key: 'fired_up', text: 'Fired Up', className: 'bg-orange-700 text-orange-50 border-orange-500' });
  if (env.fire_state === 'fired_down') chips.push({ key: 'fired_down', text: 'Fired Down', className: 'bg-sky-800 text-sky-100 border-sky-600' });
  if (env.shed_state === 'pre_shed')   chips.push({ key: 'pre_shed', text: 'Pre-shed', className: 'bg-slate-800 text-slate-300 border-slate-600' });
  if (env.age === 'juvenile')          chips.push({ key: 'juv', text: 'Juvenile', className: 'bg-teal-800 text-teal-100 border-teal-600' });

  return (
    <div className="flex flex-wrap gap-1.5">
      {chips.length === 0 ? (
        <span className="text-xs text-slate-500 italic">No traits selected</span>
      ) : (
        chips.map((c) => (
          <span key={c.key} className={`text-[11px] px-2 py-0.5 rounded border ${c.className}`}>
            {c.text}
          </span>
        ))
      )}
    </div>
  );
}
