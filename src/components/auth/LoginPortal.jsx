import React, { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Mail, Lock } from 'lucide-react';

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

export default function LoginPortal({ requiredFeature = null }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [signUpSent, setSignUpSent] = useState(false);
  const { toast } = useToast();

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (error) {
      toast({ title: 'Google sign-in failed', description: error.message, variant: 'destructive' });
      setIsGoogleLoading(false);
    }
    // On success, Supabase redirects the browser — no need to reset state.
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) {
          toast({ title: 'Sign up failed', description: error.message, variant: 'destructive' });
        } else {
          setSignUpSent(true);
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          toast({ title: 'Sign in failed', description: error.message, variant: 'destructive' });
        }
        // On success, onAuthStateChange in AuthContext re-renders the app.
      }
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setIsLoading(false);
  };

  if (signUpSent) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center space-y-6">
          <img
            src={window.APP_LOGO_URL || 'https://i.imgur.com/gfaW2Yg.png'}
            alt="Geck Inspect"
            className="h-16 w-16 rounded-xl mx-auto"
          />
          <h1 className="text-3xl font-bold text-white">Check your email</h1>
          <p className="text-slate-300">
            We sent a confirmation link to{' '}
            <span className="text-emerald-400">{email}</span>.
            Click it to activate your account, then come back and sign in.
          </p>
          <button
            onClick={() => { setIsSignUp(false); setSignUpSent(false); }}
            className="text-emerald-400 hover:text-emerald-300 underline text-sm"
          >
            Back to sign in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-7">

        {/* Branding */}
        <div className="text-center space-y-3">
          <img
            src={window.APP_LOGO_URL || 'https://i.imgur.com/gfaW2Yg.png'}
            alt="Geck Inspect"
            className="h-16 w-16 rounded-xl mx-auto"
          />
          <h1 className="text-4xl font-bold text-white">Geck Inspect</h1>
          <p className="text-sm font-semibold text-emerald-300">
            <span className="font-bold">geckOS</span> — the ultimate gecko operating system
          </p>
          <p className="text-slate-400 text-sm">
            {requiredFeature
              ? `${requiredFeature} requires an account — sign in or create one below.`
              : 'Sign in to continue to your collection.'}
          </p>
        </div>

        {/* Auth card */}
        <Card className="bg-slate-900 border-slate-700 shadow-xl">
          <CardContent className="pt-6 space-y-5">

            {/* Tab toggle */}
            <div className="flex bg-slate-800 rounded-lg p-1 gap-1">
              <button
                onClick={() => setIsSignUp(false)}
                className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
                  !isSignUp
                    ? 'bg-emerald-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Sign In
              </button>
              <button
                onClick={() => setIsSignUp(true)}
                className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
                  isSignUp
                    ? 'bg-emerald-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Create Account
              </button>
            </div>

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

            {/* Email / password form */}
            <form onSubmit={handleSubmit} className="space-y-4">
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
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="password" className="text-slate-300 text-sm">Password</Label>
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
                    minLength={6}
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={isLoading || isGoogleLoading}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
              >
                {isLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                {isSignUp ? 'Create Account' : 'Sign In'}
              </Button>
            </form>

          </CardContent>
        </Card>

        <p className="text-center text-xs text-slate-600">
          By continuing you agree to our terms of service and privacy policy.
        </p>
      </div>
    </div>
  );
}
