import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Lock } from 'lucide-react';

/**
 * Second half of the forgot-password flow. The reset email sends the
 * keeper to /AuthPortal?mode=reset; Supabase turns the link into a
 * recovery session, so by the time this renders they are signed in and
 * only need to choose a new password.
 */
export default function SetNewPassword() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [done, setDone] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password.length < 8) {
      toast({ title: 'Use at least 8 characters', variant: 'destructive' });
      return;
    }
    if (password !== confirm) {
      toast({ title: 'The two passwords do not match', variant: 'destructive' });
      return;
    }
    setIsLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setIsLoading(false);
    if (error) {
      toast({ title: 'Could not update the password', description: error.message, variant: 'destructive' });
      return;
    }
    setDone(true);
    setTimeout(() => navigate('/MyGeckos', { replace: true }), 1200);
  };

  return (
    <div className="flex-1 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-slate-900 border-slate-700 shadow-xl">
        <CardContent className="pt-6 space-y-5">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-white">Choose a new password</h1>
            <p className="text-sm text-slate-400">
              You are signed in through the reset link. Pick a new password and you are done.
            </p>
          </div>
          {done ? (
            <p className="text-emerald-300 font-medium">Password updated. Taking you to your collection.</p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="new-password" className="text-slate-300 text-sm">New password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    id="new-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 bg-slate-800 border-slate-600 text-white focus:border-emerald-500"
                    required
                    minLength={8}
                    autoComplete="new-password"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="confirm-password" className="text-slate-300 text-sm">Confirm password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    id="confirm-password"
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className="pl-10 bg-slate-800 border-slate-600 text-white focus:border-emerald-500"
                    required
                    minLength={8}
                    autoComplete="new-password"
                  />
                </div>
              </div>
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
              >
                {isLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Save new password
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
