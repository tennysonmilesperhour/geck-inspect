import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Check, Trash2, ExternalLink, Loader2, Cloud, Copy } from 'lucide-react';
import { SocialPlatformConnection } from '@/entities/all';
import { supabase } from '@/lib/supabaseClient';
import { toast } from '@/components/ui/use-toast';
import { normalizeBlueskyHandle, connectionErrorMessage } from '@/lib/socialMedia';

// Connections modal: manages per-member platform credentials.
//
// Decision D8: Bluesky is the only platform Geck Inspect posts to for
// you. It uses an app password (no OAuth), saved through the
// set-platform-connection edge function, which checks the login with
// Bluesky and encrypts it at rest.
//
// Facebook and Instagram direct posting stays off until Meta's App
// Review passes, and Reddit with it; those platforms are copy-out in the
// composer. The meta-oauth-* and reddit-oauth-* functions are kept for
// when that changes. Any rows a member already has for them still show
// here so they can be removed.
export default function ConnectionsModal({ open, onOpenChange, user }) {
  const [connections, setConnections] = useState([]);
  const [handle, setHandle] = useState('');
  const [appPassword, setAppPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  const bluesky = connections.find((r) => r.platform === 'bluesky' && r.is_active);
  const otherRows = connections.filter((r) => r.platform !== 'bluesky' && r.is_active);

  const load = async () => {
    if (!user?.auth_user_id) return;
    setLoading(true);
    try {
      const rows = await SocialPlatformConnection.filter({ user_id: user.auth_user_id });
      setConnections(rows || []);
      const b = (rows || []).find((r) => r.platform === 'bluesky' && r.is_active);
      if (b) setHandle(b.account_handle || '');
    } catch (e) {
      console.warn('connections load failed', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) load();
  }, [open, user?.auth_user_id]);

  const handleSaveBluesky = async () => {
    const cleanHandle = normalizeBlueskyHandle(handle);
    if (!cleanHandle || !appPassword.trim()) {
      toast({ title: 'Enter your Bluesky handle and an app password.' });
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('set-platform-connection', {
        body: {
          platform: 'bluesky',
          account_handle: cleanHandle,
          access_token: appPassword.trim(),
        },
      });
      let code = data?.error || null;
      if (error) {
        try {
          const ctx = error.context;
          const parsed = ctx && typeof ctx.json === 'function' ? await ctx.json() : null;
          code = parsed?.error || 'unknown';
        } catch {
          code = 'unknown';
        }
      }
      if (code) {
        toast({ title: 'Bluesky not connected', description: connectionErrorMessage(code) });
        return;
      }
      setAppPassword('');
      await load();
      toast({ title: 'Bluesky connected', description: 'Your posts can now go straight to Bluesky.' });
    } catch (e) {
      console.warn('bluesky connect failed', e);
      toast({ title: 'Bluesky not connected', description: connectionErrorMessage('unknown') });
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async (row, niceName) => {
    if (!row) return;
    if (!confirm(`Disconnect ${niceName}? You can reconnect anytime.`)) return;
    try {
      await SocialPlatformConnection.delete(row.id);
      await load();
      toast({ title: `${niceName} disconnected.` });
    } catch (e) {
      console.warn('disconnect failed', e);
      toast({ title: 'Could not disconnect', description: 'Please try again.' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Cloud className="w-5 h-5 text-emerald-400" />
            Platform connections
          </DialogTitle>
          <DialogDescription>
            Connect Bluesky and we post for you. For every other platform, we copy your post and
            open that platform so you can paste it. Copies are free and never use a post.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Bluesky card */}
          <div className="rounded-lg border border-emerald-800/40 bg-emerald-950/30 p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="font-semibold text-emerald-100 flex items-center gap-2">
                  Bluesky
                  {bluesky && (
                    <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-200 font-bold">
                      <Check className="inline w-3 h-3 mr-0.5" />
                      Connected
                    </span>
                  )}
                </div>
                {bluesky && (
                  <div className="text-xs text-emerald-200/70 mt-0.5">
                    @{bluesky.account_handle}
                  </div>
                )}
              </div>
              {bluesky && (
                <Button size="sm" variant="ghost" onClick={() => handleDisconnect(bluesky, 'Bluesky')}>
                  <Trash2 className="w-3.5 h-3.5 mr-1" />
                  Disconnect
                </Button>
              )}
            </div>

            {!bluesky && (
              <div className="space-y-3">
                <div>
                  <Label className="text-xs">Handle</Label>
                  <Input
                    value={handle}
                    onChange={(e) => setHandle(e.target.value)}
                    placeholder="yourhandle.bsky.social"
                    className="text-sm"
                    autoCapitalize="none"
                    autoCorrect="off"
                  />
                </div>
                <div>
                  <Label className="text-xs">App password</Label>
                  <Input
                    type="password"
                    value={appPassword}
                    onChange={(e) => setAppPassword(e.target.value)}
                    placeholder="xxxx-xxxx-xxxx-xxxx"
                    className="text-sm font-mono"
                  />
                  <p className="text-xs text-emerald-200/60 mt-1">
                    Make one in Bluesky at{' '}
                    <a
                      href="https://bsky.app/settings/app-passwords"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-300 underline inline-flex items-center gap-0.5"
                    >
                      Settings, Privacy and security, App passwords
                      <ExternalLink className="w-3 h-3" />
                    </a>
                    . Do not use your main Bluesky password. You can revoke an app password at any time.
                  </p>
                </div>
                <Button
                  onClick={handleSaveBluesky}
                  disabled={saving || loading}
                  className="bg-emerald-600 hover:bg-emerald-500"
                >
                  {saving ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Checking with Bluesky…</> : 'Connect Bluesky'}
                </Button>
              </div>
            )}
          </div>

          {/* Copy-out platforms */}
          <div className="rounded-lg border border-emerald-900/40 bg-emerald-950/20 p-3 text-sm text-emerald-200/70">
            <div className="flex items-center gap-2 font-medium text-emerald-100">
              <Copy className="w-4 h-4" />
              Facebook, Instagram, Threads, X, TikTok, YouTube, Reddit
            </div>
            <div className="text-xs mt-1 text-emerald-200/60 leading-relaxed">
              Pick any of these in the composer and we copy your post, then open the platform so you
              can paste it and add your photos. Nothing to connect, and copies never use a post.
              Posting straight to Facebook and Instagram needs approval from Meta, so it is not
              available yet.
            </div>
          </div>

          {/* Older connections from before Promote went Bluesky-only.
              Shown so a member can remove them; they are not used. */}
          {otherRows.length > 0 && (
            <div className="rounded-lg border border-emerald-900/40 bg-emerald-950/20 p-3 space-y-2">
              <div className="text-xs text-emerald-200/60">
                Older connections we no longer post to. You can remove them.
              </div>
              {otherRows.map((c) => (
                <div key={c.id} className="flex items-center justify-between text-sm rounded bg-emerald-900/30 px-2 py-1.5">
                  <span className="text-emerald-100">{c.account_handle}</span>
                  <Button size="sm" className="touch:min-w-11" variant="ghost" onClick={() => handleDisconnect(c, c.account_handle)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
