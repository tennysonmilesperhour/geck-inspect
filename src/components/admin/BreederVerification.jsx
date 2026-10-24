import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, Loader2, ShieldCheck, ShieldOff } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { VERIFIED_BREEDER_CHECKS } from '@/lib/verifiedBreeder';
import { storeUrl } from '@/lib/morphmarketStore';

/**
 * Breeder verification (decision D9). An admin opens a breeder page,
 * checks each item, and only then can give the "Verified breeder" badge.
 * The database refuses to verify unless every item is ticked
 * (admin_set_breeder_verified), and only admins can call it.
 */
// The same five checks the public pages describe (src/lib/verifiedBreeder.js),
// so what an admin ticks is exactly what the badge tells buyers.
export const VERIFICATION_CHECKLIST = VERIFIED_BREEDER_CHECKS;

export function checklistComplete(checklist) {
  return VERIFICATION_CHECKLIST.every((item) => checklist?.[item.key] === true);
}

function BreederRow({ row, onChanged }) {
  const { toast } = useToast();
  const [checklist, setChecklist] = useState(() => row.verification_checklist || {});
  const [saving, setSaving] = useState(false);
  const complete = checklistComplete(checklist);

  const save = async (verified) => {
    setSaving(true);
    const { error } = await supabase.rpc('admin_set_breeder_verified', {
      p_breeder_profile_id: row.breeder_profile_id,
      p_verified: verified,
      p_checklist: checklist,
    });
    setSaving(false);
    if (error) {
      toast({ title: 'Not saved', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: verified ? 'Breeder verified' : 'Badge removed', description: row.display_name || row.custom_slug });
    onChanged();
  };

  return (
    <Card className="bg-slate-900 border-slate-700">
      <CardContent className="p-4 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-semibold text-slate-100 flex items-center gap-2">
              {row.display_name || row.custom_slug || 'Unnamed breeder'}
              {row.is_verified && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 text-emerald-300 px-2 py-0.5 text-[11px] font-semibold">
                  <ShieldCheck className="w-3 h-3" /> Verified
                  {row.verified_at ? ` ${new Date(row.verified_at).toLocaleDateString()}` : ''}
                </span>
              )}
            </p>
            <p className="text-xs text-slate-400 truncate">{row.owner_email}</p>
            <p className="text-xs text-slate-500 mt-1">
              {row.gecko_count} gecko{Number(row.gecko_count) === 1 ? '' : 's'} tracked
              {' · '}{row.claimed_transfers} claimed transfer{Number(row.claimed_transfers) === 1 ? '' : 's'}
              {' · '}store {row.store_published ? 'published' : 'not published'}
              {' · '}{row.has_policies ? 'has policies' : 'no policies'}
            </p>
          </div>
          {row.custom_slug && (
            <a
              href={`/Breeder/${row.custom_slug}`}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-emerald-300 hover:underline inline-flex items-center gap-1"
            >
              Open page <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          {VERIFICATION_CHECKLIST.map((item) => (
            <label key={item.key} className="flex items-start gap-2 rounded-lg border border-slate-800 p-2 cursor-pointer">
              <Checkbox
                checked={checklist[item.key] === true}
                onCheckedChange={(v) => setChecklist((prev) => ({ ...prev, [item.key]: v === true }))}
                className="mt-0.5"
              />
              <span>
                <span className="block text-sm text-slate-200">{item.label}</span>
                <span className="block text-xs text-slate-500">{item.hint}</span>
              </span>
            </label>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 justify-end">
          {row.is_verified && (
            <Button variant="outline" size="sm" disabled={saving} onClick={() => save(false)} className="border-slate-600">
              <ShieldOff className="w-4 h-4 mr-1" /> Remove badge
            </Button>
          )}
          <Button size="sm" disabled={saving || !complete} onClick={() => save(true)} className="bg-emerald-700 hover:bg-emerald-800 text-white">
            {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <ShieldCheck className="w-4 h-4 mr-1" />}
            {row.is_verified ? 'Save checklist' : 'Verify breeder'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// Stores MorphMarket would not let verify-morphmarket-store read. The admin
// opens the store, looks for the code in its About text and decides.
function MorphMarketQueue() {
  const { toast } = useToast();
  const [rows, setRows] = useState([]);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('admin_morphmarket_review_queue');
    if (!error) setRows(Array.isArray(data) ? data : []);
  }, []);

  useEffect(() => { load(); }, [load]);

  const decide = async (row, verified) => {
    setBusyId(row.user_id);
    const { error } = await supabase.rpc('admin_set_morphmarket_verified', { p_user_id: row.user_id, p_verified: verified });
    setBusyId(null);
    if (error) {
      toast({ title: 'Not saved', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: verified ? 'MorphMarket store verified' : 'Marked as not found', description: row.store_slug });
    load();
  };

  if (rows.length === 0) return null;
  return (
    <Card className="bg-slate-900 border-amber-700/50">
      <CardContent className="p-4 space-y-3">
        <p className="font-semibold text-slate-100">MorphMarket stores to check by hand</p>
        <p className="text-xs text-slate-400">MorphMarket blocked the automatic check. Open the store and look for the code in its About text.</p>
        {rows.map((row) => (
          <div key={row.user_id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800 p-2">
            <div className="min-w-0 text-sm">
              <a href={storeUrl(row.store_slug)} target="_blank" rel="noreferrer" className="text-emerald-300 hover:underline inline-flex items-center gap-1">
                {row.store_slug} <ExternalLink className="w-3 h-3" />
              </a>
              <span className="text-slate-400"> · code <span className="font-mono text-slate-200">{row.code}</span> · {row.email}</span>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={busyId === row.user_id} onClick={() => decide(row, false)} className="border-slate-600">
                Not there
              </Button>
              <Button size="sm" disabled={busyId === row.user_id} onClick={() => decide(row, true)} className="bg-emerald-700 hover:bg-emerald-800 text-white">
                Code is there
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default function BreederVerification() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await supabase.rpc('admin_breeder_verification_queue');
    if (err) setError(err.message);
    else {
      setError(null);
      setRows(Array.isArray(data) ? data : []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;
  if (error) return <p className="text-sm text-red-300">Could not load breeder pages: {error}</p>;

  return (
    <div className="space-y-4">
      <MorphMarketQueue />
      <p className="text-sm text-slate-400">
        Every breeder page is listed here, unverified first. Tick each item after checking it, then verify.
        The badge shows on the breeder's public page.
      </p>
      {rows.length === 0 ? (
        <p className="text-sm text-slate-500 italic">No breeder pages yet. They appear when a Breeder-plan member saves My Store.</p>
      ) : (
        rows.map((row) => (
          <BreederRow key={`${row.breeder_profile_id}-${row.verified_at || ''}`} row={row} onChanged={load} />
        ))
      )}
    </div>
  );
}
