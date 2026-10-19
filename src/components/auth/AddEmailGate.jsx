import { useState } from 'react';
import { Loader2, Mail } from 'lucide-react';
import { APP_LOGO_ICON_URL } from '@/lib/constants';
import { getSupabase } from '@/lib/supabaseLazy';
import { authRedirect } from '@/lib/nativeAuth';
import { useAuth } from '@/lib/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';

// Shown instead of the app to a member signed in with no email (a Facebook
// account made with only a phone number). Everything in Geck Inspect is
// tied to an email, so they add one and confirm it; confirming creates
// their profile (on_auth_user_email_added) and the app loads as normal.
export default function AddEmailGate() {
  const { logout } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [busy, setBusy] = useState(false);

  const sendLink = async (e) => {
    e.preventDefault();
    const address = email.trim();
    if (!address) return;
    setBusy(true);
    try {
      const supabase = await getSupabase();
      const { error } = await supabase.auth.updateUser({ email: address }, { emailRedirectTo: authRedirect('/MyGeckos') });
      if (error) throw error;
      setSentTo(address);
    } catch (error) {
      toast({ title: 'Could not send the link', description: error.message, variant: 'destructive' });
    } finally { setBusy(false); }
  };

  // For a link confirmed in another browser or on another device: ask
  // Supabase for the account again, and the app opens once the email is set.
  const checkAgain = async () => {
    setBusy(true);
    try {
      const supabase = await getSupabase();
      const { data } = await supabase.auth.refreshSession();
      if (!data?.user?.email) {
        toast({ title: 'Not confirmed yet', description: `Tap the link in the email sent to ${sentTo}, then try again.` });
      }
    } catch (error) {
      toast({ title: 'Could not check', description: error.message, variant: 'destructive' });
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-5">
        <div className="text-center space-y-2">
          <img src={APP_LOGO_ICON_URL} alt="" width="64" height="64" className="h-12 w-12 rounded-xl mx-auto" />
          <h1 className="text-2xl font-bold text-white">Add your email</h1>
          <p className="text-sm text-slate-300">
            Your Facebook account did not share an email. Geck Inspect uses it for your collection, feeding reminders and receipts.
          </p>
        </div>
        <Card className="shadow-xl">
          <CardContent className="pt-6 space-y-4">
            {sentTo ? (
              <div className="space-y-4">
                <p className="text-sm text-slate-300">
                  We sent a link to <strong className="text-white">{sentTo}</strong>. Tap it to confirm, and your account opens here.
                </p>
                <Button type="button" onClick={checkAgain} disabled={busy} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold">
                  {busy && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  I confirmed it
                </Button>
                <button type="button" onClick={() => setSentTo('')} className="touch:min-h-11 w-full text-sm text-slate-400 hover:text-white">
                  Use a different email
                </button>
              </div>
            ) : (
              <form onSubmit={sendLink} className="space-y-4">
                <div className="space-y-1">
                  <Label htmlFor="add-email" className="text-slate-300 text-sm">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      id="add-email"
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
                <Button type="submit" disabled={busy} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold">
                  {busy && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  Send confirmation link
                </Button>
              </form>
            )}
            <button type="button" onClick={() => logout()} className="touch:min-h-11 w-full text-sm text-slate-500 hover:text-slate-300">
              Sign out
            </button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
