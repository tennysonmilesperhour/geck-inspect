import { useId } from 'react';
import { CARD_TYPES, CARD_STAGES, RARITIES, BORDER_COLORS, FIELD_LIMITS, updateAttack } from '@/lib/store/customSticker';

export const INPUT_CLASS = 'w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400';

export function TextField({ label, hint, value, onChange, maxLength = 60, type = 'text', ...props }) {
  const id = useId();
  return <div><label htmlFor={id} className="block text-sm font-medium text-slate-200 mb-1.5">{label}</label><input id={id} className={INPUT_CLASS} value={value ?? ''} type={type} maxLength={maxLength} onChange={(e) => onChange(e.target.value)} aria-describedby={hint ? `${id}-hint` : undefined} {...props} />{hint && <p id={`${id}-hint`} className="mt-1 text-xs text-slate-500">{hint}</p>}</div>;
}

export function ChoiceField({ label, value, options, onChange }) {
  const id = useId();
  return <div><label htmlFor={id} className="block text-sm font-medium text-slate-200 mb-1.5">{label}</label><select id={id} className={INPUT_CLASS} value={value || ''} onChange={(e) => onChange(e.target.value)}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>;
}

export default function CardDetails({ design, onChange }) {
  return <div className="space-y-5">
    <div className="grid sm:grid-cols-2 gap-4">
      <TextField label="Power score" type="number" min={FIELD_LIMITS.hp_min} max={FIELD_LIMITS.hp_max} value={design.hp} onChange={(hp) => onChange({ hp })} />
      <ChoiceField label="Affinity" value={design.type} options={CARD_TYPES} onChange={(type) => onChange({ type })} />
      <ChoiceField label="Life stage" value={design.stage} options={CARD_STAGES} onChange={(stage) => onChange({ stage })} />
      <ChoiceField label="Border" value={design.border_color} options={BORDER_COLORS} onChange={(border_color) => onChange({ border_color })} />
    </div>
    <p className="text-xs text-slate-400">Make the moves personal. A favorite snack, a dramatic leap, or the talent for sleeping all day.</p>
    {(design.attacks || []).slice(0, 2).map((attack, index) => <fieldset key={index} className="rounded-lg border border-slate-800 p-3 space-y-3"><legend className="px-2 text-xs text-emerald-300">Signature move {index + 1}</legend>
      <div className="grid grid-cols-[1fr_85px] gap-3"><TextField label="Move name" maxLength={FIELD_LIMITS.attack_name} value={attack.name} onChange={(name) => onChange(updateAttack(design, index, { name }))} /><TextField label="Power" value={attack.damage} maxLength={FIELD_LIMITS.attack_damage} onChange={(damage) => onChange(updateAttack(design, index, { damage }))} /></div>
      <TextField label="Move description" maxLength={FIELD_LIMITS.attack_text} value={attack.text} onChange={(text) => onChange(updateAttack(design, index, { text }))} />
      <ChoiceField label="Move energy" value={String(attack.cost)} options={[0, 1, 2, 3, 4].map((value) => ({ value: String(value), label: `${value} ${value === 1 ? 'pip' : 'pips'}` }))} onChange={(cost) => onChange(updateAttack(design, index, { cost: Number(cost) }))} />
    </fieldset>)}
    <div className="grid sm:grid-cols-2 gap-4">
      <TextField label="Lineage note (optional)" value={design.evolves_from} maxLength={FIELD_LIMITS.evolves_from} onChange={(evolves_from) => onChange({ evolves_from })} />
      <ChoiceField label="Edition mark" value={design.rarity} options={RARITIES} onChange={(rarity) => onChange({ rarity })} />
      <TextField label="Collection code" value={design.set_code} maxLength={FIELD_LIMITS.set_code} onChange={(set_code) => onChange({ set_code })} />
      <TextField label="Card number" value={design.card_number} maxLength={FIELD_LIMITS.card_number} onChange={(card_number) => onChange({ card_number })} />
      <TextField label="Collection total" value={design.set_total} maxLength={FIELD_LIMITS.set_total} onChange={(set_total) => onChange({ set_total })} />
      <TextField label="Credit (optional)" value={design.illustrator} maxLength={FIELD_LIMITS.illustrator} onChange={(illustrator) => onChange({ illustrator })} />
    </div>
    <details className="rounded-lg border border-slate-800 p-3"><summary className="cursor-pointer text-sm text-slate-300">Matchups and specimen details</summary><div className="mt-4 grid sm:grid-cols-2 gap-3">
      <ChoiceField label="Challenge" value={design.weakness_type} options={[{ value: '', label: 'None' }, ...CARD_TYPES]} onChange={(weakness_type) => onChange({ weakness_type })} />
      <ChoiceField label="Challenge multiplier" value={design.weakness_multiplier} options={['×2', '×3'].map((value) => ({ value, label: value }))} onChange={(weakness_multiplier) => onChange({ weakness_multiplier })} />
      <ChoiceField label="Strength" value={design.resistance_type} options={[{ value: '', label: 'None' }, ...CARD_TYPES]} onChange={(resistance_type) => onChange({ resistance_type })} />
      <ChoiceField label="Strength amount" value={design.resistance_amount} options={['-20', '-30'].map((value) => ({ value, label: value }))} onChange={(resistance_amount) => onChange({ resistance_amount })} />
      <ChoiceField label="Rest cost" value={String(design.retreat_cost)} options={[0, 1, 2, 3, 4].map((value) => ({ value: String(value), label: String(value) }))} onChange={(retreat_cost) => onChange({ retreat_cost: Number(retreat_cost) })} />
      <TextField label="Specimen number" value={design.dex_number} maxLength={FIELD_LIMITS.dex_number} onChange={(dex_number) => onChange({ dex_number })} />
      <TextField label="Length" value={design.height} maxLength={FIELD_LIMITS.measurement} onChange={(height) => onChange({ height })} />
      <TextField label="Weight" value={design.weight} maxLength={FIELD_LIMITS.measurement} onChange={(weight) => onChange({ weight })} />
    </div></details>
  </div>;
}
