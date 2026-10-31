import { useCallback, useEffect, useState } from 'react';
import { Copy, KeyRound, Loader2, ShieldCheck, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import {
  CODE_LENGTH,
  authenticatorName,
  cleanCode,
  groupSecret,
  qrImageSrc,
  shortDate,
  totpFactors,
  verifyCode,
} from '@/lib/mfa';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

// Settings, Security: two-factor sign-in for the admin account (Settings
// only shows it to admins). Adds an authenticator app with Supabase's
// mfa.enroll, checks the first code with mfa.challenge and mfa.verify,
// lists the apps added, and removes one after a confirm step on the page.
// The rules behind it are in src/lib/mfa.js.

const canCopy = () => typeof navigator !== 'undefined' && Boolean(navigator.clipboard?.writeText);
// An otpauth:// link opens the authenticator app on the same phone, where
// a QR code on the screen cannot be scanned.
const onTouchDevice = () => {
  try { return Boolean(window.matchMedia?.('(pointer: coarse)')?.matches); } catch { return false; }
};

export default function SecurityCard() {
  const [factors, setFactors] = useState(null); // { verified, unverified } once loaded
  const [loadError, setLoadError] = useState(false);
  const [setup, setSetup] = useState(null); // { id, qr, secret, uri } while adding an app
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null); // { tone: 'ok' | 'error', text }
  const [confirmRemove, setConfirmRemove] = useState(null); // factor id
  const [copied, setCopied] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;
      setFactors(totpFactors(data));
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const startSetup = async () => {
    setBusy(true);
    setNotice(null);
    try {
      // A setup started earlier and never finished would block a new one.
      for (const f of factors?.unverified ?? []) {
        await supabase.auth.mfa.unenroll({ factorId: f.id });
      }
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: authenticatorName(new Date()),
        issuer: 'Geck Inspect',
      });
      if (error) throw error;
      setSetup({ id: data.id, qr: qrImageSrc(data.totp?.qr_code), secret: data.totp?.secret || '', uri: data.totp?.uri || '' });
      setCode('');
      setCopied(false);
    } catch (error) {
      setNotice({
        tone: 'error',
        text: error?.code === 'insufficient_aal'
          ? 'Sign out, sign back in with your current authenticator code, then add another app.'
          : 'Could not start the setup. Check your connection and try again.',
      });
    } finally {
      setBusy(false);
    }
  };

  const cancelSetup = async () => {
    const pending = setup;
    setSetup(null);
    setCode('');
    setNotice(null);
    if (pending) await supabase.auth.mfa.unenroll({ factorId: pending.id }).catch(() => {});
    refresh();
  };

  const confirmSetup = async (event) => {
    event.preventDefault();
    if (!setup || busy) return;
    setBusy(true);
    setNotice(null);
    const result = await verifyCode(supabase, setup.id, code);
    setBusy(false);
    if (result.error) {
      setNotice({ tone: 'error', text: result.error });
      setCode('');
      return;
    }
    setSetup(null);
    setCode('');
    setNotice({ tone: 'ok', text: 'Two-factor sign-in is on. Next time you sign in, Geck Inspect will ask for a code from your authenticator app.' });
    refresh();
  };

  const remove = async (factorId) => {
    setBusy(true);
    setNotice(null);
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId });
      if (error) throw error;
      setConfirmRemove(null);
      setNotice({ tone: 'ok', text: 'Authenticator removed.' });
      // A fresh session stops listing the app, so sign-in stops asking for it.
      await supabase.auth.refreshSession().catch(() => {});
    } catch (error) {
      setNotice({
        tone: 'error',
        text: error?.code === 'insufficient_aal'
          ? 'Sign out, sign back in with your authenticator code, then remove it.'
          : 'Could not remove the authenticator. Check your connection and try again.',
      });
    } finally {
      setBusy(false);
      refresh();
    }
  };

  const copySecret = async () => {
    try {
      await navigator.clipboard.writeText(setup.secret);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const verified = factors?.verified ?? [];
  const isOn = verified.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-slate-100 flex items-center gap-2">
          <ShieldCheck className="w-5 h-5" />
          Security
          {factors && (
            <Badge className={isOn ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/40' : 'bg-slate-800 text-slate-300 border border-slate-600'}>
              {isOn ? 'Two-factor on' : 'Two-factor off'}
            </Badge>
          )}
        </CardTitle>
        <CardDescription className="text-slate-400">
          Two-factor sign-in for this admin account.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm text-slate-300">
        <p>
          Two-factor sign-in asks for a 6-digit code from an authenticator app on your phone every time you sign in, as well as your password or sign-in link.
        </p>
        <p>
          Why: this account has admin powers (member records, payments, the admin panel). With two-factor sign-in, Geck Inspect asks for a code from your phone every time you sign in, so a password on its own is not enough to open the app.
        </p>
        <p>
          If you lose your phone, the secret key shown during setup is how you add the account to a new authenticator app. Save it somewhere safe, such as a password manager, before you finish.
        </p>

        {loadError && (
          <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-red-200">
            <span>Could not load your authenticator apps.</span>
            <Button type="button" size="sm" variant="outline" onClick={refresh}>Try again</Button>
          </div>
        )}

        {!factors && !loadError && (
          <div className="flex items-center gap-2 text-slate-400" role="status">
            <Loader2 className="w-4 h-4 animate-spin" /> Checking two-factor sign-in
          </div>
        )}

        {verified.length > 0 && (
          <ul className="space-y-2" aria-label="Authenticator apps">
            {verified.map((f) => (
              <li key={f.id} className="rounded-lg border border-slate-700 bg-slate-800/50 p-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-100 truncate">{f.friendly_name || 'Authenticator app'}</p>
                    <p className="text-xs text-slate-400">Added {shortDate(f.created_at)}</p>
                  </div>
                  {confirmRemove !== f.id && (
                    <Button type="button" size="sm" variant="outline" onClick={() => { setConfirmRemove(f.id); setNotice(null); }} disabled={busy}>
                      <Trash2 className="w-4 h-4 mr-1.5" /> Remove
                    </Button>
                  )}
                </div>
                {confirmRemove === f.id && (
                  <div className="mt-3 space-y-3 rounded-md border border-amber-500/40 bg-amber-500/10 p-3" role="group" aria-label="Confirm removal">
                    <p className="text-amber-100">
                      Remove this authenticator? Sign-in will stop asking for its code. If admin powers need a code, they stop working until you add an app again.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" size="sm" onClick={() => remove(f.id)} disabled={busy} className="bg-red-600 hover:bg-red-500 text-white">
                        {busy && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
                        Yes, remove it
                      </Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => setConfirmRemove(null)} disabled={busy}>
                        Keep it
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        {setup ? (
          <form onSubmit={confirmSetup} className="space-y-4 rounded-lg border border-slate-700 bg-slate-900/60 p-4" aria-label="Set up an authenticator app">
            <ol className="list-decimal space-y-4 pl-5">
              <li>
                <p>Open an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password or the iPhone Passwords app) and scan this QR code.</p>
                {setup.qr && (
                  <img src={setup.qr} alt="QR code for your authenticator app" width="180" height="180" className="mt-3 h-44 w-44 rounded-md bg-white p-2" />
                )}
                {setup.uri && onTouchDevice() && (
                  <a href={setup.uri} className="mt-3 inline-flex touch:min-h-11 items-center text-emerald-300 underline">
                    On this phone? Add it to your authenticator app
                  </a>
                )}
              </li>
              <li>
                <p>Can't scan it? Type this secret key into the app instead:</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <code className="rounded bg-slate-800 px-3 py-2 font-mono text-base tracking-wider text-slate-100 break-all" data-testid="mfa-secret">
                    {groupSecret(setup.secret)}
                  </code>
                  {canCopy() && (
                    <Button type="button" size="sm" variant="outline" onClick={copySecret}>
                      <Copy className="w-4 h-4 mr-1.5" /> {copied ? 'Copied' : 'Copy'}
                    </Button>
                  )}
                </div>
              </li>
              <li>
                <p>Save the secret key somewhere safe, such as a password manager. It is the only way to set up a new phone if you lose this one.</p>
              </li>
              <li>
                <Label htmlFor="mfa-setup-code" className="text-slate-300">Type the 6-digit code the app shows for Geck Inspect</Label>
                <div className="relative mt-2 max-w-xs">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" aria-hidden="true" />
                  <Input
                    id="mfa-setup-code"
                    value={code}
                    onChange={(e) => setCode(cleanCode(e.target.value))}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]*"
                    placeholder="123456"
                    className="pl-10 tracking-[0.3em] bg-slate-800 border-slate-600 text-slate-100"
                  />
                </div>
              </li>
            </ol>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={busy || code.length !== CODE_LENGTH} className="bg-emerald-600 hover:bg-emerald-500 text-white">
                {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Turn on two-factor sign-in
              </Button>
              <Button type="button" variant="outline" onClick={cancelSetup} disabled={busy}>
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          factors && (
            <Button type="button" onClick={startSetup} disabled={busy} className="bg-emerald-600 hover:bg-emerald-500 text-white">
              {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isOn ? 'Add another authenticator app' : 'Set up an authenticator app'}
            </Button>
          )
        )}

        {notice && (
          <p
            role={notice.tone === 'error' ? 'alert' : 'status'}
            className={notice.tone === 'error' ? 'text-red-300' : 'text-emerald-300'}
          >
            {notice.text}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
