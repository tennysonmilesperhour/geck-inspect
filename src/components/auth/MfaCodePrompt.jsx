import { useEffect, useState } from 'react';
import { KeyRound, Loader2 } from 'lucide-react';
import { APP_LOGO_ICON_URL } from '@/lib/constants';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { queryClientInstance } from '@/lib/query-client';
import { dataCache } from '@/lib/layoutCache';
import { CODE_LENGTH, cleanCode, totpFactors, verifyCode } from '@/lib/mfa';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// The sign-in code step (MfaStepUpGate shows it). The account has an
// authenticator app, and this session signed in with a password or link
// only, so it asks for the app's 6-digit code before any page opens.
// A correct code raises the session to aal2; the gate checks again
// (onVerified, and on Supabase's MFA_CHALLENGE_VERIFIED event) and opens
// the app. Same screen on the website and in the iPhone app.
export default function MfaCodePrompt({ onVerified }) {
  const { logout } = useAuth();
  const [factors, setFactors] = useState(null);
  const [factorId, setFactorId] = useState('');
  const [loadFailed, setLoadFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    supabase.auth.mfa.listFactors()
      .then(({ data, error: listError }) => {
        if (!live) return;
        if (listError) throw listError;
        const { verified } = totpFactors(data);
        setFactors(verified);
        setFactorId((current) => current || verified[0]?.id || '');
        setLoadFailed(false);
        // The stored session still lists an authenticator the account no
        // longer has (removed on another device). A fresh session drops
        // it, and the gate then opens the app.
        if (verified.length === 0) supabase.auth.refreshSession().catch(() => {});
      })
      .catch(() => { if (live) setLoadFailed(true); });
    return () => { live = false; };
  }, [attempt]);

  const submit = async (event) => {
    event.preventDefault();
    if (busy || !factorId) return;
    setBusy(true);
    setError('');
    const result = await verifyCode(supabase, factorId, code);
    if (result.error) {
      setError(result.error);
      setCode('');
      setBusy(false);
      return;
    }
    // Anything read before the code (with fewer rights) is read again.
    dataCache.clearAll();
    queryClientInstance.invalidateQueries();
    // Normally the gate opens the app now and this screen goes away.
    await Promise.resolve(onVerified?.()).catch(() => {});
    setBusy(false);
  };

  const signOut = () => {
    logout().catch(() => {});
  };

  return (
    <div className="min-h-screen min-h-dvh bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 flex items-center justify-center p-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-[calc(1rem+env(safe-area-inset-bottom))]">
      <div className="w-full max-w-md space-y-5">
        <div className="text-center space-y-2">
          <img src={APP_LOGO_ICON_URL} alt="" width="64" height="64" className="h-12 w-12 rounded-xl mx-auto" />
          <h1 className="text-2xl font-bold text-white">Enter your sign-in code</h1>
          <p className="text-sm text-slate-300">
            This account uses two-factor sign-in. Open your authenticator app and type the 6-digit code it shows for Geck Inspect.
          </p>
        </div>
        <Card className="shadow-xl">
          <CardContent className="pt-6 space-y-4">
            {loadFailed ? (
              <div className="space-y-3" role="alert">
                <p className="text-sm text-slate-300">Could not reach Geck Inspect to check your sign-in. Check your connection and try again.</p>
                <Button type="button" onClick={() => setAttempt((n) => n + 1)} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold">
                  Try again
                </Button>
              </div>
            ) : factors === null ? (
              <div className="flex justify-center py-4" role="status" aria-label="Loading">
                <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
              </div>
            ) : factors.length === 0 ? (
              <p className="text-sm text-slate-300" role="alert">
                This account has no authenticator app to check. Sign out, then sign in again.
              </p>
            ) : (
              <form onSubmit={submit} className="space-y-4" noValidate>
                {factors.length > 1 && (
                  <div className="space-y-1">
                    <Label htmlFor="mfa-factor" className="text-slate-300 text-sm">Authenticator</Label>
                    <select
                      id="mfa-factor"
                      value={factorId}
                      onChange={(e) => setFactorId(e.target.value)}
                      className="touch:min-h-11 w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white"
                    >
                      {factors.map((f) => (
                        <option key={f.id} value={f.id}>{f.friendly_name || 'Authenticator app'}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="space-y-1">
                  <Label htmlFor="mfa-code" className="text-slate-300 text-sm">6-digit code</Label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" aria-hidden="true" />
                    <Input
                      id="mfa-code"
                      value={code}
                      onChange={(e) => setCode(cleanCode(e.target.value))}
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      pattern="[0-9]*"
                      maxLength={CODE_LENGTH + 2}
                      placeholder="123456"
                      autoFocus
                      aria-invalid={error ? true : undefined}
                      aria-describedby={error ? 'mfa-code-error' : undefined}
                      className="pl-10 tracking-[0.3em] text-lg bg-slate-800 border-slate-600 text-white placeholder-slate-600 focus:border-emerald-500"
                    />
                  </div>
                  {error && (
                    <p id="mfa-code-error" role="alert" className="text-sm text-red-300">{error}</p>
                  )}
                </div>
                <Button
                  type="submit"
                  disabled={busy || code.length !== CODE_LENGTH || !factorId}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                >
                  {busy && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  Confirm code
                </Button>
                <p className="text-xs text-slate-400">
                  Lost your phone? Add Geck Inspect to an authenticator app on a new phone with the secret key you saved when you set this up, then use its code.
                </p>
              </form>
            )}
            <button type="button" onClick={signOut} disabled={busy} className="touch:min-h-11 w-full text-sm text-slate-500 hover:text-slate-300">
              Sign out
            </button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
