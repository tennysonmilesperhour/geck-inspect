import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Check, Trash2, ExternalLink, Loader2, Cloud } from 'lucide-react';
import { SocialPlatformConnection } from '@/entities/all';
import { toast } from '@/components/ui/use-toast';

// Connections modal — manages per-user platform credentials. v1 ships
// Bluesky (app-password auth) only; other direct integrations land in
// later phases.
//
// Bluesky note: app passwords are NOT the user's main login password.
// They generate a per-app password at https://bsky.app/settings/app-passwords
// and paste it here. We store it in social_platform_connections.access_token
// alongside their handle. See wrap-up notes for the encryption-at-rest
// follow-up.
export default function ConnectionsModal({ open, onOpenChange, user }) {
  const [bluesky, setBluesky] = useState(null);
  const [handle, setHandle] = useState('');
  const [appPassword, setAppPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const rows = await SocialPlatformConnection.filter({ user_id: user.id });
      const b = rows.find((r) => r.platform === 'bluesky' && r.is_active);
      setBluesky(b || null);
      if (b) setHandle(b.account_handle || '');
    } catch (e) {
      console.warn('connections load failed', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) load();
  }, [open, user?.id]);

  const handleSave = async () => {
    if (!handle.trim() || !appPassword.trim()) {
      toast({ title: 'Both handle and app password required.' });
      return;
    }
    setSaving(true);
    try {
      if (bluesky) {
        await SocialPlatformConnection.update(bluesky.id, {
          account_handle: handle.trim(),
          access_token: appPassword.trim(),
          is_active: true,
        });
      } else {
        await SocialPlatformConnection.create({
          user_id: user.id,
          platform: 'bluesky',
          account_handle: handle.trim(),
          access_token: appPassword.trim(),
          is_active: true,
        });
      }
      setAppPassword('');
      await load();
      toast({ title: 'Bluesky connected', description: 'Direct posting is now active.' });
    } catch (e) {
      toast({ title: 'Save failed', description: String(e?.message || e) });
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async () => {
    if (!bluesky) return;
    if (!confirm('Disconnect Bluesky? You can reconnect anytime.')) return;
    try {
      await SocialPlatformConnection.update(bluesky.id, { is_active: false });
      setBluesky(null);
      setHandle('');
      setAppPassword('');
      toast({ title: 'Bluesky disconnected.' });
    } catch (e) {
      toast({ title: 'Disconnect failed', description: String(e?.message || e) });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Cloud className="w-5 h-5 text-emerald-400" />
            Platform connections
          </DialogTitle>
          <DialogDescription>
            Connect a platform to enable direct posting. Anything not connected here is published
            via copy-to-clipboard with a deep link to the platform's compose page.
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
                <Button size="sm" variant="ghost" onClick={handleDisconnect}>
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
                    Generate one at{' '}
                    <a
                      href="https://bsky.app/settings/app-passwords"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-300 underline inline-flex items-center gap-0.5"
                    >
                      bsky.app/settings/app-passwords
                      <ExternalLink className="w-3 h-3" />
                    </a>
                    . This is NOT your main Bluesky password.
                  </p>
                </div>
                <Button
                  onClick={handleSave}
                  disabled={saving || loading}
                  className="bg-emerald-600 hover:bg-emerald-500"
                >
                  {saving ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Saving…</> : 'Connect Bluesky'}
                </Button>
              </div>
            )}
          </div>

          {/* Other platforms — coming soon */}
          {['Threads', 'Reddit', 'Facebook Page'].map((name) => (
            <div
              key={name}
              className="rounded-lg border border-emerald-900/40 bg-emerald-950/20 p-3 text-sm text-emerald-200/60"
            >
              <div className="flex items-center justify-between">
                <span>{name}</span>
                <span className="text-xs">Direct posting in v2 · copy-to-clipboard works now</span>
              </div>
            </div>
          ))}

          <div className="rounded-lg border border-emerald-900/40 bg-emerald-950/20 p-3 text-sm text-emerald-200/60">
            <div className="flex items-center justify-between">
              <span>Instagram, X, TikTok, YouTube</span>
              <span className="text-xs">Copy-to-clipboard with deep links</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
