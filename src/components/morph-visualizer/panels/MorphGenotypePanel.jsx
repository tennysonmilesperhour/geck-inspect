/**
 * Mendelian morph genotype picker. Each proven morph gets its own row with
 * a labelled zygosity selector (Absent / Het / Visual / Super), with
 * inheritance-appropriate options (recessive only offers het + visual;
 * incomplete dominant offers visual + super).
 */

import { MENDELIAN_MORPHS, GENETICS_TYPE, ZYGOSITY as Z } from '../data/traits';
import { zygosityOptions, zygosityLabel } from '../data/genetics';
import { Dna, AlertTriangle } from 'lucide-react';

const BAND_STYLES = {
  [Z.ABSENT]: 'bg-slate-800 text-slate-400 border-slate-700',
  [Z.HET]:    'bg-slate-700 text-slate-100 border-slate-500',
  [Z.VISUAL]: 'bg-emerald-700 text-white border-emerald-500',
  [Z.SUPER]:  'bg-amber-600 text-white border-amber-400',
};

export default function MorphGenotypePanel({ mendelian, onChange }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
        <Dna className="w-4 h-4 text-emerald-400" />
        Proven Morphs
        <span className="text-xs font-normal text-slate-500 ml-1">(Mendelian ,  set zygosity)</span>
      </h3>

      <div className="space-y-2">
        {MENDELIAN_MORPHS.map((m) => {
          const current = mendelian[m.id] || Z.ABSENT;
          const options = zygosityOptions(m.id);
          const isRec = m.genetics.type === GENETICS_TYPE.RECESSIVE;
          const superLethal = m.genetics.superLethal;

          return (
            <div key={m.id} className="bg-slate-900 border border-slate-700 rounded-md p-2.5">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium text-slate-100">{m.name}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 uppercase tracking-wide">
                    {isRec ? 'Recessive' : 'Incomp-Dom'}
                  </span>
                </div>
                {current === Z.SUPER && superLethal && (
                  <span className="flex items-center gap-1 text-[10px] text-red-400">
                    <AlertTriangle className="w-3 h-3" /> Lethal
                  </span>
                )}
              </div>

              <div className="flex gap-1.5 flex-wrap">
                {options.map((opt) => {
                  const label = opt === Z.ABSENT ? 'Not Carried' : zygosityLabel(m.id, opt);
                  return (
                    <button
                      key={opt}
                      onClick={() => onChange(m.id, opt)}
                      className={`px-2 py-1 text-xs rounded border transition ${
                        current === opt ? BAND_STYLES[opt] : 'bg-slate-800 text-slate-300 border-slate-700 hover:border-slate-500'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              {current !== Z.ABSENT && (
                <p className="mt-1.5 text-[11px] text-slate-400 leading-snug">{m.description}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
