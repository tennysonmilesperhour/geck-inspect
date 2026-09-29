import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, ChevronUp, Copy, ExternalLink, ListOrdered, Loader2, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/use-toast';
import { GeckoWaitlist, GeckoWaitlistSignup, PendingSale } from '@/entities/all';
import { todayLocalISO } from '@/lib/dateUtils';
import {
  defaultWaitlistTitle,
  makeWaitlistSlug,
  matchableHatchlings,
  orderedSignups,
  pairingLabel,
  reserveFromSignup,
  signupStatusLabel,
  waitlistOutcomes,
  waitlistSummary,
} from '@/lib/pairingWaitlist';

// Business Tools > Waitlists. Open a waitlist for a pairing, share the
// link, and track each buyer from signup to deposit to a matched
// hatchling. Deposits are recorded here; buyers pay the breeder directly.
// See src/lib/pairingWaitlist.js.

const fieldClass = 'bg-slate-950/60 border-slate-700 text-slate-100';
const money = (n, symbol) => `${symbol}${(Number(n) || 0).toFixed(2).replace(/\.00$/, '')}`;
const pct = (p) => `${Math.round(p * 1000) / 10}%`;
const linkFor = (slug) => `${window.location.origin}/waitlist/${slug}`;

const STATUS_CLASS = {
  waiting: 'bg-slate-700 text-slate-200',
  deposit_paid: 'bg-emerald-700 text-emerald-50',
  matched: 'bg-sky-700 text-sky-50',
  completed: 'bg-emerald-900 text-emerald-200',
  withdrawn: 'bg-slate-800 text-slate-500',
};

export default function WaitlistsTab({ user, plans = [], geckos = [], currency = '$', onReserveCreated }) {
  const [waitlists, setWaitlists] = useState([]);
  const [signups, setSignups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const geckosById = useMemo(() => new Map(geckos.map((g) => [g.id, g])), [geckos]);
  const plansById = useMemo(() => new Map(plans.map((p) => [p.id, p])), [plans]);
  const breederId = user?.auth_user_id;

  const load = async () => {
    if (!breederId) { setLoading(false); return; }
    setLoading(true);
    try {
      const lists = await GeckoWaitlist.filter({ breeder_user_id: breederId }, '-created_date');
      setWaitlists(lists || []);
      const ids = (lists || []).map((w) => w.id);
      setSignups(ids.length ? await GeckoWaitlistSignup.filter({ waitlist_id: { $in: ids } }, 'created_date') : []);
    } catch (e) {
      console.error('Waitlists failed to load', e);
      toast({ title: 'Could not load waitlists', description: e.message, variant: 'destructive' });
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [breederId]);

  const patchSignup = async (id, patch) => {
    const updated = await GeckoWaitlistSignup.update(id, patch);
    setSignups((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch, ...(updated || {}) } : s)));
  };

  return (
    <div className="space-y-6" data-waitlists-tab>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="max-w-2xl">
          <h3 className="text-base font-semibold text-slate-100 flex items-center gap-1.5">
            <ListOrdered className="w-4 h-4 text-emerald-400" /> Waitlists
          </h3>
          <p className="text-sm text-slate-400 mt-1">
            Open a waitlist for a pairing and share the link. Buyers see the likely babies and their odds, join the
            line and say what they hope for. You record deposits as they come in and match each buyer to a
            hatchling. Buyers pay you directly; Geck Inspect keeps the record.
          </p>
        </div>
        {!creating && (
          <Button onClick={() => setCreating(true)} className="bg-emerald-600 hover:bg-emerald-500 text-white h-9">
            <Plus className="w-4 h-4 mr-2" /> New waitlist
          </Button>
        )}
      </div>

      {creating && (
        <NewWaitlistForm
          plans={plans}
          geckosById={geckosById}
          currency={currency}
          breederId={breederId}
          onCancel={() => setCreating(false)}
          onCreated={(row) => { setWaitlists((prev) => [row, ...prev]); setCreating(false); }}
        />
      )}

      {loading ? (
        <p className="text-sm text-slate-400 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading waitlists</p>
      ) : waitlists.length === 0 ? (
        !creating && (
          <div className="rounded-xl border border-dashed border-slate-700 p-6 text-center text-sm text-slate-400">
            No waitlists yet. Start one for a pairing you have planned, like a Lilly White x Axanthic project,
            and share the link before the eggs are even laid.
          </div>
        )
      ) : (
        <div className="space-y-4">
          {waitlists.map((w) => (
            <WaitlistCard
              key={w.id}
              waitlist={w}
              plan={plansById.get(w.breeding_plan_id)}
              geckosById={geckosById}
              geckos={geckos}
              signups={signups.filter((s) => s.waitlist_id === w.id)}
              currency={w.currency && w.currency !== 'USD' ? w.currency : currency}
              user={user}
              onPatchSignup={patchSignup}
              onChangeList={(patch) => setWaitlists((prev) => prev.map((x) => (x.id === w.id ? { ...x, ...patch } : x)))}
              onDeleted={() => { setWaitlists((prev) => prev.filter((x) => x.id !== w.id)); setSignups((prev) => prev.filter((s) => s.waitlist_id !== w.id)); }}
              onSignupAdded={(row) => setSignups((prev) => [...prev, row])}
              onReserveCreated={onReserveCreated}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function NewWaitlistForm({ plans, geckosById, currency, breederId, onCancel, onCreated }) {
  const openPlans = plans.filter((p) => !p.archived);
  const [planId, setPlanId] = useState(openPlans[0]?.id || '');
  const plan = openPlans.find((p) => p.id === planId) || null;
  const [title, setTitle] = useState(defaultWaitlistTitle(plan, geckosById));
  const [titleTouched, setTitleTouched] = useState(false);
  const [description, setDescription] = useState('');
  const [deposit, setDeposit] = useState('');
  const [instructions, setInstructions] = useState('');
  const [spots, setSpots] = useState('');
  const [saving, setSaving] = useState(false);

  const outcomes = useMemo(() => {
    if (!plan) return [];
    return waitlistOutcomes(geckosById.get(plan.sire_id), geckosById.get(plan.dam_id));
  }, [plan, geckosById]);

  useEffect(() => {
    if (!titleTouched) setTitle(plan ? defaultWaitlistTitle(plan, geckosById) : '');
  }, [planId]);

  const save = async () => {
    if (!title.trim()) {
      toast({ title: 'Give the waitlist a name', variant: 'destructive' });
      return;
    }
    setSaving(true);
    let row = null;
    let lastErr = null;
    for (let attempt = 0; attempt < 3 && !row; attempt += 1) {
      try {
        row = await GeckoWaitlist.create({
          breeder_user_id: breederId,
          breeding_plan_id: plan?.id || null,
          slug: makeWaitlistSlug(),
          title: title.trim(),
          description: description.trim(),
          is_open: true,
          outcomes,
          deposit_amount: deposit === '' ? null : Number(deposit),
          deposit_instructions: instructions.trim() || null,
          max_signups: spots === '' ? null : Math.max(1, parseInt(spots, 10) || 1),
          currency,
        });
      } catch (e) {
        lastErr = e;
        if (!String(e?.message || '').toLowerCase().includes('duplicate')) break;
      }
    }
    setSaving(false);
    if (!row) {
      toast({ title: 'Could not create the waitlist', description: lastErr?.message, variant: 'destructive' });
      return;
    }
    try { await navigator.clipboard?.writeText(linkFor(row.slug)); } catch { /* clipboard is optional */ }
    toast({ title: 'Waitlist created', description: 'The link is copied. Share it wherever you post.' });
    onCreated(row);
  };

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4 space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="wl-plan" className="text-slate-200">Pairing</Label>
          <select
            id="wl-plan"
            value={planId}
            onChange={(e) => setPlanId(e.target.value)}
            className={`w-full h-10 rounded-md border px-3 text-sm ${fieldClass}`}
          >
            <option value="">No pairing (a general list)</option>
            {openPlans.map((p) => <option key={p.id} value={p.id}>{pairingLabel(p, geckosById)}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="wl-title" className="text-slate-200">Name</Label>
          <Input id="wl-title" value={title} onChange={(e) => { setTitle(e.target.value); setTitleTouched(true); }} className={fieldClass} />
        </div>
      </div>

      {plan && (
        <div className="rounded-lg bg-slate-950/50 border border-slate-800 p-3">
          <p className="text-xs uppercase tracking-wider text-slate-500 mb-2">Likely babies (buyers see this)</p>
          {outcomes.length === 0 ? (
            <p className="text-sm text-slate-400">Add traits to both parents to show the odds. The list still works without them.</p>
          ) : (
            <ul className="grid sm:grid-cols-2 gap-x-4 gap-y-1 text-sm">
              {outcomes.map((o) => (
                <li key={o.label} className="flex justify-between gap-3">
                  <span className="text-slate-200 min-w-0 break-words">{o.label}</span>
                  <span className="text-emerald-300 tabular-nums shrink-0">{pct(o.probability)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="wl-desc" className="text-slate-200">Note for buyers (optional)</Label>
        <Textarea id="wl-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className={fieldClass}
          placeholder="Eggs expected this winter. First in line picks first." />
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="wl-deposit" className="text-slate-200">Deposit ({currency})</Label>
          <Input id="wl-deposit" type="number" min="0" step="1" value={deposit} onChange={(e) => setDeposit(e.target.value)} className={fieldClass} placeholder="None" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="wl-spots" className="text-slate-200">Spots (optional)</Label>
          <Input id="wl-spots" type="number" min="1" step="1" value={spots} onChange={(e) => setSpots(e.target.value)} className={fieldClass} placeholder="No limit" />
        </div>
      </div>
      {deposit !== '' && (
        <div className="space-y-1.5">
          <Label htmlFor="wl-instr" className="text-slate-200">How buyers pay the deposit, and your terms</Label>
          <Textarea id="wl-instr" value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={2} className={fieldClass}
            placeholder="I will message you with a PayPal invoice. Deposits are refundable until you are matched with a hatchling." />
          <p className="text-xs text-slate-500">Shown on the waitlist page. Buyers pay you directly; Geck Inspect never handles the money.</p>
        </div>
      )}

      <div className="flex gap-2 justify-end">
        <Button variant="ghost" onClick={onCancel} className="text-slate-300">Cancel</Button>
        <Button onClick={save} disabled={saving} className="bg-emerald-600 hover:bg-emerald-500 text-white">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create and copy link'}
        </Button>
      </div>
    </div>
  );
}

function WaitlistCard({
  waitlist, plan, geckosById, geckos, signups, currency, user,
  onPatchSignup, onChangeList, onDeleted, onSignupAdded, onReserveCreated,
}) {
  const [open, setOpen] = useState(signups.length > 0);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const summary = waitlistSummary(signups);
  const rows = orderedSignups(signups);
  const hatchlings = matchableHatchlings(plan, geckos);
  const isClosed = !waitlist.is_open || (waitlist.closes_at && new Date(waitlist.closes_at) < new Date());

  const copy = async () => {
    try {
      await navigator.clipboard?.writeText(linkFor(waitlist.slug));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast({ title: 'Copy this link', description: linkFor(waitlist.slug) });
    }
  };

  const toggleOpen = async () => {
    setBusy(true);
    try {
      await GeckoWaitlist.update(waitlist.id, { is_open: !waitlist.is_open });
      onChangeList({ is_open: !waitlist.is_open });
    } catch (e) {
      toast({ title: 'Could not update the waitlist', description: e.message, variant: 'destructive' });
    }
    setBusy(false);
  };

  const remove = async () => {
    if (!confirm(`Delete "${waitlist.title}" and its ${signups.length} signup${signups.length === 1 ? '' : 's'}? The link stops working.`)) return;
    setBusy(true);
    try {
      await GeckoWaitlist.delete(waitlist.id);
      onDeleted();
    } catch (e) {
      toast({ title: 'Could not delete the waitlist', description: e.message, variant: 'destructive' });
      setBusy(false);
    }
  };

  const addByHand = async () => {
    const name = prompt('Buyer name');
    if (!name?.trim()) return;
    const email = prompt('Buyer email');
    if (!email?.trim()) return;
    try {
      const row = await GeckoWaitlistSignup.create({ waitlist_id: waitlist.id, name: name.trim(), email: email.trim(), status: 'waiting' });
      onSignupAdded(row);
    } catch (e) {
      toast({ title: 'Could not add the buyer', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/50" data-waitlist-card>
      <div className="p-4 flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-semibold text-slate-100 break-words">{waitlist.title}</h4>
            <Badge className={isClosed ? 'bg-slate-700 text-slate-300' : 'bg-emerald-700 text-emerald-50'}>
              {isClosed ? 'Closed' : 'Open'}
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {plan ? pairingLabel(plan, geckosById) : waitlist.breeding_plan_id ? 'Pairing archived or deleted' : waitlist.gecko_id ? 'For one gecko' : 'General list'}
            {waitlist.deposit_amount != null && ` · Deposit ${money(waitlist.deposit_amount, currency)}`}
            {waitlist.max_signups ? ` · ${summary.active} of ${waitlist.max_signups} spots` : ` · ${summary.active} in line`}
          </p>
          {summary.depositTotal > 0 && (
            <p className="text-xs text-emerald-300 mt-0.5">
              Holding {money(summary.depositTotal, currency)} in deposits from {summary.deposits} buyer{summary.deposits === 1 ? '' : 's'}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          <Button variant="ghost" size="sm" onClick={copy} className="text-slate-300 hover:text-emerald-300">
            {copied ? <><Check className="w-4 h-4 mr-1" />Copied</> : <><Copy className="w-4 h-4 mr-1" />Copy link</>}
          </Button>
          <Button asChild variant="ghost" size="sm" className="text-slate-300 hover:text-emerald-300">
            <a href={`/waitlist/${waitlist.slug}`} target="_blank" rel="noreferrer"><ExternalLink className="w-4 h-4 mr-1" />View</a>
          </Button>
          <Button variant="ghost" size="sm" onClick={toggleOpen} disabled={busy} className="text-slate-300 hover:text-emerald-300">
            {waitlist.is_open ? 'Close' : 'Reopen'}
          </Button>
          <Button variant="ghost" size="icon" onClick={remove} disabled={busy} className="text-slate-400 hover:text-red-300 h-8 w-8" aria-label="Delete waitlist">
            <Trash2 className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setOpen((v) => !v)} className="text-slate-300 h-8 w-8" aria-label={open ? 'Hide buyers' : 'Show buyers'} aria-expanded={open}>
            {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {open && (
        <div className="border-t border-slate-800 p-4 space-y-3">
          {rows.length === 0 ? (
            <p className="text-sm text-slate-400">Nobody has joined yet. Share the link in your next post.</p>
          ) : (
            <ul className="space-y-2">
              {rows.map((s) => (
                <SignupRow
                  key={s.id}
                  signup={s}
                  waitlist={waitlist}
                  currency={currency}
                  hatchlings={hatchlings}
                  geckosById={geckosById}
                  user={user}
                  onPatch={(patch) => onPatchSignup(s.id, patch)}
                  onReserveCreated={onReserveCreated}
                />
              ))}
            </ul>
          )}
          <Button variant="ghost" size="sm" onClick={addByHand} className="text-slate-300 hover:text-emerald-300 px-2">
            <Plus className="w-4 h-4 mr-1" /> Add a buyer by hand
          </Button>
        </div>
      )}
    </div>
  );
}

function SignupRow({ signup, waitlist, currency, hatchlings, geckosById, user, onPatch, onReserveCreated }) {
  const [mode, setMode] = useState(null); // 'deposit' | 'match'
  const [amount, setAmount] = useState(String(waitlist.deposit_amount ?? ''));
  const [paidOn, setPaidOn] = useState(todayLocalISO());
  const [geckoId, setGeckoId] = useState('');
  const [startReserve, setStartReserve] = useState(true);
  const [saving, setSaving] = useState(false);
  const matched = signup.matched_gecko_id ? geckosById.get(signup.matched_gecko_id) : null;
  const withdrawn = signup.status === 'withdrawn';

  const run = async (fn) => {
    setSaving(true);
    try { await fn(); setMode(null); } catch (e) {
      toast({ title: 'Could not save', description: e.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  const recordDeposit = () => run(async () => {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) throw new Error('Enter the amount you received.');
    await onPatch({ status: 'deposit_paid', deposit_paid: value, deposit_paid_on: paidOn || todayLocalISO() });
    toast({ title: 'Deposit recorded', description: `${money(value, currency)} from ${signup.name}` });
  });

  const match = () => run(async () => {
    const gecko = geckosById.get(geckoId);
    if (!gecko) throw new Error('Pick a hatchling.');
    await onPatch({ status: 'matched', matched_gecko_id: gecko.id });
    if (startReserve) {
      const created = await PendingSale.create(reserveFromSignup({ signup, gecko, userEmail: user?.email, today: todayLocalISO() }));
      onReserveCreated?.(created);
      toast({ title: 'Matched, and a reserve started', description: `${gecko.name || 'The hatchling'} is reserved for ${signup.name} under Sales.` });
    } else {
      toast({ title: 'Matched', description: `${gecko.name || 'The hatchling'} is set aside for ${signup.name}.` });
    }
  });

  return (
    <li className={`rounded-lg border border-slate-800 bg-slate-950/40 p-3 ${withdrawn ? 'opacity-60' : ''}`} data-signup-row>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <p className="text-sm text-slate-100">
            {signup.place && <span className="text-slate-500 tabular-nums mr-1.5">#{signup.place}</span>}
            <span className="font-medium">{signup.name}</span>{' '}
            <a href={`mailto:${signup.email}`} className="text-emerald-300 hover:underline break-all">{signup.email}</a>
          </p>
          <p className="text-xs text-slate-400 mt-0.5">
            {signup.wanted_outcome ? `Hoping for ${signup.wanted_outcome}` : 'Any baby from this pairing'}
            {signup.notes && ` · "${signup.notes}"`}
          </p>
          {(signup.deposit_paid > 0 || matched) && (
            <p className="text-xs text-emerald-300 mt-0.5">
              {signup.deposit_paid > 0 && `Deposit ${money(signup.deposit_paid, currency)}${signup.deposit_paid_on ? ` on ${signup.deposit_paid_on}` : ''}`}
              {signup.deposit_paid > 0 && matched && ' · '}
              {matched && `Matched with ${matched.name || matched.morphs_traits || 'a hatchling'}`}
            </p>
          )}
        </div>
        <Badge className={STATUS_CLASS[signup.status] || STATUS_CLASS.waiting}>{signupStatusLabel(signup.status)}</Badge>
      </div>

      {!withdrawn && signup.status !== 'completed' && (
        <div className="flex flex-wrap gap-1 mt-2">
          {signup.status === 'waiting' && (
            <Button size="sm" variant="outline" onClick={() => setMode(mode === 'deposit' ? null : 'deposit')} className="h-8 border-slate-700 bg-transparent text-slate-200">
              Deposit received
            </Button>
          )}
          {['waiting', 'deposit_paid'].includes(signup.status) && (
            <Button size="sm" variant="outline" onClick={() => setMode(mode === 'match' ? null : 'match')} className="h-8 border-slate-700 bg-transparent text-slate-200">
              Match a hatchling
            </Button>
          )}
          {signup.status === 'matched' && (
            <Button size="sm" variant="outline" disabled={saving} onClick={() => run(() => onPatch({ status: 'completed' }))} className="h-8 border-slate-700 bg-transparent text-slate-200">
              Mark completed
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            disabled={saving}
            onClick={() => {
              const note = signup.deposit_paid > 0 ? ` Their ${money(signup.deposit_paid, currency)} deposit stays recorded; refund it per your terms.` : '';
              if (confirm(`Mark ${signup.name} as withdrawn?${note}`)) run(() => onPatch({ status: 'withdrawn' }));
            }}
            className="h-8 text-slate-400 hover:text-red-300"
          >
            Withdrawn
          </Button>
        </div>
      )}

      {mode === 'deposit' && (
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-[1fr_1fr_auto] gap-2 items-end">
          <div className="space-y-1">
            <Label className="text-xs text-slate-400">Amount ({currency})</Label>
            <Input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className={`h-9 ${fieldClass}`} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-slate-400">Received on</Label>
            <Input type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} className={`h-9 ${fieldClass}`} />
          </div>
          <Button onClick={recordDeposit} disabled={saving} className="h-9 col-span-2 sm:col-span-1 bg-emerald-600 hover:bg-emerald-500 text-white">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save deposit'}
          </Button>
        </div>
      )}

      {mode === 'match' && (
        <div className="mt-3 space-y-2">
          {hatchlings.length === 0 ? (
            <p className="text-xs text-slate-400">
              No unsold babies from this pairing yet. When an egg hatches into a gecko with these parents, it shows up here.
            </p>
          ) : (
            <>
              <select value={geckoId} onChange={(e) => setGeckoId(e.target.value)} className={`w-full h-9 rounded-md border px-2 text-sm ${fieldClass}`}>
                <option value="">Pick a hatchling</option>
                {hatchlings.map((g) => (
                  <option key={g.id} value={g.id}>
                    {[g.name, g.morphs_traits, g.sex].filter(Boolean).join(', ')}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-2 text-xs text-slate-300">
                <input type="checkbox" checked={startReserve} onChange={(e) => setStartReserve(e.target.checked)} />
                Also start a reserve in Sales{signup.deposit_paid > 0 ? ', with the deposit as the first payment' : ''}
              </label>
              <Button onClick={match} disabled={saving || !geckoId} className="h-9 bg-emerald-600 hover:bg-emerald-500 text-white">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Match'}
              </Button>
            </>
          )}
        </div>
      )}
    </li>
  );
}
