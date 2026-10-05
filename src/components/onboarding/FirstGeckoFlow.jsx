import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, CheckCircle2, GitBranch, Loader2, Scale, Sparkles, Utensils, PlusCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import { FeedingGroup, Gecko, WeightRecord } from '@/entities/all';
import MarketValueCard from '@/components/gecko/MarketValueCard';
import { todayLocalISO } from '@/lib/dateUtils';
import {
  DEFAULT_FEEDING_INTERVAL_DAYS,
  careSchedule,
  flowEvent,
  friendlyDay,
  weighInIntervalDays,
} from '@/lib/firstGeckoFlow';
import { ensureDefaultWeighInReminder, setGeckoWeighInReminder } from '@/lib/careReminders';

/**
 * Steps 2 and 3 of the guided first gecko (step 1 is QuickAddGecko).
 *
 *   2. Parents: sire and dam by name, or picked from the collection.
 *      Names are enough (they show on the record and the family tree as
 *      placeholders); nothing here adds a gecko, so the Free plan's
 *      10-gecko limit is never touched.
 *   3. Payoff: the gecko's family card, what it needs next (first or next
 *      weigh-in, feeding schedule) with its reminders on by default and a
 *      visible switch for each, and its value estimate.
 *
 * Props: open, gecko (just saved), user, allGeckos, onClose(),
 * onOpenRecord(gecko), onAddAnother(), onUpdated(gecko), startStep.
 */
export default function FirstGeckoFlow({ open, gecko: savedGecko, user, allGeckos = [], onClose, onOpenRecord, onAddAnother, onUpdated, startStep = 'parents' }) {
  const { toast } = useToast();
  const [step, setStep] = useState(startStep);
  const [gecko, setGecko] = useState(savedGecko);
  const today = todayLocalISO();

  useEffect(() => { setGecko(savedGecko); }, [savedGecko]);
  useEffect(() => { if (open) flowEvent(step, 'shown'); }, [open, step]);

  // Weigh-in reminder: on by default from the moment the gecko exists,
  // unless the member turned weigh-in reminders off in Settings.
  const everyDays = weighInIntervalDays(gecko);
  const [weighIn, setWeighIn] = useState({ status: 'loading', on: false, memberEnabled: true });
  useEffect(() => {
    if (!open || !gecko?.id || !user?.email) return undefined;
    let cancelled = false;
    ensureDefaultWeighInReminder(user.email, gecko.id, { everyDays, since: today })
      .then((r) => { if (!cancelled) setWeighIn({ status: 'ready', on: Boolean(r?.on), memberEnabled: r?.memberEnabled !== false }); })
      .catch(() => { if (!cancelled) setWeighIn({ status: 'error', on: false, memberEnabled: true }); });
    return () => { cancelled = true; };
    // Once per gecko.
  }, [open, gecko?.id, user?.email]);

  // Feeding group the quick add put the gecko in (feeding reminders on).
  const [group, setGroup] = useState(null);
  useEffect(() => {
    if (!open || !gecko?.feeding_group_id) { setGroup(null); return undefined; }
    let cancelled = false;
    FeedingGroup.get(gecko.feeding_group_id)
      .then((g) => { if (!cancelled) setGroup(g || null); })
      .catch(() => { if (!cancelled) setGroup(null); });
    return () => { cancelled = true; };
  }, [open, gecko?.feeding_group_id]);

  const [lastWeighDate, setLastWeighDate] = useState(() => (savedGecko?.weight_grams != null ? today : null));
  const schedule = careSchedule({ gecko, lastWeighDate, group, today });
  const name = gecko?.name || 'your gecko';

  // ---- Step 2: parents ----
  const candidates = useMemo(
    () => allGeckos.filter((g) => g && g.id !== gecko?.id && !g.archived),
    [allGeckos, gecko?.id],
  );
  const sires = candidates.filter((g) => g.sex !== 'Female');
  const dams = candidates.filter((g) => g.sex !== 'Male');
  const [sireId, setSireId] = useState('');
  const [damId, setDamId] = useState('');
  const [sireName, setSireName] = useState('');
  const [damName, setDamName] = useState('');
  const [savingParents, setSavingParents] = useState(false);

  const saveParents = async () => {
    const patch = {
      sire_id: sireId || null,
      dam_id: damId || null,
      sire_name: sireId ? null : (sireName.trim() || null),
      dam_name: damId ? null : (damName.trim() || null),
    };
    const any = patch.sire_id || patch.dam_id || patch.sire_name || patch.dam_name;
    if (!any) { skipParents(); return; }
    setSavingParents(true);
    try {
      const updated = await Gecko.update(gecko.id, patch);
      const next = { ...gecko, ...patch, ...(updated || {}) };
      setGecko(next);
      onUpdated?.(next);
      flowEvent('parents', 'saved', {
        sire: patch.sire_id ? 'picked' : patch.sire_name ? 'named' : 'none',
        dam: patch.dam_id ? 'picked' : patch.dam_name ? 'named' : 'none',
      });
      window.dispatchEvent(new CustomEvent('geckos_changed', { detail: { action: 'updated' } }));
      setStep('payoff');
    } catch (err) {
      toast({ title: 'Parents could not be saved', description: err.message || 'Try again, or skip this step.', variant: 'destructive' });
    }
    setSavingParents(false);
  };
  const skipParents = () => {
    flowEvent('parents', 'skipped');
    setStep('payoff');
  };

  // ---- Step 3: payoff ----
  const [weightInput, setWeightInput] = useState('');
  const [savingWeight, setSavingWeight] = useState(false);
  const logWeight = async () => {
    const grams = Number(weightInput);
    if (!weightInput || !Number.isFinite(grams) || grams <= 0) {
      toast({ title: 'Check the weight', description: 'Enter grams as a number, for example 18.' });
      return;
    }
    setSavingWeight(true);
    try {
      await WeightRecord.create({ gecko_id: gecko.id, weight_grams: grams, record_date: today });
      // Keep the stored weight in step with the latest weigh-in, so cards
      // and Field Mode show the same number.
      await Gecko.update(gecko.id, { weight_grams: grams }).catch(() => null);
      const next = { ...gecko, weight_grams: grams };
      setGecko(next);
      onUpdated?.(next);
      setLastWeighDate(today);
      flowEvent('payoff', 'weight_logged');
    } catch (err) {
      toast({ title: 'Weight could not be saved', description: err.message || 'Please try again.', variant: 'destructive' });
    }
    setSavingWeight(false);
  };

  const toggleWeighIn = async (on) => {
    const before = weighIn;
    setWeighIn({ ...weighIn, on });
    try {
      await setGeckoWeighInReminder(user.email, gecko.id, { on, everyDays, since: lastWeighDate || today });
      flowEvent('payoff', on ? 'reminder_on' : 'reminder_off', { reminder: 'weigh_in' });
    } catch (err) {
      setWeighIn(before);
      toast({ title: 'Could not change the reminder', description: err.message, variant: 'destructive' });
    }
  };

  const [savingFeeding, setSavingFeeding] = useState(false);
  const feedingOn = Boolean(gecko?.feeding_group_id) && group?.feeding_reminder_enabled !== false;
  const toggleFeeding = async (on) => {
    setSavingFeeding(true);
    try {
      if (on) {
        let target = group;
        if (!target) {
          const groups = await FeedingGroup.filter({ created_by: user.email }).catch(() => []);
          target = groups[0] || await FeedingGroup.create({
            label: 'A',
            name: 'My geckos',
            diet_type: 'CGD',
            interval_days: DEFAULT_FEEDING_INTERVAL_DAYS,
            last_fed_date: today,
            feeding_reminder_enabled: true,
          });
        }
        if (target.feeding_reminder_enabled === false) {
          target = { ...target, ...(await FeedingGroup.update(target.id, { feeding_reminder_enabled: true })) };
        }
        await Gecko.update(gecko.id, { feeding_group_id: target.id });
        setGroup(target);
        const next = { ...gecko, feeding_group_id: target.id };
        setGecko(next);
        onUpdated?.(next);
      } else {
        // Off for this gecko only: it leaves the feeding group, so other
        // geckos in the group keep their reminders.
        await Gecko.update(gecko.id, { feeding_group_id: null });
        const next = { ...gecko, feeding_group_id: null };
        setGecko(next);
        setGroup(null);
        onUpdated?.(next);
      }
      flowEvent('payoff', on ? 'reminder_on' : 'reminder_off', { reminder: 'feeding' });
    } catch (err) {
      toast({ title: 'Could not change the reminder', description: err.message, variant: 'destructive' });
    }
    setSavingFeeding(false);
  };

  if (!gecko) return null;

  const sireLabel = allGeckos.find((g) => g.id === gecko.sire_id)?.name || gecko.sire_name || null;
  const damLabel = allGeckos.find((g) => g.id === gecko.dam_id)?.name || gecko.dam_name || null;
  const feedingAccountOff = user?.feeding_alerts_enabled === false;

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) { flowEvent(step, 'closed'); onClose?.(); } }}>
      <DialogContent data-scroll className="w-[95vw] max-w-md max-h-[90svh] overflow-y-auto bg-slate-900 border-slate-700">
        {step === 'parents' ? (
          <div className="space-y-4">
            <div>
              <p className="text-[11px] uppercase tracking-wider font-semibold text-emerald-300">Step 2 of 3</p>
              <DialogTitle className="text-xl text-slate-100">Do you know {name}&rsquo;s parents?</DialogTitle>
              <DialogDescription className="text-slate-400 mt-1">
                Names from the breeder are enough, for example a sire called Spud and a dam called Harley.
                They start {name}&rsquo;s family tree. Skip if you don&rsquo;t know them.
              </DialogDescription>
            </div>
            <ParentField
              id="fg-sire"
              label="Sire (father)"
              options={sires}
              pickedId={sireId}
              onPick={setSireId}
              typed={sireName}
              onType={setSireName}
              placeholder="e.g. Spud"
            />
            <ParentField
              id="fg-dam"
              label="Dam (mother)"
              options={dams}
              pickedId={damId}
              onPick={setDamId}
              typed={damName}
              onType={setDamName}
              placeholder="e.g. Harley"
            />
            <div className="flex flex-col-reverse sm:flex-row gap-2 pt-1">
              <Button variant="ghost" className="min-h-11 text-slate-300" disabled={savingParents} onClick={skipParents}>
                Skip, I don&rsquo;t know them
              </Button>
              <Button className="min-h-11 flex-1" disabled={savingParents} onClick={saveParents}>
                {savingParents ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</> : 'Save parents'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <p className="text-[11px] uppercase tracking-wider font-semibold text-emerald-300">Step 3 of 3</p>
              <DialogTitle className="text-xl text-slate-100 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" /> {name} is set up
              </DialogTitle>
              <DialogDescription className="text-slate-400 mt-1">
                Here is {name}&rsquo;s family so far, what comes next, and what {gecko.sex === 'Female' ? 'she' : gecko.sex === 'Male' ? 'he' : 'it'} is worth.
              </DialogDescription>
            </div>

            {/* Family card */}
            <section className="rounded-xl border border-slate-700 bg-slate-800/40 p-3" aria-label={`${name}'s family`}>
              <div className="grid grid-cols-2 gap-2">
                <ParentBox role="Sire" name={sireLabel} tone="sky" />
                <ParentBox role="Dam" name={damLabel} tone="pink" />
              </div>
              <div className="flex justify-center py-1 text-slate-600" aria-hidden="true">
                <GitBranch className="w-4 h-4 rotate-180" />
              </div>
              <div className="rounded-lg border border-emerald-500/50 bg-emerald-950/30 px-3 py-2 text-center">
                <p className="font-semibold text-slate-100 truncate">{name}</p>
                <p className="text-[11px] text-slate-400 truncate">{[gecko.sex === 'Unsexed' ? 'Not sexed yet' : gecko.sex, gecko.morphs_traits].filter(Boolean).join(', ')}</p>
              </div>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                <Link to={`/Lineage?geckoId=${encodeURIComponent(gecko.id)}`} onClick={() => flowEvent('payoff', 'open_lineage')} className="touch:min-h-11 inline-flex items-center text-emerald-300 hover:text-emerald-200">
                  Open the family tree
                </Link>
                {!sireLabel && !damLabel && (
                  <button type="button" onClick={() => setStep('parents')} className="touch:min-h-11 text-slate-400 hover:text-slate-200 underline underline-offset-4">
                    Add parents
                  </button>
                )}
              </div>
            </section>

            {/* What it needs next */}
            <section className="space-y-2" aria-label="What comes next">
              <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-1.5"><Bell className="w-4 h-4 text-emerald-400" /> What {name} needs next</h3>

              <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-3 space-y-2">
                <div className="flex items-start gap-2.5">
                  <Scale className="w-4 h-4 mt-0.5 text-sky-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    {schedule.weighIn.hasWeight ? (
                      <>
                        <p className="text-sm font-medium text-slate-100">Next weigh-in {friendlyDay(schedule.weighIn.dueDate)}</p>
                        <p className="text-xs text-slate-400">Every {schedule.weighIn.everyDays} days{schedule.weighIn.everyDays === 14 ? ' while growing' : ''}. Weights build the growth chart and show when a female is big enough to breed.</p>
                      </>
                    ) : (
                      <>
                        <p className="text-sm font-medium text-slate-100">First weigh-in: today</p>
                        <p className="text-xs text-slate-400">A kitchen scale in grams is fine. After this, every {schedule.weighIn.everyDays} days.</p>
                        <div className="mt-2 flex gap-2">
                          <Input
                            id="fg-weight"
                            type="number"
                            inputMode="decimal"
                            min="0"
                            step="0.1"
                            value={weightInput}
                            onChange={(e) => setWeightInput(e.target.value)}
                            placeholder="grams"
                            aria-label={`${name}'s weight in grams`}
                            className="h-11 w-28 bg-slate-800 border-slate-600 text-slate-100"
                          />
                          <Button className="min-h-11" disabled={savingWeight} onClick={logWeight}>
                            {savingWeight ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Log weight'}
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
                <ReminderSwitch
                  id="fg-weigh-remind"
                  label="Weigh-in reminder"
                  detail={!weighIn.memberEnabled
                    ? 'Weigh-in reminders are off for your account (Settings, Notifications).'
                    : `A note when ${name} is due, even with the app closed.`}
                  checked={weighIn.on && weighIn.memberEnabled}
                  disabled={weighIn.status === 'loading' || !weighIn.memberEnabled}
                  onChange={toggleWeighIn}
                />
              </div>

              <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-3 space-y-2">
                <div className="flex items-start gap-2.5">
                  <Utensils className="w-4 h-4 mt-0.5 text-amber-300 shrink-0" />
                  <div className="flex-1 min-w-0">
                    {schedule.feeding && feedingOn ? (
                      <>
                        <p className="text-sm font-medium text-slate-100">Next feeding {friendlyDay(schedule.feeding.nextDate)}</p>
                        <p className="text-xs text-slate-400">{schedule.feeding.diet} every {schedule.feeding.everyDays} days, with the group &ldquo;{group?.name || group?.label || 'My geckos'}&rdquo;. Change the schedule in Batch Husbandry.</p>
                      </>
                    ) : (
                      <>
                        <p className="text-sm font-medium text-slate-100">Feeding schedule</p>
                        <p className="text-xs text-slate-400">Crested geckos on CGD are usually fed every 2 to 3 days. Turn this on for a reminder every {DEFAULT_FEEDING_INTERVAL_DAYS} days.</p>
                      </>
                    )}
                  </div>
                </div>
                <ReminderSwitch
                  id="fg-feed-remind"
                  label="Feeding reminder"
                  detail={feedingAccountOff
                    ? 'Feeding alerts are off for your account (Settings, Notifications).'
                    : 'One message on feeding days for all your geckos, never one per gecko.'}
                  checked={feedingOn}
                  disabled={savingFeeding}
                  onChange={toggleFeeding}
                />
              </div>
            </section>

            {/* Value */}
            <section aria-label="Value estimate">
              {gecko.morphs_traits || (Array.isArray(gecko.morph_tags) && gecko.morph_tags.length) ? (
                <MarketValueCard gecko={gecko} />
              ) : (
                <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-3">
                  <p className="text-sm font-medium text-slate-100 flex items-center gap-1.5"><Sparkles className="w-4 h-4 text-emerald-400" /> What is {name} worth?</p>
                  <p className="text-xs text-slate-400 mt-1">Add its morph (say, Lilly White or Harlequin) and Geck Inspect estimates its value from real crested gecko listings.</p>
                  <Link to="/Recognition" onClick={() => onClose?.()} className="touch:min-h-11 mt-2 inline-flex text-sm text-emerald-300 hover:text-emerald-200">
                    Not sure of the morph? Try Morph ID free
                  </Link>
                </div>
              )}
            </section>

            <div className="grid gap-2 pt-1">
              <Button className="w-full min-h-11" onClick={() => { flowEvent('payoff', 'open_record'); onOpenRecord?.(gecko); }}>
                Open {name}&rsquo;s record
              </Button>
              <Button variant="outline" className="w-full min-h-11 border-slate-600 text-slate-100" onClick={() => { flowEvent('payoff', 'add_another'); onAddAnother?.(); }}>
                <PlusCircle className="w-4 h-4 mr-2" /> Add another gecko
              </Button>
              <Button variant="ghost" className="w-full min-h-11 text-slate-300" onClick={() => { flowEvent('payoff', 'done'); onClose?.(); }}>
                Done
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ParentField({ id, label, options, pickedId, onPick, typed, onType, placeholder }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={`${id}-name`} className="text-slate-200">{label}</Label>
      {options.length > 0 && (
        <select
          id={`${id}-pick`}
          value={pickedId}
          onChange={(e) => onPick(e.target.value)}
          aria-label={`${label}: pick from your collection`}
          className="w-full h-11 rounded-md border border-slate-600 bg-slate-800 px-3 text-sm text-slate-100"
        >
          <option value="">Not in my collection, type a name</option>
          {options.map((g) => (
            <option key={g.id} value={g.id}>{g.name}{g.gecko_id_code ? ` (${g.gecko_id_code})` : ''}</option>
          ))}
        </select>
      )}
      {!pickedId && (
        <Input
          id={`${id}-name`}
          value={typed}
          onChange={(e) => onType(e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          className="bg-slate-800 border-slate-600 text-slate-100"
        />
      )}
    </div>
  );
}

function ParentBox({ role, name, tone }) {
  const toneClass = tone === 'pink' ? 'border-pink-500/40 text-pink-300' : 'border-sky-500/40 text-sky-300';
  return (
    <div className={`rounded-lg border bg-slate-900/60 px-3 py-2 min-w-0 ${toneClass}`}>
      <p className="text-[10px] uppercase tracking-wider">{role}</p>
      <p className={`text-sm font-semibold truncate ${name ? 'text-slate-100' : 'text-slate-500'}`}>{name || 'Unknown'}</p>
    </div>
  );
}

function ReminderSwitch({ id, label, detail, checked, disabled, onChange }) {
  return (
    <div className="flex items-start justify-between gap-3 border-t border-slate-700/70 pt-2">
      <div className="min-w-0">
        <Label htmlFor={id} className="text-sm text-slate-100">{label}</Label>
        <p className="text-[11px] text-slate-400 mt-0.5">{detail}</p>
      </div>
      <Switch id={id} checked={checked} disabled={disabled} onCheckedChange={onChange} />
    </div>
  );
}
