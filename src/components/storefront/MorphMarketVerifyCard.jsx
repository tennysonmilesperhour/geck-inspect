import { useCallback, useEffect, useState } from 'react';
import { Check, Copy, ExternalLink, Loader2, ShieldCheck } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { parseStoreSlug, storeUrl } from '@/lib/morphmarketStore';

/**
 * Verified MorphMarket seller. MorphMarket has no "sign in with
 * MorphMarket", so the member pastes a code into their store's About text
 * and verify-morphmarket-store finds it on the public store page. The
 * badge then shows on their breeder page.
 */

const CHECK_MESSAGES = {
  not_found: 'We read your store page but did not find the code yet. Save your About text on MorphMarket, then check again.',
  no_store: 'MorphMarket says that store does not exist. Check the link and try again.',
  needs_review: 'MorphMarket did not let us read your page automatically. We will check it by hand, usually within a day. Keep the code in your About text until then.',
};

async function callVerify(body) {
  const { data, error } = await supabase.functions.invoke('verify-morphmarket-store', { body });
  if (error) {
    let message = 'Something went wrong. Try again in a minute.';
    try {
      const parsed = await error.context?.json?.();
      if (parsed?.error) message = parsed.error;
    } catch { /* keep the default message */ }
    throw new Error(message);
  }
  return data;
}

export default function MorphMarketVerifyCard({ userId }) {
  const { toast } = useToast();
  const [row, setRow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [storeInput, setStoreInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [checkMessage, setCheckMessage] = useState('');
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase
      .from('morphmarket_store_links')
      .select('store_slug, code, status, needs_review, last_check_result')
      .eq('user_id', userId)
      .maybeSingle();
    setRow(data || null);
    if (data?.status === 'pending' && data.needs_review) setCheckMessage(CHECK_MESSAGES.needs_review);
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const run = async (body, after) => {
    setBusy(true);
    try {
      const data = await callVerify(body);
      after?.(data);
      await load();
    } catch (err) {
      toast({ title: 'Not done', description: err.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const start = () => {
    if (!parseStoreSlug(storeInput)) {
      toast({ title: 'That is not a store link', description: 'Paste the link to your MorphMarket store, like https://www.morphmarket.com/stores/yourstore/', variant: 'destructive' });
      return;
    }
    setCheckMessage('');
    run({ action: 'start', store: storeInput });
  };

  const check = () => run({ action: 'check' }, (data) => {
    if (data?.status === 'verified') {
      setCheckMessage('');
      toast({ title: 'MorphMarket store verified', description: 'You can take the code out of your About text now.' });
    } else {
      setCheckMessage(CHECK_MESSAGES[data?.status] || '');
    }
  });

  const remove = () => run({ action: 'remove' }, () => { setStoreInput(''); setCheckMessage(''); });

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(row.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: 'Copy it by hand', description: row.code });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className={`w-5 h-5 ${row?.status === 'verified' ? 'text-emerald-400' : 'text-slate-500'}`} />
          MorphMarket store
        </CardTitle>
        <CardDescription>
          Prove the MorphMarket store is yours and your page shows a Verified MorphMarket seller badge that links to it.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
        ) : row?.status === 'verified' ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-300">
              Verified:{' '}
              <a href={storeUrl(row.store_slug)} target="_blank" rel="noopener noreferrer" className="text-emerald-300 hover:underline inline-flex items-center gap-1">
                {row.store_slug} <ExternalLink className="w-3 h-3" />
              </a>
            </p>
            <Button variant="outline" size="sm" disabled={busy} onClick={remove} className="border-slate-600">
              Remove from my page
            </Button>
          </div>
        ) : row ? (
          <div className="space-y-4">
            <ol className="list-decimal pl-5 space-y-2 text-sm text-slate-300">
              <li>
                Copy this code:{' '}
                <button type="button" onClick={copyCode} className="inline-flex items-center gap-1 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 font-mono text-emerald-200">
                  {row.code} {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                </button>
              </li>
              <li>
                On MorphMarket, open your store settings and paste it anywhere in your About text, then save.{' '}
                <a href={storeUrl(row.store_slug)} target="_blank" rel="noopener noreferrer" className="text-emerald-300 hover:underline inline-flex items-center gap-1">
                  Your store <ExternalLink className="w-3 h-3" />
                </a>
              </li>
              <li>Come back and press Check my store. Once it is verified you can delete the code.</li>
            </ol>
            {checkMessage && <p className="text-sm text-amber-200">{checkMessage}</p>}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" disabled={busy} onClick={check} className="bg-emerald-700 hover:bg-emerald-800 text-white">
                {busy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <ShieldCheck className="w-4 h-4 mr-1" />}
                Check my store
              </Button>
              <Button variant="outline" size="sm" disabled={busy} onClick={remove} className="border-slate-600">
                Use a different store
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="morphmarket-store">Your MorphMarket store link</Label>
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                id="morphmarket-store"
                value={storeInput}
                onChange={(e) => setStoreInput(e.target.value)}
                placeholder="https://www.morphmarket.com/stores/yourstore/"
              />
              <Button disabled={busy || !storeInput.trim()} onClick={start} className="bg-emerald-700 hover:bg-emerald-800 text-white whitespace-nowrap">
                {busy && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                Get my code
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
