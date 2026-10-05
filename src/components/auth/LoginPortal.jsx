import { authRedirect } from '@/lib/nativeAuth';
import { redirectFromSearch, rememberPostAuthRedirect } from '@/lib/postAuthRedirect';
import { isNativePlatform, detectPlatform } from '@/lib/revenuecat';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { APP_LOGO_ICON_URL } from '@/lib/constants';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Mail, Lock, User as UserIcon, Check, ArrowLeft } from 'lucide-react';
import { readPendingGecko } from '@/lib/firstGeckoFlow';
import { isGuestMode } from '@/lib/guestMode';

// Supabase refuses a password sign-in for an unconfirmed address with
// code email_not_confirmed (older versions only say so in the message).
export function isEmailNotConfirmed(error) {
  if (!error) return false;
  if (error.code === 'email_not_confirmed') return true;
  return /email not confirmed/i.test(error.message || '');
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

// Where email links bring people back. Confirmation lands in the app;
// password resets land on the "choose a new password" form.


export default function LoginPortal({ requiredFeature: _requiredFeature = null }) {
  // ?mode=signup opens on Create Account (landing page CTAs and the morph
  // ID guest hand-off use it); ?mode=forgot opens the reset form.
  const [searchParams] = useSearchParams();
  const initialMode = searchParams.get('mode');
  // A claim link or collection invite sent the visitor here with
  // ?redirect= or ?next=; remember it so they land back there after signing
  // in, confirming their email, or coming back from Google.
  useEffect(() => {
    const target = redirectFromSearch(window.location.search);
    if (target) rememberPostAuthRedirect(target);
  }, []);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // Asked at sign-up so new members are not shown as "Geck Inspect
  // member" everywhere until they find Settings (audit step 32). The
  // profile trigger copies it from the sign-up metadata into full_name.
  const [displayName, setDisplayName] = useState('');
  // Set when a password sign-in is refused because the email is not
  // confirmed yet, so the form can offer to send the link again.
  const [unconfirmed, setUnconfirmed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(initialMode === 'signup');
  const [isForgot, setIsForgot] = useState(initialMode === 'forgot');
  const [signUpSent, setSignUpSent] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  // A gecko the visitor typed in the guest demo, saved once the account
  // exists (My Geckos picks it up), and the way back to the demo.
  const [pendingGeckoName] = useState(() => readPendingGecko()?.name || null);
  const [fromDemo] = useState(() => isGuestMode());
  const { toast } = useToast();

  useEffect(() => {
    if (initialMode === 'signup') setIsSignUp(true);
    if (initialMode === 'forgot') setIsForgot(true);
    if (new URLSearchParams(window.location.search).get('authError') === 'callback') {
      toast({ title: 'Sign-in link could not be completed', description: 'Request a fresh link and open it on the device where you started sign-in.', variant: 'destructive' });
    }
    // An expired or already-used confirmation or reset link comes back with
    // error_description in the URL hash; it used to land on a plain sign-in
    // form with no word about what went wrong.
    const hashParams = new URLSearchParams(window.location.hash.slice(1));
    const linkError = hashParams.get('error_description') || new URLSearchParams(window.location.search).get('error_description');
    if (linkError) {
      toast({ title: 'That email link has expired or was already used', description: 'Request a fresh one below.', variant: 'destructive' });
      if (initialMode === 'reset') setIsForgot(true);
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }, [initialMode]);

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    try {
      const native = isNativePlatform();
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google', options: { redirectTo: authRedirect('/MyGeckos'), skipBrowserRedirect: native },
      });
      if (error) throw error;
      if (native) {
        if (!data?.url) throw new Error('Google sign-in did not return a URL.');
        const { Browser } = await import('@capacitor/browser');
        await Browser.open({ url: data.url });
      }
    } catch (error) {
      toast({ title: 'Google sign-in failed', description: error.message, variant: 'destructive' });
    } finally { setIsGoogleLoading(false); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      if (isSignUp) {
        const name = displayName.trim().slice(0, 60);
        if (!name) {
          toast({ title: 'Add a display name', description: 'This is the name other keepers see on your posts and geckos.', variant: 'destructive' });
          setIsLoading(false);
          return;
        }
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: authRedirect('/MyGeckos'),
            data: { full_name: name },
          },
        });
        if (error) {
          toast({ title: 'Sign up failed', description: error.message, variant: 'destructive' });
        } else if (data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
          // Supabase answers a signup for an already-confirmed email with a
          // fake success and sends nothing (it hides which addresses exist).
          // The one visible tell is an empty identities array. Without this
          // branch the user sits on "Check your email" waiting for a message
          // that was never sent.
          toast({
            title: 'This email already has an account',
            description: 'Sign in with your password, or use "Forgot password" if you need a new one.',
          });
          setIsSignUp(false);
        } else {
          setSignUpSent(true);
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error && isEmailNotConfirmed(error)) {
          setUnconfirmed(true);
        } else if (error) {
          setUnconfirmed(false);
          toast({ title: 'Sign in failed', description: error.message, variant: 'destructive' });
        } else if (!rememberMe) {
          // Mark session as ephemeral, AuthContext will clear it on tab close
          sessionStorage.setItem('geck_inspect_ephemeral_session', '1');
        } else {
          sessionStorage.removeItem('geck_inspect_ephemeral_session');
          localStorage.removeItem('geck_inspect_unload_ts');
        }
        // On success, onAuthStateChange in AuthContext re-renders the app.
      }
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setIsLoading(false);
  };

  const handleResendConfirmation = async () => {
    setIsLoading(true);
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: authRedirect('/MyGeckos') },
    });
    if (error) {
      toast({ title: 'Could not resend the email', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Sent again', description: `A fresh confirmation link is on its way to ${email}.` });
    }
    setIsLoading(false);
  };

  const handleForgot = async (e) => {
    e.preventDefault();
    if (!email) {
      toast({ title: 'Enter the email you signed up with', variant: 'destructive' });
      return;
    }
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: authRedirect('/AuthPortal?mode=reset'),
      });
      if (error) {
        toast({ title: 'Could not send the reset email', description: error.message, variant: 'destructive' });
      } else {
        setResetSent(true);
      }
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setIsLoading(false);
  };

  if (signUpSent || resetSent) {
    const isReset = resetSent;
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center space-y-6">
          <img
            src={APP_LOGO_ICON_URL}
            alt="Geck Inspect"
            className="h-16 w-16 rounded-xl mx-auto"
          />
          <h1 className="text-3xl font-bold text-white">Check your email</h1>
          <p className="text-slate-300">
            We sent {isReset ? 'a password reset link' : 'a confirmation link'} to{' '}
            <span className="text-emerald-400">{email}</span>.{' '}
            {isReset
              ? 'Open it on this device and you will be asked to choose a new password.'
              : 'Click the link and we will bring you straight into the app.'}
          </p>
          <p className="text-slate-500 text-sm">
            Nothing in your inbox after a minute? Check spam, or try again with the address you used.
          </p>
          {!isReset && (
            <button
              type="button"
              onClick={handleResendConfirmation}
              disabled={isLoading}
              className="text-emerald-400 hover:text-emerald-300 underline text-sm touch:min-h-11 disabled:opacity-50 block mx-auto"
            >
              {isLoading ? 'Sending...' : 'Resend confirmation email'}
            </button>
          )}
          <button
            onClick={() => { setIsSignUp(false); setIsForgot(false); setSignUpSent(false); setResetSent(false); }}
            className="text-emerald-400 hover:text-emerald-300 underline text-sm touch:min-h-11"
          >
            Back to sign in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-5 md:space-y-7">

        {/* Branding. The logo leads back to the landing page (there was no
            way back before). Sign-up gets a short reminder of what the
            free account includes, each line true today: the Free plan's
            10 geckos (src/lib/tierLimits.js), value estimates on every
            plan, and one free Morph ID. */}
        <div className="text-center space-y-2 md:space-y-3">
          <Link to="/" className="inline-block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400" aria-label="Geck Inspect home">
            <img
              src={APP_LOGO_ICON_URL}
              alt=""
              width="64"
              height="64"
              className="h-12 w-12 md:h-16 md:w-16 rounded-xl mx-auto"
            />
          </Link>
          <h1 className="text-2xl md:text-4xl font-bold text-white">
            {isForgot ? 'Geck Inspect' : isSignUp ? 'Create your free account' : 'Welcome back'}
          </h1>
          {isSignUp && !isForgot && pendingGeckoName && (
            <p className="rounded-lg border border-emerald-500/40 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-100">
              {pendingGeckoName} is waiting. It goes straight into your collection once your account exists.
            </p>
          )}
          {isSignUp && !isForgot && (
            <ul className="inline-flex flex-col items-start gap-1 md:gap-1.5 text-sm text-slate-300 text-left">
              {[
                'Up to 10 geckos free, no credit card',
                'Value estimates from real crested gecko listings',
                'Your first AI Morph ID is free',
              ].map((line) => (
                <li key={line} className="flex items-start gap-2">
                  <Check className="w-4 h-4 mt-0.5 text-emerald-400 shrink-0" aria-hidden="true" />
                  {line}
                </li>
              ))}
            </ul>
          )}
        </div>

        {fromDemo && (
          <div className="text-center">
            <Link to="/Dashboard" className="touch:min-h-11 inline-flex items-center gap-1.5 text-sm text-slate-300 hover:text-white">
              <ArrowLeft className="w-4 h-4" /> Back to the demo
            </Link>
          </div>
        )}

        {/* Auth card */}
        <Card className="shadow-xl">
          <CardContent className="pt-6 space-y-5">

            {isForgot ? (
              <form onSubmit={handleForgot} className="space-y-4">
                <div className="space-y-1">
                  <h2 className="text-lg font-semibold text-white">Reset your password</h2>
                  <p className="text-sm text-slate-400">
                    Enter the email you signed up with and we will send a link to choose a new password.
                  </p>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="email" className="text-slate-300 text-sm">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="pl-10 bg-slate-800 border-slate-600 text-white placeholder-slate-500 focus:border-emerald-500"
                      required
                      autoComplete="email"
                    />
                  </div>
                </div>
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                >
                  {isLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  Send reset link
                </Button>
                <button
                  type="button"
                  onClick={() => setIsForgot(false)}
                  className="w-full text-center text-sm touch:min-h-11 text-slate-400 hover:text-white"
                >
                  Back to sign in
                </button>
              </form>
            ) : (
              <>
                {/* Tab toggle */}
                <div className="flex bg-slate-800 rounded-lg p-1 gap-1">
                  <button
                    type="button"
                    onClick={() => setIsSignUp(false)}
                    className={`flex-1 py-2 touch:min-h-11 rounded-md text-sm font-medium transition-colors ${
                      !isSignUp
                        ? 'bg-emerald-600 text-white shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsSignUp(true)}
                    className={`flex-1 py-2 touch:min-h-11 rounded-md text-sm font-medium transition-colors ${
                      isSignUp
                        ? 'bg-emerald-600 text-white shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Create Account
                  </button>
                </div>

                {detectPlatform() !== "ios" && <>
                {/* Google OAuth */}
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleGoogleSignIn}
                  disabled={isGoogleLoading || isLoading}
                  className="w-full bg-white hover:bg-slate-100 text-slate-900 border-slate-300 font-medium gap-2"
                >
                  {isGoogleLoading
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <GoogleIcon />}
                  Continue with Google
                </Button>

                {/* Divider */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-slate-700" />
                  <span className="text-xs text-slate-500 uppercase tracking-wider">or</span>
                  <div className="flex-1 h-px bg-slate-700" />
                </div>

                </>}
                {/* Email / password form */}
                <form onSubmit={handleSubmit} className="space-y-4">
                  {unconfirmed && !isSignUp && (
                    <div role="alert" className="rounded-lg border border-amber-700 bg-amber-950/40 p-3 space-y-2">
                      <p className="text-sm font-semibold text-amber-100">Confirm your email first</p>
                      <p className="text-xs text-amber-200/80">
                        Open the confirmation link we sent to {email || 'your email'}. Can&apos;t find it? Check spam, or send a new one.
                      </p>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={isLoading || !email}
                        onClick={handleResendConfirmation}
                        className="border-amber-600 bg-transparent text-amber-100 hover:bg-amber-900/40"
                      >
                        {isLoading ? 'Sending...' : 'Resend confirmation email'}
                      </Button>
                    </div>
                  )}
                  {isSignUp && (
                    <div className="space-y-1">
                      <Label htmlFor="display-name" className="text-slate-300 text-sm">Display name</Label>
                      <div className="relative">
                        <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                          id="display-name"
                          type="text"
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          placeholder="Your name or breeding name"
                          className="pl-10 bg-slate-800 border-slate-600 text-white placeholder-slate-500 focus:border-emerald-500"
                          required
                          maxLength={60}
                          autoComplete="nickname"
                        />
                      </div>
                      <p className="text-xs text-slate-500">Shown on your posts and geckos. You can change it later.</p>
                    </div>
                  )}
                  <div className="space-y-1">
                    <Label htmlFor="email" className="text-slate-300 text-sm">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="pl-10 bg-slate-800 border-slate-600 text-white placeholder-slate-500 focus:border-emerald-500"
                        required
                        autoComplete="email"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password" className="text-slate-300 text-sm">Password</Label>
                      {!isSignUp && (
                        <button
                          type="button"
                          onClick={() => setIsForgot(true)}
                          className="text-xs touch:min-h-11 text-emerald-400 hover:text-emerald-300"
                        >
                          Forgot password?
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="pl-10 bg-slate-800 border-slate-600 text-white placeholder-slate-500 focus:border-emerald-500"
                        required
                        minLength={isSignUp ? 8 : 6}
                        autoComplete={isSignUp ? 'new-password' : 'current-password'}
                      />
                    </div>
                    {isSignUp && (
                      <p className="text-xs text-slate-500">At least 8 characters.</p>
                    )}
                  </div>

                  {!isSignUp && (
                    <label className="flex items-center gap-2 touch:min-h-11 cursor-pointer select-none">
                      <Checkbox
                        checked={rememberMe}
                        onCheckedChange={(checked) => setRememberMe(!!checked)}
                      />
                      <span className="text-sm text-slate-400">Stay signed in</span>
                    </label>
                  )}

                  <Button
                    type="submit"
                    disabled={isLoading || isGoogleLoading}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                  >
                    {isLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                    {isSignUp ? 'Create free account' : 'Sign In'}
                  </Button>
                </form>
              </>
            )}

          </CardContent>
        </Card>

        <p className="text-center text-xs text-slate-500">
          By continuing you agree to our{' '}
          <Link to="/Terms" className="underline hover:text-slate-300">terms of service</Link>
          {' '}and{' '}
          <Link to="/PrivacyPolicy" className="underline hover:text-slate-300">privacy policy</Link>.
        </p>
      </div>
    </div>
  );
}
