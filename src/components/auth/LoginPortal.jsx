import React, { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Mail, Lock } from 'lucide-react';

export default function LoginPortal({ requiredFeature = null }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [signUpSent, setSignUpSent] = useState(false);
  const { toast } = useToast();

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
        // On success, onAuthStateChange in AuthContext updates state and re-renders the app.
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
            We sent a confirmation link to <span className="text-emerald-400">{email}</span>.
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
      <div className="w-full max-w-md space-y-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <img
            src={window.APP_LOGO_URL || 'https://i.imgur.com/gfaW2Yg.png'}
            alt="Geck Inspect"
            className="h-16 w-16 rounded-xl mx-auto"
          />
          <h1 className="text-4xl font-bold text-white">Geck Inspect</h1>
          <p className="text-slate-300">
            {requiredFeature
              ? `${requiredFeature} requires an account.`
              : 'The ultimate crested gecko breeding & identification platform'}
          </p>
        </div>

        {/* Login / Sign-up card */}
        <Card className="bg-slate-900 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white text-center text-xl">
              {isSignUp ? 'Create Account' : 'Sign In'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="email" className="text-slate-300">Email</Label>
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
                <Label htmlFor="password" className="text-slate-300">Password</Label>
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
                disabled={isLoading}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
              >
                {isLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                {isSignUp ? 'Create Account' : 'Sign In'}
              </Button>
            </form>

            <div className="mt-5 text-center">
              <button
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-emerald-400 hover:text-emerald-300 text-sm underline"
              >
                {isSignUp
                  ? 'Already have an account? Sign in'
                  : "Don't have an account? Sign up"}
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
