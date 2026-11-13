import { useState } from 'react';
import { X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { SaveError, SaveTick } from './SaveStatus';

// The controls the Settings tabs are built from. Each one saves on its
// own through the page's useSettingsAutosave (`auto`): switches when they
// move, text when focus leaves the field or Enter is pressed. There is no
// Save button anywhere on the page (finding F5).

/**
 * A switch in a bordered row. Give it `auto` and `field` for a profile
 * field, or `checked`, `onCheckedChange` and `status` for a setting that
 * saves some other way (Keeper mode).
 */
export function SwitchSetting({ auto, field, id, label, description, checked, onCheckedChange, status, disabled }) {
  const on = auto ? auto.values[field] === true : checked === true;
  const state = auto ? auto.status[field] : status;
  const change = auto ? (next) => auto.commit(field, next) : onCheckedChange;
  return (
    <div className="p-4 border border-slate-700 rounded-lg bg-slate-800/50">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <Label id={`${id}-label`} htmlFor={id} className="font-medium text-slate-200">{label}</Label>
          {description && <p className="text-sm text-slate-400 mt-1">{description}</p>}
        </div>
        <div className="relative flex items-center gap-3 shrink-0">
          {/* Named by the label alone: the On/Off word beside it is also a
              label (a tap on it moves the switch) and would be read twice. */}
          <Switch id={id} aria-labelledby={`${id}-label`} checked={on} onCheckedChange={change} disabled={disabled} className="data-[state=checked]:bg-emerald-500" />
          <Label htmlFor={id} className={`font-semibold text-sm ${on ? 'text-emerald-400' : 'text-slate-500'}`}>
            {on ? 'On' : 'Off'}
          </Label>
          {/* Hung under the switch so the tick never reflows the row. */}
          <SaveTick status={state} className="absolute right-0 top-full mt-1.5" />
        </div>
      </div>
      <SaveError status={state} onRetry={auto ? () => auto.retry(field) : undefined} />
    </div>
  );
}

/**
 * A text field (or a textarea with `multiline`). Typing only changes
 * what is on screen; the save goes out when focus leaves the field, and
 * on Enter for a single-line field. `toDraft` turns the typed text into
 * the stored value (a number field, for example).
 */
export function TextSetting({ auto, field, id = field, label, labelAside, multiline = false, hint, toDraft, className, inputClassName, ...rest }) {
  const state = auto.status[field];
  const Control = multiline ? Textarea : Input;
  const value = auto.values[field];
  return (
    <div className={className}>
      <div className="flex min-h-5 items-center justify-between gap-2">
        <Label htmlFor={id} className="text-slate-300">{label}</Label>
        <span className="flex items-center gap-2">
          <SaveTick status={state} />
          {labelAside}
        </span>
      </div>
      <Control
        id={id}
        value={value === null || value === undefined || Number.isNaN(value) ? '' : value}
        onChange={(e) => auto.setDraft(field, toDraft ? toDraft(e.target.value) : e.target.value)}
        onBlur={() => auto.commit(field)}
        onKeyDown={multiline ? undefined : (e) => {
          if (e.key !== 'Enter') return;
          e.preventDefault();
          auto.commit(field);
        }}
        aria-invalid={state?.state === 'error' ? true : undefined}
        className={cn('mt-1.5 bg-slate-800 border-slate-600 text-slate-100', inputClassName)}
        {...rest}
      />
      {hint && <p className="text-xs text-slate-400 mt-1.5">{hint}</p>}
      <SaveError status={state} onRetry={() => auto.retry(field)} />
    </div>
  );
}

/**
 * A short list the member builds one item at a time (specialties, the
 * morphs they are looking for). Adding or removing an item saves the
 * whole list at once.
 */
export function ChipListSetting({ auto, field, id = field, label, icon: Icon, placeholder, hint, chipClassName, className }) {
  const [draft, setDraft] = useState('');
  const items = Array.isArray(auto.values[field]) ? auto.values[field] : [];
  const state = auto.status[field];

  const add = () => {
    const item = draft.trim();
    if (!item) return;
    setDraft('');
    if (!items.includes(item)) auto.commit(field, [...items, item]);
  };

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex min-h-5 items-center justify-between gap-2">
        <Label htmlFor={id} className="text-slate-300 flex items-center gap-2">
          {Icon && <Icon className="w-4 h-4" aria-hidden="true" />}
          {label}
        </Label>
        <SaveTick status={state} />
      </div>
      <Input
        id={id}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={placeholder}
        onKeyDown={(e) => {
          if (e.key !== 'Enter') return;
          e.preventDefault();
          add();
        }}
        // A typed item is added when focus leaves too, so it is never lost.
        onBlur={add}
        className="bg-slate-800 border-slate-600 text-slate-100"
      />
      {items.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {items.map((item) => (
            <Badge key={item} variant="secondary" className={cn('flex items-center gap-1 bg-slate-700 text-slate-200 border-slate-600', chipClassName)}>
              {item}
              <button
                type="button"
                onClick={() => auto.commit(field, items.filter((i) => i !== item))}
                aria-label={`Remove ${item}`}
                className="relative touch-hit"
              >
                <X className="w-3 h-3" aria-hidden="true" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
      <SaveError status={state} onRetry={() => auto.retry(field)} />
    </div>
  );
}
