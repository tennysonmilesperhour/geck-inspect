import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Plus, Target, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabaseClient';
import {
  SCOREBOARD_CHECKPOINTS,
  SCOREBOARD_TARGETS,
  denverToday,
  formatUsd,
  meetsTarget,
  nextCheckpoint,
  percent,
  summarizeEntries,
  summarizePaidPlans,
  targetText,
} from '@/lib/scoreboard';

const KIND_LABELS = {
  conversation: 'Breeder conversation',
  import: 'Collection imported',
  monthly_cost: 'Monthly cost',
};

function isMissing(error) {
  const text = `${error?.code || ''} ${error?.message || ''}`;
  return /PGRST202|PGRST205|42883|42P01|could not find|does not exist/i.test(text);
}

function n(v) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

/**
 * The weekly scoreboard from Part E5 of the comprehensive review: the
 * numbers that decide, on 17 January 2027, whether Geck Inspect is a
 * subscription business. Each number has its definition written under it,
 * because two meanings of "weekly active" were quoted for weeks without
 * saying which was which (C15 item 13). Computed numbers come from
 * public.admin_scoreboard(); conversations, imports and cost come from
 * public.scoreboard_entries, which Tennyson fills in with the form below.
 * Both answer admins only (migration 20261015151500_scoreboard.sql).
 */
export default function WeeklyScoreboard() {
  const [board, setBoard] = useState(null);
  const [boardError, setBoardError] = useState(null);
  const [entries, setEntries] = useState(null);
  const [entriesError, setEntriesError] = useState(null);

  const loadEntries = useCallback(async () => {
    const { data, error } = await supabase
      .from('scoreboard_entries')
      .select('id, kind, entry_date, breeder_name, amount_usd, notes, created_date')
      .order('entry_date', { ascending: false })
      .order('created_date', { ascending: false })
      .limit(1000);
    if (error) setEntriesError(error);
    else {
      setEntriesError(null);
      setEntries(data || []);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    supabase.rpc('admin_scoreboard').then(({ data, error }) => {
      if (cancelled) return;
      if (error) setBoardError(error);
      else setBoard(data || {});
    });
    loadEntries();
    return () => { cancelled = true; };
  }, [loadEntries]);

  const today = denverToday();
  const next = nextCheckpoint(today);
  const money = useMemo(() => summarizePaidPlans(board?.paid_plans), [board]);
  const manual = useMemo(() => summarizeEntries(entries || [], today), [entries, today]);

  if (boardError && isMissing(boardError)) {
    return (
      <section aria-labelledby="scoreboard-heading" className="space-y-2">
        <ScoreboardHeading next={next} />
        <p className="text-sm text-amber-200/90">
          The scoreboard needs migration 20261015151500_scoreboard.sql. It has not been applied yet, so
          there is nothing to show.
        </p>
      </section>
    );
  }

  const passports = board?.passports || {};
  const activity = board?.activity || {};
  const signups = board?.signups || {};
  const weeks = Array.isArray(board?.breeder_weeks) ? board.breeder_weeks : [];

  return (
    <section aria-labelledby="scoreboard-heading" className="space-y-4">
      <ScoreboardHeading next={next} generatedAt={board?.generated_at} />

      {boardError ? (
        <p className="text-sm text-red-300">Could not load the computed numbers: {boardError.message}</p>
      ) : board === null ? (
        <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <Metric
          label="Breeder conversations"
          value={entries === null ? null : manual.conversations}
          detail={`${manual.conversations7d} in the last 7 days`}
          definition="Conversations you held with a breeder, recorded by hand in the form below. All entries count."
          targets={SCOREBOARD_TARGETS.conversations}
          next={next}
        />
        <Metric
          label="Collections hand-imported"
          value={entries === null ? null : manual.imports}
          detail={`${manual.imports7d} in the last 7 days`}
          definition="Breeder collections you imported for them (spreadsheet or MorphMarket export), recorded by hand below."
          targets={SCOREBOARD_TARGETS.imports}
          next={next}
        />
        <Metric
          label="Paying breeders"
          value={board ? money.payingBreeders : null}
          detail={[
            `${money.payingKeepers} paying keeper${money.payingKeepers === 1 ? '' : 's'} not included`,
            money.compedPayers ? `${money.compedPayers} more pay but also hold a comp, so are left out` : null,
            n(board?.unverified_lifetime)
              ? `${n(board.unverified_lifetime)} lifetime plan${n(board.unverified_lifetime) === 1 ? '' : 's'} with no payment on record, left out`
              : null,
          ].filter(Boolean).join('. ')}
          definition="Members on Breeder or Enterprise who pay: a live Stripe subscription (active or past due, not a trial, not grandfathered), a lifetime plan with a payment on record, or an App Store subscription. Anyone with a current comp, and the admin, are left out."
          targets={SCOREBOARD_TARGETS.payingBreeders}
          next={next}
        />
        <Metric
          label="Monthly recurring revenue"
          value={board ? formatUsd(money.mrr) : null}
          targetValue={board ? money.mrr : null}
          detail={`From ${money.payingAll} paying member${money.payingAll === 1 ? '' : 's'} on any plan${money.lifetime ? `, ${money.lifetime} of them lifetime` : ''}`}
          definition="Each paying, non-comped member's plan price per month at today's list prices. Annual plans count a twelfth of the year; lifetime plans count nothing, because they do not recur."
          targets={SCOREBOARD_TARGETS.mrr}
          next={next}
        />
        <Metric
          label="Passports issued"
          value={board ? n(passports.issued) : null}
          detail={`Plus ${n(passports.issued_admin)} on your own geckos`}
          definition="Geckos with a passport code, owned by members other than the admin."
          targets={SCOREBOARD_TARGETS.passportsIssued}
          next={next}
        />
        <Metric
          label="Passports claimed"
          value={board ? n(passports.claimed) : null}
          detail={`${n(passports.claimed_7d)} in the last 7 days. Plus ${n(passports.claimed_admin)} from your own sales`}
          definition="Transfers a buyer accepted, from a seller other than the admin."
          targets={SCOREBOARD_TARGETS.passportsClaimed}
          next={next}
        />
        <Metric
          label="Claimers still active 2 weeks on"
          value={board ? n(passports.claimers_active_after_14d) : null}
          detail={`Out of ${n(passports.claimers_eligible_14d)} buyers who claimed at least 14 days ago (all sellers)`}
          definition="Buyers who signed in or used the app 14 days or more after their claim."
          targets={SCOREBOARD_TARGETS.claimersActive}
          next={next}
        />
        <Metric
          label="Signups, last 7 days"
          value={board ? n(signups.signups_7d) : null}
          detail={`Day-one first gecko: ${n(signups.first_gecko_1d)} of ${n(signups.first_gecko_eligible)} (${percent(signups.first_gecko_1d, signups.first_gecko_eligible)})`}
          definition="New accounts, admin and the Morph ID test account left out. The first gecko rate uses accounts made 1 to 8 days ago, so each one had a full first day to add a gecko."
          next={next}
        />
        <Metric
          label="Monthly cost"
          value={entries === null ? null : manual.latestCost ? formatUsd(manual.latestCost.amount) : 'Not recorded'}
          targetValue={manual.latestCost ? manual.latestCost.amount : null}
          detail={manual.latestCost ? `As of ${manual.latestCost.entry_date}` : 'Add a Monthly cost entry below'}
          definition="What the services cost this month (Supabase, Vercel, Resend, AI and the rest), entered by hand. The newest entry shows."
          targets={SCOREBOARD_TARGETS.monthlyCost}
          money
          next={next}
        />
      </div>

      <div>
        <p className="text-[11px] uppercase tracking-wider text-slate-500 mb-2">Two meanings of weekly active, side by side</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Metric
            label="Weekly active breeders (logging records)"
            value={board ? n(activity.weekly_active_breeders) : null}
            detail={weeks.length ? (
              <span>
                Last 8 weeks, newest first:{' '}
                {weeks.map((w, i) => (
                  <span key={w.weeks_ago} title={`7 days to ${w.ends_on}`}>
                    {i ? ', ' : ''}{n(w.active)}
                  </span>
                ))}
              </span>
            ) : null}
            definition="Members who logged a weigh-in, feeding, shed, vet visit or event on a gecko they own in the last 7 days. Admin left out. This is the E5 number."
            targets={SCOREBOARD_TARGETS.weeklyActiveBreeders}
            next={next}
          />
          <Metric
            label="Weekly active members (signed in)"
            value={board ? n(activity.weekly_active_signed_in) : null}
            detail={`Out of ${n(activity.members)} member accounts`}
            definition="Members who signed in, or used the app while signed in, in the last 7 days. Admin left out. Larger than the number beside it because looking is not logging."
            next={next}
          />
        </div>
      </div>

      <EmailDelivery delivery={board?.email_delivery} loading={board === null && !boardError} />

      <EntryForm onSaved={loadEntries} />
      <EntryList entries={entries} error={entriesError} onChanged={loadEntries} />
    </section>
  );
}

function ScoreboardHeading({ next, generatedAt }) {
  return (
    <div>
      <h3 id="scoreboard-heading" className="text-sm font-semibold text-slate-100 flex items-center gap-2">
        <Target className="w-4 h-4 text-emerald-400" />
        Weekly scoreboard
      </h3>
      <p className="text-xs text-slate-500">
        The numbers behind the decision on 17 January 2027. Targets for day 30 ({SCOREBOARD_CHECKPOINTS[0].dateLabel}),
        day 60 ({SCOREBOARD_CHECKPOINTS[1].dateLabel}) and day 90 ({SCOREBOARD_CHECKPOINTS[2].dateLabel}) sit under each
        number; the next one, {next.label} on {next.dateLabel}, is highlighted. Green means that target is met today.
        {generatedAt ? ` Computed ${new Date(generatedAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}.` : ''}
      </p>
    </div>
  );
}

/**
 * One number on the card. `value` is what shows; `targetValue` is the
 * plain number the target chips compare against. They differ for money,
 * where the display is a formatted string like "$64.00" that cannot be
 * compared with "under $100". Without `targetValue`, a numeric `value`
 * is used, so counts need nothing extra.
 */
function Metric({ label, value, targetValue, detail, definition, targets, next, money = false }) {
  const compareWith = targetValue !== undefined ? targetValue : typeof value === 'number' ? value : null;
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3 flex flex-col gap-1 min-w-0">
      <p className="text-xs font-medium text-slate-300">{label}</p>
      <p className="text-2xl font-semibold text-slate-50 tabular-nums">
        {value === null || value === undefined ? <span className="text-slate-600">…</span> : value}
      </p>
      {detail ? <p className="text-[11px] text-slate-400">{detail}</p> : null}
      <p className="text-[11px] text-slate-500">{definition}</p>
      {targets ? <Targets targets={targets} value={compareWith} next={next} money={money} /> : null}
    </div>
  );
}

function Targets({ targets, value, next, money }) {
  const numeric = typeof value === 'number' && Number.isFinite(value) ? value : null;
  return (
    <div className="mt-1 space-y-1">
      <div className="flex flex-wrap gap-1.5">
        {SCOREBOARD_CHECKPOINTS.map((c) => {
          const t = targets[c.key];
          const text = targetText(t, { money });
          if (!text) return null;
          const met = meetsTarget(numeric, t);
          const isNext = c.key === next.key;
          const tone = met
            ? 'border-emerald-700/60 text-emerald-300 bg-emerald-950/30'
            : isNext
              ? 'border-amber-700/60 text-amber-200 bg-amber-950/20'
              : 'border-slate-700 text-slate-400';
          return (
            <span
              key={c.key}
              className={`text-[11px] rounded border px-1.5 py-0.5 ${tone}`}
              title={`${c.label}, ${c.dateLabel}${met ? ': met' : ''}`}
            >
              {c.label}: {text}
            </span>
          );
        })}
      </div>
      {SCOREBOARD_CHECKPOINTS.map((c) => (targets[c.key]?.note ? (
        <p key={c.key} className="text-[11px] text-slate-500">{c.label}: {targets[c.key].note}.</p>
      ) : null))}
    </div>
  );
}

function EmailDelivery({ delivery, loading }) {
  if (loading) return null;
  const rows = Array.isArray(delivery?.rows) ? delivery.rows : [];
  const columns = rows.length ? Object.keys(rows[0]) : [];
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider text-slate-500 mb-1">Email delivery</p>
      {!delivery || delivery.available === false ? (
        <p className="text-xs text-slate-500">
          {delivery?.reason === 'error'
            ? `The email delivery numbers could not be read: ${delivery.message || 'unknown error'}.`
            : 'Delivery numbers show here once email delivery tracking is switched on (the email_delivery_stats view in the database).'}
        </p>
      ) : rows.length === 0 ? (
        <p className="text-xs text-slate-500">No emails recorded yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-slate-500 text-left">
                {columns.map((c) => <th key={c} className="py-1.5 pr-3 font-medium">{c.replace(/_/g, ' ')}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-t border-slate-800 text-slate-200">
                  {columns.map((c) => (
                    <td key={c} className="py-1.5 pr-3">{r[c] === null || r[c] === undefined ? '' : String(r[c])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const fieldClass = 'h-9 w-full rounded-md border border-slate-700 bg-slate-900 px-2 text-sm text-slate-100';

export function EntryForm({ onSaved }) {
  const [kind, setKind] = useState('conversation');
  const [entryDate, setEntryDate] = useState(denverToday());
  const [breederName, setBreederName] = useState('');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  const isCost = kind === 'monthly_cost';
  const amountNumber = Number(amount);
  const canSave = !saving && entryDate && (isCost ? amount !== '' && Number.isFinite(amountNumber) && amountNumber >= 0 : true);

  async function save(e) {
    e.preventDefault();
    if (!canSave) return;
    setSaving(true);
    setMessage(null);
    const row = {
      kind,
      entry_date: entryDate,
      breeder_name: isCost ? null : breederName.trim() || null,
      amount_usd: isCost ? Math.round(amountNumber * 100) / 100 : null,
      notes: notes.trim() || null,
    };
    const { error } = await supabase.from('scoreboard_entries').insert(row);
    setSaving(false);
    if (error) {
      setMessage({ tone: 'error', text: `Could not save: ${error.message}` });
      return;
    }
    setBreederName('');
    setAmount('');
    setNotes('');
    setMessage({ tone: 'ok', text: `${KIND_LABELS[kind]} saved.` });
    if (onSaved) onSaved();
  }

  return (
    <form onSubmit={save} className="rounded-lg border border-slate-800 p-3 space-y-2" aria-label="Record a scoreboard entry">
      <p className="text-[11px] uppercase tracking-wider text-slate-500">Record by hand</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
        <label className="text-xs text-slate-400 space-y-1">
          <span>What happened</span>
          <select className={fieldClass} value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="conversation">{KIND_LABELS.conversation}</option>
            <option value="import">{KIND_LABELS.import}</option>
            <option value="monthly_cost">{KIND_LABELS.monthly_cost}</option>
          </select>
        </label>
        <label className="text-xs text-slate-400 space-y-1">
          <span>Date</span>
          <Input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} className="bg-slate-900 border-slate-700 text-slate-100" required />
        </label>
        {isCost ? (
          <label className="text-xs text-slate-400 space-y-1">
            <span>Amount in US dollars</span>
            <Input type="number" min="0" step="0.01" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className="bg-slate-900 border-slate-700 text-slate-100" required />
          </label>
        ) : (
          <label className="text-xs text-slate-400 space-y-1">
            <span>Breeder</span>
            <Input value={breederName} maxLength={200} onChange={(e) => setBreederName(e.target.value)} placeholder="Name or business" className="bg-slate-900 border-slate-700 text-slate-100" />
          </label>
        )}
        <label className="text-xs text-slate-400 space-y-1">
          <span>Note (optional)</span>
          <Input value={notes} maxLength={2000} onChange={(e) => setNotes(e.target.value)} placeholder={isCost ? 'What it covers' : 'How it went'} className="bg-slate-900 border-slate-700 text-slate-100" />
        </label>
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={!canSave}>
          {saving ? <Loader2 className="animate-spin" /> : <Plus />}
          Save entry
        </Button>
        {message ? (
          <p role="status" className={`text-xs ${message.tone === 'error' ? 'text-red-300' : 'text-emerald-300'}`}>{message.text}</p>
        ) : null}
      </div>
    </form>
  );
}

function EntryList({ entries, error, onChanged }) {
  const [busy, setBusy] = useState(null);
  const [failure, setFailure] = useState(null);

  async function remove(entry) {
    const what = entry.breeder_name ? `${KIND_LABELS[entry.kind]} with ${entry.breeder_name}` : KIND_LABELS[entry.kind];
    if (typeof window !== 'undefined' && window.confirm && !window.confirm(`Delete "${what}" from ${entry.entry_date}?`)) return;
    setBusy(entry.id);
    setFailure(null);
    const { error: err } = await supabase.from('scoreboard_entries').delete().eq('id', entry.id);
    setBusy(null);
    if (err) setFailure(`Could not delete: ${err.message}`);
    else if (onChanged) onChanged();
  }

  if (error) {
    return (
      <p className="text-xs text-red-300">
        {isMissing(error)
          ? 'The hand-recorded entries need migration 20261015151500_scoreboard.sql.'
          : `Could not load the entries: ${error.message}`}
      </p>
    );
  }
  if (entries === null) return null;
  const recent = entries.slice(0, 10);
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider text-slate-500 mb-1">
        Latest entries ({entries.length} in all)
      </p>
      {failure ? <p className="text-xs text-red-300 mb-1">{failure}</p> : null}
      {recent.length === 0 ? (
        <p className="text-xs text-slate-500">Nothing recorded yet. Add the first breeder conversation above.</p>
      ) : (
        <ul className="divide-y divide-slate-800">
          {recent.map((e) => (
            <li key={e.id} className="py-1.5 flex items-start gap-2 text-sm text-slate-200">
              <span className="text-xs text-slate-500 tabular-nums shrink-0 pt-0.5">{e.entry_date}</span>
              <span className="flex-1 min-w-0">
                {KIND_LABELS[e.kind] || e.kind}
                {e.kind === 'monthly_cost' ? `: ${formatUsd(e.amount_usd)}` : e.breeder_name ? `: ${e.breeder_name}` : ''}
                {e.notes ? <span className="block text-xs text-slate-500 break-words">{e.notes}</span> : null}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-slate-500 hover:text-red-300"
                disabled={busy === e.id}
                onClick={() => remove(e)}
                aria-label={`Delete ${KIND_LABELS[e.kind] || e.kind} from ${e.entry_date}`}
              >
                {busy === e.id ? <Loader2 className="animate-spin" /> : <Trash2 />}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
